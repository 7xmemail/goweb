<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../src/Auth.php';
require_once __DIR__ . '/../src/Settings.php';

Auth::requireLogin();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    jsonResponse(['settings' => Settings::get()]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        jsonResponse(['success' => true, 'settings' => Settings::save($data)]);
    } catch (Exception $e) {
        jsonResponse(['error' => $e->getMessage()], 422);
    }
}

jsonResponse(['error' => 'Invalid request'], 400);
