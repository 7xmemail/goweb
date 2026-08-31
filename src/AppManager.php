<?php
require_once __DIR__ . '/System.php';

class AppManager
{

    private const FIRST_APP_PORT = 1001;
    private const LAST_APP_PORT = 65535;

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
        usort($apps, function ($left, $right) {
            $portOrder = ((int) $left['port']) <=> ((int) $right['port']);
            return $portOrder !== 0 ? $portOrder : strcasecmp($left['name'], $right['name']);
        });

        return $apps;
    }

    public function getNextAvailablePort()
    {
        $usedPorts = array_flip($this->getUsedPorts());

        for ($port = self::FIRST_APP_PORT; $port <= self::LAST_APP_PORT; $port++) {
            if (!isset($usedPorts[$port]) && !$this->isTcpPortInUse($port)) {
                return $port;
            }
        }

        throw new Exception('No available application ports');
    }

    public function assertPortAvailable($port, $excludeApp = null)
    {
        $port = $this->validatePort($port);

        if (in_array($port, $this->getUsedPorts($excludeApp), true)) {
            throw new Exception("Port {$port} is already assigned to another application");
        }

        if ($this->isTcpPortInUse($port)) {
            $currentPort = $excludeApp === null ? null : $this->getAssignedPort($excludeApp);
            if ($currentPort !== $port) {
                throw new Exception("Port {$port} is already in use on this server");
            }
        }

        return $port;
    }

    private function validatePort($port)
    {
        $port = filter_var($port, FILTER_VALIDATE_INT, [
            'options' => ['min_range' => self::FIRST_APP_PORT, 'max_range' => self::LAST_APP_PORT]
        ]);

        if ($port === false) {
            throw new Exception('Port must be a number between 1001 and 65535');
        }

        return $port;
    }

    private function getUsedPorts($excludeApp = null)
    {
        $ports = [];

        if (!is_dir($this->appsDir)) {
            return $ports;
        }

        foreach (scandir($this->appsDir) as $appName) {
            if ($appName === '.' || $appName === '..' || $appName === $excludeApp) {
                continue;
            }

            $metadataFile = $this->appsDir . '/' . $appName . '/metadata.json';
            if (!is_file($metadataFile)) {
                continue;
            }

            $metadata = json_decode(file_get_contents($metadataFile), true);
            if (isset($metadata['port']) && is_numeric($metadata['port'])) {
                $ports[] = (int) $metadata['port'];
            }
        }

        return array_values(array_unique($ports));
    }

    private function getAssignedPort($appName)
    {
        $metadataFile = $this->appsDir . '/' . $appName . '/metadata.json';
        if (!is_file($metadataFile)) {
            return null;
        }

        $metadata = json_decode(file_get_contents($metadataFile), true);
        return isset($metadata['port']) ? (int) $metadata['port'] : null;
    }

    private function isTcpPortInUse($port)
    {
        $connection = @fsockopen('127.0.0.1', $port, $errorCode, $errorMessage, 0.1);
        if ($connection === false) {
            return false;
        }

        fclose($connection);
        return true;
    }

    private function acquirePortLock()
    {
        $lock = fopen($this->appsDir . '/.ports.lock', 'c');
        if ($lock === false || !flock($lock, LOCK_EX)) {
            throw new Exception('Could not reserve an application port');
        }

        return $lock;
    }

    private function releasePortLock($lock)
    {
        flock($lock, LOCK_UN);
        fclose($lock);
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

        $portLock = $this->acquirePortLock();
        try {
            if (is_dir($appPath)) {
                throw new Exception("App already exists");
            }

            $port = $this->assertPortAvailable($port);

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
        } finally {
            $this->releasePortLock($portLock);
        }
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
        $binaryPath = $appPath . '/' . $binaryName;

        // Check for main.go to rebuild (Support for source uploads)
        if (file_exists($appPath . '/main.go')) {
            $cacheRoot = $appPath . '/.goweb-cache';
            $logDir = $appPath . '/.goweb-deployments';
            if (!is_dir($cacheRoot) && !mkdir($cacheRoot, 0750, true)) throw new Exception('Could not create app cache');
            if (!is_dir($logDir) && !mkdir($logDir, 0750, true)) throw new Exception('Could not create deployment log directory');
            foreach (['gopath', 'build', 'modules', 'tmp'] as $directory) {
                if (!is_dir($cacheRoot . '/' . $directory)) mkdir($cacheRoot . '/' . $directory, 0750, true);
            }

            $logFile = $logDir . '/deployment-' . date('Ymd-His') . '.log';
            file_put_contents($logFile, "GoWeb deployment: {$name}\nStarted: " . date(DATE_ATOM) . "\n\n");
            $goEnv = sprintf(
                'export GOPATH=%s GOCACHE=%s GOMODCACHE=%s GOTMPDIR=%s GOTOOLCHAIN=auto GOPROXY=https://proxy.golang.org,direct GOSUMDB=sum.golang.org',
                escapeshellarg($cacheRoot . '/gopath'), escapeshellarg($cacheRoot . '/build'),
                escapeshellarg($cacheRoot . '/modules'), escapeshellarg($cacheRoot . '/tmp')
            );
            $run = function ($label, $command) use ($stream, $logFile) {
                $heading = "\n==> {$label}\n";
                file_put_contents($logFile, $heading, FILE_APPEND);
                if ($stream) { echo $heading; flush(); }
                if ($stream) return System::streamExec($command, $logFile);
                $output = [];
                System::exec($command . ' 2>&1', $output, $status);
                file_put_contents($logFile, implode("\n", $output) . "\n", FILE_APPEND);
                return $status;
            };
            $workingDirectory = escapeshellarg($appPath);

            // Check for go.mod
            if (!file_exists($appPath . '/go.mod')) {
                if ($stream) {
                    echo "Initializing Go module...\n";
                    flush();
                }
                // Initialize go.mod if missing
                if ($run('Initialize module', "{$goEnv} && cd {$workingDirectory} && /usr/bin/go mod init " . escapeshellarg($name)) !== 0) {
                    return $this->deploymentFailure($stream, $logFile, 'Could not initialize go.mod');
                }
            }
            if ($run('Detect and download the required Go toolchain', "{$goEnv} && cd {$workingDirectory} && /usr/bin/go version && /usr/bin/go env GOVERSION GOTOOLCHAIN") !== 0) return $this->deploymentFailure($stream, $logFile, 'Go toolchain setup failed');
            if ($run('Resolve imported modules', "{$goEnv} && cd {$workingDirectory} && /usr/bin/go mod tidy -v") !== 0) return $this->deploymentFailure($stream, $logFile, 'Dependency resolution failed');
            if ($run('Verify downloaded modules', "{$goEnv} && cd {$workingDirectory} && /usr/bin/go mod verify") !== 0) return $this->deploymentFailure($stream, $logFile, 'Module verification failed');

            $nextBinary = $binaryPath . '.next';
            @unlink($nextBinary);
            if ($run('Build optimized application', "{$goEnv} && cd {$workingDirectory} && /usr/bin/go build -trimpath -buildvcs=false -o " . escapeshellarg($nextBinary) . ' .') !== 0 || !is_file($nextBinary)) {
                @unlink($nextBinary);
                return $this->deploymentFailure($stream, $logFile, 'Build failed; the previous app remains untouched');
            }
            chmod($nextBinary, 0755);
            $previousBinary = $binaryPath . '.previous';
            if (is_file($binaryPath) && !copy($binaryPath, $previousBinary)) {
                @unlink($nextBinary);
                return $this->deploymentFailure($stream, $logFile, 'Could not create a rollback copy of the current executable');
            }
            if (!rename($nextBinary, $binaryPath)) return $this->deploymentFailure($stream, $logFile, 'Could not activate the new executable');
            file_put_contents($logFile, "\nBuild completed and executable replaced atomically.\n", FILE_APPEND);
        }

        if ($stream) {
            echo "Restarting Systemd service...\n";
            flush();
        }
        System::restartService($name);

        if (System::getServiceStatus($name) !== 'active') {
            if (isset($previousBinary) && is_file($previousBinary)) {
                copy($previousBinary, $binaryPath);
                chmod($binaryPath, 0755);
                System::restartService($name);
                file_put_contents($logFile, "\nNew executable failed to start. Previous executable restored.\n", FILE_APPEND);
            }
            if (isset($logFile)) return $this->deploymentFailure($stream, $logFile, 'Service did not become active; the previous executable was restored');
            throw new Exception('Service did not become active; check runtime logs');
        }

        if ($stream) {
            echo "App restarted successfully.\n[DEPLOYMENT SUCCEEDED]\n";
            flush();
        }
        if (isset($logFile)) {
            file_put_contents($logFile, "\nCompleted: " . date(DATE_ATOM) . "\n[DEPLOYMENT SUCCEEDED]\n", FILE_APPEND);
            @copy($logFile, dirname($logFile) . '/latest.log');
        }
        if (isset($previousBinary)) @unlink($previousBinary);
        return true;
    }

    private function deploymentFailure($stream, $logFile, $message)
    {
        $output = "\n{$message}\nDetailed log: {$logFile}\n[DEPLOYMENT FAILED]\n";
        file_put_contents($logFile, $output, FILE_APPEND);
        @copy($logFile, dirname($logFile) . '/latest.log');
        if ($stream) { echo $output; flush(); return false; }
        throw new Exception($message . '. Detailed log: ' . $logFile);
    }

    public function deleteApp($name)
    {
        if (!preg_match(System::VALID_NAME_REGEX, $name))
            throw new Exception("Invalid app name");

        // 1. Get Domain from Metadata for Cleanup
        $appPath = $this->appsDir . '/' . $name;
        $metaFile = $appPath . '/metadata.json';
        $domain = '';
        $port = null;
        if (file_exists($metaFile)) {
            $meta = json_decode(file_get_contents($metaFile), true);
            $domain = $meta['domain'] ?? '';
            $port = isset($meta['port']) ? (int) $meta['port'] : null;
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

        // 4. Remove the application, its build/module caches and deployment logs.
        $this->deleteDirectory($appPath);
        if (is_dir($appPath)) throw new Exception('Application files could not be completely removed');

        return ['name' => $name, 'port' => $port];
    }

    private function deleteDirectory($path)
    {
        if (!is_dir($path)) return;
        // Go makes downloaded module-cache directories read-only. Restore owner
        // write permission first so the panel can remove its own private cache.
        $directories = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );
        foreach ($directories as $item) {
            if ($item->isDir() && !$item->isLink()) @chmod($item->getPathname(), 0750);
        }
        @chmod($path, 0750);
        $items = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($items as $item) {
            if ($item->isLink() || $item->isFile()) {
                if (!@unlink($item->getPathname())) throw new Exception('Could not delete ' . $item->getFilename());
            } elseif (!@rmdir($item->getPathname())) {
                throw new Exception('Could not remove directory ' . $item->getFilename());
            }
        }
        if (!@rmdir($path)) throw new Exception('Could not remove application directory');
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

        $portLock = $this->acquirePortLock();
        try {
            $port = $this->assertPortAvailable($port, $name);

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

        // Update Metadata without dropping the existing domain, email, or creation date.
        $metadataFile = $appPath . '/metadata.json';
        $metadata = is_file($metadataFile)
            ? (json_decode(file_get_contents($metadataFile), true) ?: [])
            : [];
        $metadata = array_merge($metadata, [
            'port' => $port,
            'env' => $envVars,
            'created_at' => $metadata['created_at'] ?? time(),
            'updated_at' => time()
        ]);
        file_put_contents($metadataFile, json_encode($metadata));

            return true;
        } finally {
            $this->releasePortLock($portLock);
        }
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

    public function domainIsAssigned($domain)
    {
        foreach ($this->listApps() as $app) {
            if (strcasecmp($app['domain'] ?? '', $domain) === 0) return true;
        }
        return false;
    }
}
