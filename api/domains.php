<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../src/Auth.php';
require_once __DIR__ . '/../src/NginxManager.php';
require_once __DIR__ . '/../src/Settings.php';

Auth::requireLogin();

$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'random') {
    header('Content-Type: text/plain');
    header('X-Accel-Buffering: no');
    ini_set('output_buffering', 'off');
    while (@ob_end_flush()) ;

    try {
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $appName = $data['app'] ?? '';
        if (!preg_match('/^[a-zA-Z0-9-]+$/', $appName)) throw new Exception('Invalid application');

        $settings = Settings::get();
        $baseDomain = $settings['app_base_domain'];
        if (!$baseDomain) throw new Exception('Set the app base domain in Settings first');

        require_once __DIR__ . '/../src/AppManager.php';
        $manager = new AppManager();
        $application = null;
        foreach ($manager->listApps() as $listedApp) {
            if ($listedApp['name'] === $appName) { $application = $listedApp; break; }
        }
        if (!$application) throw new Exception('Application not found');
        if (!empty($application['domain'])) throw new Exception('This application already has a domain. Remove its current domain before assigning another one');
        $port = (int) $application['port'];
        if ($port < 1001 || $port > 65535) throw new Exception('Application has an invalid assigned port');

        $alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
        $domain = '';
        for ($attempt = 0; $attempt < 50; $attempt++) {
            $prefix = '';
            for ($index = 0; $index < 4; $index++) $prefix .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            $candidate = $prefix . '.' . $baseDomain;
            if (!NginxManager::configExists($candidate) && !$manager->domainIsAssigned($candidate)) {
                $domain = $candidate;
                break;
            }
        }
        if (!$domain) throw new Exception('Could not allocate a unique subdomain; please try again');

        echo "Reserved unique hostname: {$domain}\n";
        echo "Routing {$domain} to 127.0.0.1:{$port}\n";
        flush();
        NginxManager::createConfig($domain, $port, true);
        $manager->saveMetadata($appName, ['domain' => $domain]);

        $sslEnabled = false;
        if (!empty($settings['ssl_email'])) {
            echo "\nRequesting HTTPS certificate...\n";
            flush();
            try {
                NginxManager::enableSSL($domain, $settings['ssl_email'], $port, true);
                $manager->saveMetadata($appName, ['domain' => $domain, 'email' => $settings['ssl_email']]);
                $sslEnabled = true;
            } catch (Exception $sslError) {
                echo "\nThe subdomain is assigned, but HTTPS is pending: " . $sslError->getMessage() . "\n";
                echo "DNS may still be propagating. Use the SSL button later to retry.\n";
            }
        } else {
            echo "\nSSL email is not configured; the HTTP route is ready.\n";
        }

        echo "\nPublic URL: " . ($sslEnabled ? 'https://' : 'http://') . $domain . "\n[DOMAIN SUCCEEDED]\n";
    } catch (Exception $e) {
        echo "\n" . $e->getMessage() . "\n[DOMAIN FAILED]\n";
    }
    exit;
}

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
