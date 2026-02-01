<?php
require_once __DIR__ . '/System.php';

class AppManager
{

    private $appsDir;

    public function __construct()
    {
        $this->appsDir = defined('APPS_DIR') ? APPS_DIR : '/var/go-apps';
    }

    public function listApps()
    {
        if (!is_dir($this->appsDir)) {
            return [];
        }
        $apps = [];
        $dirs = scandir($this->appsDir);
        foreach ($dirs as $dir) {
            if ($dir === '.' || $dir === '..')
                continue;
            if (is_dir($this->appsDir . '/' . $dir)) {
                $status = System::getServiceStatus($dir);
                $metaFile = $this->appsDir . '/' . $dir . '/metadata.json';
                $port = 8080;
                $domain = '';
                $email = '';
                if (file_exists($metaFile)) {
                    $meta = json_decode(file_get_contents($metaFile), true);
                    $port = $meta['port'] ?? 8080;
                    $domain = $meta['domain'] ?? '';
                    $email = $meta['email'] ?? '';
                }

                $apps[] = [
                    'name' => $dir,
                    'status' => $status,
                    'path' => $this->appsDir . '/' . $dir,
                    'port' => $port,
                    'domain' => $domain,
                    'email' => $email
                ];
            }
        }
        return $apps;
    }

    public function createApp($name, $fileUpload = null, $createEmpty = false, $port = 8080, $envVars = [])
    {
        if (!preg_match(System::VALID_NAME_REGEX, $name)) {
            throw new Exception("Invalid app name");
        }

        $appPath = $this->appsDir . '/' . $name;
        if (is_dir($appPath)) {
            throw new Exception("App already exists");
        }

        // Create directory
        if (!@mkdir($appPath, 0755, true)) {
            System::exec("sudo mkdir -p {$appPath}");
            System::exec("sudo chown www-data:www-data {$appPath}");
        }

        $binaryName = 'app';

        if ($fileUpload) {
            move_uploaded_file($fileUpload['tmp_name'], $appPath . '/' . $binaryName);
            chmod($appPath . '/' . $binaryName, 0755);
        } elseif ($createEmpty) {
            // Empty app mode: No binary yet
            // We just create the structure
        } else {
            throw new Exception("No file provided");
        }

        // Create Systemd Service
        // Note: If empty, the service will point to a non-existent binary initially.
        // User must upload 'app' binary later.
        System::createService($name, $appPath . '/' . $binaryName, $envVars, $port);

        // Only start if we uploaded a file
        if ($fileUpload) {
            System::startService($name);
        }

        // Save Metadata
        file_put_contents($appPath . '/metadata.json', json_encode([
            'port' => $port,
            'env' => $envVars,
            'created_at' => time()
        ]));

        return true;
    }

    public function restartApp($name, $stream = false)
    {
        if (!preg_match(System::VALID_NAME_REGEX, $name)) {
            throw new Exception("Invalid app name");
        }

        $appPath = $this->appsDir . '/' . $name;
        if (!is_dir($appPath))
            throw new Exception("App not found");

        $binaryName = 'app';

        // Check for main.go to rebuild (Support for source uploads)
        if (file_exists($appPath . '/main.go')) {
            if ($stream) {
                echo "Stopping service to release binary...\n";
                flush();
            }
            // Ignore stop errors
            try {
                System::stopService($name);
            } catch (Exception $e) {
            }

            // Force remove old binary to ensure we don't run stale code
            if (file_exists($appPath . '/' . $binaryName)) {
                if ($stream) {
                    echo "Removing old binary to force rebuild...\n";
                    flush();
                }
                @unlink($appPath . '/' . $binaryName);
            }

            // Setup Go Env with writable cache and GOPATH
            // Use /tmp which is writable by www-data
            $goEnv = "export GOPATH=/tmp/go && export GOCACHE=/tmp/go-build-cache && export GOMODCACHE=/tmp/go-mod-cache && mkdir -p /tmp/go /tmp/go-build-cache /tmp/go-mod-cache";

            // Check for go.mod
            if (!file_exists($appPath . '/go.mod')) {
                if ($stream) {
                    echo "Initializing Go module...\n";
                    flush();
                }
                // Initialize go.mod if missing
                System::streamExec("{$goEnv} && cd {$appPath} && /usr/bin/go mod init {$name}");
            }

            // Explicitly download deps
            if ($stream) {
                echo "Resolving dependencies (go get)...\n";
                flush();
                System::streamExec("{$goEnv} && cd {$appPath} && /usr/bin/go get -d ./...");
            } else {
                System::exec("{$goEnv} && cd {$appPath} && /usr/bin/go get -d ./...");
            }

            // Tidy deps
            if ($stream) {
                echo "Tidying dependencies...\n";
                flush();
                System::streamExec("{$goEnv} && cd {$appPath} && /usr/bin/go mod tidy");
            } else {
                System::exec("{$goEnv} && cd {$appPath} && /usr/bin/go mod tidy");
            }

            if ($stream) {
                echo "Building application... (this may take a moment)\n";
                flush();
            }

            $cmd = "{$goEnv} && cd {$appPath} && /usr/bin/go build -o {$binaryName} 2>&1";

            $buildSuccess = false;
            if ($stream) {
                System::streamExec($cmd);
                if (file_exists($appPath . '/' . $binaryName)) {
                    chmod($appPath . '/' . $binaryName, 0755);
                    echo "Build successful.\n";
                    $buildSuccess = true;
                } else {
                    echo "Build FAILED: Binary not created.\n";
                }
                flush();
            } else {
                $output = [];
                $returnVar = 0;
                System::exec($cmd, $output, $returnVar);
                if ($returnVar === 0 && file_exists($appPath . '/' . $binaryName)) {
                    chmod($appPath . '/' . $binaryName, 0755);
                    $buildSuccess = true;
                } else {
                    throw new Exception("Build failed: " . implode("\n", $output));
                }
            }

            // Abort if build failed
            if (!$buildSuccess) {
                if ($stream) {
                    echo "Aborting restart due to build failure.\n";
                    flush();
                }
                return false;
            }
        }

        if ($stream) {
            echo "Restarting Systemd service...\n";
            flush();
        }
        System::restartService($name);

        if ($stream) {
            echo "App restarted successfully.\n";
            flush();
        }
        return true;
    }

    public function deleteApp($name)
    {
        if (!preg_match(System::VALID_NAME_REGEX, $name))
            throw new Exception("Invalid app name");

        // 1. Get Domain from Metadata for Cleanup
        $appPath = $this->appsDir . '/' . $name;
        $metaFile = $appPath . '/metadata.json';
        $domain = '';
        if (file_exists($metaFile)) {
            $meta = json_decode(file_get_contents($metaFile), true);
            $domain = $meta['domain'] ?? '';
        }

        // 2. Clean Service & Process
        System::deleteService($name);

        // 3. Clean Nginx & SSL
        if ($domain) {
            // Need to require NginxManager if not already loaded, but it should be via autoload or require at top
            require_once __DIR__ . '/NginxManager.php';
            NginxManager::deleteConfig($domain);
            NginxManager::deleteCert($domain);
        }

        // 4. Remove Files
        // Recursive delete
        System::exec("sudo rm -rf {$appPath}");

        return true;
    }

    public function updateApp($name, $fileUpload = null, $port = 8080, $envVars = [])
    {
        if (!preg_match(System::VALID_NAME_REGEX, $name)) {
            throw new Exception("Invalid app name");
        }

        $appPath = $this->appsDir . '/' . $name;
        if (!is_dir($appPath)) {
            throw new Exception("App not found");
        }

        try {
            System::stopService($name);
        } catch (Exception $e) {
        }

        if ($fileUpload) {
            $binaryName = 'app';
            @unlink($appPath . '/' . $binaryName);
            if (move_uploaded_file($fileUpload['tmp_name'], $appPath . '/' . $binaryName)) {
                chmod($appPath . '/' . $binaryName, 0755);
            } else {
                throw new Exception("Failed to upload binary");
            }
        }

        $binaryName = 'app';
        System::createService($name, $appPath . '/' . $binaryName, $envVars, $port);
        System::startService($name);

        // Update Metadata
        file_put_contents($appPath . '/metadata.json', json_encode([
            'port' => $port,
            'env' => $envVars,
            'created_at' => time()
        ]));

        return true;
    }

    public function saveMetadata($name, $data)
    {
        $appPath = $this->appsDir . '/' . $name;
        if (!is_dir($appPath))
            return false;

        $metaFile = $appPath . '/metadata.json';
        $current = [];
        if (file_exists($metaFile)) {
            $current = json_decode(file_get_contents($metaFile), true);
        }

        $new = array_merge($current, $data);
        file_put_contents($metaFile, json_encode($new, JSON_PRETTY_PRINT));
        return true;
    }
}
