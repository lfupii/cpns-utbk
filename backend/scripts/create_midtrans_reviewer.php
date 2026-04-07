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

$options = getopt('', ['email::', 'password::', 'name::']);

$email = strtolower(trim((string) ($options['email'] ?? 'midtrans.reviewer@tocpnsutbk.com')));
$plainPassword = (string) ($options['password'] ?? bin2hex(random_bytes(4)) . 'A1!');
$fullName = trim((string) ($options['name'] ?? 'Midtrans Reviewer'));

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "Email reviewer tidak valid.\n");
    exit(1);
}

if (strlen($plainPassword) < 6) {
    fwrite(STDERR, "Password reviewer minimal 6 karakter.\n");
    exit(1);
}

$select = $mysqli->prepare('SELECT id, role FROM users WHERE email = ? LIMIT 1');
$select->bind_param('s', $email);
$select->execute();
$existingUser = $select->get_result()->fetch_assoc();

if ($existingUser && ($existingUser['role'] ?? 'user') === 'admin') {
    fwrite(STDERR, "Email reviewer sudah dipakai akun admin. Gunakan email lain.\n");
    exit(1);
}

$passwordHash = password_hash($plainPassword, PASSWORD_BCRYPT);

if ($existingUser) {
    $update = $mysqli->prepare(
        "UPDATE users
         SET password = ?,
             full_name = ?,
             role = 'user',
             email_verified_at = NOW(),
             email_verification_token = NULL,
             email_verification_sent_at = NULL,
             email_verification_expires_at = NULL
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
            email_verified_at,
            email_verification_token,
            email_verification_sent_at,
            email_verification_expires_at
        ) VALUES (?, ?, ?, 'user', NOW(), NULL, NULL, NULL)"
    );
    $insert->bind_param('sss', $email, $passwordHash, $fullName);
    $insert->execute();
    $userId = (int) $insert->insert_id;
    $action = 'created';
}

fwrite(STDOUT, "Midtrans reviewer account {$action}.\n");
fwrite(STDOUT, "Email    : {$email}\n");
fwrite(STDOUT, "Password : {$plainPassword}\n");
fwrite(STDOUT, "Full name: {$fullName}\n");
fwrite(STDOUT, "User ID  : {$userId}\n");
fwrite(STDOUT, "Login URL: " . rtrim(FRONTEND_URL, '/') . "/login\n");
