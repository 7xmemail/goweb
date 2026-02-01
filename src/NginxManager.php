<?php
require_once __DIR__ . '/System.php';

class NginxManager
{

    public static function createConfig($domain, $port)
    {
        $config = "server {
    listen 80;
    server_name {$domain};

    location / {
        proxy_pass http://127.0.0.1:{$port};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}";

        $availablePath = NGINX_SITES_AVAILABLE . '/' . $domain;

        // Write to temp and move
        $tmp = tempnam(sys_get_temp_dir(), 'nginx');
        file_put_contents($tmp, $config);

        System::exec("sudo cp {$tmp} {$availablePath}");
        System::exec("sudo ln -sf {$availablePath} " . NGINX_SITES_ENABLED . "/{$domain}");
        System::exec("sudo nginx -t && sudo systemctl reload nginx");
        unlink($tmp);

        return true;
    }

    public static function enableSSL($domain, $email)
    {
        // Runs certbot
        // Assumes certbot nginx plugin is installed
        // Non-interactive mode
        $cmd = "sudo certbot --nginx -d {$domain} --non-interactive --agree-tos -m {$email}";
        System::exec($cmd);
    }
}
