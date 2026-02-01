<?php
// Global Configuration

// Prevent direct access to includes
defined('ROOT_PATH') OR define('ROOT_PATH', __DIR__);

// Application Settings
define('APP_NAME', 'GoPanel');
define('APP_VERSION', '1.0.0');

// System Paths (Adjust these based on VPS structure)
define('APPS_DIR', '/var/go-apps');
define('NGINX_SITES_AVAILABLE', '/etc/nginx/sites-available');
define('NGINX_SITES_ENABLED', '/etc/nginx/sites-enabled');
define('SYSTEMD_DIR', '/etc/systemd/system');

// Security
define('AUTH_SALT', 'CHANGE_THIS_ON_INSTALL'); // Should be generated on install
define('SESSION_LIFETIME', 3600); // 1 hour

// Database (Using SQLite for simplicity, or simple JSON store)
define('DB_PATH', ROOT_PATH . '/config/data.db');

// Enable Error Reporting for Dev (Disable in Prod)
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Helper function to return JSON response
function jsonResponse($data, $status = 200) {
    header('Content-Type: application/json');
    http_response_code($status);
    echo json_encode($data);
    exit;
}
