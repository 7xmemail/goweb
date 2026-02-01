<?php
// api/debug_git.php
// Standalone script to test git capabilities
require_once __DIR__ . '/../config.php';

echo "<h1>Git Debugger</h1>";
echo "<pre>";

// 1. Check User
echo "User: " . exec('whoami') . "\n";
echo "Group: " . exec('id -gn') . "\n";

// 2. Check Git Version
$output = [];
$ret = 0;
exec('git --version', $output, $ret);
echo "Git Version Check: Return $ret\n";
echo implode("\n", $output) . "\n\n";

// 3. Test Write Permission in Apps Dir
$testDir = APPS_DIR . '/test_write_' . time();
echo "Testing Write to " . APPS_DIR . "...\n";
if (mkdir($testDir)) {
    echo "MKDIR Success.\n";
    rmdir($testDir);
} else {
    echo "MKDIR FAILED. Trying sudo...\n";
    $output = [];
    exec("sudo mkdir $testDir 2>&1", $output, $ret);
    echo "Sudo MKDIR: Return $ret\n" . implode("\n", $output) . "\n";
    if ($ret === 0)
        exec("sudo rmdir $testDir");
}
echo "\n";

// 4. Test Cloning Public Repo
$repo = 'https://github.com/octocat/Hello-World.git';
$cloneDir = APPS_DIR . '/debug_clone_' . time();
echo "Testing Clone $repo to $cloneDir...\n";

// Command matching AppManager
$cmd = "export GIT_TERMINAL_PROMPT=0 && cd " . APPS_DIR . " && git clone " . $repo . " " . basename($cloneDir) . " 2>&1";
echo "Command: $cmd\n";

$output = [];
exec($cmd, $output, $ret);
echo "Clone Result: Return $ret\n";
echo implode("\n", $output);

if ($ret === 0) {
    echo "\n\nCLONE SUCCESS!";
    // Cleanup
    exec("rm -rf " . escapeshellarg($cloneDir)); // might fail if permissions, but it's debug
    exec("sudo rm -rf " . escapeshellarg($cloneDir));
} else {
    echo "\n\nCLONE FAILED.";
}

echo "</pre>";
