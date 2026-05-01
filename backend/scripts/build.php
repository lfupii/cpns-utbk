<?php

declare(strict_types=1);

$backendRoot = dirname(__DIR__);
$vendorAutoload = $backendRoot . '/vendor/autoload.php';

$composerCommand = file_exists($vendorAutoload)
    ? sprintf(
        'composer dump-autoload --optimize --working-dir=%s',
        escapeshellarg($backendRoot)
    )
    : sprintf(
        'composer install --no-dev --optimize-autoloader --working-dir=%s',
        escapeshellarg($backendRoot)
    );

echo "Running Composer step...\n";
passthru($composerCommand, $exitCode);

if ($exitCode !== 0) {
    fwrite(STDERR, "Composer step failed.\n");
    exit($exitCode);
}

$iterator = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($backendRoot, FilesystemIterator::SKIP_DOTS)
);

$phpFiles = [];

foreach ($iterator as $file) {
    if (!$file->isFile()) {
        continue;
    }

    $path = $file->getPathname();

    if (pathinfo($path, PATHINFO_EXTENSION) !== 'php') {
        continue;
    }

    if (strpos($path, DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR) !== false) {
        continue;
    }

    $phpFiles[] = $path;
}

sort($phpFiles);

echo "Linting PHP files...\n";

foreach ($phpFiles as $path) {
    $lintCommand = sprintf('php -l %s', escapeshellarg($path));
    passthru($lintCommand, $exitCode);

    if ($exitCode !== 0) {
        fwrite(STDERR, "Build failed while linting: {$path}\n");
        exit($exitCode);
    }
}

echo "Backend build completed successfully.\n";
