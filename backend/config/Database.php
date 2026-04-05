<?php
if (!function_exists('env')) {
    function env(string $key, $default = null) {
        if (array_key_exists($key, $_ENV) && $_ENV[$key] !== '') {
            return $_ENV[$key];
        }

        $value = getenv($key);
        if ($value !== false && $value !== '') {
            return $value;
        }

        return $default;
    }
}

// Database Configuration
define('DB_HOST', env('DB_HOST', '127.0.0.1'));     // Use TCP instead of socket
define('DB_USER', env('DB_USER', 'root'));
define('DB_PASSWORD', env('DB_PASSWORD', ''));
define('DB_NAME', env('DB_NAME', 'cpns_utbk_2026'));
define('DB_PORT', (int) env('DB_PORT', 3306));

// API Configuration
define('API_URL', env('API_URL', 'http://localhost:8000'));
define('FRONTEND_URL', env('FRONTEND_URL', 'http://localhost:5173'));

// JWT Secret Key
define('JWT_SECRET_KEY', env('JWT_SECRET_KEY', 'your_super_secret_jwt_key_change_this_in_production'));

// Midtrans Configuration
define('MIDTRANS_SERVER_KEY', env('MIDTRANS_SERVER_KEY', 'YOUR_MIDTRANS_SERVER_KEY')); // Ganti dengan key Midtrans
define('MIDTRANS_CLIENT_KEY', env('MIDTRANS_CLIENT_KEY', 'YOUR_MIDTRANS_CLIENT_KEY'));
$midtransProduction = filter_var(env('MIDTRANS_IS_PRODUCTION', false), FILTER_VALIDATE_BOOLEAN);
define('MIDTRANS_IS_PRODUCTION', $midtransProduction); // false untuk sandbox, true untuk production
define('MERCHANT_ID', env('MERCHANT_ID', ''));

// Midtrans API Base URLs
define('MIDTRANS_CORE_API_URL', MIDTRANS_IS_PRODUCTION
    ? 'https://api.midtrans.com/v2'
    : 'https://api.sandbox.midtrans.com/v2'
);
define('MIDTRANS_SNAP_API_URL', MIDTRANS_IS_PRODUCTION
    ? 'https://app.midtrans.com/snap/v1/transactions'
    : 'https://app.sandbox.midtrans.com/snap/v1/transactions'
);
define('MIDTRANS_SNAP_JS_URL', MIDTRANS_IS_PRODUCTION
    ? 'https://app.midtrans.com/snap/snap.js'
    : 'https://app.sandbox.midtrans.com/snap/snap.js'
);

// Email Configuration (untuk notifikasi pembayaran)
define('SMTP_HOST', env('SMTP_HOST', 'smtp.gmail.com'));
define('SMTP_PORT', (int) env('SMTP_PORT', 587));
define('SMTP_USER', env('SMTP_USER', 'your-email@gmail.com'));
define('SMTP_PASSWORD', env('SMTP_PASSWORD', 'your-app-password'));
define('SMTP_SECURE', env('SMTP_SECURE', SMTP_PORT === 465 ? 'ssl' : 'tls'));
define('FROM_EMAIL', env('FROM_EMAIL', 'noreply@cpns-utbk.com'));
define('FROM_NAME', env('FROM_NAME', 'CPNS UTBK 2026'));
define('EMAIL_VERIFICATION_EXPIRY_HOURS', (int) env('EMAIL_VERIFICATION_EXPIRY_HOURS', 24));
define('EMAIL_VERIFICATION_URL', env('EMAIL_VERIFICATION_URL', rtrim(FRONTEND_URL, '/') . '/verify-email'));
define('DEFAULT_ADMIN_EMAIL', env('DEFAULT_ADMIN_EMAIL', 'fadhlurrohmanluthfi@gmail.com'));
define('DEFAULT_ADMIN_FULL_NAME', env('DEFAULT_ADMIN_FULL_NAME', 'Admin TO CPNS UTBK'));
define('DEFAULT_ADMIN_PASSWORD_HASH', env('DEFAULT_ADMIN_PASSWORD_HASH', '$2y$12$4.8bTUnKgsWR/Js3cW.04uaQc9aerTIew7nPSpCf7V7aB2I3KQ8S2'));
$forceBootstrapDefaultAdmin = filter_var(env('DEFAULT_ADMIN_FORCE_BOOTSTRAP', false), FILTER_VALIDATE_BOOLEAN);
define('DEFAULT_ADMIN_FORCE_BOOTSTRAP', $forceBootstrapDefaultAdmin);

define('TOKEN_EXPIRY', (int) env('TOKEN_EXPIRY', 86400)); // 24 jam
define('MAX_LOGIN_ATTEMPTS', (int) env('MAX_LOGIN_ATTEMPTS', 5));
define('LOCK_TIME', (int) env('LOCK_TIME', 900)); // 15 menit

if (!class_exists('mysqli')) {
    http_response_code(500);
    if (!headers_sent()) {
        header('Content-Type: application/json');
    }

    echo json_encode([
        'status' => 'error',
        'message' => 'PHP mysqli extension is not enabled on production hosting',
        'hint' => 'Aktifkan extension mysqli di Select PHP Version / PHP Extensions cPanel.',
    ]);
    exit();
}

mysqli_report(MYSQLI_REPORT_OFF);
$mysqli = @new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT);

if ($mysqli->connect_error) {
    http_response_code(500);
    if (!headers_sent()) {
        header('Content-Type: application/json');
    }

    echo json_encode([
        'status' => 'error',
        'message' => 'Database connection failed on production API',
        'hint' => 'Periksa secret PROD_DB_HOST, PROD_DB_USER, PROD_DB_PASSWORD, PROD_DB_NAME, dan privilege database di hosting.',
        'code' => $mysqli->connect_errno,
    ]);
    exit();
}

$mysqli->set_charset('utf8mb4');

function databaseTableExists(mysqli $mysqli, string $tableName): bool {
    $query = 'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1';
    $stmt = $mysqli->prepare($query);
    $stmt->bind_param('s', $tableName);
    $stmt->execute();

    return (bool) $stmt->get_result()->fetch_row();
}

function databaseColumnExists(mysqli $mysqli, string $tableName, string $columnName): bool {
    $query = 'SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1';
    $stmt = $mysqli->prepare($query);
    $stmt->bind_param('ss', $tableName, $columnName);
    $stmt->execute();

    return (bool) $stmt->get_result()->fetch_row();
}

function ensureSystemSettingsTable(mysqli $mysqli): void {
    $mysqli->query(
        "CREATE TABLE IF NOT EXISTS system_settings (
            setting_key VARCHAR(100) PRIMARY KEY,
            setting_value TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function getSystemSetting(mysqli $mysqli, string $settingKey): ?string {
    ensureSystemSettingsTable($mysqli);
    $query = 'SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1';
    $stmt = $mysqli->prepare($query);
    $stmt->bind_param('s', $settingKey);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();

    return $row['setting_value'] ?? null;
}

function setSystemSetting(mysqli $mysqli, string $settingKey, string $settingValue): void {
    ensureSystemSettingsTable($mysqli);
    $query = "INSERT INTO system_settings (setting_key, setting_value)
              VALUES (?, ?)
              ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)";
    $stmt = $mysqli->prepare($query);
    $stmt->bind_param('ss', $settingKey, $settingValue);
    $stmt->execute();
}

function ensureEmailVerificationSchema(mysqli $mysqli): void {
    if (!databaseTableExists($mysqli, 'users')) {
        return;
    }

    if (!databaseColumnExists($mysqli, 'users', 'email_verified_at')) {
        $mysqli->query("ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP NULL AFTER birth_date");
    }

    if (!databaseColumnExists($mysqli, 'users', 'email_verification_token')) {
        $mysqli->query("ALTER TABLE users ADD COLUMN email_verification_token VARCHAR(64) UNIQUE DEFAULT NULL AFTER email_verified_at");
    }

    if (!databaseColumnExists($mysqli, 'users', 'email_verification_sent_at')) {
        $mysqli->query("ALTER TABLE users ADD COLUMN email_verification_sent_at TIMESTAMP NULL AFTER email_verification_token");
    }

    if (!databaseColumnExists($mysqli, 'users', 'email_verification_expires_at')) {
        $mysqli->query("ALTER TABLE users ADD COLUMN email_verification_expires_at TIMESTAMP NULL AFTER email_verification_sent_at");
    }
}

function shouldBootstrapDefaultAdmin(): bool {
    if (DEFAULT_ADMIN_FORCE_BOOTSTRAP) {
        return true;
    }

    $frontendHost = (string) parse_url(FRONTEND_URL, PHP_URL_HOST);
    $apiHost = (string) parse_url(API_URL, PHP_URL_HOST);

    return $frontendHost === 'tocpnsutbk.com'
        || $frontendHost === 'www.tocpnsutbk.com'
        || $apiHost === 'api.tocpnsutbk.com';
}

function bootstrapDefaultAdmin(mysqli $mysqli): void {
    if (!shouldBootstrapDefaultAdmin() || !databaseTableExists($mysqli, 'users')) {
        return;
    }

    $bootstrapKey = 'default_admin_reset_v1';
    if (getSystemSetting($mysqli, $bootstrapKey) !== null) {
        return;
    }

    $mysqli->begin_transaction();

    try {
        $mysqli->query('DELETE FROM users');

        $query = "INSERT INTO users (
                    email,
                    password,
                    full_name,
                    role,
                    email_verified_at
                  ) VALUES (?, ?, ?, 'admin', NOW())";
        $stmt = $mysqli->prepare($query);
        $adminEmail = DEFAULT_ADMIN_EMAIL;
        $adminPasswordHash = DEFAULT_ADMIN_PASSWORD_HASH;
        $adminFullName = DEFAULT_ADMIN_FULL_NAME;
        $stmt->bind_param('sss', $adminEmail, $adminPasswordHash, $adminFullName);
        $stmt->execute();

        setSystemSetting($mysqli, $bootstrapKey, json_encode([
            'email' => $adminEmail,
            'completed_at' => date(DATE_ATOM),
        ], JSON_UNESCAPED_SLASHES));

        $mysqli->commit();
    } catch (Throwable $error) {
        $mysqli->rollback();
        error_log('Default admin bootstrap failed: ' . $error->getMessage());
    }
}

ensureEmailVerificationSchema($mysqli);
bootstrapDefaultAdmin($mysqli);
