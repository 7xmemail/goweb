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
            // Use exec for recursive delete to ensure it works
            // Check safety? securePath ensures it's inside app dir.
            System::exec("rm -rf " . escapeshellarg($path));
            return !is_dir($path);
        } else {
            return unlink($path);
        }
    }

    public function renameFile($old, $new)
    {
        // $new is just the new filename or relative path?
        // Let's assume $new is the full relative path or just name? 
        // User usually renames "foo.txt" to "bar.txt" in same dir.
        // But let's support moving if they pass path. 
        // Logic: $old = "src/foo.txt", $new = "src/bar.txt"

        $oldPath = $this->securePath($old);
        $newPath = $this->securePath($new);

        if (!file_exists($oldPath))
            throw new Exception("File not found");
        if (file_exists($newPath))
            throw new Exception("Destination already exists");

        return rename($oldPath, $newPath);
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
