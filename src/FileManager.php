<?php

class FileManager
{

    private $baseDir;

    public function __construct($appName)
    {
        if (!preg_match('/^[a-zA-Z0-9-]+$/', $appName)) {
            throw new Exception("Invalid app name");
        }
        $this->baseDir = (defined('APPS_DIR') ? APPS_DIR : '/var/go-apps') . '/' . $appName;
    }

    private function securePath($path)
    {
        $realBase = realpath($this->baseDir);
        $target = realpath($this->baseDir . '/' . $path);

        if ($target && strpos($target, $realBase) === 0) {
            return $target;
        }
        // If file doesn't exist yet (for write), check parent
        $parent = dirname($this->baseDir . '/' . $path);
        if (realpath($parent) && strpos(realpath($parent), $realBase) === 0) {
            return $this->baseDir . '/' . $path;
        }

        throw new Exception("Access denied or invalid path.");
    }

    public function listFiles($dir = '')
    {
        $path = $this->securePath($dir);
        if (!is_dir($path))
            return [];

        $items = [];
        $files = scandir($path);
        foreach ($files as $f) {
            if ($f == '.' || $f == '..')
                continue;
            $full = $path . '/' . $f;
            $items[] = [
                'name' => $f,
                'type' => is_dir($full) ? 'directory' : 'file',
                'size' => is_file($full) ? filesize($full) : 0,
                'mtime' => filemtime($full),
                'path' => $dir . ($dir ? '/' : '') . $f
            ];
        }
        return $items;
    }

    public function readFile($file)
    {
        $path = $this->securePath($file);
        if (!is_file($path))
            throw new Exception("File not found");
        return file_get_contents($path);
    }

    public function saveFile($file, $content)
    {
        $path = $this->securePath($file);
        return file_put_contents($path, $content);
    }

    public function deleteFile($file)
    {
        $path = $this->securePath($file);
        if (is_dir($path)) {
            return rmdir($path); // Only works for empty dirs, use exec rm -rf for non-empty
        } else {
            return unlink($path);
        }
    }

    public function createDirectory($dir)
    {
        $path = $this->securePath($dir);
        if (!file_exists($path)) {
            return mkdir($path, 0755, true);
        }
        return false;
    }
}
