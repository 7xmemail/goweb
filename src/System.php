<?php

class System
{

    /**
     * pattern for valid app names (alphanumeric, dashes)
     */
    const VALID_NAME_REGEX = '/^[a-zA-Z0-9-]+$/';

    /**
     * Execute a command safely.
     * In a real environment, important commands need sudo.
     * We assume specific sudoers rules are set up.
     */
    public static function exec($command, &$output = null, &$return_var = null)
    {
        // Logging could go here
        return exec($command, $output, $return_var);
    }

    public static function createService($appName, $binaryPath, $envVars = [], $port = 8080)
    {
        if (!preg_match(self::VALID_NAME_REGEX, $appName)) {
            throw new Exception("Invalid app name.");
        }

        $serviceFile = "/etc/systemd/system/go-{$appName}.service";

        $envString = "";
        foreach ($envVars as $k => $v) {
            $envString .= "Environment=\"{$k}={$v}\"\n";
        }

        $content = "[Unit]
Description=Go App {$appName}
After=network.target

[Service]
User=root
Group=root
WorkingDirectory=" . dirname($binaryPath) . "
ExecStart={$binaryPath}
Restart=always
{$envString}

[Install]
WantedBy=multi-user.target
";

        // Write to temp file first then sudo cp
        $tmp = tempnam(sys_get_temp_dir(), 'svc');
        file_put_contents($tmp, $content);

        // Move file (requires sudo if web user doesn't have write access to /etc/systemd/system)
        // We will assume the php user has passwordless sudo for specific commands
        // or we use a helper script. For now, let's try direct sudo cp.
        self::exec("sudo cp {$tmp} {$serviceFile}");
        self::exec("sudo chmod 644 {$serviceFile}");
        self::exec("sudo systemctl daemon-reload");
        self::exec("sudo systemctl enable go-{$appName}");
        unlink($tmp);

        return true;
    }

    public static function startService($appName)
    {
        if (!preg_match(self::VALID_NAME_REGEX, $appName))
            throw new Exception("Invalid app name.");
        self::exec("sudo systemctl start go-{$appName}");
    }

    public static function stopService($appName)
    {
        if (!preg_match(self::VALID_NAME_REGEX, $appName))
            throw new Exception("Invalid app name.");
        self::exec("sudo systemctl stop go-{$appName}");
    }

    public static function restartService($appName)
    {
        if (!preg_match(self::VALID_NAME_REGEX, $appName))
            throw new Exception("Invalid app name.");
        self::exec("sudo systemctl restart go-{$appName}");
    }

    public static function deleteService($appName)
    {
        if (!preg_match(self::VALID_NAME_REGEX, $appName))
            throw new Exception("Invalid app name.");
        self::stopService($appName);
        self::exec("sudo systemctl disable go-{$appName}");
        self::exec("sudo rm /etc/systemd/system/go-{$appName}.service");
        self::exec("sudo systemctl daemon-reload");
    }

    public static function getServiceStatus($appName)
    {
        if (!preg_match(self::VALID_NAME_REGEX, $appName))
            return 'unknown';
        $output = [];
        self::exec("systemctl is-active go-{$appName}", $output);
        return trim(implode("\n", $output));
    }
}
