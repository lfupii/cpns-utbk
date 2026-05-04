<?php

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "Script ini hanya bisa dijalankan via CLI.\n");
    exit(1);
}

if (file_exists(__DIR__ . '/../vendor/autoload.php')) {
    require_once __DIR__ . '/../vendor/autoload.php';
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
    $dotenv->safeLoad();
}

require_once __DIR__ . '/../config/Database.php';

$options = getopt('', ['email:', 'password:', 'name::']);

$email = strtolower(trim((string) ($options['email'] ?? '')));
$plainPassword = (string) ($options['password'] ?? '');
$fullName = trim((string) ($options['name'] ?? 'Admin Ujiin'));

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "Email admin tidak valid.\n");
    exit(1);
}

if (strlen($plainPassword) < 8) {
    fwrite(STDERR, "Password admin minimal 8 karakter.\n");
    exit(1);
}

$passwordHash = password_hash($plainPassword, PASSWORD_BCRYPT);

$select = $mysqli->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
$select->bind_param('s', $email);
$select->execute();
$existingUser = $select->get_result()->fetch_assoc();

if ($existingUser) {
    $update = $mysqli->prepare(
        "UPDATE users
         SET password = ?,
             full_name = ?,
             role = 'admin',
             email_verified_at = COALESCE(email_verified_at, NOW())
         WHERE id = ?"
    );
    $update->bind_param('ssi', $passwordHash, $fullName, $existingUser['id']);
    $update->execute();
    $userId = (int) $existingUser['id'];
    $action = 'updated';
} else {
    $insert = $mysqli->prepare(
        "INSERT INTO users (
            email,
            password,
            full_name,
            role,
            email_verified_at
        ) VALUES (?, ?, ?, 'admin', NOW())"
    );
    $insert->bind_param('sss', $email, $passwordHash, $fullName);
    $insert->execute();
    $userId = (int) $insert->insert_id;
    $action = 'created';
}

fwrite(STDOUT, "Admin account {$action}.\n");
fwrite(STDOUT, "Email    : {$email}\n");
fwrite(STDOUT, "Password : {$plainPassword}\n");
fwrite(STDOUT, "Full name: {$fullName}\n");
fwrite(STDOUT, "User ID  : {$userId}\n");
fwrite(STDOUT, "Login URL: " . rtrim(FRONTEND_URL, '/') . "/login\n");
