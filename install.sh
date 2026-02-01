#!/bin/bash

# Go Web App Control Panel Installer
# This script sets up the environment on a fresh Ubuntu/Debian VPS.

# 1. Check for Root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo ./install.sh)"
  exit 1
fi

echo "Starting Installation..."

# 2. Update System & Install Dependencies
echo "Updating system and installing dependencies..."
apt-get update -y
apt-get install -y nginx php-fpm php-cli php-json php-mbstring golang git certbot python3-certbot-nginx unzip jq

# 3. Configure Directories
echo "Configuring directories..."
APPS_DIR="/var/go-apps"
PANEL_DIR="/var/www/panel" # Assuming standard location, can be adjusted
# Get current directory as PANEL_DIR if we are running from inside it
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
if [ "$SCRIPT_DIR" != "$PANEL_DIR" ]; then
    echo "Note: Script running from $SCRIPT_DIR. Using this as Panel Directory."
    PANEL_DIR="$SCRIPT_DIR"
fi

mkdir -p "$APPS_DIR"
chown -R www-data:www-data "$APPS_DIR"
chown -R www-data:www-data "$PANEL_DIR"

# 4. Configure Nginx
echo "Configuring Nginx..."
NGINX_CONF="/etc/nginx/sites-available/gopanel"
cat > "$NGINX_CONF" <<EOF
server {
    listen 8888;
    server_name _;
    client_max_body_size 100M;
    root $PANEL_DIR;
    index index.html index.php;

    location / {
        try_files \$uri \$uri/ =404;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php-fpm.sock; # Adjust version if needed (e.g., php8.1-fpm.sock)
    }

    location /api/ {
        try_files \$uri \$uri/ /api/index.php?\$query_string;
    }

    location ~ /\.ht {
        deny all;
    }
    
    # Secure sensitive directories
    location ^~ /config/ {
        deny all;
        return 403;
    }
    location ^~ /src/ {
        deny all;
        return 403;
    }
}
EOF

# Detect PHP version for FPM socket
PHP_VERSION=$(php -r "echo PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;")
sed -i "s/php-fpm.sock/php$PHP_VERSION-fpm.sock/g" "$NGINX_CONF"

ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
    nginx -t && systemctl restart nginx

    # Configure PHP Upload Limits
    echo "Configuring PHP limits..."
    echo "post_max_size = 100M" > /etc/php/$PHP_VERSION/fpm/conf.d/99-gopanel.ini
    echo "upload_max_filesize = 100M" >> /etc/php/$PHP_VERSION/fpm/conf.d/99-gopanel.ini
    systemctl restart php$PHP_VERSION-fpm

# 5. Configuration & Security
echo "Setting up configuration..."
CONFIG_FILE="$PANEL_DIR/config.php"
USERS_FILE="$PANEL_DIR/config/users.json"

# Implement Auth Salt
SALT=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
if grep -q "CHANGE_THIS_ON_INSTALL" "$CONFIG_FILE"; then
    sed -i "s/CHANGE_THIS_ON_INSTALL/$SALT/" "$CONFIG_FILE"
fi

# Create Default User if not exists
if [ ! -f "$USERS_FILE" ]; then
    mkdir -p "$(dirname "$USERS_FILE")"
    # Default: admin / admin
    # In a real scenario, we should hash this. Assuming simple check for now or plain text as implied by README.
    # README says change password in users.json.
    echo '{
        "admin": {
            "password": "admin", 
            "role": "admin"
        }
    }' > "$USERS_FILE"
    chown www-data:www-data "$USERS_FILE"
fi

# 6. Sudoers for www-data
echo "Configuring sudoers..."
SUDO_FILE="/etc/sudoers.d/gopanel"
cat > "$SUDO_FILE" <<EOF
# Systemctl
www-data ALL=(ALL) NOPASSWD: /bin/systemctl start go-*, /bin/systemctl stop go-*, /bin/systemctl restart go-*, /bin/systemctl status go-*
www-data ALL=(ALL) NOPASSWD: /bin/systemctl enable go-*, /bin/systemctl disable go-*, /bin/systemctl daemon-reload

# Nginx & Certbot
www-data ALL=(ALL) NOPASSWD: /usr/sbin/nginx -t, /usr/sbin/nginx -s reload
www-data ALL=(ALL) NOPASSWD: /usr/bin/certbot *

# Service File Management
# Allow copying any file to systemd directory (Required for creating new services)
www-data ALL=(ALL) NOPASSWD: /usr/bin/cp * /etc/systemd/system/go-*.service
# Allow setting permissions on service files
www-data ALL=(ALL) NOPASSWD: /usr/bin/chmod 644 /etc/systemd/system/go-*.service
# Allow removing service files
www-data ALL=(ALL) NOPASSWD: /usr/bin/rm /etc/systemd/system/go-*.service

# Nginx Configuration Management
# Allow copying to sites-available
www-data ALL=(ALL) NOPASSWD: /usr/bin/cp * /etc/nginx/sites-available/*
# Allow linking sites-enabled
www-data ALL=(ALL) NOPASSWD: /usr/bin/ln -sf /etc/nginx/sites-available/* /etc/nginx/sites-enabled/*
# Allow removing configs (Cleanup)
www-data ALL=(ALL) NOPASSWD: /usr/bin/rm /etc/nginx/sites-enabled/*
www-data ALL=(ALL) NOPASSWD: /usr/bin/rm /etc/nginx/sites-available/*
www-data ALL=(ALL) NOPASSWD: /usr/bin/rm -f /etc/nginx/sites-enabled/*
www-data ALL=(ALL) NOPASSWD: /usr/bin/rm -f /etc/nginx/sites-available/*
EOF
chmod 0440 "$SUDO_FILE"

echo "Installation Complete!"
echo "Access the panel at http://<YOUR_IP>:8888"
