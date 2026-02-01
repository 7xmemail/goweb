<?php

class Auth
{

    private static $dbFile = __DIR__ . '/../config/users.json';

    public static function init()
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
    }

    public static function login($username, $password)
    {
        self::init();

        // For simplicity, we'll store users in a json file. 
        // In real prod, use a DB.
        if (!file_exists(self::$dbFile)) {
            // Create default admin if not exists (admin / admin for first run)
            // USER SHOULD CHANGE THIS
            $default = ['admin' => password_hash('admin', PASSWORD_DEFAULT)];
            file_put_contents(self::$dbFile, json_encode($default));
        }

        $users = json_decode(file_get_contents(self::$dbFile), true);

        if (isset($users[$username]) && password_verify($password, $users[$username])) {
            $_SESSION['user'] = $username;
            return true;
        }

        return false;
    }

    public static function logout()
    {
        self::init();
        session_destroy();
    }

    public static function isLoggedIn()
    {
        self::init();
        return isset($_SESSION['user']);
    }

    public static function requireLogin()
    {
        if (!self::isLoggedIn()) {
            jsonResponse(['error' => 'Unauthorized'], 401);
        }
    }
}
