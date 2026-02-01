<?php
// api/debug_apps.php
require_once __DIR__ . '/../config.php';

$appName = $_GET['name'] ?? '';

echo "<h1>App Debugger: " . htmlspecialchars($appName) . "</h1>";
echo "<pre>";

if (!$appName) {
    echo "Please provide ?name=your-app-name";
    exit;
}

$appDir = APPS_DIR . '/' . $appName;
$binary = $appDir . '/app';

// 1. Check Directory
echo "Checking Directory: $appDir\n";
if (is_dir($appDir)) {
    echo "Directory EXISTS.\n";
    echo "Contents (ls -la):\n";
    $out = [];
    exec("ls -la " . escapeshellarg($appDir), $out);
    echo implode("\n", $out) . "\n";
} else {
    echo "Directory NOT FOUND.\n";
}

echo "\n";

// 2. Check Binary
echo "Checking Binary: $binary\n";
if (file_exists($binary)) {
    echo "Binary EXISTS.\n";
    echo "Size: " . filesize($binary) . " bytes\n";
    echo "Permissions: " . substr(sprintf('%o', fileperms($binary)), -4) . "\n";

    // Check file type
    echo "File Type:\n";
    $out = [];
    exec("file " . escapeshellarg($binary), $out);
    echo implode("\n", $out) . "\n";

    // Check ldd if dynamic
    echo "LDD:\n";
    $out = [];
    exec("ldd " . escapeshellarg($binary), $out);
    echo implode("\n", $out) . "\n";
} else {
    echo "Binary NOT FOUND.\n";
}

echo "\n";

// 3. Check Systemd Service
echo "Checking Service File:\n";
$svc = "/etc/systemd/system/go-$appName.service";
if (file_exists($svc)) {
    echo "Service File EXISTS: $svc\n";
    echo "Content:\n";
    echo file_get_contents($svc);
} else {
    echo "Service File NOT FOUND at $svc\n";
}

echo "</pre>";
