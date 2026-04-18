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
define('FROM_NAME', env('FROM_NAME', 'Ujiin'));
define('EMAIL_VERIFICATION_EXPIRY_HOURS', (int) env('EMAIL_VERIFICATION_EXPIRY_HOURS', 24));
define('EMAIL_VERIFICATION_URL', env('EMAIL_VERIFICATION_URL', rtrim(FRONTEND_URL, '/') . '/verify-email'));
define('DEFAULT_ADMIN_EMAIL', env('DEFAULT_ADMIN_EMAIL', 'REMOVED_ADMIN_EMAIL'));
define('DEFAULT_ADMIN_FULL_NAME', env('DEFAULT_ADMIN_FULL_NAME', 'Admin Ujiin'));
define('DEFAULT_ADMIN_PASSWORD_HASH', env('DEFAULT_ADMIN_PASSWORD_HASH', 'REMOVED_ADMIN_PASSWORD_HASH'));
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
        "CREATE TABLE IF NOT EXISTS learning_section_questions (
            id INT PRIMARY KEY AUTO_INCREMENT,
            package_id INT NOT NULL,
            section_code VARCHAR(100) NOT NULL,
            question_text LONGTEXT NOT NULL,
            question_image_url VARCHAR(1000) DEFAULT NULL,
            difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (question_id) REFERENCES learning_section_questions(id) ON DELETE CASCADE,
            INDEX (question_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    if (!databaseColumnExists($mysqli, 'learning_section_questions', 'question_image_url')) {
        $mysqli->query("ALTER TABLE learning_section_questions ADD COLUMN question_image_url VARCHAR(1000) NULL AFTER question_text");
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
    seedTwkDraftContent($mysqli);
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
                $pages = LearningContent::defaultMaterialPages($section, $mode);
                $contentJson = json_encode($pages, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
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

function seedTwkDraftContent(mysqli $mysqli): void {
    if (!databaseTableExists($mysqli, 'test_packages') || !databaseTableExists($mysqli, 'learning_materials')) {
        return;
    }

    $schemaVersion = '20260419_twk_draft_topics_v1';
    if (getSystemSetting($mysqli, 'learning_twk_draft_seed_version') === $schemaVersion) {
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

    $upsertMaterial = $mysqli->prepare(
        "INSERT INTO learning_materials (
            package_id,
            section_code,
            title,
            content_json,
            status,
            source_url,
            review_notes,
            published_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            content_json = VALUES(content_json),
            status = VALUES(status),
            source_url = VALUES(source_url),
            review_notes = VALUES(review_notes),
            published_at = VALUES(published_at),
            updated_at = CURRENT_TIMESTAMP"
    );

    while ($package = $packageResult->fetch_assoc()) {
        $workflow = TestWorkflow::buildPackageWorkflow($package);
        $mode = (string) ($workflow['mode'] ?? '');

        foreach ($workflow['sections'] as $section) {
            if ((string) ($section['code'] ?? '') !== 'twk') {
                continue;
            }

            $packageId = (int) ($package['id'] ?? 0);
            $sectionCode = 'twk';
            $sectionName = (string) ($section['name'] ?? 'TWK');
            $pages = LearningContent::defaultMaterialPages($section, $mode);
            $topics = array_map(static function (array $page): array {
                return [
                    'title' => (string) ($page['title'] ?? 'Topik'),
                    'pages' => [$page],
                ];
            }, $pages);
            $contentJson = json_encode([
                'topics' => $topics,
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $status = 'draft';
            $sourceUrl = null;
            $reviewNotes = 'Draft sistem: topik TWK disesuaikan ke Pancasila, UUD 1945, Bhinneka Tunggal Ika, dan NKRI. Review admin sebelum publish.';
            $publishedAt = null;
            $upsertMaterial->bind_param('isssssss', $packageId, $sectionCode, $sectionName, $contentJson, $status, $sourceUrl, $reviewNotes, $publishedAt);
            $upsertMaterial->execute();
        }
    }

    setSystemSetting($mysqli, 'learning_twk_draft_seed_version', $schemaVersion);
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
ensureTestAttemptProgressSchema($mysqli);
ensureAttemptQuestionFlagsSchema($mysqli);
ensureLearningProgressSchema($mysqli);
bootstrapDefaultAdmin($mysqli);
