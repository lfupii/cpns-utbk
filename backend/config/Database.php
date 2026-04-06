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

require_once __DIR__ . '/../utils/TestWorkflow.php';

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

function ensureTestWorkflowSchema(mysqli $mysqli): void {
    if (!databaseTableExists($mysqli, 'test_packages') || !databaseTableExists($mysqli, 'questions')) {
        return;
    }

    $schemaChanged = false;

    if (!databaseColumnExists($mysqli, 'test_packages', 'test_mode')) {
        $mysqli->query("ALTER TABLE test_packages ADD COLUMN test_mode VARCHAR(50) NULL AFTER time_limit");
        $schemaChanged = true;
    }

    if (!databaseColumnExists($mysqli, 'test_packages', 'workflow_config')) {
        $mysqli->query("ALTER TABLE test_packages ADD COLUMN workflow_config LONGTEXT NULL AFTER test_mode");
        $schemaChanged = true;
    }

    if (!databaseColumnExists($mysqli, 'questions', 'section_code')) {
        $mysqli->query("ALTER TABLE questions ADD COLUMN section_code VARCHAR(100) NULL AFTER difficulty");
        $schemaChanged = true;
    }

    if (!databaseColumnExists($mysqli, 'questions', 'section_name')) {
        $mysqli->query("ALTER TABLE questions ADD COLUMN section_name VARCHAR(150) NULL AFTER section_code");
        $schemaChanged = true;
    }

    if (!databaseColumnExists($mysqli, 'questions', 'section_order')) {
        $mysqli->query("ALTER TABLE questions ADD COLUMN section_order INT NOT NULL DEFAULT 1 AFTER section_name");
        $schemaChanged = true;
    }

    if (!databaseColumnExists($mysqli, 'questions', 'question_order')) {
        $mysqli->query("ALTER TABLE questions ADD COLUMN question_order INT NOT NULL DEFAULT 0 AFTER section_order");
        $schemaChanged = true;
    }

    $workflowSchemaVersion = '20260406_test_workflow_modes_v1';
    $appliedWorkflowSchemaVersion = getSystemSetting($mysqli, 'test_workflow_schema_version');
    if ($schemaChanged || $appliedWorkflowSchemaVersion !== $workflowSchemaVersion) {
        backfillTestWorkflowData($mysqli);
        setSystemSetting($mysqli, 'test_workflow_schema_version', $workflowSchemaVersion);
    }
}

function backfillTestWorkflowData(mysqli $mysqli): void {
    $packageQuery = "SELECT tp.id, tp.name, tp.category_id, tp.time_limit, tp.test_mode, tp.workflow_config, tc.name AS category_name
                     FROM test_packages tp
                     LEFT JOIN test_categories tc ON tc.id = tp.category_id
                     ORDER BY tp.id ASC";
    $packageResult = $mysqli->query($packageQuery);
    if (!$packageResult) {
        return;
    }

    $updatePackageStmt = $mysqli->prepare(
        'UPDATE test_packages SET test_mode = ?, workflow_config = ?, time_limit = ? WHERE id = ?'
    );
    $countQuestionsStmt = $mysqli->prepare(
        "SELECT COUNT(*) AS total,
                SUM(CASE WHEN section_code IS NULL OR section_code = '' THEN 1 ELSE 0 END) AS missing_section_code,
                SUM(CASE WHEN section_name IS NULL OR section_name = '' THEN 1 ELSE 0 END) AS missing_section_name,
                SUM(CASE WHEN question_order IS NULL OR question_order <= 0 THEN 1 ELSE 0 END) AS missing_question_order
         FROM questions
         WHERE package_id = ?"
    );
    $fetchQuestionIdsStmt = $mysqli->prepare(
        'SELECT id FROM questions WHERE package_id = ? ORDER BY id ASC'
    );
    $updateQuestionStmt = $mysqli->prepare(
        'UPDATE questions SET section_code = ?, section_name = ?, section_order = ?, question_order = ? WHERE id = ?'
    );

    while ($package = $packageResult->fetch_assoc()) {
        $mode = TestWorkflow::detectMode($package);
        $workflow = TestWorkflow::buildPackageWorkflow($package);
        $workflowConfig = json_encode([
            'label' => $workflow['label'],
            'allow_random_navigation' => $workflow['allow_random_navigation'],
            'save_behavior' => $workflow['save_behavior'],
            'manual_finish' => $workflow['manual_finish'],
            'total_duration_minutes' => $workflow['total_duration_minutes'],
            'sections' => $workflow['sections'],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $effectiveTimeLimit = (int) round((float) ($workflow['total_duration_minutes'] ?? (int) ($package['time_limit'] ?? 0)));

        $currentConfig = trim((string) ($package['workflow_config'] ?? ''));
        if ((string) ($package['test_mode'] ?? '') !== $mode
            || $currentConfig === ''
            || $currentConfig !== $workflowConfig
            || (int) ($package['time_limit'] ?? 0) !== $effectiveTimeLimit
        ) {
            $packageId = (int) $package['id'];
            $updatePackageStmt->bind_param('ssii', $mode, $workflowConfig, $effectiveTimeLimit, $packageId);
            $updatePackageStmt->execute();
        }

        $packageId = (int) $package['id'];
        $countQuestionsStmt->bind_param('i', $packageId);
        $countQuestionsStmt->execute();
        $questionMeta = $countQuestionsStmt->get_result()->fetch_assoc();
        $questionTotal = (int) ($questionMeta['total'] ?? 0);

        if ($questionTotal <= 0) {
            continue;
        }

        $needsRebuild = (int) ($questionMeta['missing_section_code'] ?? 0) > 0
            || (int) ($questionMeta['missing_section_name'] ?? 0) > 0
            || (int) ($questionMeta['missing_question_order'] ?? 0) > 0;

        if (!$needsRebuild) {
            continue;
        }

        $fetchQuestionIdsStmt->bind_param('i', $packageId);
        $fetchQuestionIdsStmt->execute();
        $questionRows = $fetchQuestionIdsStmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $questionIds = array_map(static function (array $row): int {
            return (int) $row['id'];
        }, $questionRows);

        $sections = $workflow['sections'];
        if (count($sections) === 0) {
            $sections = TestWorkflow::defaultWorkflow(TestWorkflow::MODE_STANDARD, $effectiveTimeLimit)['sections'];
        }

        $allocation = TestWorkflow::allocateQuestionsToSections(count($questionIds), $sections);
        $questionIndex = 0;

        foreach ($sections as $sectionIndex => $section) {
            $countInSection = (int) ($allocation[$sectionIndex] ?? 0);

            for ($order = 1; $order <= $countInSection; $order++) {
                if (!isset($questionIds[$questionIndex])) {
                    break;
                }

                $questionId = (int) $questionIds[$questionIndex];
                $sectionCode = (string) $section['code'];
                $sectionName = (string) $section['name'];
                $sectionOrder = (int) ($section['order'] ?? ($sectionIndex + 1));

                $updateQuestionStmt->bind_param('ssiii', $sectionCode, $sectionName, $sectionOrder, $order, $questionId);
                $updateQuestionStmt->execute();
                $questionIndex++;
            }
        }

        while (isset($questionIds[$questionIndex])) {
            $fallbackSection = $sections[count($sections) - 1];
            $questionId = (int) $questionIds[$questionIndex];
            $sectionCode = (string) $fallbackSection['code'];
            $sectionName = (string) $fallbackSection['name'];
            $sectionOrder = (int) ($fallbackSection['order'] ?? count($sections));
            $questionOrder = $questionIndex + 1;

            $updateQuestionStmt->bind_param('ssiii', $sectionCode, $sectionName, $sectionOrder, $questionOrder, $questionId);
            $updateQuestionStmt->execute();
            $questionIndex++;
        }
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
ensureTestWorkflowSchema($mysqli);
bootstrapDefaultAdmin($mysqli);
