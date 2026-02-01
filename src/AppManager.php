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

    public function restartApp($name)
    {
        // Simply restart the service
        System::restartService($name);
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
