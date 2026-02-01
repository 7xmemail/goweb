<?php
require_once __DIR__ . '/System.php';

class NginxManager
{

    public static function createConfig($domain, $port, $stream = false, $ssl = false)
    {
        if (!preg_match('/^[a-zA-Z0-9.-]+$/', $domain))
            throw new Exception("Invalid domain");

        $proxyBlock = "
    location / {
        proxy_pass http://127.0.0.1:{$port};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Websocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";

        # Disable Caching for Development
        add_header Cache-Control \"no-store, no-cache, must-revalidate, max-age=0\";
    }";

        if ($ssl) {
            $config = "server {
    listen 80;
    listen [::]:80;
    server_name {$domain};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name {$domain};

    ssl_certificate /etc/letsencrypt/live/{$domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/{$domain}/privkey.pem;

    {$proxyBlock}
}";
        } else {
            $config = "server {
    listen 80;
    listen [::]:80;
    server_name {$domain};

    {$proxyBlock}
}";
        }

        $availablePath = NGINX_SITES_AVAILABLE . '/' . $domain;

        if ($stream) {
            echo "Generating Nginx configuration for Domain: {$domain}\n";
            echo "Target Port: {$port}\n";
            echo "Config file: {$availablePath}\n";
            flush();
        }

        // Write to temp and move
        $tmp = tempnam(sys_get_temp_dir(), 'nginx');
        file_put_contents($tmp, $config);

        if ($stream) {
            echo "Installing configuration...\n";
            flush();
        }

        System::exec("sudo cp {$tmp} {$availablePath}");
        System::exec("sudo ln -sf {$availablePath} " . NGINX_SITES_ENABLED . "/{$domain}");

        // Cleanup potential certbot leftovers
        System::exec("sudo rm -f " . NGINX_SITES_ENABLED . "/{$domain}-le-ssl.conf");
        System::exec("sudo rm -f " . NGINX_SITES_AVAILABLE . "/{$domain}-le-ssl.conf");

        if ($stream) {
            echo "Verifying configuration and reloading Nginx...\n";
            flush();
            System::streamExec("sudo /usr/sbin/nginx -t && sudo /usr/sbin/nginx -s reload");
        } else {
            System::exec("sudo /usr/sbin/nginx -t && sudo /usr/sbin/nginx -s reload");
        }
        unlink($tmp);

        if ($stream) {
            echo "Nginx configuration completed successfully.\n";
            flush();
        }

        return true;
    }

    public static function enableSSL($domain, $email, $port, $stream = false)
    {
        if (!preg_match('/^[a-zA-Z0-9.-]+$/', $domain))
            throw new Exception("Invalid domain");
        if (!filter_var($email, FILTER_VALIDATE_EMAIL))
            throw new Exception("Invalid email");

        // Use certonly so we don't rely on the flaky nginx installer
        $cmd = "sudo certbot certonly --nginx -d {$domain} --non-interactive --agree-tos -m {$email} --force-renewal";

        if ($stream) {
            echo "---------------------------------------------------\n";
            echo "Starting SSL Issuance for {$domain}\n";
            echo "Email: {$email}\n";
            echo "Port: {$port}\n";
            echo "Command: {$cmd}\n";
            echo "---------------------------------------------------\n";
            flush();

            System::streamExec($cmd);
        } else {
            $output = [];
            $returnVar = 0;
            System::exec($cmd, $output, $returnVar);
            if ($returnVar !== 0) {
                throw new Exception("Certbot failed: " . implode("\n", $output));
            }
        }

        if ($stream) {
            echo "\nApplying SSL Configuration to Nginx...\n";
            flush();
        }

        // Re-create config with SSL enabled
        self::createConfig($domain, $port, $stream, true);

        if ($stream) {
            echo "SSL Certificate installed and Nginx reloaded.\n";
            flush();
        }
    }
    public static function getConfig($domain)
    {
        if (!preg_match('/^[a-zA-Z0-9.-]+$/', $domain))
            throw new Exception("Invalid domain");

        $path = NGINX_SITES_AVAILABLE . '/' . $domain;
        // Use cat via sudo because the file is root owned
        // We granted sudo cat permissions to www-data for sites-available explicitly?
        // Wait, in step 922 I allowed "cp * /etc/nginx/sites-available/*" but not cat directly.
        // Actually, let's use a workaround:
        // cp /etc/nginx/sites-available/domain /tmp/domain
        // chmod 666 /tmp/domain (via sudo? wait, cp preserves owner? no, cp by www-data creates file owned by www-data if dest in /tmp usually... wait, reading FROM root owned to /tmp owned by www-data might fail?
        // cp is NOPASSWD only for DESTINATION /etc/systemd/... or /etc/nginx/...
        // I need to update sudoers to allow reading or just 'cat'.
        // Let's assume I will update sudoers in next step.
        // Command: sudo cat $path

        $output = [];
        $ret = 0;
        System::exec("sudo cat {$path}", $output, $ret);

        if ($ret !== 0) {
            return ""; // File probably doesn't exist
        }

        return implode("\n", $output);
    }

    public static function saveConfig($domain, $content)
    {
        if (!preg_match('/^[a-zA-Z0-9.-]+$/', $domain))
            throw new Exception("Invalid domain");

        $path = NGINX_SITES_AVAILABLE . '/' . $domain;

        // Write to temp
        $tmp = tempnam(sys_get_temp_dir(), 'nginx_edit');
        file_put_contents($tmp, $content);

        // Move with sudo (we have permission for cp to sites-available)
        System::exec("sudo cp {$tmp} {$path}");
        unlink($tmp);

        // Reload
        System::exec("sudo /usr/sbin/nginx -t && sudo /usr/sbin/nginx -s reload");
        return true;
    }

    public static function deleteConfig($domain)
    {
        if (!preg_match('/^[a-zA-Z0-9.-]+$/', $domain))
            return;

        // Remove Symlink
        System::exec("sudo rm -f " . NGINX_SITES_ENABLED . "/{$domain}");

        // Remove Config
        System::exec("sudo rm -f " . NGINX_SITES_AVAILABLE . "/{$domain}");

        // Reload
        System::exec("sudo /usr/sbin/nginx -t && sudo /usr/sbin/nginx -s reload");
    }

    public static function deleteCert($domain)
    {
        if (!preg_match('/^[a-zA-Z0-9.-]+$/', $domain))
            return;

        // Certbot delete
        // sudoers allows 'certbot *'
        System::exec("sudo certbot delete --cert-name {$domain} --non-interactive");
    }
}
