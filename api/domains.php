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

    try {
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

    try {
        NginxManager::enableSSL($domain, $email);
        jsonResponse(['success' => true]);
    } catch (Exception $e) {
        jsonResponse(['error' => $e->getMessage()], 500);
    }
}
