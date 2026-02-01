<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../src/Auth.php';
require_once __DIR__ . '/../src/FileManager.php';

Auth::requireLogin();

$appName = $_GET['app'] ?? '';
if (!$appName)
    jsonResponse(['error' => 'App name required'], 400);

try {
    $fm = new FileManager($appName);
    $action = $_GET['action'] ?? '';
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET' && $action === 'list') {
        $dir = $_GET['path'] ?? '';
        jsonResponse(['files' => $fm->listFiles($dir)]);
    }

    if ($method === 'GET' && $action === 'read') {
        $file = $_GET['file'] ?? '';
        jsonResponse(['content' => $fm->readFile($file)]);
    }

    if ($method === 'POST' && $action === 'save') {
        $data = json_decode(file_get_contents('php://input'), true);
        $file = $data['file'] ?? '';
        $content = $data['content'] ?? '';
        $fm->saveFile($file, $content);
        jsonResponse(['success' => true]);
    }

    if ($method === 'POST' && $action === 'upload') {
        $path = $_POST['path'] ?? ''; // target directory inside app
        if (!isset($_FILES['file']))
            throw new Exception("No file uploaded");

        // This effectively saves to app path + path + filename
        // FileManager saveFile expects relative path to app root
        $targetPath = ($path ? $path . '/' : '') . $_FILES['file']['name'];
        // Temporarily move to reading content to use saveFile for consistent security checks
        // Ideally we move_uploaded_file directly but need to respect FileManager's secure path logic
        // Let's modify FileManager to accept move logic or just read content
        $content = file_get_contents($_FILES['file']['tmp_name']);
        $fm->saveFile($targetPath, $content);
        jsonResponse(['success' => true]);
    }

    if ($method === 'POST' && $action === 'mkdir') {
        $data = json_decode(file_get_contents('php://input'), true);
        $dir = $data['dir'] ?? '';
        if ($fm->createDirectory($dir)) {
            jsonResponse(['success' => true]);
        } else {
            jsonResponse(['error' => 'Failed to create directory'], 500);
        }
    }

    if ($method === 'POST' && $action === 'rename') {
        $data = json_decode(file_get_contents('php://input'), true);
        $old = $data['old'] ?? '';
        $new = $data['new'] ?? '';
        if ($fm->renameFile($old, $new)) {
            jsonResponse(['success' => true]);
        } else {
            jsonResponse(['error' => 'Failed to rename'], 500);
        }
    }

    if ($method === 'POST' && $action === 'delete') {
        $data = json_decode(file_get_contents('php://input'), true);
        $file = $data['file'] ?? '';
        if ($fm->deleteFile($file)) {
            jsonResponse(['success' => true]);
        } else {
            jsonResponse(['error' => 'Failed to delete'], 500);
        }
    }

} catch (Exception $e) {
    jsonResponse(['error' => $e->getMessage()], 500);
}
