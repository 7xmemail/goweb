<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../src/Auth.php';
require_once __DIR__ . '/../src/AppManager.php';

Auth::requireLogin();

$manager = new AppManager();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($method === 'GET' && $action === 'list') {
    jsonResponse(['apps' => $manager->listApps()]);
}

if ($method === 'POST' && $action === 'create') {
    // Handling multipart/form-data for uploads
    $name = $_POST['name'] ?? '';
    $gitRepo = $_POST['git_repo'] ?? null;
    $envVars = json_decode($_POST['env_vars'] ?? '{}', true);
    $port = $_POST['port'] ?? 8080;

    $file = isset($_FILES['binary']) ? $_FILES['binary'] : null;

    try {
        $manager->createApp($name, $file, $gitRepo, $port, $envVars);
        jsonResponse(['success' => true]);
    } catch (Exception $e) {
        jsonResponse(['error' => $e->getMessage()], 500);
    }
}

if ($method === 'POST' && $action === 'control') {
    $data = json_decode(file_get_contents('php://input'), true);
    $appName = $data['name'] ?? '';
    $command = $data['command'] ?? ''; // start, stop, restart, delete

    try {
        if ($command === 'start')
            System::startService($appName);
        elseif ($command === 'stop')
            System::stopService($appName);
        elseif ($command === 'restart')
            System::restartService($appName);
        elseif ($command === 'delete')
            $manager->deleteApp($appName);
        else
            throw new Exception("Invalid command");

        jsonResponse(['success' => true]);
    } catch (Exception $e) {
        jsonResponse(['error' => $e->getMessage()], 500);
    }
}

if ($method === 'GET' && $action === 'logs') {
    $appName = $_GET['name'] ?? '';
    // Fetch last 100 lines
    // Security: Validate appName
    if (!preg_match('/^[a-zA-Z0-9-]+$/', $appName)) {
        jsonResponse(['error' => 'Invalid Name'], 400);
    }

    // Command to get logs
    $output = [];
    // journalctl -u go-app -n 100 --no-pager
    exec("sudo journalctl -u go-{$appName} -n 100 --no-pager", $output);
    jsonResponse(['logs' => implode("\n", $output)]);
}

jsonResponse(['error' => 'Invalid request'], 400);
