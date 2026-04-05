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
define('FROM_EMAIL', env('FROM_EMAIL', 'noreply@cpns-utbk.com'));
define('FROM_NAME', env('FROM_NAME', 'CPNS UTBK 2026'));

define('TOKEN_EXPIRY', (int) env('TOKEN_EXPIRY', 86400)); // 24 jam
define('MAX_LOGIN_ATTEMPTS', (int) env('MAX_LOGIN_ATTEMPTS', 5));
define('LOCK_TIME', (int) env('LOCK_TIME', 900)); // 15 menit

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
