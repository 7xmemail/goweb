<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../src/Auth.php';
require_once __DIR__ . '/../src/NginxManager.php';

Auth::requireLogin();

$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'create') {
    $data = json_decode(file_get_contents('php://input'), true);
    $domain = $data['domain'] ?? '';
    $port = $data['port'] ?? 8080;
    $appName = $data['app'] ?? ''; // New field

    if ($appName) {
        require_once __DIR__ . '/../src/AppManager.php';
        $manager = new AppManager();
        $manager->saveMetadata($appName, ['domain' => $domain]);
    }

    try {
        if (isset($_GET['stream'])) {
            // Basic text stream headers
            header('Content-Type: text/plain');
            header('X-Accel-Buffering: no'); // Disable Nginx buffering
            NginxManager::createConfig($domain, $port, true);
            exit;
        }
        NginxManager::createConfig($domain, $port);
        jsonResponse(['success' => true]);
    } catch (Exception $e) {
        jsonResponse(['error' => $e->getMessage()], 500);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'ssl') {
    $data = json_decode(file_get_contents('php://input'), true);
    $domain = $data['domain'] ?? '';
    $email = $data['email'] ?? '';
    $appName = $data['app'] ?? '';

    if ($appName) {
        require_once __DIR__ . '/../src/AppManager.php';
        $manager = new AppManager();
        $manager->saveMetadata($appName, ['domain' => $domain, 'email' => $email]);
    }

    try {
        if (isset($_GET['stream'])) {
            header('Content-Type: text/plain');
            header('X-Accel-Buffering: no');
            $port = $data['port'] ?? 8080;
            NginxManager::enableSSL($domain, $email, $port, true);
            exit;
        }
        $port = $data['port'] ?? 8080;
        NginxManager::enableSSL($domain, $email, $port);
        jsonResponse(['success' => true]);
    } catch (Exception $e) {
        jsonResponse(['error' => $e->getMessage()], 500);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'read_config') {
    $domain = $_GET['domain'] ?? '';
    try {
        $content = NginxManager::getConfig($domain);
        jsonResponse(['content' => $content]);
    } catch (Exception $e) {
        jsonResponse(['error' => $e->getMessage()], 500);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'save_config') {
    $data = json_decode(file_get_contents('php://input'), true);
    $domain = $data['domain'] ?? '';
    $content = $data['content'] ?? '';

    try {
        NginxManager::saveConfig($domain, $content);
        jsonResponse(['success' => true]);
    } catch (Exception $e) {
        jsonResponse(['error' => $e->getMessage()], 500);
    }
}

