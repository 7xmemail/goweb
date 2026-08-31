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

    /**
     * Stream command output to browser
     */
    public static function streamExec($command, $logFile = null)
    {
        while (@ob_end_flush()) ;
        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['redirect', 1]
        ];
        $process = proc_open($command, $descriptors, $pipes);
        if (!is_resource($process)) {
            throw new Exception('Could not start command');
        }

        fclose($pipes[0]);
        $log = $logFile ? @fopen($logFile, 'ab') : null;
        while (!feof($pipes[1])) {
            $chunk = fread($pipes[1], 8192);
            if ($chunk === '' || $chunk === false) {
                usleep(10000);
                continue;
            }
            echo $chunk;
            if ($log) fwrite($log, $chunk);
            flush();
        }
        fclose($pipes[1]);
        if ($log) fclose($log);
        return proc_close($process);
    }

    public static function createService($appName, $binaryPath, $envVars = [], $port = 8080)
    {
        if (!preg_match(self::VALID_NAME_REGEX, $appName)) {
            throw new Exception("Invalid app name.");
        }

        $serviceFile = "/etc/systemd/system/go-{$appName}.service";

        // PORT is the standard contract between the panel and managed apps.
        $envVars = array_merge(['PORT' => (string) $port], $envVars);
        $envString = "";
        foreach ($envVars as $k => $v) {
            $envString .= "Environment=\"{$k}={$v}\"\n";
        }

        $content = "[Unit]
Description=Go App {$appName}
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=" . dirname($binaryPath) . "
ExecStart={$binaryPath}
Restart=always
NoNewPrivileges=true
PrivateTmp=true
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
SocketBindDeny=tcp:1-1000
SocketBindDeny=udp:1-1000
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
        self::exec("sudo systemctl stop go-{$appName}");
        self::exec("sudo systemctl disable go-{$appName}");
        self::exec("sudo rm /etc/systemd/system/go-{$appName}.service");
        self::exec("sudo systemctl daemon-reload");
        self::exec("sudo systemctl reset-failed go-{$appName}");
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
