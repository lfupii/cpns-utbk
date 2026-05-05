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
define('GOOGLE_CLIENT_ID', trim((string) env('GOOGLE_CLIENT_ID', env('VITE_GOOGLE_CLIENT_ID', ''))));

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
define('FROM_NAME', env('FROM_NAME', 'Ujiin'));
define('EMAIL_VERIFICATION_EXPIRY_HOURS', (int) env('EMAIL_VERIFICATION_EXPIRY_HOURS', 24));
define('EMAIL_VERIFICATION_URL', env('EMAIL_VERIFICATION_URL', rtrim(FRONTEND_URL, '/') . '/verify-email'));
define('DEFAULT_ADMIN_EMAIL', trim((string) env('DEFAULT_ADMIN_EMAIL', '')));
define('DEFAULT_ADMIN_FULL_NAME', trim((string) env('DEFAULT_ADMIN_FULL_NAME', '')));
define('DEFAULT_ADMIN_PASSWORD_HASH', (string) env('DEFAULT_ADMIN_PASSWORD_HASH', ''));
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
require_once __DIR__ . '/../utils/LearningContent.php';
require_once __DIR__ . '/NewsSeedData.php';

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

function ensureGoogleAuthSchema(mysqli $mysqli): void {
    if (!databaseTableExists($mysqli, 'users')) {
        return;
    }

    if (!databaseColumnExists($mysqli, 'users', 'google_id')) {
        $mysqli->query("ALTER TABLE users ADD COLUMN google_id VARCHAR(255) UNIQUE DEFAULT NULL AFTER password");
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

    if (!databaseColumnExists($mysqli, 'test_packages', 'is_temporarily_disabled')) {
        $mysqli->query(
            "ALTER TABLE test_packages
             ADD COLUMN is_temporarily_disabled TINYINT(1) NOT NULL DEFAULT 0 AFTER workflow_config"
        );
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

    if (!databaseColumnExists($mysqli, 'questions', 'question_image_url')) {
        $mysqli->query("ALTER TABLE questions ADD COLUMN question_image_url VARCHAR(1000) NULL AFTER question_text");
        $schemaChanged = true;
    }

    if (!databaseColumnExists($mysqli, 'questions', 'question_image_layout')) {
        $mysqli->query("ALTER TABLE questions ADD COLUMN question_image_layout VARCHAR(20) NOT NULL DEFAULT 'top' AFTER question_image_url");
        $schemaChanged = true;
    }

    if (databaseColumnExists($mysqli, 'questions', 'question_order')) {
        $mysqli->query("ALTER TABLE questions DROP COLUMN question_order");
        $schemaChanged = true;
    }

    if (databaseTableExists($mysqli, 'question_options') && !databaseColumnExists($mysqli, 'question_options', 'option_image_url')) {
        $mysqli->query("ALTER TABLE question_options ADD COLUMN option_image_url VARCHAR(1000) NULL AFTER option_text");
        $schemaChanged = true;
    }

    $workflowSchemaVersion = '20260415_test_workflow_modes_v4';
    $appliedWorkflowSchemaVersion = getSystemSetting($mysqli, 'test_workflow_schema_version');
    if ($schemaChanged || $appliedWorkflowSchemaVersion !== $workflowSchemaVersion) {
        backfillTestWorkflowData($mysqli);
        setSystemSetting($mysqli, 'test_workflow_schema_version', $workflowSchemaVersion);
    }
}

function ensureTestAttemptProgressSchema(mysqli $mysqli): void {
    if (!databaseTableExists($mysqli, 'test_attempts')) {
        return;
    }

    $schemaChanged = false;

    if (!databaseColumnExists($mysqli, 'test_attempts', 'active_section_order')) {
        $mysqli->query("ALTER TABLE test_attempts ADD COLUMN active_section_order INT NULL AFTER status");
        $schemaChanged = true;
    }

    if (!databaseColumnExists($mysqli, 'test_attempts', 'active_section_started_at')) {
        $mysqli->query("ALTER TABLE test_attempts ADD COLUMN active_section_started_at TIMESTAMP NULL AFTER active_section_order");
        $schemaChanged = true;
    }

    $schemaVersion = '20260406_utbk_attempt_progress_v1';
    $appliedSchemaVersion = getSystemSetting($mysqli, 'utbk_attempt_progress_schema_version');
    if ($schemaChanged || $appliedSchemaVersion !== $schemaVersion) {
        $backfillQuery = "UPDATE test_attempts ta
                          JOIN test_packages tp ON tp.id = ta.package_id
                          SET ta.active_section_order = COALESCE(NULLIF(ta.active_section_order, 0), 1),
                              ta.active_section_started_at = COALESCE(ta.active_section_started_at, ta.start_time)
                          WHERE tp.test_mode = 'utbk_sectioned'
                            AND (
                                ta.active_section_order IS NULL
                                OR ta.active_section_order <= 0
                                OR ta.active_section_started_at IS NULL
                            )";
        $mysqli->query($backfillQuery);
        setSystemSetting($mysqli, 'utbk_attempt_progress_schema_version', $schemaVersion);
    }
}

function ensureAttemptQuestionFlagsSchema(mysqli $mysqli): void {
    if (!databaseTableExists($mysqli, 'test_attempts') || !databaseTableExists($mysqli, 'questions')) {
        return;
    }

    $mysqli->query(
        "CREATE TABLE IF NOT EXISTS attempt_question_flags (
            id INT PRIMARY KEY AUTO_INCREMENT,
            attempt_id INT NOT NULL,
            question_id INT NOT NULL,
            is_marked_review BOOLEAN NOT NULL DEFAULT TRUE,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (attempt_id) REFERENCES test_attempts(id) ON DELETE CASCADE,
            FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
            UNIQUE KEY unique_attempt_question_flag (attempt_id, question_id),
            INDEX (attempt_id, question_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    if (!databaseColumnExists($mysqli, 'attempt_question_flags', 'is_marked_review')) {
        $mysqli->query(
            "ALTER TABLE attempt_question_flags
             ADD COLUMN is_marked_review BOOLEAN NOT NULL DEFAULT TRUE AFTER question_id"
        );
    }

    $schemaVersion = '20260415_attempt_question_flags_v1';
    $appliedSchemaVersion = getSystemSetting($mysqli, 'attempt_question_flags_schema_version');
    if ($appliedSchemaVersion !== $schemaVersion) {
        $mysqli->query(
            "DELETE FROM attempt_question_flags
             WHERE is_marked_review = 0 OR is_marked_review IS NULL"
        );
        setSystemSetting($mysqli, 'attempt_question_flags_schema_version', $schemaVersion);
    }
}

function ensureTryoutScoringSchema(mysqli $mysqli): void {
    if (!databaseTableExists($mysqli, 'test_results')) {
        return;
    }

    if (!databaseColumnExists($mysqli, 'test_results', 'score_details_json')) {
        $mysqli->query(
            "ALTER TABLE test_results
             ADD COLUMN score_details_json LONGTEXT NULL AFTER percentage"
        );
    }
}

function ensureQuestionOptionScoreWeightSchema(mysqli $mysqli): void {
    $optionTables = [
        'question_options',
        'question_option_drafts',
        'learning_section_question_options',
        'learning_section_question_option_drafts',
    ];

    foreach ($optionTables as $tableName) {
        if (!databaseTableExists($mysqli, $tableName) || databaseColumnExists($mysqli, $tableName, 'score_weight')) {
            continue;
        }

        $mysqli->query(
            "ALTER TABLE {$tableName}
             ADD COLUMN score_weight TINYINT NULL AFTER is_correct"
        );
    }
}

function ensureLearningProgressSchema(mysqli $mysqli): void {
    if (!databaseTableExists($mysqli, 'users') || !databaseTableExists($mysqli, 'test_packages')) {
        return;
    }

    $mysqli->query(
        "CREATE TABLE IF NOT EXISTS learning_progress (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT NOT NULL,
            package_id INT NOT NULL,
            section_code VARCHAR(100) NOT NULL,
            milestone_type VARCHAR(50) NOT NULL,
            metadata LONGTEXT NULL,
            completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (package_id) REFERENCES test_packages(id) ON DELETE CASCADE,
            UNIQUE KEY unique_learning_milestone (user_id, package_id, section_code, milestone_type),
            INDEX (user_id, package_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    if (!databaseColumnExists($mysqli, 'learning_progress', 'metadata')) {
        $mysqli->query("ALTER TABLE learning_progress ADD COLUMN metadata LONGTEXT NULL AFTER milestone_type");
    }

    $mysqli->query(
        "CREATE TABLE IF NOT EXISTS learning_materials (
            id INT PRIMARY KEY AUTO_INCREMENT,
            package_id INT NOT NULL,
            section_code VARCHAR(100) NOT NULL,
            title VARCHAR(150) NOT NULL,
            content_json LONGTEXT NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'published',
            source_url VARCHAR(1000) NULL,
            review_notes LONGTEXT NULL,
            published_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (package_id) REFERENCES test_packages(id) ON DELETE CASCADE,
            UNIQUE KEY unique_learning_material (package_id, section_code),
            INDEX (package_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    if (!databaseColumnExists($mysqli, 'learning_materials', 'status')) {
        $mysqli->query(
            "ALTER TABLE learning_materials
             ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'published' AFTER content_json"
        );
    }

    if (!databaseColumnExists($mysqli, 'learning_materials', 'source_url')) {
        $mysqli->query(
            "ALTER TABLE learning_materials
             ADD COLUMN source_url VARCHAR(1000) NULL AFTER status"
        );
    }

    if (!databaseColumnExists($mysqli, 'learning_materials', 'review_notes')) {
        $mysqli->query(
            "ALTER TABLE learning_materials
             ADD COLUMN review_notes LONGTEXT NULL AFTER source_url"
        );
    }

    if (!databaseColumnExists($mysqli, 'learning_materials', 'published_at')) {
        $mysqli->query(
            "ALTER TABLE learning_materials
             ADD COLUMN published_at TIMESTAMP NULL DEFAULT NULL AFTER review_notes"
        );
    }

    $mysqli->query(
        "UPDATE learning_materials
         SET published_at = COALESCE(published_at, updated_at, created_at)
         WHERE status = 'published' AND published_at IS NULL"
    );

    $mysqli->query(
        "CREATE TABLE IF NOT EXISTS test_package_drafts (
            package_id INT PRIMARY KEY,
            category_id INT NOT NULL,
            name VARCHAR(255) NOT NULL,
            description TEXT NULL,
            price INT NOT NULL DEFAULT 0,
            duration_days INT NOT NULL DEFAULT 30,
            max_attempts INT NOT NULL DEFAULT 1,
            question_count INT NOT NULL DEFAULT 0,
            time_limit INT NOT NULL DEFAULT 90,
            test_mode VARCHAR(50) NOT NULL DEFAULT 'standard',
            workflow_config LONGTEXT NULL,
            is_temporarily_disabled TINYINT(1) NOT NULL DEFAULT 0,
            last_saved_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            last_published_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (package_id) REFERENCES test_packages(id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES test_categories(id) ON DELETE CASCADE,
            INDEX (category_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    if (!databaseColumnExists($mysqli, 'test_package_drafts', 'last_saved_at')) {
        $mysqli->query(
            "ALTER TABLE test_package_drafts
             ADD COLUMN last_saved_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP AFTER workflow_config"
        );
    }

    if (!databaseColumnExists($mysqli, 'test_package_drafts', 'is_temporarily_disabled')) {
        $mysqli->query(
            "ALTER TABLE test_package_drafts
             ADD COLUMN is_temporarily_disabled TINYINT(1) NOT NULL DEFAULT 0 AFTER workflow_config"
        );
    }

    if (!databaseColumnExists($mysqli, 'test_package_drafts', 'last_published_at')) {
        $mysqli->query(
            "ALTER TABLE test_package_drafts
             ADD COLUMN last_published_at TIMESTAMP NULL DEFAULT NULL AFTER last_saved_at"
        );
    }

    $mysqli->query(
        "CREATE TABLE IF NOT EXISTS question_drafts (
            id INT PRIMARY KEY AUTO_INCREMENT,
            package_id INT NOT NULL,
            question_text LONGTEXT NOT NULL,
            question_image_url VARCHAR(1000) DEFAULT NULL,
            question_image_layout VARCHAR(20) NOT NULL DEFAULT 'top',
            question_type VARCHAR(50) NOT NULL DEFAULT 'single_choice',
            difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
            explanation_notes LONGTEXT NULL,
            section_code VARCHAR(100) DEFAULT NULL,
            section_name VARCHAR(255) DEFAULT NULL,
            section_order INT NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (package_id) REFERENCES test_packages(id) ON DELETE CASCADE,
            INDEX (package_id, section_code),
            INDEX (package_id, section_order)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    if (!databaseColumnExists($mysqli, 'questions', 'explanation_notes')) {
        $mysqli->query(
            "ALTER TABLE questions
             ADD COLUMN explanation_notes LONGTEXT NULL AFTER difficulty"
        );
    }

    if (!databaseColumnExists($mysqli, 'question_drafts', 'explanation_notes')) {
        $mysqli->query(
            "ALTER TABLE question_drafts
             ADD COLUMN explanation_notes LONGTEXT NULL AFTER difficulty"
        );
    }

    $mysqli->query(
        "CREATE TABLE IF NOT EXISTS question_option_drafts (
            id INT PRIMARY KEY AUTO_INCREMENT,
            question_id INT NOT NULL,
            option_letter VARCHAR(5) NOT NULL,
            option_text LONGTEXT NOT NULL,
            option_image_url VARCHAR(1000) DEFAULT NULL,
            is_correct BOOLEAN DEFAULT FALSE,
            score_weight TINYINT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (question_id) REFERENCES question_drafts(id) ON DELETE CASCADE,
            INDEX (question_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $mysqli->query(
        "CREATE TABLE IF NOT EXISTS learning_material_drafts (
            id INT PRIMARY KEY AUTO_INCREMENT,
            package_id INT NOT NULL,
            section_code VARCHAR(100) NOT NULL,
            title VARCHAR(150) NOT NULL,
            content_json LONGTEXT NOT NULL,
            source_url VARCHAR(1000) NULL,
            review_notes LONGTEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (package_id) REFERENCES test_packages(id) ON DELETE CASCADE,
            UNIQUE KEY unique_learning_material_draft (package_id, section_code),
            INDEX (package_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $mysqli->query(
        "CREATE TABLE IF NOT EXISTS learning_section_question_drafts (
            id INT PRIMARY KEY AUTO_INCREMENT,
            package_id INT NOT NULL,
            section_code VARCHAR(100) NOT NULL,
            question_text LONGTEXT NOT NULL,
            question_image_url VARCHAR(1000) DEFAULT NULL,
            material_topic VARCHAR(255) DEFAULT NULL,
            difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
            explanation_notes LONGTEXT NULL,
            question_order INT NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (package_id) REFERENCES test_packages(id) ON DELETE CASCADE,
            INDEX (package_id, section_code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $mysqli->query(
        "CREATE TABLE IF NOT EXISTS learning_section_question_option_drafts (
            id INT PRIMARY KEY AUTO_INCREMENT,
            question_id INT NOT NULL,
            option_letter VARCHAR(5) NOT NULL,
            option_text LONGTEXT NOT NULL,
            option_image_url VARCHAR(1000) DEFAULT NULL,
            is_correct BOOLEAN DEFAULT FALSE,
            score_weight TINYINT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (question_id) REFERENCES learning_section_question_drafts(id) ON DELETE CASCADE,
            INDEX (question_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $mysqli->query(
        "CREATE TABLE IF NOT EXISTS learning_section_questions (
            id INT PRIMARY KEY AUTO_INCREMENT,
            package_id INT NOT NULL,
            section_code VARCHAR(100) NOT NULL,
            question_text LONGTEXT NOT NULL,
            question_image_url VARCHAR(1000) DEFAULT NULL,
            material_topic VARCHAR(255) DEFAULT NULL,
            difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
            explanation_notes LONGTEXT NULL,
            question_order INT NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (package_id) REFERENCES test_packages(id) ON DELETE CASCADE,
            INDEX (package_id, section_code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $mysqli->query(
        "CREATE TABLE IF NOT EXISTS learning_section_question_options (
            id INT PRIMARY KEY AUTO_INCREMENT,
            question_id INT NOT NULL,
            option_letter VARCHAR(5) NOT NULL,
            option_text LONGTEXT NOT NULL,
            option_image_url VARCHAR(1000) DEFAULT NULL,
            is_correct BOOLEAN DEFAULT FALSE,
            score_weight TINYINT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (question_id) REFERENCES learning_section_questions(id) ON DELETE CASCADE,
            INDEX (question_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    if (!databaseColumnExists($mysqli, 'learning_section_questions', 'question_image_url')) {
        $mysqli->query("ALTER TABLE learning_section_questions ADD COLUMN question_image_url VARCHAR(1000) NULL AFTER question_text");
    }

    if (!databaseColumnExists($mysqli, 'learning_section_questions', 'material_topic')) {
        $mysqli->query("ALTER TABLE learning_section_questions ADD COLUMN material_topic VARCHAR(255) NULL AFTER question_image_url");
    }

    if (!databaseColumnExists($mysqli, 'learning_section_question_drafts', 'material_topic')) {
        $mysqli->query("ALTER TABLE learning_section_question_drafts ADD COLUMN material_topic VARCHAR(255) NULL AFTER question_image_url");
    }

    if (!databaseColumnExists($mysqli, 'learning_section_questions', 'explanation_notes')) {
        $mysqli->query("ALTER TABLE learning_section_questions ADD COLUMN explanation_notes LONGTEXT NULL AFTER difficulty");
    }

    if (!databaseColumnExists($mysqli, 'learning_section_question_drafts', 'explanation_notes')) {
        $mysqli->query("ALTER TABLE learning_section_question_drafts ADD COLUMN explanation_notes LONGTEXT NULL AFTER difficulty");
    }

    if (!databaseColumnExists($mysqli, 'learning_section_question_options', 'option_image_url')) {
        $mysqli->query("ALTER TABLE learning_section_question_options ADD COLUMN option_image_url VARCHAR(1000) NULL AFTER option_text");
    }

    $mysqli->query(
        "CREATE TABLE IF NOT EXISTS learning_section_test_attempts (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT NOT NULL,
            package_id INT NOT NULL,
            section_code VARCHAR(100) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'ongoing',
            duration_seconds INT NOT NULL DEFAULT 0,
            answers_json LONGTEXT NULL,
            review_flags_json LONGTEXT NULL,
            result_json LONGTEXT NULL,
            start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            end_time TIMESTAMP NULL DEFAULT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (package_id) REFERENCES test_packages(id) ON DELETE CASCADE,
            INDEX (user_id, package_id, section_code, status),
            INDEX (package_id, section_code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    if (!databaseColumnExists($mysqli, 'learning_section_test_attempts', 'duration_seconds')) {
        $mysqli->query(
            "ALTER TABLE learning_section_test_attempts
             ADD COLUMN duration_seconds INT NOT NULL DEFAULT 0 AFTER status"
        );
    }

    if (!databaseColumnExists($mysqli, 'learning_section_test_attempts', 'answers_json')) {
        $mysqli->query(
            "ALTER TABLE learning_section_test_attempts
             ADD COLUMN answers_json LONGTEXT NULL AFTER duration_seconds"
        );
    }

    if (!databaseColumnExists($mysqli, 'learning_section_test_attempts', 'review_flags_json')) {
        $mysqli->query(
            "ALTER TABLE learning_section_test_attempts
             ADD COLUMN review_flags_json LONGTEXT NULL AFTER answers_json"
        );
    }

    if (!databaseColumnExists($mysqli, 'learning_section_test_attempts', 'result_json')) {
        $mysqli->query(
            "ALTER TABLE learning_section_test_attempts
             ADD COLUMN result_json LONGTEXT NULL AFTER review_flags_json"
        );
    }

    if (!databaseColumnExists($mysqli, 'learning_section_test_attempts', 'end_time')) {
        $mysqli->query(
            "ALTER TABLE learning_section_test_attempts
             ADD COLUMN end_time TIMESTAMP NULL DEFAULT NULL AFTER start_time"
        );
    }

    seedDefaultLearningContent($mysqli);
    migrateLegacyLearningMaterialDrafts($mysqli);
    refreshTwkDraftMaterials($mysqli);
}

function ensureNewsArticleSchema(mysqli $mysqli): void {
    if (!databaseTableExists($mysqli, 'news_articles')) {
        $mysqli->query(
            "CREATE TABLE IF NOT EXISTS news_articles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                slug VARCHAR(180) NOT NULL UNIQUE,
                title VARCHAR(255) NOT NULL,
                excerpt TEXT NULL,
                content LONGTEXT NULL,
                cover_image_url TEXT NULL,
                category VARCHAR(100) NOT NULL DEFAULT 'Nasional',
                author_name VARCHAR(150) NOT NULL DEFAULT 'Tim Redaksi',
                read_time_minutes INT NOT NULL DEFAULT 4,
                status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
                visibility VARCHAR(32) NOT NULL DEFAULT 'public',
                tags_json LONGTEXT NULL,
                focus_keyword VARCHAR(255) NOT NULL DEFAULT '',
                allow_comments TINYINT(1) NOT NULL DEFAULT 1,
                is_featured TINYINT(1) NOT NULL DEFAULT 0,
                featured_order INT NOT NULL DEFAULT 0,
                is_popular TINYINT(1) NOT NULL DEFAULT 0,
                popular_order INT NOT NULL DEFAULT 0,
                is_editor_pick TINYINT(1) NOT NULL DEFAULT 0,
                editor_pick_order INT NOT NULL DEFAULT 0,
                published_at TIMESTAMP NULL DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_news_status_published (status, published_at),
                INDEX idx_news_featured (is_featured, featured_order, published_at),
                INDEX idx_news_popular (is_popular, popular_order, published_at),
                INDEX idx_news_editor_pick (is_editor_pick, editor_pick_order, published_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );
    }

    $columnDefinitions = [
        'slug' => "ALTER TABLE news_articles ADD COLUMN slug VARCHAR(180) NOT NULL UNIQUE AFTER id",
        'title' => "ALTER TABLE news_articles ADD COLUMN title VARCHAR(255) NOT NULL AFTER slug",
        'excerpt' => "ALTER TABLE news_articles ADD COLUMN excerpt TEXT NULL AFTER title",
        'content' => "ALTER TABLE news_articles ADD COLUMN content LONGTEXT NULL AFTER excerpt",
        'cover_image_url' => "ALTER TABLE news_articles ADD COLUMN cover_image_url TEXT NULL AFTER content",
        'category' => "ALTER TABLE news_articles ADD COLUMN category VARCHAR(100) NOT NULL DEFAULT 'Nasional' AFTER cover_image_url",
        'author_name' => "ALTER TABLE news_articles ADD COLUMN author_name VARCHAR(150) NOT NULL DEFAULT 'Tim Redaksi' AFTER category",
        'read_time_minutes' => "ALTER TABLE news_articles ADD COLUMN read_time_minutes INT NOT NULL DEFAULT 4 AFTER author_name",
        'status' => "ALTER TABLE news_articles ADD COLUMN status ENUM('draft', 'published') NOT NULL DEFAULT 'draft' AFTER read_time_minutes",
        'visibility' => "ALTER TABLE news_articles ADD COLUMN visibility VARCHAR(32) NOT NULL DEFAULT 'public' AFTER status",
        'tags_json' => "ALTER TABLE news_articles ADD COLUMN tags_json LONGTEXT NULL AFTER visibility",
        'focus_keyword' => "ALTER TABLE news_articles ADD COLUMN focus_keyword VARCHAR(255) NOT NULL DEFAULT '' AFTER tags_json",
        'allow_comments' => "ALTER TABLE news_articles ADD COLUMN allow_comments TINYINT(1) NOT NULL DEFAULT 1 AFTER focus_keyword",
        'is_featured' => "ALTER TABLE news_articles ADD COLUMN is_featured TINYINT(1) NOT NULL DEFAULT 0 AFTER allow_comments",
        'featured_order' => "ALTER TABLE news_articles ADD COLUMN featured_order INT NOT NULL DEFAULT 0 AFTER is_featured",
        'is_popular' => "ALTER TABLE news_articles ADD COLUMN is_popular TINYINT(1) NOT NULL DEFAULT 0 AFTER featured_order",
        'popular_order' => "ALTER TABLE news_articles ADD COLUMN popular_order INT NOT NULL DEFAULT 0 AFTER is_popular",
        'is_editor_pick' => "ALTER TABLE news_articles ADD COLUMN is_editor_pick TINYINT(1) NOT NULL DEFAULT 0 AFTER popular_order",
        'editor_pick_order' => "ALTER TABLE news_articles ADD COLUMN editor_pick_order INT NOT NULL DEFAULT 0 AFTER is_editor_pick",
        'published_at' => "ALTER TABLE news_articles ADD COLUMN published_at TIMESTAMP NULL DEFAULT NULL AFTER editor_pick_order",
        'created_at' => "ALTER TABLE news_articles ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER published_at",
        'updated_at' => "ALTER TABLE news_articles ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at",
    ];

    foreach ($columnDefinitions as $columnName => $statement) {
        if (!databaseColumnExists($mysqli, 'news_articles', $columnName)) {
            $mysqli->query($statement);
        }
    }
}

function ensureNewsArticleDraftSchema(mysqli $mysqli): void {
    if (!databaseTableExists($mysqli, 'news_article_drafts')) {
        $mysqli->query(
            "CREATE TABLE IF NOT EXISTS news_article_drafts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                article_id INT NULL UNIQUE,
                slug VARCHAR(180) NOT NULL UNIQUE,
                title VARCHAR(255) NOT NULL,
                excerpt TEXT NULL,
                content LONGTEXT NULL,
                cover_image_url TEXT NULL,
                category VARCHAR(100) NOT NULL DEFAULT 'Nasional',
                author_name VARCHAR(150) NOT NULL DEFAULT 'Tim Redaksi',
                read_time_minutes INT NOT NULL DEFAULT 4,
                status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
                visibility VARCHAR(32) NOT NULL DEFAULT 'public',
                tags_json LONGTEXT NULL,
                focus_keyword VARCHAR(255) NOT NULL DEFAULT '',
                allow_comments TINYINT(1) NOT NULL DEFAULT 1,
                is_featured TINYINT(1) NOT NULL DEFAULT 0,
                featured_order INT NOT NULL DEFAULT 0,
                is_popular TINYINT(1) NOT NULL DEFAULT 0,
                popular_order INT NOT NULL DEFAULT 0,
                is_editor_pick TINYINT(1) NOT NULL DEFAULT 0,
                editor_pick_order INT NOT NULL DEFAULT 0,
                published_at TIMESTAMP NULL DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                last_saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                last_published_at TIMESTAMP NULL DEFAULT NULL,
                INDEX idx_news_drafts_status_saved (status, last_saved_at),
                INDEX idx_news_drafts_publish (article_id, last_published_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );
    }

    $columnDefinitions = [
        'article_id' => "ALTER TABLE news_article_drafts ADD COLUMN article_id INT NULL UNIQUE AFTER id",
        'slug' => "ALTER TABLE news_article_drafts ADD COLUMN slug VARCHAR(180) NOT NULL UNIQUE AFTER article_id",
        'title' => "ALTER TABLE news_article_drafts ADD COLUMN title VARCHAR(255) NOT NULL AFTER slug",
        'excerpt' => "ALTER TABLE news_article_drafts ADD COLUMN excerpt TEXT NULL AFTER title",
        'content' => "ALTER TABLE news_article_drafts ADD COLUMN content LONGTEXT NULL AFTER excerpt",
        'cover_image_url' => "ALTER TABLE news_article_drafts ADD COLUMN cover_image_url TEXT NULL AFTER content",
        'category' => "ALTER TABLE news_article_drafts ADD COLUMN category VARCHAR(100) NOT NULL DEFAULT 'Nasional' AFTER cover_image_url",
        'author_name' => "ALTER TABLE news_article_drafts ADD COLUMN author_name VARCHAR(150) NOT NULL DEFAULT 'Tim Redaksi' AFTER category",
        'read_time_minutes' => "ALTER TABLE news_article_drafts ADD COLUMN read_time_minutes INT NOT NULL DEFAULT 4 AFTER author_name",
        'status' => "ALTER TABLE news_article_drafts ADD COLUMN status ENUM('draft', 'published') NOT NULL DEFAULT 'draft' AFTER read_time_minutes",
        'visibility' => "ALTER TABLE news_article_drafts ADD COLUMN visibility VARCHAR(32) NOT NULL DEFAULT 'public' AFTER status",
        'tags_json' => "ALTER TABLE news_article_drafts ADD COLUMN tags_json LONGTEXT NULL AFTER visibility",
        'focus_keyword' => "ALTER TABLE news_article_drafts ADD COLUMN focus_keyword VARCHAR(255) NOT NULL DEFAULT '' AFTER tags_json",
        'allow_comments' => "ALTER TABLE news_article_drafts ADD COLUMN allow_comments TINYINT(1) NOT NULL DEFAULT 1 AFTER focus_keyword",
        'is_featured' => "ALTER TABLE news_article_drafts ADD COLUMN is_featured TINYINT(1) NOT NULL DEFAULT 0 AFTER allow_comments",
        'featured_order' => "ALTER TABLE news_article_drafts ADD COLUMN featured_order INT NOT NULL DEFAULT 0 AFTER is_featured",
        'is_popular' => "ALTER TABLE news_article_drafts ADD COLUMN is_popular TINYINT(1) NOT NULL DEFAULT 0 AFTER featured_order",
        'popular_order' => "ALTER TABLE news_article_drafts ADD COLUMN popular_order INT NOT NULL DEFAULT 0 AFTER is_popular",
        'is_editor_pick' => "ALTER TABLE news_article_drafts ADD COLUMN is_editor_pick TINYINT(1) NOT NULL DEFAULT 0 AFTER popular_order",
        'editor_pick_order' => "ALTER TABLE news_article_drafts ADD COLUMN editor_pick_order INT NOT NULL DEFAULT 0 AFTER is_editor_pick",
        'published_at' => "ALTER TABLE news_article_drafts ADD COLUMN published_at TIMESTAMP NULL DEFAULT NULL AFTER editor_pick_order",
        'created_at' => "ALTER TABLE news_article_drafts ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER published_at",
        'updated_at' => "ALTER TABLE news_article_drafts ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at",
        'last_saved_at' => "ALTER TABLE news_article_drafts ADD COLUMN last_saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER updated_at",
        'last_published_at' => "ALTER TABLE news_article_drafts ADD COLUMN last_published_at TIMESTAMP NULL DEFAULT NULL AFTER last_saved_at",
    ];

    foreach ($columnDefinitions as $columnName => $statement) {
        if (!databaseColumnExists($mysqli, 'news_article_drafts', $columnName)) {
            $mysqli->query($statement);
        }
    }
}

function ensureNewsSectionSchema(mysqli $mysqli): void {
    $mysqli->query(
        "CREATE TABLE IF NOT EXISTS news_sections (
            id INT AUTO_INCREMENT PRIMARY KEY,
            slug VARCHAR(180) NOT NULL UNIQUE,
            title VARCHAR(255) NOT NULL,
            description TEXT NULL,
            layout_style VARCHAR(40) NOT NULL DEFAULT 'cards',
            article_count INT NOT NULL DEFAULT 5,
            section_order INT NOT NULL DEFAULT 0,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_news_sections_order (section_order, is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $publishedSectionColumns = [
        'slug' => "ALTER TABLE news_sections ADD COLUMN slug VARCHAR(180) NOT NULL UNIQUE AFTER id",
        'title' => "ALTER TABLE news_sections ADD COLUMN title VARCHAR(255) NOT NULL AFTER slug",
        'description' => "ALTER TABLE news_sections ADD COLUMN description TEXT NULL AFTER title",
        'layout_style' => "ALTER TABLE news_sections ADD COLUMN layout_style VARCHAR(40) NOT NULL DEFAULT 'cards' AFTER description",
        'article_count' => "ALTER TABLE news_sections ADD COLUMN article_count INT NOT NULL DEFAULT 5 AFTER layout_style",
        'section_order' => "ALTER TABLE news_sections ADD COLUMN section_order INT NOT NULL DEFAULT 0 AFTER article_count",
        'is_active' => "ALTER TABLE news_sections ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER section_order",
        'created_at' => "ALTER TABLE news_sections ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER is_active",
        'updated_at' => "ALTER TABLE news_sections ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at",
    ];

    foreach ($publishedSectionColumns as $columnName => $statement) {
        if (!databaseColumnExists($mysqli, 'news_sections', $columnName)) {
            $mysqli->query($statement);
        }
    }

    $mysqli->query(
        "CREATE TABLE IF NOT EXISTS news_section_articles (
            id INT AUTO_INCREMENT PRIMARY KEY,
            section_id INT NOT NULL,
            article_id INT NOT NULL,
            article_order INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_news_section_article (section_id, article_id),
            INDEX idx_news_section_article_order (section_id, article_order)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $publishedSectionRelationColumns = [
        'section_id' => "ALTER TABLE news_section_articles ADD COLUMN section_id INT NOT NULL AFTER id",
        'article_id' => "ALTER TABLE news_section_articles ADD COLUMN article_id INT NOT NULL AFTER section_id",
        'article_order' => "ALTER TABLE news_section_articles ADD COLUMN article_order INT NOT NULL DEFAULT 0 AFTER article_id",
        'created_at' => "ALTER TABLE news_section_articles ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER article_order",
        'updated_at' => "ALTER TABLE news_section_articles ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at",
    ];

    foreach ($publishedSectionRelationColumns as $columnName => $statement) {
        if (!databaseColumnExists($mysqli, 'news_section_articles', $columnName)) {
            $mysqli->query($statement);
        }
    }
}

function ensureNewsSectionDraftSchema(mysqli $mysqli): void {
    $mysqli->query(
        "CREATE TABLE IF NOT EXISTS news_section_drafts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            section_id INT NULL UNIQUE,
            slug VARCHAR(180) NOT NULL UNIQUE,
            title VARCHAR(255) NOT NULL,
            description TEXT NULL,
            layout_style VARCHAR(40) NOT NULL DEFAULT 'cards',
            article_count INT NOT NULL DEFAULT 5,
            section_order INT NOT NULL DEFAULT 0,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            last_saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            last_published_at TIMESTAMP NULL DEFAULT NULL,
            INDEX idx_news_section_drafts_order (section_order, is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $draftSectionColumns = [
        'section_id' => "ALTER TABLE news_section_drafts ADD COLUMN section_id INT NULL UNIQUE AFTER id",
        'slug' => "ALTER TABLE news_section_drafts ADD COLUMN slug VARCHAR(180) NOT NULL UNIQUE AFTER section_id",
        'title' => "ALTER TABLE news_section_drafts ADD COLUMN title VARCHAR(255) NOT NULL AFTER slug",
        'description' => "ALTER TABLE news_section_drafts ADD COLUMN description TEXT NULL AFTER title",
        'layout_style' => "ALTER TABLE news_section_drafts ADD COLUMN layout_style VARCHAR(40) NOT NULL DEFAULT 'cards' AFTER description",
        'article_count' => "ALTER TABLE news_section_drafts ADD COLUMN article_count INT NOT NULL DEFAULT 5 AFTER layout_style",
        'section_order' => "ALTER TABLE news_section_drafts ADD COLUMN section_order INT NOT NULL DEFAULT 0 AFTER article_count",
        'is_active' => "ALTER TABLE news_section_drafts ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER section_order",
        'created_at' => "ALTER TABLE news_section_drafts ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER is_active",
        'updated_at' => "ALTER TABLE news_section_drafts ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at",
        'last_saved_at' => "ALTER TABLE news_section_drafts ADD COLUMN last_saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER updated_at",
        'last_published_at' => "ALTER TABLE news_section_drafts ADD COLUMN last_published_at TIMESTAMP NULL DEFAULT NULL AFTER last_saved_at",
    ];

    foreach ($draftSectionColumns as $columnName => $statement) {
        if (!databaseColumnExists($mysqli, 'news_section_drafts', $columnName)) {
            $mysqli->query($statement);
        }
    }

    $mysqli->query(
        "CREATE TABLE IF NOT EXISTS news_section_draft_articles (
            id INT AUTO_INCREMENT PRIMARY KEY,
            section_draft_id INT NOT NULL,
            draft_article_id INT NOT NULL,
            article_order INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_news_section_draft_article (section_draft_id, draft_article_id),
            INDEX idx_news_section_draft_article_order (section_draft_id, article_order)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $draftSectionRelationColumns = [
        'section_draft_id' => "ALTER TABLE news_section_draft_articles ADD COLUMN section_draft_id INT NOT NULL AFTER id",
        'draft_article_id' => "ALTER TABLE news_section_draft_articles ADD COLUMN draft_article_id INT NOT NULL AFTER section_draft_id",
        'article_order' => "ALTER TABLE news_section_draft_articles ADD COLUMN article_order INT NOT NULL DEFAULT 0 AFTER draft_article_id",
        'created_at' => "ALTER TABLE news_section_draft_articles ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER article_order",
        'updated_at' => "ALTER TABLE news_section_draft_articles ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at",
    ];

    foreach ($draftSectionRelationColumns as $columnName => $statement) {
        if (!databaseColumnExists($mysqli, 'news_section_draft_articles', $columnName)) {
            $mysqli->query($statement);
        }
    }
}

function ensureNewsCommentSchema(mysqli $mysqli): void {
    if (!databaseTableExists($mysqli, 'users') || !databaseTableExists($mysqli, 'news_articles')) {
        return;
    }

    $mysqli->query(
        "CREATE TABLE IF NOT EXISTS news_article_comments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            article_id INT NOT NULL,
            user_id INT NOT NULL,
            comment_text TEXT NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'published',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_news_comments_article (article_id, status, created_at),
            INDEX idx_news_comments_user (user_id, created_at),
            CONSTRAINT fk_news_comments_article
                FOREIGN KEY (article_id) REFERENCES news_articles(id) ON DELETE CASCADE,
            CONSTRAINT fk_news_comments_user
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $commentColumns = [
        'article_id' => "ALTER TABLE news_article_comments ADD COLUMN article_id INT NOT NULL AFTER id",
        'user_id' => "ALTER TABLE news_article_comments ADD COLUMN user_id INT NOT NULL AFTER article_id",
        'comment_text' => "ALTER TABLE news_article_comments ADD COLUMN comment_text TEXT NOT NULL AFTER user_id",
        'status' => "ALTER TABLE news_article_comments ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'published' AFTER comment_text",
        'created_at' => "ALTER TABLE news_article_comments ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER status",
        'updated_at' => "ALTER TABLE news_article_comments ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at",
    ];

    foreach ($commentColumns as $columnName => $statement) {
        if (!databaseColumnExists($mysqli, 'news_article_comments', $columnName)) {
            $mysqli->query($statement);
        }
    }
}

function seedDefaultNewsContent(mysqli $mysqli): void {
    if (
        !databaseTableExists($mysqli, 'news_articles')
        || !databaseTableExists($mysqli, 'news_sections')
        || !databaseTableExists($mysqli, 'news_section_articles')
        || !function_exists('getDefaultNewsSeedFeed')
        || !function_exists('buildDefaultNewsSeedContent')
    ) {
        return;
    }

    $seedStateKey = 'default_news_seed_initialized';
    if (getSystemSetting($mysqli, $seedStateKey) !== null) {
        return;
    }

    $countTables = [
        'news_articles',
        'news_article_drafts',
        'news_sections',
        'news_section_drafts',
        'news_section_articles',
        'news_section_draft_articles',
    ];

    foreach ($countTables as $tableName) {
        if (!databaseTableExists($mysqli, $tableName)) {
            return;
        }

        $result = $mysqli->query("SELECT COUNT(*) AS total FROM {$tableName}");
        $row = $result ? $result->fetch_assoc() : null;
        if ((int) ($row['total'] ?? 0) > 0) {
            return;
        }
    }

    $feed = getDefaultNewsSeedFeed();
    $sections = is_array($feed['sections'] ?? null) ? $feed['sections'] : [];
    if ($sections === []) {
        return;
    }

    $uniqueStoriesBySlug = [];
    $sectionAssignments = [];

    foreach ($sections as $sectionIndex => $section) {
        $sectionSlug = trim((string) ($section['slug'] ?? ''));
        if ($sectionSlug === '') {
            continue;
        }

        $sectionAssignments[$sectionSlug] = [];
        $items = is_array($section['items'] ?? null) ? $section['items'] : [];
        foreach ($items as $storyIndex => $story) {
            $storySlug = trim((string) ($story['slug'] ?? ''));
            if ($storySlug === '') {
                continue;
            }

            if (!isset($uniqueStoriesBySlug[$storySlug])) {
                $publishedOffsetMinutes = max(1, (int) ($story['published_offset_minutes'] ?? (($sectionIndex + 1) * 60) + ($storyIndex * 15)));
                $tags = is_array($story['tags'] ?? null)
                    ? array_values(array_filter(array_map('strval', $story['tags'])))
                    : [];
                $category = trim((string) ($story['category'] ?? '')) ?: 'Nasional';

                $uniqueStoriesBySlug[$storySlug] = [
                    'slug' => $storySlug,
                    'title' => trim((string) ($story['title'] ?? '')) ?: 'Berita tanpa judul',
                    'excerpt' => trim((string) ($story['excerpt'] ?? '')),
                    'content' => trim((string) ($story['content'] ?? '')) ?: buildDefaultNewsSeedContent($story),
                    'cover_image_url' => trim((string) ($story['image'] ?? '')),
                    'category' => $category,
                    'author_name' => trim((string) ($story['author'] ?? '')) ?: 'Tim Redaksi',
                    'read_time_minutes' => max(1, (int) ($story['read_time_minutes'] ?? 4)),
                    'status' => 'published',
                    'visibility' => 'public',
                    'tags_json' => json_encode($tags, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    'focus_keyword' => trim((string) ($story['focus_keyword'] ?? ($tags[0] ?? $category))),
                    'allow_comments' => 1,
                    'is_featured' => $sectionSlug === 'sorotan-cpns-utbk' ? 1 : 0,
                    'featured_order' => $sectionSlug === 'sorotan-cpns-utbk' ? ($storyIndex + 1) : 0,
                    'is_popular' => $sectionSlug === 'terpopuler' ? 1 : 0,
                    'popular_order' => $sectionSlug === 'terpopuler' ? ($storyIndex + 1) : 0,
                    'is_editor_pick' => $sectionSlug === 'pilihan-redaksi' ? 1 : 0,
                    'editor_pick_order' => $sectionSlug === 'pilihan-redaksi' ? ($storyIndex + 1) : 0,
                    'published_at' => date('Y-m-d H:i:s', time() - ($publishedOffsetMinutes * 60)),
                ];
            }

            $sectionAssignments[$sectionSlug][] = $storySlug;
        }
    }

    if ($uniqueStoriesBySlug === [] || $sectionAssignments === []) {
        return;
    }

    $insertArticle = $mysqli->prepare(
        'INSERT INTO news_articles (
            slug, title, excerpt, content, cover_image_url, category, author_name,
            read_time_minutes, status, visibility, tags_json, focus_keyword, allow_comments,
            is_featured, featured_order, is_popular, popular_order, is_editor_pick,
            editor_pick_order, published_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $insertSection = $mysqli->prepare(
        'INSERT INTO news_sections (
            slug, title, description, layout_style, article_count, section_order, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $insertSectionRelation = $mysqli->prepare(
        'INSERT INTO news_section_articles (section_id, article_id, article_order)
         VALUES (?, ?, ?)'
    );

    $articleIdBySlug = [];
    $transactionStarted = false;

    try {
        $mysqli->begin_transaction();
        $transactionStarted = true;

        foreach ($uniqueStoriesBySlug as $story) {
            $insertArticle->bind_param(
                'sssssssissssiiiiiiis',
                $story['slug'],
                $story['title'],
                $story['excerpt'],
                $story['content'],
                $story['cover_image_url'],
                $story['category'],
                $story['author_name'],
                $story['read_time_minutes'],
                $story['status'],
                $story['visibility'],
                $story['tags_json'],
                $story['focus_keyword'],
                $story['allow_comments'],
                $story['is_featured'],
                $story['featured_order'],
                $story['is_popular'],
                $story['popular_order'],
                $story['is_editor_pick'],
                $story['editor_pick_order'],
                $story['published_at']
            );
            $insertArticle->execute();
            $articleIdBySlug[$story['slug']] = (int) $insertArticle->insert_id;
        }

        foreach ($sections as $sectionIndex => $section) {
            $sectionSlug = trim((string) ($section['slug'] ?? ''));
            if ($sectionSlug === '' || !isset($sectionAssignments[$sectionSlug])) {
                continue;
            }

            $title = trim((string) ($section['title'] ?? '')) ?: 'Section Berita';
            $description = trim((string) ($section['description'] ?? ''));
            $layoutStyle = trim((string) ($section['layout_style'] ?? '')) ?: 'cards';
            $articleCount = max(1, (int) ($section['article_count'] ?? count($sectionAssignments[$sectionSlug])));
            $sectionOrder = max(0, (int) ($section['section_order'] ?? ($sectionIndex + 1)));
            $isActive = 1;

            $insertSection->bind_param(
                'ssssiii',
                $sectionSlug,
                $title,
                $description,
                $layoutStyle,
                $articleCount,
                $sectionOrder,
                $isActive
            );
            $insertSection->execute();
            $sectionId = (int) $insertSection->insert_id;

            foreach ($sectionAssignments[$sectionSlug] as $storyIndex => $storySlug) {
                $articleId = (int) ($articleIdBySlug[$storySlug] ?? 0);
                if ($articleId <= 0) {
                    continue;
                }

                $articleOrder = $storyIndex + 1;
                $insertSectionRelation->bind_param('iii', $sectionId, $articleId, $articleOrder);
                $insertSectionRelation->execute();
            }
        }

        setSystemSetting($mysqli, $seedStateKey, json_encode([
            'seeded' => true,
            'articles' => count($articleIdBySlug),
            'sections' => count($sectionAssignments),
            'seeded_at' => date(DATE_ATOM),
        ], JSON_UNESCAPED_SLASHES));

        $mysqli->commit();
    } catch (Throwable $error) {
        if ($transactionStarted) {
            $mysqli->rollback();
        }

        error_log('Default news seed failed: ' . $error->getMessage());
    }
}

function hydrateNewsDraftWorkspace(mysqli $mysqli): void {
    $requiredTables = [
        'news_articles',
        'news_article_drafts',
        'news_sections',
        'news_section_articles',
        'news_section_drafts',
        'news_section_draft_articles',
    ];

    foreach ($requiredTables as $tableName) {
        if (!databaseTableExists($mysqli, $tableName)) {
            return;
        }
    }

    $publishedArticles = $mysqli->query('SELECT * FROM news_articles ORDER BY id ASC');
    if (!$publishedArticles) {
        return;
    }

    $findDraftArticle = $mysqli->prepare('SELECT id FROM news_article_drafts WHERE article_id = ? LIMIT 1');
    $insertDraftArticle = $mysqli->prepare(
        'INSERT INTO news_article_drafts (
            article_id, slug, title, excerpt, content, cover_image_url, category, author_name,
            read_time_minutes, status, visibility, tags_json, focus_keyword, allow_comments,
            is_featured, featured_order, is_popular, popular_order, is_editor_pick,
            editor_pick_order, published_at, last_published_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
    );

    while ($row = $publishedArticles->fetch_assoc()) {
        $publishedArticleId = (int) ($row['id'] ?? 0);
        if ($publishedArticleId <= 0) {
            continue;
        }

        $findDraftArticle->bind_param('i', $publishedArticleId);
        $findDraftArticle->execute();
        if ($findDraftArticle->get_result()->fetch_assoc()) {
            continue;
        }

        $slug = (string) ($row['slug'] ?? '');
        $title = (string) ($row['title'] ?? '');
        $excerpt = (string) ($row['excerpt'] ?? '');
        $content = (string) ($row['content'] ?? '');
        $coverImageUrl = (string) ($row['cover_image_url'] ?? '');
        $category = (string) ($row['category'] ?? 'Nasional');
        $authorName = (string) ($row['author_name'] ?? 'Tim Redaksi');
        $readTimeMinutes = max(1, (int) ($row['read_time_minutes'] ?? 4));
        $status = (string) ($row['status'] ?? 'published');
        $visibility = (string) ($row['visibility'] ?? 'public');
        $tagsJson = (string) ($row['tags_json'] ?? '[]');
        $focusKeyword = (string) ($row['focus_keyword'] ?? '');
        $allowComments = (int) ($row['allow_comments'] ?? 1);
        $isFeatured = (int) ($row['is_featured'] ?? 0);
        $featuredOrder = (int) ($row['featured_order'] ?? 0);
        $isPopular = (int) ($row['is_popular'] ?? 0);
        $popularOrder = (int) ($row['popular_order'] ?? 0);
        $isEditorPick = (int) ($row['is_editor_pick'] ?? 0);
        $editorPickOrder = (int) ($row['editor_pick_order'] ?? 0);
        $publishedAt = $row['published_at'] ?? null;

        $insertDraftArticle->bind_param(
            'isssssssissssiiiiiiis',
            $publishedArticleId,
            $slug,
            $title,
            $excerpt,
            $content,
            $coverImageUrl,
            $category,
            $authorName,
            $readTimeMinutes,
            $status,
            $visibility,
            $tagsJson,
            $focusKeyword,
            $allowComments,
            $isFeatured,
            $featuredOrder,
            $isPopular,
            $popularOrder,
            $isEditorPick,
            $editorPickOrder,
            $publishedAt
        );
        $insertDraftArticle->execute();
    }

    $draftArticleMap = [];
    $draftArticleRows = $mysqli->query('SELECT id, article_id FROM news_article_drafts WHERE article_id IS NOT NULL');
    if ($draftArticleRows) {
        while ($row = $draftArticleRows->fetch_assoc()) {
            $draftArticleMap[(int) ($row['article_id'] ?? 0)] = (int) ($row['id'] ?? 0);
        }
    }

    $publishedSections = $mysqli->query('SELECT * FROM news_sections ORDER BY section_order ASC, id ASC');
    if (!$publishedSections) {
        return;
    }

    $findDraftSection = $mysqli->prepare('SELECT id FROM news_section_drafts WHERE section_id = ? LIMIT 1');
    $insertDraftSection = $mysqli->prepare(
        'INSERT INTO news_section_drafts (
            section_id, slug, title, description, layout_style, article_count, section_order, is_active, last_published_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
    );
    $insertDraftRelation = $mysqli->prepare(
        'INSERT INTO news_section_draft_articles (section_draft_id, draft_article_id, article_order)
         VALUES (?, ?, ?)'
    );
    $loadPublishedSectionArticles = $mysqli->prepare(
        'SELECT article_id, article_order
         FROM news_section_articles
         WHERE section_id = ?
         ORDER BY article_order ASC, id ASC'
    );

    while ($row = $publishedSections->fetch_assoc()) {
        $publishedSectionId = (int) ($row['id'] ?? 0);
        if ($publishedSectionId <= 0) {
            continue;
        }

        $findDraftSection->bind_param('i', $publishedSectionId);
        $findDraftSection->execute();
        if ($findDraftSection->get_result()->fetch_assoc()) {
            continue;
        }

        $slug = (string) ($row['slug'] ?? '');
        $title = (string) ($row['title'] ?? '');
        $description = (string) ($row['description'] ?? '');
        $layoutStyle = (string) ($row['layout_style'] ?? 'cards');
        $articleCount = max(1, (int) ($row['article_count'] ?? 5));
        $sectionOrder = max(0, (int) ($row['section_order'] ?? 0));
        $isActive = (int) ($row['is_active'] ?? 1);

        $insertDraftSection->bind_param(
            'issssiii',
            $publishedSectionId,
            $slug,
            $title,
            $description,
            $layoutStyle,
            $articleCount,
            $sectionOrder,
            $isActive
        );
        $insertDraftSection->execute();
        $draftSectionId = (int) $insertDraftSection->insert_id;

        $loadPublishedSectionArticles->bind_param('i', $publishedSectionId);
        $loadPublishedSectionArticles->execute();
        $relations = $loadPublishedSectionArticles->get_result();

        while ($relation = $relations->fetch_assoc()) {
            $publishedArticleId = (int) ($relation['article_id'] ?? 0);
            $draftArticleId = (int) ($draftArticleMap[$publishedArticleId] ?? 0);
            if ($draftArticleId <= 0) {
                continue;
            }

            $articleOrder = max(1, (int) ($relation['article_order'] ?? 1));
            $insertDraftRelation->bind_param('iii', $draftSectionId, $draftArticleId, $articleOrder);
            $insertDraftRelation->execute();
        }
    }
}

function seedDefaultLearningContent(mysqli $mysqli): void {
    if (!databaseTableExists($mysqli, 'test_packages')) {
        return;
    }

    $schemaVersion = '20260419_learning_content_v3';
    if (getSystemSetting($mysqli, 'learning_content_seed_version') === $schemaVersion) {
        return;
    }

    $packageResult = $mysqli->query(
        "SELECT tp.*, tc.name AS category_name
         FROM test_packages tp
         LEFT JOIN test_categories tc ON tc.id = tp.category_id
         ORDER BY tp.id ASC"
    );
    if (!$packageResult) {
        return;
    }

    $countMaterial = $mysqli->prepare(
        'SELECT id FROM learning_materials WHERE package_id = ? AND section_code = ? LIMIT 1'
    );
    $insertMaterial = $mysqli->prepare(
        'INSERT INTO learning_materials (package_id, section_code, title, content_json, status, published_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    $countQuestion = $mysqli->prepare(
        'SELECT COUNT(*) AS total FROM learning_section_questions WHERE package_id = ? AND section_code = ?'
    );
    $insertQuestion = $mysqli->prepare(
        'INSERT INTO learning_section_questions (package_id, section_code, question_text, question_image_url, difficulty, question_order)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $insertOption = $mysqli->prepare(
        'INSERT INTO learning_section_question_options (question_id, option_letter, option_text, option_image_url, is_correct)
         VALUES (?, ?, ?, ?, ?)'
    );

    while ($package = $packageResult->fetch_assoc()) {
        $workflow = TestWorkflow::buildPackageWorkflow($package);
        $mode = (string) ($workflow['mode'] ?? '');

        foreach ($workflow['sections'] as $section) {
            $packageId = (int) $package['id'];
            $sectionCode = (string) $section['code'];
            $sectionName = (string) $section['name'];

            $countMaterial->bind_param('is', $packageId, $sectionCode);
            $countMaterial->execute();
            $materialResult = $countMaterial->get_result();
            $materialExists = (bool) $materialResult->fetch_assoc();
            $materialResult->free();
            if (!$materialExists) {
                $materialPayload = LearningContent::defaultMaterialContent($section, $mode);
                $contentJson = json_encode($materialPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                $materialStatus = 'published';
                $publishedAt = date('Y-m-d H:i:s');
                $insertMaterial->bind_param('isssss', $packageId, $sectionCode, $sectionName, $contentJson, $materialStatus, $publishedAt);
                $insertMaterial->execute();
            }

            $countQuestion->bind_param('is', $packageId, $sectionCode);
            $countQuestion->execute();
            $questionResult = $countQuestion->get_result();
            $questionCount = (int) (($questionResult->fetch_assoc()['total'] ?? 0));
            $questionResult->free();
            if ($questionCount >= 5) {
                continue;
            }

            foreach (array_slice(LearningContent::defaultSectionQuestions($section, $mode), $questionCount) as $question) {
                $difficulty = (string) ($question['difficulty'] ?? 'medium');
                $questionOrder = (int) ($question['question_order'] ?? 1);
                $questionText = (string) $question['question_text'];
                $questionImageUrl = null;
                $insertQuestion->bind_param('issssi', $packageId, $sectionCode, $questionText, $questionImageUrl, $difficulty, $questionOrder);
                $insertQuestion->execute();
                $questionId = (int) $insertQuestion->insert_id;

                foreach ($question['options'] as $option) {
                    $letter = (string) $option['letter'];
                    $text = (string) $option['text'];
                    $imageUrl = null;
                    $isCorrect = (int) $option['is_correct'];
                    $insertOption->bind_param('isssi', $questionId, $letter, $text, $imageUrl, $isCorrect);
                    $insertOption->execute();
                }
            }
        }
    }

    setSystemSetting($mysqli, 'learning_content_seed_version', $schemaVersion);
}

function migrateLegacyLearningMaterialDrafts(mysqli $mysqli): void {
    if (
        !databaseTableExists($mysqli, 'test_packages')
        || !databaseTableExists($mysqli, 'learning_materials')
        || !databaseTableExists($mysqli, 'learning_material_drafts')
    ) {
        return;
    }

    $schemaVersion = '20260419_workspace_draft_migration_v1';
    if (getSystemSetting($mysqli, 'workspace_draft_migration_version') === $schemaVersion) {
        return;
    }

    $packageResult = $mysqli->query(
        "SELECT tp.*, tc.name AS category_name
         FROM test_packages tp
         LEFT JOIN test_categories tc ON tc.id = tp.category_id
         ORDER BY tp.id ASC"
    );
    if (!$packageResult) {
        return;
    }

    $upsertDraftMaterial = $mysqli->prepare(
        "INSERT INTO learning_material_drafts (
            package_id,
            section_code,
            title,
            content_json,
            source_url,
            review_notes
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            content_json = VALUES(content_json),
            source_url = VALUES(source_url),
            review_notes = VALUES(review_notes),
            updated_at = CURRENT_TIMESTAMP"
    );
    $updatePublishedMaterial = $mysqli->prepare(
        "UPDATE learning_materials
         SET title = ?,
             content_json = ?,
             status = 'published',
             source_url = NULL,
             review_notes = NULL,
             published_at = COALESCE(published_at, CURRENT_TIMESTAMP),
             updated_at = CURRENT_TIMESTAMP
         WHERE package_id = ? AND section_code = ?"
    );

    while ($package = $packageResult->fetch_assoc()) {
        $workflow = TestWorkflow::buildPackageWorkflow($package);
        $mode = (string) ($workflow['mode'] ?? '');

        foreach ($workflow['sections'] as $section) {
            $packageId = (int) ($package['id'] ?? 0);
            $sectionCode = (string) ($section['code'] ?? '');
            if ($packageId <= 0 || $sectionCode === '') {
                continue;
            }

            $findMaterial = $mysqli->prepare(
                'SELECT title, content_json, status, source_url, review_notes
                 FROM learning_materials
                 WHERE package_id = ? AND section_code = ?
                 LIMIT 1'
            );
            $findMaterial->bind_param('is', $packageId, $sectionCode);
            $findMaterial->execute();
            $material = $findMaterial->get_result()->fetch_assoc();

            if (!$material || (string) ($material['status'] ?? 'published') !== 'draft') {
                continue;
            }

            $title = (string) ($material['title'] ?? ($section['name'] ?? 'Materi'));
            $contentJson = (string) ($material['content_json'] ?? '');
            $sourceUrl = ($material['source_url'] ?? null) ?: null;
            $reviewNotes = ($material['review_notes'] ?? null) ?: null;
            $upsertDraftMaterial->bind_param('isssss', $packageId, $sectionCode, $title, $contentJson, $sourceUrl, $reviewNotes);
            $upsertDraftMaterial->execute();

            $publishedContentJson = json_encode(
                LearningContent::defaultMaterialContent($section, $mode),
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
            );
            $publishedTitle = (string) ($section['name'] ?? $title);
            $updatePublishedMaterial->bind_param('ssis', $publishedTitle, $publishedContentJson, $packageId, $sectionCode);
            $updatePublishedMaterial->execute();
        }
    }

    setSystemSetting($mysqli, 'workspace_draft_migration_version', $schemaVersion);
}

function refreshTwkDraftMaterials(mysqli $mysqli): void {
    if (
        !databaseTableExists($mysqli, 'test_packages')
        || !databaseTableExists($mysqli, 'learning_materials')
        || !databaseTableExists($mysqli, 'learning_material_drafts')
    ) {
        return;
    }

    $schemaVersion = '20260419_twk_complex_draft_v1';
    if (getSystemSetting($mysqli, 'twk_complex_draft_version') === $schemaVersion) {
        return;
    }

    $packageResult = $mysqli->query(
        "SELECT tp.*, tc.name AS category_name
         FROM test_packages tp
         LEFT JOIN test_categories tc ON tc.id = tp.category_id
         ORDER BY tp.id ASC"
    );
    if (!$packageResult) {
        return;
    }

    $findMaterial = $mysqli->prepare(
        'SELECT title, content_json
         FROM learning_materials
         WHERE package_id = ? AND section_code = ?
         LIMIT 1'
    );
    $findDraft = $mysqli->prepare(
        'SELECT title, content_json
         FROM learning_material_drafts
         WHERE package_id = ? AND section_code = ?
         LIMIT 1'
    );
    $upsertDraft = $mysqli->prepare(
        "INSERT INTO learning_material_drafts (package_id, section_code, title, content_json, source_url, review_notes)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            content_json = VALUES(content_json),
            source_url = VALUES(source_url),
            review_notes = VALUES(review_notes),
            updated_at = CURRENT_TIMESTAMP"
    );

    while ($package = $packageResult->fetch_assoc()) {
        $workflow = TestWorkflow::buildPackageWorkflow($package);
        $mode = (string) ($workflow['mode'] ?? '');

        foreach ($workflow['sections'] as $section) {
            $sectionCode = (string) ($section['code'] ?? '');
            if ($sectionCode !== 'twk') {
                continue;
            }

            $packageId = (int) ($package['id'] ?? 0);
            if ($packageId <= 0) {
                continue;
            }

            $findMaterial->bind_param('is', $packageId, $sectionCode);
            $findMaterial->execute();
            $publishedMaterial = $findMaterial->get_result()->fetch_assoc() ?: null;

            $findDraft->bind_param('is', $packageId, $sectionCode);
            $findDraft->execute();
            $draftMaterial = $findDraft->get_result()->fetch_assoc() ?: null;

            $draftPayload = json_decode((string) ($draftMaterial['content_json'] ?? ''), true);
            $publishedPayload = json_decode((string) ($publishedMaterial['content_json'] ?? ''), true);
            $draftLooksLegacy = !$draftMaterial || LearningContent::isLegacySimpleTwkContent($draftPayload);
            $publishedLooksLegacy = !$publishedMaterial || LearningContent::isLegacySimpleTwkContent($publishedPayload);

            if (!$draftLooksLegacy) {
                continue;
            }

            if (!$draftMaterial && !$publishedLooksLegacy) {
                continue;
            }

            $contentJson = json_encode(
                LearningContent::defaultMaterialContent($section, $mode),
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
            );
            $title = (string) ($section['name'] ?? 'TWK');
            $sourceUrl = 'https://jdih.mpr.go.id/dokumen/view?id=46';
            $reviewNotes = 'Draft awal disusun dari sumber resmi: UUD NRI 1945 (JDIH MPR), UU No. 24 Tahun 2009 (JDIH BPK), dan artikel Indonesia.go.id tentang Bhinneka Tunggal Ika. Silakan edit dan parafrase lanjutan sebelum publish.';
            $upsertDraft->bind_param('isssss', $packageId, $sectionCode, $title, $contentJson, $sourceUrl, $reviewNotes);
            $upsertDraft->execute();
        }
    }

    setSystemSetting($mysqli, 'twk_complex_draft_version', $schemaVersion);
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
                SUM(CASE WHEN section_name IS NULL OR section_name = '' THEN 1 ELSE 0 END) AS missing_section_name
         FROM questions
         WHERE package_id = ?"
    );
    $fetchQuestionIdsStmt = $mysqli->prepare(
        'SELECT id FROM questions WHERE package_id = ? ORDER BY id ASC'
    );
    $updateQuestionStmt = $mysqli->prepare(
        'UPDATE questions SET section_code = ?, section_name = ?, section_order = ? WHERE id = ?'
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
            || (int) ($questionMeta['missing_section_name'] ?? 0) > 0;

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

                $updateQuestionStmt->bind_param('ssii', $sectionCode, $sectionName, $sectionOrder, $questionId);
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
            $updateQuestionStmt->bind_param('ssii', $sectionCode, $sectionName, $sectionOrder, $questionId);
            $updateQuestionStmt->execute();
            $questionIndex++;
        }
    }
}

function hasDefaultAdminBootstrapConfig(): bool {
    if (DEFAULT_ADMIN_EMAIL === '' || DEFAULT_ADMIN_FULL_NAME === '' || DEFAULT_ADMIN_PASSWORD_HASH === '') {
        return false;
    }

    if (filter_var(DEFAULT_ADMIN_EMAIL, FILTER_VALIDATE_EMAIL) === false) {
        return false;
    }

    return preg_match('/^\$2y\$\d{2}\$.{53}$/', DEFAULT_ADMIN_PASSWORD_HASH) === 1;
}

function shouldBootstrapDefaultAdmin(): bool {
    return DEFAULT_ADMIN_FORCE_BOOTSTRAP && hasDefaultAdminBootstrapConfig();
}

function bootstrapDefaultAdmin(mysqli $mysqli): void {
    if (!shouldBootstrapDefaultAdmin() || !databaseTableExists($mysqli, 'users')) {
        return;
    }

    $legacyBootstrapKey = 'default_admin_reset_v1';
    $bootstrapKey = 'default_admin_bootstrap_v2';
    if (getSystemSetting($mysqli, $legacyBootstrapKey) !== null || getSystemSetting($mysqli, $bootstrapKey) !== null) {
        return;
    }

    $mysqli->begin_transaction();

    try {
        $adminEmail = DEFAULT_ADMIN_EMAIL;
        $adminPasswordHash = DEFAULT_ADMIN_PASSWORD_HASH;
        $adminFullName = DEFAULT_ADMIN_FULL_NAME;

        $select = $mysqli->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
        $select->bind_param('s', $adminEmail);
        $select->execute();
        $existingAdmin = $select->get_result()->fetch_assoc();

        if ($existingAdmin) {
            $update = $mysqli->prepare(
                "UPDATE users
                 SET password = ?,
                     full_name = ?,
                     role = 'admin',
                     email_verified_at = COALESCE(email_verified_at, NOW())
                 WHERE id = ?"
            );
            $update->bind_param('ssi', $adminPasswordHash, $adminFullName, $existingAdmin['id']);
            $update->execute();
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
            $insert->bind_param('sss', $adminEmail, $adminPasswordHash, $adminFullName);
            $insert->execute();
        }

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
ensureGoogleAuthSchema($mysqli);
ensureTestWorkflowSchema($mysqli);
ensureTestAttemptProgressSchema($mysqli);
ensureAttemptQuestionFlagsSchema($mysqli);
ensureTryoutScoringSchema($mysqli);
ensureLearningProgressSchema($mysqli);
ensureQuestionOptionScoreWeightSchema($mysqli);
ensureNewsArticleSchema($mysqli);
ensureNewsArticleDraftSchema($mysqli);
ensureNewsSectionSchema($mysqli);
ensureNewsSectionDraftSchema($mysqli);
ensureNewsCommentSchema($mysqli);
seedDefaultNewsContent($mysqli);
hydrateNewsDraftWorkspace($mysqli);
bootstrapDefaultAdmin($mysqli);
