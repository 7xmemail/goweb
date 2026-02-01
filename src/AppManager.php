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
                $apps[] = [
                    'name' => $dir,
                    'status' => $status,
                    'path' => $this->appsDir . '/' . $dir
                ];
            }
        }
        return $apps;
    }

    public function createApp($name, $fileUpload = null, $gitRepo = null, $port = 8080, $envVars = [])
    {
        if (!preg_match(System::VALID_NAME_REGEX, $name)) {
            throw new Exception("Invalid app name");
        }

        $appPath = $this->appsDir . '/' . $name;
        if (is_dir($appPath)) {
            throw new Exception("App already exists");
        }

        // Create directory (needs permission or sudo)
        // Since we are PHP user, we might need to rely on System::exec with sudo for mkdir if /var/go-apps is root owned
        // Ideally /var/go-apps is owned by www-data or a dedicated group
        if (!mkdir($appPath, 0755, true)) {
            // Fallback to sudo if direct mkdir fails
            System::exec("sudo mkdir -p {$appPath}");
            System::exec("sudo chown www-data:www-data {$appPath}");
        }

        $binaryName = 'app';

        if ($fileUpload) {
            move_uploaded_file($fileUpload['tmp_name'], $appPath . '/' . $binaryName);
            chmod($appPath . '/' . $binaryName, 0755);
        } elseif ($gitRepo) {
            // Git clone and build
            System::exec("cd {$appPath} && git clone {$gitRepo} .");
            // Assume 'go build -o app' works
            System::exec("cd {$appPath} && /usr/local/go/bin/go build -o {$binaryName}");
        } else {
            throw new Exception("No file or git repo provided");
        }

        // Create Systemd Service
        System::createService($name, $appPath . '/' . $binaryName, $envVars, $port);
        System::startService($name);

        return true;
    }

    public function deleteApp($name)
    {
        if (!preg_match(System::VALID_NAME_REGEX, $name))
            throw new Exception("Invalid app name");

        System::deleteService($name);

        $appPath = $this->appsDir . '/' . $name;
        // Recursive delete
        System::exec("sudo rm -rf {$appPath}");

        return true;
    }
}
