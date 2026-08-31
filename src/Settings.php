<?php

class Settings
{
    private static function path()
    {
        return ROOT_PATH . '/config/settings.json';
    }

    public static function get()
    {
        $defaults = ['app_base_domain' => '', 'ssl_email' => ''];
        if (!is_file(self::path())) return $defaults;
        $saved = json_decode(file_get_contents(self::path()), true);
        return array_merge($defaults, is_array($saved) ? $saved : []);
    }

    public static function save($data)
    {
        $domain = strtolower(trim($data['app_base_domain'] ?? ''));
        $domain = rtrim($domain, '.');
        if ($domain !== '' && (!filter_var($domain, FILTER_VALIDATE_DOMAIN, FILTER_FLAG_HOSTNAME) || strpos($domain, '.') === false)) {
            throw new Exception('Enter a valid base domain, for example apps.example.com');
        }

        $email = strtolower(trim($data['ssl_email'] ?? ''));
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new Exception('Enter a valid SSL notification email');
        }

        $settings = ['app_base_domain' => $domain, 'ssl_email' => $email];
        $directory = dirname(self::path());
        if (!is_dir($directory)) mkdir($directory, 0750, true);
        if (file_put_contents(self::path(), json_encode($settings, JSON_PRETTY_PRINT), LOCK_EX) === false) {
            throw new Exception('Could not save panel settings');
        }
        @chmod(self::path(), 0660);
        return $settings;
    }
}
