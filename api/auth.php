<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../src/Auth.php';

header('Content-Type: application/json');

$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'login') {
    $data = json_decode(file_get_contents('php://input'), true);
    $username = $data['username'] ?? '';
    $password = $data['password'] ?? '';

    if (Auth::login($username, $password)) {
        jsonResponse(['success' => true]);
    } else {
        jsonResponse(['success' => false, 'error' => 'Invalid credentials'], 401);
    }
}

if ($action === 'logout') {
    Auth::logout();
    jsonResponse(['success' => true]);
}

if ($action === 'check') {
    jsonResponse(['loggedIn' => Auth::isLoggedIn(), 'user' => $_SESSION['user'] ?? null]);
}

jsonResponse(['error' => 'Invalid action'], 400);
