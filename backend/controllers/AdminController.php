<?php
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../utils/TestWorkflow.php';
require_once __DIR__ . '/../utils/LearningContent.php';
require_once __DIR__ . '/../middleware/Response.php';

class AdminController {
    private $mysqli;
    private const ADMIN_MEDIA_UPLOAD_DIR = __DIR__ . '/../uploads/admin-media';
    private const ADMIN_MEDIA_MAX_SIZE = 5242880;
    private const WORKSPACE_PUBLISHED = 'published';
    private const WORKSPACE_DRAFT = 'draft';

    public function __construct($mysqli) {
        $this->mysqli = $mysqli;
    }

    private function normalizeWorkspace($value): string {
        return strtolower(trim((string) $value)) === self::WORKSPACE_DRAFT
            ? self::WORKSPACE_DRAFT
            : self::WORKSPACE_PUBLISHED;
    }

    private function getRequestWorkspace(?array $data = null): string {
        if (is_array($data) && array_key_exists('workspace', $data)) {
            return $this->normalizeWorkspace($data['workspace']);
        }

        if (isset($_GET['workspace'])) {
            return $this->normalizeWorkspace($_GET['workspace']);
        }

        if (isset($_POST['workspace'])) {
            return $this->normalizeWorkspace($_POST['workspace']);
        }

        return self::WORKSPACE_PUBLISHED;
    }

    private function getWorkspaceTables(string $workspace): array {
        if ($workspace === self::WORKSPACE_DRAFT) {
            return [
                'packages' => 'test_package_drafts',
                'questions' => 'question_drafts',
                'question_options' => 'question_option_drafts',
                'materials' => 'learning_material_drafts',
                'learning_questions' => 'learning_section_question_drafts',
                'learning_question_options' => 'learning_section_question_option_drafts',
            ];
        }

        return [
            'packages' => 'test_packages',
            'questions' => 'questions',
            'question_options' => 'question_options',
            'materials' => 'learning_materials',
            'learning_questions' => 'learning_section_questions',
            'learning_question_options' => 'learning_section_question_options',
        ];
    }

    private function normalizeTemporaryDisabledFlag($value): int {
        $normalized = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        return $normalized ? 1 : 0;
    }

    private function getDraftPackage(int $packageId): ?array {
        $query = "SELECT tp.*, tc.name AS category_name
                  FROM test_package_drafts tp
                  JOIN test_categories tc ON tc.id = tp.category_id
                  WHERE tp.package_id = ?
                  LIMIT 1";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('i', $packageId);
        $stmt->execute();

        return $stmt->get_result()->fetch_assoc() ?: null;
    }

    private function getPackageByWorkspace(int $packageId, string $workspace = self::WORKSPACE_PUBLISHED): array {
        if ($workspace !== self::WORKSPACE_DRAFT) {
            return $this->getPackage($packageId);
        }

        $this->ensurePackageDraftExists($packageId);
        $package = $this->getDraftPackage($packageId);
        if (!$package) {
            sendResponse('error', 'Draft paket tidak ditemukan', null, 404);
        }

        return $package;
    }

    private function ensureAllPackageDraftsExist(): void {
        $result = $this->mysqli->query('SELECT id FROM test_packages ORDER BY id ASC');
        if (!$result) {
            return;
        }

        while ($row = $result->fetch_assoc()) {
            $packageId = (int) ($row['id'] ?? 0);
            if ($packageId > 0) {
                $this->ensurePackageDraftExists($packageId);
            }
        }
    }

    private function copyTryoutQuestionsToDraft(int $packageId): void {
        $countStmt = $this->mysqli->prepare('SELECT COUNT(*) AS total FROM question_drafts WHERE package_id = ?');
        $countStmt->bind_param('i', $packageId);
        $countStmt->execute();
        $countRow = $countStmt->get_result()->fetch_assoc();
        if ((int) ($countRow['total'] ?? 0) > 0) {
            return;
        }

        $query = "SELECT q.*,
                    GROUP_CONCAT(
                      JSON_OBJECT(
                        'letter', qo.option_letter,
                        'text', qo.option_text,
                        'image_url', qo.option_image_url,
                        'is_correct', qo.is_correct,
                        'score_weight', CAST(COALESCE(qo.score_weight, qo.is_correct) AS UNSIGNED)
                      ) ORDER BY qo.id SEPARATOR ','
                    ) AS options
                  FROM questions q
                  LEFT JOIN question_options qo ON qo.question_id = q.id
                  WHERE q.package_id = ?
                  GROUP BY q.id
                  ORDER BY q.section_order ASC, q.id ASC";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('i', $packageId);
        $stmt->execute();
        $result = $stmt->get_result();

        while ($row = $result->fetch_assoc()) {
            $payload = [
                'question_text' => (string) ($row['question_text'] ?? ''),
                'question_image_url' => $row['question_image_url'] ?: null,
                'question_image_layout' => (string) ($row['question_image_layout'] ?? 'top'),
                'question_type' => (string) ($row['question_type'] ?? 'single_choice'),
                'difficulty' => (string) ($row['difficulty'] ?? 'medium'),
                'explanation_notes' => (string) ($row['explanation_notes'] ?? ''),
                'section_code' => (string) ($row['section_code'] ?? ''),
                'section_name' => (string) ($row['section_name'] ?? ''),
                'section_order' => (int) ($row['section_order'] ?? 1),
                'options' => $row['options'] ? json_decode('[' . $row['options'] . ']', true) : [],
            ];
            $this->insertQuestionWithOptions($packageId, $payload, self::WORKSPACE_DRAFT);
        }
    }

    private function copyLearningMaterialsToDraft(int $packageId): void {
        $countStmt = $this->mysqli->prepare('SELECT COUNT(*) AS total FROM learning_material_drafts WHERE package_id = ?');
        $countStmt->bind_param('i', $packageId);
        $countStmt->execute();
        $countRow = $countStmt->get_result()->fetch_assoc();
        if ((int) ($countRow['total'] ?? 0) > 0) {
            return;
        }

        $insertDraft = $this->mysqli->prepare(
            "INSERT INTO learning_material_drafts (package_id, section_code, title, content_json, source_url, review_notes)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                title = VALUES(title),
                content_json = VALUES(content_json),
                source_url = VALUES(source_url),
                review_notes = VALUES(review_notes),
                updated_at = CURRENT_TIMESTAMP"
        );

        $query = "SELECT section_code, title, content_json, source_url, review_notes
                  FROM learning_materials
                  WHERE package_id = ?
                  ORDER BY section_code ASC";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('i', $packageId);
        $stmt->execute();
        $result = $stmt->get_result();

        while ($row = $result->fetch_assoc()) {
            $sectionCode = (string) ($row['section_code'] ?? '');
            $title = (string) ($row['title'] ?? '');
            $contentJson = (string) ($row['content_json'] ?? '');
            $sourceUrl = ($row['source_url'] ?? null) ?: null;
            $reviewNotes = ($row['review_notes'] ?? null) ?: null;
            $insertDraft->bind_param('isssss', $packageId, $sectionCode, $title, $contentJson, $sourceUrl, $reviewNotes);
            $insertDraft->execute();
        }
    }

    private function copyMiniTestQuestionsToDraft(int $packageId): void {
        $countStmt = $this->mysqli->prepare('SELECT COUNT(*) AS total FROM learning_section_question_drafts WHERE package_id = ?');
        $countStmt->bind_param('i', $packageId);
        $countStmt->execute();
        $countRow = $countStmt->get_result()->fetch_assoc();
        if ((int) ($countRow['total'] ?? 0) > 0) {
            return;
        }

        $query = "SELECT q.*,
                    GROUP_CONCAT(
                      JSON_OBJECT(
                        'letter', qo.option_letter,
                        'text', qo.option_text,
                        'image_url', qo.option_image_url,
                        'is_correct', qo.is_correct,
                        'score_weight', CAST(COALESCE(qo.score_weight, qo.is_correct) AS UNSIGNED)
                      ) ORDER BY qo.id SEPARATOR ','
                    ) AS options
                  FROM learning_section_questions q
                  LEFT JOIN learning_section_question_options qo ON qo.question_id = q.id
                  WHERE q.package_id = ?
                  GROUP BY q.id
                  ORDER BY q.section_code ASC, q.question_order ASC, q.id ASC";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('i', $packageId);
        $stmt->execute();
        $result = $stmt->get_result();

        $insertQuestion = $this->mysqli->prepare(
            "INSERT INTO learning_section_question_drafts (package_id, section_code, question_text, question_image_url, material_topic, difficulty, explanation_notes, question_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $insertOption = $this->mysqli->prepare(
            "INSERT INTO learning_section_question_option_drafts (question_id, option_letter, option_text, option_image_url, is_correct, score_weight)
             VALUES (?, ?, ?, ?, ?, ?)"
        );

        while ($row = $result->fetch_assoc()) {
            $sectionCode = (string) ($row['section_code'] ?? '');
            $questionText = (string) ($row['question_text'] ?? '');
            $questionImageUrl = ($row['question_image_url'] ?? null) ?: null;
            $materialTopic = ($row['material_topic'] ?? null) ? trim((string) $row['material_topic']) : null;
            $difficulty = (string) ($row['difficulty'] ?? 'medium');
            $explanationNotes = (string) ($row['explanation_notes'] ?? '');
            $questionOrder = (int) ($row['question_order'] ?? 1);
            $insertQuestion->bind_param('issssssi', $packageId, $sectionCode, $questionText, $questionImageUrl, $materialTopic, $difficulty, $explanationNotes, $questionOrder);
            $insertQuestion->execute();
            $draftQuestionId = (int) $insertQuestion->insert_id;
            $options = $row['options'] ? json_decode('[' . $row['options'] . ']', true) : [];
            foreach ($options as $option) {
                $letter = (string) ($option['letter'] ?? 'A');
                $text = (string) ($option['text'] ?? '');
                $imageUrl = ($option['image_url'] ?? null) ?: null;
                $isCorrect = (int) ($option['is_correct'] ?? 0);
                $scoreWeight = (int) ($option['score_weight'] ?? ($isCorrect ? 5 : 0));
                $insertOption->bind_param('isssii', $draftQuestionId, $letter, $text, $imageUrl, $isCorrect, $scoreWeight);
                $insertOption->execute();
            }
        }
    }

    private function ensurePackageDraftExists(int $packageId): void {
        $existsStmt = $this->mysqli->prepare('SELECT package_id FROM test_package_drafts WHERE package_id = ? LIMIT 1');
        $existsStmt->bind_param('i', $packageId);
        $existsStmt->execute();
        $exists = $existsStmt->get_result()->fetch_assoc();
        if (!$exists) {
            $package = $this->getPackage($packageId);
            $insertDraft = $this->mysqli->prepare(
                'INSERT INTO test_package_drafts (
                    package_id,
                    category_id,
                    name,
                    description,
                    price,
                    duration_days,
                    max_attempts,
                    question_count,
                    time_limit,
                    test_mode,
                    workflow_config,
                    is_temporarily_disabled,
                    last_saved_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
            );
            $insertDraft->bind_param(
                'iissiiiiissi',
                $packageId,
                $package['category_id'],
                $package['name'],
                $package['description'],
                $package['price'],
                $package['duration_days'],
                $package['max_attempts'],
                $package['question_count'],
                $package['time_limit'],
                $package['test_mode'],
                $package['workflow_config'],
                $this->normalizeTemporaryDisabledFlag($package['is_temporarily_disabled'] ?? 0)
            );
            $insertDraft->execute();
        }

        $this->copyTryoutQuestionsToDraft($packageId);
        $this->copyLearningMaterialsToDraft($packageId);
        $this->copyMiniTestQuestionsToDraft($packageId);
        $this->syncQuestionCount($packageId, self::WORKSPACE_DRAFT);
    }

    private function touchDraftPackage(int $packageId, bool $markPublished = false): void {
        $query = $markPublished
            ? 'UPDATE test_package_drafts
               SET last_saved_at = CURRENT_TIMESTAMP,
                   last_published_at = CURRENT_TIMESTAMP,
                   updated_at = CURRENT_TIMESTAMP
               WHERE package_id = ?'
            : 'UPDATE test_package_drafts
               SET last_saved_at = CURRENT_TIMESTAMP,
                   updated_at = CURRENT_TIMESTAMP
               WHERE package_id = ?';
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('i', $packageId);
        $stmt->execute();
    }

    private function buildPublicMediaUrl(string $relativePath): string {
        $baseUrl = rtrim((string) API_URL, '/');
        $normalizedPath = ltrim(str_replace(DIRECTORY_SEPARATOR, '/', $relativePath), '/');

        return $baseUrl . '/' . $normalizedPath;
    }

    private function ensureAdminMediaDirectory(string $directory): void {
        if (is_dir($directory)) {
            return;
        }

        if (!mkdir($directory, 0775, true) && !is_dir($directory)) {
            throw new RuntimeException('Folder upload gambar tidak dapat dibuat', 500);
        }
    }

    private function storeUploadedImage(array $file, string $context = 'question'): array {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw new RuntimeException('Upload gambar gagal diproses', 422);
        }

        $size = (int) ($file['size'] ?? 0);
        if ($size <= 0 || $size > self::ADMIN_MEDIA_MAX_SIZE) {
            throw new RuntimeException('Ukuran gambar maksimal 5MB', 422);
        }

        $tmpName = (string) ($file['tmp_name'] ?? '');
        if ($tmpName === '' || !is_uploaded_file($tmpName)) {
            throw new RuntimeException('File upload tidak valid', 422);
        }

        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mimeType = (string) ($finfo->file($tmpName) ?: '');
        $allowedMimeTypes = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            'image/gif' => 'gif',
        ];

        if (!isset($allowedMimeTypes[$mimeType])) {
            throw new RuntimeException('Format gambar harus JPG, PNG, WEBP, atau GIF', 422);
        }

        $contextSlug = preg_replace('/[^a-z0-9_-]+/i', '-', strtolower(trim($context))) ?: 'question';
        $dateSegment = date('Y/m');
        $targetDirectory = self::ADMIN_MEDIA_UPLOAD_DIR . '/' . $contextSlug . '/' . $dateSegment;
        $this->ensureAdminMediaDirectory($targetDirectory);

        $fileName = bin2hex(random_bytes(16)) . '.' . $allowedMimeTypes[$mimeType];
        $targetPath = $targetDirectory . '/' . $fileName;
        if (!move_uploaded_file($tmpName, $targetPath)) {
            throw new RuntimeException('Gagal menyimpan gambar ke server', 500);
        }

        $relativePath = 'uploads/admin-media/' . $contextSlug . '/' . $dateSegment . '/' . $fileName;

        return [
            'url' => $this->buildPublicMediaUrl($relativePath),
            'path' => $relativePath,
            'mime_type' => $mimeType,
            'size' => $size,
        ];
    }

    private function syncQuestionCount(int $packageId, string $workspace = self::WORKSPACE_PUBLISHED): void {
        $tables = $this->getWorkspaceTables($workspace);
        $countQuery = sprintf('SELECT COUNT(*) AS total FROM %s WHERE package_id = ?', $tables['questions']);
        $stmt = $this->mysqli->prepare($countQuery);
        $stmt->bind_param('i', $packageId);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();
        $total = (int) ($result['total'] ?? 0);

        $packageIdColumn = $workspace === self::WORKSPACE_DRAFT ? 'package_id' : 'id';
        $updateQuery = sprintf('UPDATE %s SET question_count = ? WHERE %s = ?', $tables['packages'], $packageIdColumn);
        $stmt = $this->mysqli->prepare($updateQuery);
        $stmt->bind_param('ii', $total, $packageId);
        $stmt->execute();
    }

    private function enrichPackage(array $package): array {
        $workflow = TestWorkflow::buildPackageWorkflow($package);
        $package['time_limit'] = (int) ($workflow['total_duration_minutes'] ?? (int) ($package['time_limit'] ?? 0));
        $package['is_temporarily_disabled'] = (int) ($package['is_temporarily_disabled'] ?? 0);
        $package['workflow'] = $workflow;

        return $package;
    }

    private function getPackage(int $packageId): array {
        $query = "SELECT tp.*, tc.name AS category_name
                  FROM test_packages tp
                  JOIN test_categories tc ON tc.id = tp.category_id
                  WHERE tp.id = ?
                  LIMIT 1";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('i', $packageId);
        $stmt->execute();
        $package = $stmt->get_result()->fetch_assoc();

        if (!$package) {
            sendResponse('error', 'Paket tidak ditemukan', null, 404);
        }

        return $package;
    }

    private function getFallbackCategoryId(): int {
        $result = $this->mysqli->query('SELECT id FROM test_categories ORDER BY id ASC LIMIT 1');
        $row = $result ? $result->fetch_assoc() : null;
        return (int) ($row['id'] ?? 0);
    }

    private function getCategoryById(int $categoryId): array {
        $stmt = $this->mysqli->prepare('SELECT * FROM test_categories WHERE id = ? LIMIT 1');
        $stmt->bind_param('i', $categoryId);
        $stmt->execute();
        $category = $stmt->get_result()->fetch_assoc();

        if (!$category) {
            sendResponse('error', 'Tipe paket tidak ditemukan', null, 404);
        }

        return $category;
    }

    private function normalizeTestMode($value): string {
        $mode = trim((string) ($value ?? ''));
        $allowedModes = [
            TestWorkflow::MODE_STANDARD,
            TestWorkflow::MODE_CPNS_CAT,
            TestWorkflow::MODE_UTBK_SECTIONED,
        ];

        return in_array($mode, $allowedModes, true) ? $mode : TestWorkflow::MODE_STANDARD;
    }

    private function isTkpSection(?string $sectionCode, ?string $sectionName = null): bool {
        $haystack = strtolower(trim((string) $sectionCode . ' ' . (string) $sectionName));

        return preg_match('/(^|[^a-z0-9])tkp([^a-z0-9]|$)/', $haystack) === 1
            || strpos($haystack, 'karakteristik pribadi') !== false;
    }

    private function normalizePointValue($value, int $fallback = 1): int {
        if (is_bool($value)) {
            return $value ? 5 : $fallback;
        }

        if (is_numeric($value)) {
            return min(5, max(1, (int) $value));
        }

        $normalized = strtolower(trim((string) $value));
        if ($normalized === 'true' || $normalized === 'benar') {
            return 5;
        }

        if ($normalized === 'false' || $normalized === 'salah' || $normalized === '') {
            return $fallback;
        }

        return min(5, max(1, (int) $normalized));
    }

    private function readOptionPointValue(array $option, int $fallback = 1): int {
        if (array_key_exists('score_weight', $option)) {
            return $this->normalizePointValue($option['score_weight'], $fallback);
        }

        if (array_key_exists('point', $option)) {
            return $this->normalizePointValue($option['point'], $fallback);
        }

        if (array_key_exists('points', $option)) {
            return $this->normalizePointValue($option['points'], $fallback);
        }

        return $this->normalizePointValue($option['is_correct'] ?? null, $fallback);
    }

    private function getWorkflowSection(int $packageId, string $sectionCode, string $workspace = self::WORKSPACE_PUBLISHED): array {
        $package = $this->getPackageByWorkspace($packageId, $workspace);
        $workflow = TestWorkflow::buildPackageWorkflow($package);
        foreach ($workflow['sections'] as $section) {
            if ((string) ($section['code'] ?? '') === $sectionCode) {
                return [$package, $workflow, $section];
            }
        }

        sendResponse('error', 'Subtest tidak ditemukan pada paket ini', null, 404);
    }

    private function sanitizeSectionCode($value, int $fallbackIndex): string {
        $normalized = strtolower(trim((string) $value));
        $normalized = preg_replace('/[^a-z0-9_]+/', '_', $normalized) ?? '';
        $normalized = trim($normalized, '_');
        return $normalized !== '' ? $normalized : 'section_' . $fallbackIndex;
    }

    private function normalizeWorkflowConfig(array $package, $workflowInput): array {
        $baseWorkflow = TestWorkflow::buildPackageWorkflow($package);
        $custom = $workflowInput;

        if (is_string($custom)) {
            $decoded = json_decode($custom, true);
            $custom = is_array($decoded) ? $decoded : [];
        }

        if (!is_array($custom)) {
            $custom = [];
        }

        $sectionsInput = $custom['sections'] ?? $baseWorkflow['sections'];
        if (!is_array($sectionsInput) || count($sectionsInput) === 0) {
            sendResponse('error', 'Minimal harus ada 1 subtest', null, 422);
        }

        $usedCodes = [];
        $normalizedSections = [];
        foreach (array_values($sectionsInput) as $index => $section) {
            if (!is_array($section)) {
                sendResponse('error', 'Format subtest tidak valid', null, 422);
            }

            $code = $this->sanitizeSectionCode($section['code'] ?? null, $index + 1);
            if (isset($usedCodes[$code])) {
                $code = $this->sanitizeSectionCode($code . '_' . ($index + 1), $index + 1);
            }
            $usedCodes[$code] = true;

            $name = trim((string) ($section['name'] ?? ''));
            if ($name === '') {
                $name = 'Subtest ' . ($index + 1);
            }

            $durationMinutes = $section['duration_minutes'] ?? null;
            if ($durationMinutes !== null && $durationMinutes !== '') {
                $durationMinutes = max(0, (float) $durationMinutes);
            } else {
                $durationMinutes = null;
            }

            $miniTestDurationMinutes = $section['mini_test_duration_minutes'] ?? null;
            if ($miniTestDurationMinutes !== null && $miniTestDurationMinutes !== '') {
                $miniTestDurationMinutes = max(0, (float) $miniTestDurationMinutes);
            } else {
                $miniTestDurationMinutes = null;
            }

            $normalizedSections[] = array_filter([
                'code' => $code,
                'name' => $name,
                'session_name' => trim((string) ($section['session_name'] ?? '')) ?: null,
                'session_order' => isset($section['session_order']) ? max(1, (int) $section['session_order']) : null,
                'order' => $index + 1,
                'duration_minutes' => $durationMinutes,
                'mini_test_duration_minutes' => $miniTestDurationMinutes,
                'target_question_count' => isset($section['target_question_count']) ? max(0, (int) $section['target_question_count']) : null,
            ], static function ($value) {
                return $value !== null && $value !== '';
            });
        }

        $normalizedWorkflow = [
            'label' => trim((string) ($custom['label'] ?? $baseWorkflow['label'])),
            'allow_random_navigation' => array_key_exists('allow_random_navigation', $custom)
                ? (bool) $custom['allow_random_navigation']
                : (bool) $baseWorkflow['allow_random_navigation'],
            'save_behavior' => trim((string) ($custom['save_behavior'] ?? $baseWorkflow['save_behavior'])),
            'manual_finish' => array_key_exists('manual_finish', $custom)
                ? (bool) $custom['manual_finish']
                : (bool) $baseWorkflow['manual_finish'],
            'total_duration_minutes' => (float) ($custom['total_duration_minutes'] ?? $baseWorkflow['total_duration_minutes']),
            'sections' => $normalizedSections,
        ];

        if (($baseWorkflow['mode'] ?? '') === TestWorkflow::MODE_UTBK_SECTIONED) {
            $totalDuration = 0.0;
            foreach ($normalizedSections as $section) {
                $totalDuration += (float) ($section['duration_minutes'] ?? 0);
            }

            if ($totalDuration > 0) {
                $normalizedWorkflow['total_duration_minutes'] = $totalDuration;
            }
        }

        return $normalizedWorkflow;
    }

    private function syncPackageWorkflowData(
        int $packageId,
        array $previousWorkflow,
        array $nextWorkflow,
        string $workspace = self::WORKSPACE_PUBLISHED
    ): void {
        $tables = $this->getWorkspaceTables($workspace);

        $previousSections = [];
        foreach ($previousWorkflow['sections'] ?? [] as $section) {
            $previousSections[(string) ($section['code'] ?? '')] = $section;
        }

        $nextSections = [];
        foreach ($nextWorkflow['sections'] ?? [] as $section) {
            $nextSections[(string) ($section['code'] ?? '')] = $section;
        }

        foreach ($previousSections as $code => $section) {
            if ($code === '' || isset($nextSections[$code])) {
                continue;
            }

            $deleteQuestions = $this->mysqli->prepare(sprintf('DELETE FROM %s WHERE package_id = ? AND section_code = ?', $tables['questions']));
            $deleteQuestions->bind_param('is', $packageId, $code);
            $deleteQuestions->execute();

            $deleteMaterials = $this->mysqli->prepare(sprintf('DELETE FROM %s WHERE package_id = ? AND section_code = ?', $tables['materials']));
            $deleteMaterials->bind_param('is', $packageId, $code);
            $deleteMaterials->execute();

            $deleteLearningQuestions = $this->mysqli->prepare(sprintf('DELETE FROM %s WHERE package_id = ? AND section_code = ?', $tables['learning_questions']));
            $deleteLearningQuestions->bind_param('is', $packageId, $code);
            $deleteLearningQuestions->execute();
        }

        foreach ($nextSections as $code => $section) {
            $sectionName = (string) ($section['name'] ?? 'Subtest');
            $sectionOrder = (int) ($section['order'] ?? 1);
            $updateQuestions = $this->mysqli->prepare(sprintf(
                'UPDATE %s SET section_name = ?, section_order = ? WHERE package_id = ? AND section_code = ?',
                $tables['questions']
            ));
            $updateQuestions->bind_param('siis', $sectionName, $sectionOrder, $packageId, $code);
            $updateQuestions->execute();

            if (!isset($previousSections[$code])) {
                $emptyMaterialContent = json_encode([
                    'topics' => [],
                ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                $insertMaterial = $workspace === self::WORKSPACE_DRAFT
                    ? $this->mysqli->prepare(
                        'INSERT IGNORE INTO learning_material_drafts (package_id, section_code, title, content_json, source_url, review_notes) VALUES (?, ?, ?, ?, NULL, NULL)'
                    )
                    : $this->mysqli->prepare(
                        'INSERT IGNORE INTO learning_materials (package_id, section_code, title, content_json) VALUES (?, ?, ?, ?)'
                    );
                $insertMaterial->bind_param('isss', $packageId, $code, $sectionName, $emptyMaterialContent);
                $insertMaterial->execute();
            }
        }
    }

    private function buildFallbackMaterialPage(string $title, string $point = 'Materi sedang disiapkan.'): array {
        return [
            'title' => $title,
            'points' => [$point],
            'closing' => '',
            'content_html' => '',
        ];
    }

    private function hydrateMaterialPages(array $pages, bool $allowEmpty = false): array {
        $normalized = [];
        foreach ($pages as $index => $page) {
            if (!is_array($page)) {
                continue;
            }

            $title = trim((string) ($page['title'] ?? ''));
            $closing = trim((string) ($page['closing'] ?? ''));
            $contentHtml = trim((string) ($page['content_html'] ?? ''));
            $points = $page['points'] ?? [];
            if (!is_array($points)) {
                $points = explode("\n", (string) $points);
            }

            $points = array_values(array_filter(array_map(static function ($point): string {
                return trim((string) $point);
            }, $points)));

            if (count($points) === 0 && $contentHtml !== '') {
                $plainText = trim(preg_replace('/\s+/', "\n", strip_tags($contentHtml)) ?? '');
                $points = array_values(array_filter(array_map(static function ($point): string {
                    return trim((string) $point);
                }, explode("\n", $plainText))));
            }

            $resolvedTitle = $title !== '' ? $title : 'Halaman ' . ($index + 1);
            if (count($points) === 0 && $contentHtml === '') {
                $points = ['Materi sedang disiapkan.'];
            }

            $normalized[] = [
                'title' => $resolvedTitle,
                'points' => $points,
                'closing' => $closing,
                'content_html' => $contentHtml,
            ];
        }

        if (count($normalized) > 0) {
            return $normalized;
        }

        if ($allowEmpty) {
            return [];
        }

        return [$this->buildFallbackMaterialPage('Halaman 1')];
    }

    private function buildTopicsFromPages(array $pages): array {
        $hydratedPages = $this->hydrateMaterialPages($pages);
        $topics = [];

        foreach ($hydratedPages as $index => $page) {
            $topics[] = [
                'title' => trim((string) ($page['title'] ?? '')) ?: 'Topik ' . ($index + 1),
                'pages' => [$page],
            ];
        }

        return $topics;
    }

    private function hydrateMaterialTopics($payload, array $fallbackPages = []): array {
        $hasExplicitTopics = is_array($payload) && array_key_exists('topics', $payload) && is_array($payload['topics']);

        if ($hasExplicitTopics) {
            $topics = $payload['topics'];
        } elseif (is_array($payload) && array_values($payload) === $payload) {
            $topics = $this->buildTopicsFromPages($payload);
        } else {
            $topics = $this->buildTopicsFromPages($fallbackPages);
        }

        $normalized = [];
        foreach ($topics as $index => $topic) {
            if (!is_array($topic)) {
                continue;
            }

            $title = trim((string) ($topic['title'] ?? '')) ?: 'Topik ' . ($index + 1);
            $pages = $this->hydrateMaterialPages(is_array($topic['pages'] ?? null) ? $topic['pages'] : [], true);

            $normalized[] = [
                'title' => $title,
                'pages' => $pages,
            ];
        }

        if (count($normalized) > 0) {
            return $normalized;
        }

        if ($hasExplicitTopics) {
            return [];
        }

        return $this->buildTopicsFromPages($fallbackPages);
    }

    private function flattenMaterialTopics(array $topics): array {
        $pages = [];
        foreach ($topics as $topic) {
            foreach (($topic['pages'] ?? []) as $page) {
                $pages[] = $page;
            }
        }

        return $pages;
    }

    private function encodeComparisonPayload(array $payload): string {
        return json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}';
    }

    private function buildTopicComparisonPayload(array $topic): array {
        $pages = [];
        foreach (($topic['pages'] ?? []) as $index => $page) {
            if (!is_array($page)) {
                continue;
            }

            $points = $page['points'] ?? [];
            if (!is_array($points)) {
                $points = explode("\n", (string) $points);
            }

            $pages[] = [
                'title' => trim((string) ($page['title'] ?? '')) ?: 'Halaman ' . ($index + 1),
                'points' => array_values(array_filter(array_map(static fn($point): string => trim((string) $point), $points))),
                'closing' => trim((string) ($page['closing'] ?? '')),
                'content_html' => trim((string) ($page['content_html'] ?? '')),
            ];
        }

        return [
            'title' => trim((string) ($topic['title'] ?? '')),
            'pages' => $pages,
        ];
    }

    private function buildMaterialComparisonPayload(array $material): array {
        $topics = [];
        foreach (($material['topics'] ?? []) as $topic) {
            if (!is_array($topic)) {
                continue;
            }
            $topics[] = $this->buildTopicComparisonPayload($topic);
        }

        return [
            'title' => trim((string) ($material['title'] ?? '')),
            'topics' => $topics,
            'source_url' => trim((string) ($material['source_url'] ?? '')),
            'review_notes' => trim((string) ($material['review_notes'] ?? '')),
        ];
    }

    private function buildLearningQuestionComparisonPayload(array $question): array {
        $options = [];
        foreach (($question['options'] ?? []) as $index => $option) {
            if (!is_array($option)) {
                continue;
            }

            $letter = trim((string) ($option['letter'] ?? chr(65 + $index)));
            $options[] = [
                'letter' => strtoupper(substr($letter, 0, 5)),
                'text' => trim((string) ($option['text'] ?? '')),
                'image_url' => trim((string) ($option['image_url'] ?? '')),
                'is_correct' => (int) ($option['is_correct'] ?? 0),
                'score_weight' => (int) ($option['score_weight'] ?? ($option['is_correct'] ? 5 : 0)),
            ];
        }

        return [
            'question_text' => trim((string) ($question['question_text'] ?? '')),
            'question_image_url' => trim((string) ($question['question_image_url'] ?? '')),
            'difficulty' => trim((string) ($question['difficulty'] ?? 'medium')),
            'question_order' => (int) ($question['question_order'] ?? 0),
            'options' => $options,
        ];
    }

    private function buildTryoutQuestionComparisonPayload(array $question): array {
        $options = [];
        foreach (($question['options'] ?? []) as $index => $option) {
            if (!is_array($option)) {
                continue;
            }

            $letter = trim((string) ($option['letter'] ?? chr(65 + $index)));
            $options[] = [
                'letter' => strtoupper(substr($letter, 0, 5)),
                'text' => trim((string) ($option['text'] ?? '')),
                'image_url' => trim((string) ($option['image_url'] ?? '')),
                'is_correct' => (int) ($option['is_correct'] ?? 0),
                'score_weight' => (int) ($option['score_weight'] ?? ($option['is_correct'] ? 5 : 0)),
            ];
        }

        return [
            'question_text' => trim((string) ($question['question_text'] ?? '')),
            'question_image_url' => trim((string) ($question['question_image_url'] ?? '')),
            'question_image_layout' => trim((string) ($question['question_image_layout'] ?? 'top')),
            'question_type' => trim((string) ($question['question_type'] ?? 'single_choice')),
            'difficulty' => trim((string) ($question['difficulty'] ?? 'medium')),
            'section_code' => trim((string) ($question['section_code'] ?? '')),
            'section_name' => trim((string) ($question['section_name'] ?? '')),
            'section_order' => (int) ($question['section_order'] ?? 0),
            'options' => $options,
        ];
    }

    private function annotateMaterialStatus(
        array $currentMaterial,
        ?array $draftMaterial,
        ?array $publishedMaterial,
        bool $currentIsDraft = true
    ): array {
        $draftPayload = $this->buildMaterialComparisonPayload($draftMaterial ?? $publishedMaterial ?? $currentMaterial);
        $publishedPayload = $this->buildMaterialComparisonPayload($publishedMaterial ?? $draftMaterial ?? $currentMaterial);
        $materialStatus = $this->encodeComparisonPayload($draftPayload) === $this->encodeComparisonPayload($publishedPayload)
            ? 'published'
            : 'draft';

        $comparisonTopics = $currentIsDraft ? ($publishedPayload['topics'] ?? []) : ($draftPayload['topics'] ?? []);
        $comparisonTopicSignatures = [];
        foreach ($comparisonTopics as $topicPayload) {
            $signature = $this->encodeComparisonPayload($topicPayload);
            $comparisonTopicSignatures[$signature] = ($comparisonTopicSignatures[$signature] ?? 0) + 1;
        }

        $topicStatuses = [];
        foreach (($currentMaterial['topics'] ?? []) as $index => $topic) {
            $signature = $this->encodeComparisonPayload($this->buildTopicComparisonPayload(is_array($topic) ? $topic : []));
            $isPublishedTopic = ($comparisonTopicSignatures[$signature] ?? 0) > 0;
            if ($isPublishedTopic) {
                $comparisonTopicSignatures[$signature]--;
            }
            $topicStatuses[$index] = $isPublishedTopic ? 'published' : 'draft';
        }

        $currentMaterial['status'] = $materialStatus;
        $currentMaterial['topic_statuses'] = $topicStatuses;

        return $currentMaterial;
    }

    private function annotateQuestionStatuses(array $currentQuestions, array $publishedQuestions, string $type = 'learning'): array {
        $signatureBuilder = $type === 'tryout'
            ? fn(array $question): string => $this->encodeComparisonPayload($this->buildTryoutQuestionComparisonPayload($question))
            : fn(array $question): string => $this->encodeComparisonPayload($this->buildLearningQuestionComparisonPayload($question));

        $publishedSignatures = [];
        foreach ($publishedQuestions as $question) {
            if (!is_array($question)) {
                continue;
            }
            $signature = $signatureBuilder($question);
            $publishedSignatures[$signature] = ($publishedSignatures[$signature] ?? 0) + 1;
        }

        return array_map(function ($question) use (&$publishedSignatures, $signatureBuilder) {
            $signature = $signatureBuilder(is_array($question) ? $question : []);
            $isPublished = ($publishedSignatures[$signature] ?? 0) > 0;
            if ($isPublished) {
                $publishedSignatures[$signature]--;
            }

            if (is_array($question)) {
                $question['status'] = $isPublished ? 'published' : 'draft';
            }

            return $question;
        }, $currentQuestions);
    }

    private function normalizeMaterialStatus($value, string $fallback = 'published'): string {
        $status = strtolower(trim((string) $value));
        if (in_array($status, ['draft', 'published'], true)) {
            return $status;
        }

        return $fallback;
    }

    private function normalizeMaterialPages(array $pages, string $errorContext = '', bool $allowEmpty = false): array {
        if (count($pages) === 0) {
            if ($allowEmpty) {
                return [];
            }
            sendResponse('error', 'Materi minimal memiliki 1 halaman', null, 422);
        }

        $normalized = [];
        foreach ($pages as $index => $page) {
            if (!is_array($page)) {
                sendResponse('error', 'Format halaman materi tidak valid', null, 422);
            }

            $title = trim((string) ($page['title'] ?? ''));
            $closing = trim((string) ($page['closing'] ?? ''));
            $contentHtml = trim((string) ($page['content_html'] ?? ''));
            $points = $page['points'] ?? [];
            if (!is_array($points)) {
                $points = explode("\n", (string) $points);
            }

            $points = array_values(array_filter(array_map(static function ($point): string {
                return trim((string) $point);
            }, $points)));

            if (count($points) === 0 && $contentHtml !== '') {
                $plainText = trim(preg_replace('/\s+/', "\n", strip_tags($contentHtml)) ?? '');
                $points = array_values(array_filter(array_map(static function ($point): string {
                    return trim((string) $point);
                }, explode("\n", $plainText))));
            }

            if ($title === '' || (count($points) === 0 && $contentHtml === '')) {
                sendResponse('error', 'Judul dan poin materi wajib diisi pada halaman ' . ($index + 1) . $errorContext, null, 422);
            }

            $normalized[] = [
                'title' => $title,
                'points' => $points,
                'closing' => $closing,
                'content_html' => $contentHtml,
            ];
        }

        return $normalized;
    }

    private function normalizeMaterialTopics(array $topics): array {
        if (count($topics) === 0) {
            return [];
        }

        $normalized = [];
        foreach ($topics as $index => $topic) {
            if (!is_array($topic)) {
                sendResponse('error', 'Format topik materi tidak valid', null, 422);
            }

            $title = trim((string) ($topic['title'] ?? ''));
            if ($title === '') {
                sendResponse('error', 'Nama topik wajib diisi pada topik ' . ($index + 1), null, 422);
            }

            $pages = $topic['pages'] ?? [];
            $normalized[] = [
                'title' => $title,
                'pages' => $this->normalizeMaterialPages(
                    is_array($pages) ? $pages : [],
                    ' di topik ' . $title,
                    true
                ),
            ];
        }

        return $normalized;
    }

    private function normalizeLearningQuestionPayload(array $data, int $order, bool $usesPointScoring = false): array {
        $questionText = trim((string) ($data['question_text'] ?? ''));
        $questionImageUrl = $this->normalizeMediaUrl($data['question_image_url'] ?? null);
        $explanationNotes = trim((string) ($data['explanation_notes'] ?? ''));
        $materialTopic = substr(trim((string) ($data['material_topic'] ?? '')), 0, 255);
        $difficulty = trim((string) ($data['difficulty'] ?? 'medium'));
        $options = $data['options'] ?? [];

        if ($questionText === '' && $questionImageUrl === null) {
            sendResponse('error', 'Pertanyaan mini test wajib memiliki teks atau gambar', null, 422);
        }

        if (!in_array($difficulty, ['easy', 'medium', 'hard'], true)) {
            $difficulty = 'medium';
        }

        if (!is_array($options) || count($options) < 2) {
            sendResponse('error', 'Mini test minimal memiliki 2 opsi', null, 422);
        }

        $normalizedOptions = [];
        $correctCount = 0;
        foreach ($options as $index => $option) {
            $letter = strtoupper(substr(trim((string) ($option['letter'] ?? chr(65 + $index))), 0, 5));
            $text = trim((string) ($option['text'] ?? ''));
            $imageUrl = $this->normalizeMediaUrl($option['image_url'] ?? null);
            $scoreValue = $usesPointScoring
                ? $this->readOptionPointValue($option, min(5, $index + 1))
                : (!empty($option['is_correct']) ? 1 : 0);

            if ($text === '' && $imageUrl === null) {
                continue;
            }

            if (!$usesPointScoring && $scoreValue > 0) {
                $correctCount++;
            }

            $normalizedOptions[] = [
                'letter' => $letter,
                'text' => $text,
                'image_url' => $imageUrl,
                'is_correct' => $usesPointScoring ? ($scoreValue === 5 ? 1 : 0) : $scoreValue,
                'score_weight' => $usesPointScoring ? $scoreValue : ($scoreValue > 0 ? 5 : 0),
            ];
        }

        if (count($normalizedOptions) < 2) {
            sendResponse('error', 'Mini test minimal memiliki 2 opsi berisi teks atau gambar', null, 422);
        }

        if (!$usesPointScoring && $correctCount !== 1) {
            sendResponse('error', 'Setiap soal mini test harus memiliki tepat 1 jawaban benar', null, 422);
        }

        return [
            'question_text' => $questionText,
            'question_image_url' => $questionImageUrl,
            'explanation_notes' => $explanationNotes,
            'material_topic' => $materialTopic,
            'difficulty' => $difficulty,
            'question_order' => max(1, (int) ($data['question_order'] ?? $order)),
            'options' => $normalizedOptions,
        ];
    }

    private function normalizeMediaUrl($value): ?string {
        $normalized = trim((string) ($value ?? ''));
        if ($normalized === '') {
            return null;
        }

        return substr($normalized, 0, 1000);
    }

    private function normalizeQuestionPayload(int $packageId, array $data, string $workspace = self::WORKSPACE_PUBLISHED): array {
        $questionText = trim((string) ($data['question_text'] ?? ''));
        $questionImageUrl = $this->normalizeMediaUrl($data['question_image_url'] ?? null);
        $questionImageLayout = strtolower(trim((string) ($data['question_image_layout'] ?? 'top')));
        $explanationNotes = trim((string) ($data['explanation_notes'] ?? ''));
        $difficulty = (string) ($data['difficulty'] ?? 'medium');
        $questionType = (string) ($data['question_type'] ?? 'single_choice');
        $sectionCode = trim((string) ($data['section_code'] ?? ''));
        $options = $data['options'] ?? [];

        if ($questionText === '' && $questionImageUrl === null) {
            throw new RuntimeException('Pertanyaan harus memiliki teks atau gambar', 422);
        }

        $allowedDifficulty = ['easy', 'medium', 'hard'];
        if (!in_array($difficulty, $allowedDifficulty, true)) {
            throw new RuntimeException('Tingkat kesulitan tidak valid', 422);
        }

        if ($questionType !== 'single_choice') {
            throw new RuntimeException('Tipe soal belum didukung', 422);
        }

        $allowedImageLayouts = ['top', 'bottom', 'left', 'right'];
        if (!in_array($questionImageLayout, $allowedImageLayouts, true)) {
            $questionImageLayout = 'top';
        }

        $package = $this->getPackageByWorkspace($packageId, $workspace);
        $workflow = TestWorkflow::buildPackageWorkflow($package);
        $sections = $workflow['sections'];
        $sectionLookup = [];
        foreach ($sections as $section) {
            $sectionLookup[(string) $section['code']] = $section;
        }

        if ($sectionCode === '') {
            $firstSection = $sections[0] ?? ['code' => 'general', 'name' => 'Semua Soal', 'order' => 1];
            $sectionCode = (string) $firstSection['code'];
        }

        if (!isset($sectionLookup[$sectionCode])) {
            throw new RuntimeException('Bagian/subtes soal tidak valid untuk paket ini', 422);
        }

        $usesPointScoring = $this->isTkpSection(
            $sectionCode,
            (string) ($sectionLookup[$sectionCode]['name'] ?? '')
        );

        if (!is_array($options) || count($options) < 2) {
            throw new RuntimeException('Minimal harus ada 2 opsi jawaban', 422);
        }

        $normalizedOptions = [];
        $correctCount = 0;
        foreach ($options as $index => $option) {
            $letter = trim((string) ($option['letter'] ?? ''));
            $text = trim((string) ($option['text'] ?? ''));
            $imageUrl = $this->normalizeMediaUrl($option['image_url'] ?? null);
            $scoreValue = $usesPointScoring
                ? $this->readOptionPointValue($option, min(5, $index + 1))
                : (!empty($option['is_correct']) ? 1 : 0);

            if ($letter === '') {
                $letter = chr(65 + $index);
            }

            if ($text === '' && $imageUrl === null) {
                throw new RuntimeException('Setiap opsi jawaban harus memiliki teks atau gambar', 422);
            }

            if (!$usesPointScoring && $scoreValue > 0) {
                $correctCount++;
            }

            $normalizedOptions[] = [
                'letter' => strtoupper(substr($letter, 0, 5)),
                'text' => $text,
                'image_url' => $imageUrl,
                'is_correct' => $usesPointScoring ? ($scoreValue === 5 ? 1 : 0) : $scoreValue,
                'score_weight' => $usesPointScoring ? $scoreValue : ($scoreValue > 0 ? 5 : 0),
            ];
        }

        if (!$usesPointScoring && $correctCount !== 1) {
            throw new RuntimeException('Harus ada tepat 1 jawaban benar', 422);
        }

        return [
            'question_text' => $questionText,
            'question_image_url' => $questionImageUrl,
            'question_image_layout' => $questionImageLayout,
            'explanation_notes' => $explanationNotes,
            'difficulty' => $difficulty,
            'question_type' => $questionType,
            'section_code' => $sectionCode,
            'section_name' => (string) $sectionLookup[$sectionCode]['name'],
            'section_order' => (int) ($sectionLookup[$sectionCode]['order'] ?? 1),
            'options' => $normalizedOptions,
        ];
    }

    private function insertQuestionWithOptions(int $packageId, array $payload, string $workspace = self::WORKSPACE_PUBLISHED): int {
        $tables = $this->getWorkspaceTables($workspace);
        $insertQuestion = $this->mysqli->prepare(
            sprintf(
                'INSERT INTO %s (
                package_id,
                question_text,
                question_image_url,
                question_image_layout,
                question_type,
                difficulty,
                explanation_notes,
                section_code,
                section_name,
                section_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                $tables['questions']
            )
        );
        $insertQuestion->bind_param(
            'issssssssi',
            $packageId,
            $payload['question_text'],
            $payload['question_image_url'],
            $payload['question_image_layout'],
            $payload['question_type'],
            $payload['difficulty'],
            $payload['explanation_notes'],
            $payload['section_code'],
            $payload['section_name'],
            $payload['section_order']
        );
        $insertQuestion->execute();
        $questionId = (int) $insertQuestion->insert_id;

        $insertOption = $this->mysqli->prepare(sprintf(
            'INSERT INTO %s (question_id, option_letter, option_text, option_image_url, is_correct, score_weight) VALUES (?, ?, ?, ?, ?, ?)',
            $tables['question_options']
        ));
        foreach ($payload['options'] as $option) {
            $scoreWeight = (int) ($option['score_weight'] ?? ($option['is_correct'] ? 5 : 0));
            $insertOption->bind_param(
                'isssii',
                $questionId,
                $option['letter'],
                $option['text'],
                $option['image_url'],
                $option['is_correct'],
                $scoreWeight
            );
            $insertOption->execute();
        }

        return $questionId;
    }

    public function getPackages() {
        verifyAdmin();
        $workspace = $this->getRequestWorkspace();

        if ($workspace === self::WORKSPACE_DRAFT) {
            $this->ensureAllPackageDraftsExist();
            $query = "SELECT tp.*, tc.name AS category_name
                      FROM test_package_drafts tp
                      JOIN test_categories tc ON tc.id = tp.category_id
                      ORDER BY tp.package_id ASC";
            $result = $this->mysqli->query($query);

            $packages = [];
            while ($row = $result->fetch_assoc()) {
                $row['id'] = (int) ($row['package_id'] ?? 0);
                $packages[] = $this->enrichPackage($row);
            }

            sendResponse('success', 'Data draft paket admin berhasil diambil', $packages);
        }

        $query = "SELECT tp.*, tc.name AS category_name
                  FROM test_packages tp
                  JOIN test_categories tc ON tc.id = tp.category_id
                  ORDER BY tp.id ASC";
        $result = $this->mysqli->query($query);

        $packages = [];
        while ($row = $result->fetch_assoc()) {
            $packages[] = $this->enrichPackage($row);
        }

        sendResponse('success', 'Data paket admin berhasil diambil', $packages);
    }

    public function getPackageTypes() {
        verifyAdmin();

        $query = "SELECT tc.*,
                    COUNT(tp.id) AS package_count
                  FROM test_categories tc
                  LEFT JOIN test_packages tp ON tp.category_id = tc.id
                  GROUP BY tc.id
                  ORDER BY tc.id ASC";
        $result = $this->mysqli->query($query);

        $types = [];
        while ($row = $result->fetch_assoc()) {
          $row['id'] = (int) $row['id'];
          $row['package_count'] = (int) ($row['package_count'] ?? 0);
          $types[] = $row;
        }

        sendResponse('success', 'Tipe paket berhasil diambil', $types);
    }

    public function createPackageType() {
        verifyAdmin();
        $data = json_decode(file_get_contents('php://input'), true);

        $name = trim((string) ($data['name'] ?? ''));
        $description = trim((string) ($data['description'] ?? ''));

        if ($name === '') {
            sendResponse('error', 'Nama tipe paket wajib diisi', null, 422);
        }

        $stmt = $this->mysqli->prepare('INSERT INTO test_categories (name, description) VALUES (?, ?)');
        $stmt->bind_param('ss', $name, $description);

        if (!$stmt->execute()) {
            sendResponse('error', 'Gagal menambahkan tipe paket', ['details' => $stmt->error], 500);
        }

        sendResponse('success', 'Tipe paket berhasil ditambahkan', ['category_id' => (int) $stmt->insert_id], 201);
    }

    public function updatePackageType() {
        verifyAdmin();
        $data = json_decode(file_get_contents('php://input'), true);

        $categoryId = (int) ($data['category_id'] ?? 0);
        $name = trim((string) ($data['name'] ?? ''));
        $description = trim((string) ($data['description'] ?? ''));

        if ($categoryId <= 0 || $name === '') {
            sendResponse('error', 'Data tipe paket tidak lengkap', null, 422);
        }

        $this->getCategoryById($categoryId);

        $stmt = $this->mysqli->prepare('UPDATE test_categories SET name = ?, description = ? WHERE id = ?');
        $stmt->bind_param('ssi', $name, $description, $categoryId);

        if (!$stmt->execute()) {
            sendResponse('error', 'Gagal memperbarui tipe paket', ['details' => $stmt->error], 500);
        }

        sendResponse('success', 'Tipe paket berhasil diperbarui');
    }

    public function deletePackageType() {
        verifyAdmin();

        $categoryId = (int) ($_GET['id'] ?? 0);
        if ($categoryId <= 0) {
            sendResponse('error', 'ID tipe paket harus diisi', null, 400);
        }

        $category = $this->getCategoryById($categoryId);
        $countStmt = $this->mysqli->prepare('SELECT COUNT(*) AS total FROM test_packages WHERE category_id = ?');
        $countStmt->bind_param('i', $categoryId);
        $countStmt->execute();
        $countRow = $countStmt->get_result()->fetch_assoc();
        $packageCount = (int) ($countRow['total'] ?? 0);

        if ($packageCount > 0) {
            sendResponse('error', 'Tipe paket masih dipakai oleh paket aktif', null, 422);
        }

        $totalResult = $this->mysqli->query('SELECT COUNT(*) AS total FROM test_categories');
        $totalTypes = (int) (($totalResult ? $totalResult->fetch_assoc() : [])['total'] ?? 0);
        if ($totalTypes <= 1) {
            sendResponse('error', 'Minimal harus ada 1 tipe paket', null, 422);
        }

        $stmt = $this->mysqli->prepare('DELETE FROM test_categories WHERE id = ?');
        $stmt->bind_param('i', $categoryId);

        if (!$stmt->execute()) {
            sendResponse('error', 'Gagal menghapus tipe paket', ['details' => $stmt->error], 500);
        }

        sendResponse('success', 'Tipe paket "' . $category['name'] . '" berhasil dihapus');
    }

    public function updatePackage() {
        verifyAdmin();
        $data = json_decode(file_get_contents('php://input'), true);
        $workspace = $this->getRequestWorkspace($data);

        $packageId = (int) ($data['package_id'] ?? 0);
        $categoryId = (int) ($data['category_id'] ?? 0);
        $name = trim((string) ($data['name'] ?? ''));
        $description = trim((string) ($data['description'] ?? ''));
        $price = (int) ($data['price'] ?? 0);
        $durationDays = (int) ($data['duration_days'] ?? 30);
        $maxAttempts = (int) ($data['max_attempts'] ?? 1);
        $timeLimit = (int) ($data['time_limit'] ?? 90);
        $package = $this->getPackageByWorkspace($packageId, $workspace);
        $categoryId = $categoryId > 0 ? $categoryId : (int) ($package['category_id'] ?? 0);
        $testMode = $this->normalizeTestMode($data['test_mode'] ?? ($package['test_mode'] ?? ''));
        $isTemporarilyDisabled = array_key_exists('is_temporarily_disabled', $data)
            ? $this->normalizeTemporaryDisabledFlag($data['is_temporarily_disabled'])
            : $this->normalizeTemporaryDisabledFlag($package['is_temporarily_disabled'] ?? 0);
        $workflowContext = array_merge($package, [
            'category_id' => $categoryId,
            'test_mode' => $testMode,
        ]);
        $previousWorkflow = TestWorkflow::buildPackageWorkflow($package);
        $nextWorkflow = array_key_exists('workflow_config', $data)
            ? $this->normalizeWorkflowConfig($workflowContext, $data['workflow_config'])
            : (
                $testMode !== ($previousWorkflow['mode'] ?? '')
                  ? TestWorkflow::defaultWorkflow($testMode, $timeLimit)
                  : $previousWorkflow
            );
        $workflowConfig = json_encode($nextWorkflow, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        if (in_array($testMode, [TestWorkflow::MODE_CPNS_CAT, TestWorkflow::MODE_UTBK_SECTIONED], true)) {
            $timeLimit = (int) ($nextWorkflow['total_duration_minutes'] ?? $timeLimit);
        }

        if ($packageId <= 0 || $categoryId <= 0 || $name === '' || $price <= 0 || $durationDays <= 0 || $maxAttempts <= 0 || $timeLimit <= 0) {
            sendResponse('error', 'Data paket tidak lengkap atau tidak valid', null, 422);
        }

        $query = $workspace === self::WORKSPACE_DRAFT
            ? "UPDATE test_package_drafts
               SET category_id = ?, name = ?, description = ?, price = ?, duration_days = ?, max_attempts = ?, time_limit = ?, test_mode = ?, workflow_config = ?, is_temporarily_disabled = ?, last_saved_at = CURRENT_TIMESTAMP
               WHERE package_id = ?"
            : "UPDATE test_packages
               SET category_id = ?, name = ?, description = ?, price = ?, duration_days = ?, max_attempts = ?, time_limit = ?, test_mode = ?, workflow_config = ?, is_temporarily_disabled = ?
               WHERE id = ?";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('issiiiissii', $categoryId, $name, $description, $price, $durationDays, $maxAttempts, $timeLimit, $testMode, $workflowConfig, $isTemporarilyDisabled, $packageId);

        if (!$stmt->execute()) {
            sendResponse('error', 'Gagal memperbarui paket', null, 500);
        }

        $this->syncPackageWorkflowData($packageId, $previousWorkflow, $nextWorkflow, $workspace);
        $this->syncQuestionCount($packageId, $workspace);
        if ($workspace === self::WORKSPACE_DRAFT) {
            $this->touchDraftPackage($packageId);
        }
        sendResponse('success', $workspace === self::WORKSPACE_DRAFT ? 'Draft paket berhasil disimpan' : 'Paket berhasil diperbarui');
    }

    public function createPackage() {
        verifyAdmin();
        $data = json_decode(file_get_contents('php://input'), true);

        $templatePackageId = (int) ($data['template_package_id'] ?? 0);
        $templatePackage = $templatePackageId > 0 ? $this->getPackage($templatePackageId) : null;

        $categoryId = (int) ($data['category_id'] ?? 0);
        if ($categoryId <= 0) {
            $categoryId = $templatePackage ? (int) $templatePackage['category_id'] : $this->getFallbackCategoryId();
        }
        if ($categoryId <= 0) {
            sendResponse('error', 'Kategori paket belum tersedia', null, 422);
        }

        $name = trim((string) ($data['name'] ?? ''));
        if ($name === '') {
            $baseName = trim((string) ($templatePackage['name'] ?? 'Paket Baru'));
            $name = $baseName . ' Copy';
        }

        $description = trim((string) ($data['description'] ?? ($templatePackage['description'] ?? '')));
        $price = max(1000, (int) ($data['price'] ?? ($templatePackage['price'] ?? 1000)));
        $durationDays = max(1, (int) ($data['duration_days'] ?? ($templatePackage['duration_days'] ?? 30)));
        $maxAttempts = max(1, (int) ($data['max_attempts'] ?? ($templatePackage['max_attempts'] ?? 1)));
        $timeLimit = max(1, (int) ($data['time_limit'] ?? ($templatePackage['time_limit'] ?? 90)));
        $testMode = $this->normalizeTestMode($data['test_mode'] ?? ($templatePackage['test_mode'] ?? TestWorkflow::MODE_STANDARD));
        $workflowContext = [
            'name' => $name,
            'category_id' => $categoryId,
            'test_mode' => $testMode,
            'time_limit' => $timeLimit,
        ];
        $workflowPayload = array_key_exists('workflow_config', $data)
            ? $this->normalizeWorkflowConfig($workflowContext, $data['workflow_config'])
            : (
                $templatePackage && empty($data['test_mode'])
                    ? TestWorkflow::buildPackageWorkflow($templatePackage)
                    : TestWorkflow::defaultWorkflow($testMode, $timeLimit)
            );
        $workflowConfig = json_encode($workflowPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (in_array($testMode, [TestWorkflow::MODE_CPNS_CAT, TestWorkflow::MODE_UTBK_SECTIONED], true)) {
            $timeLimit = (int) ($workflowPayload['total_duration_minutes'] ?? $timeLimit);
        }
        $isTemporarilyDisabled = $templatePackage
            ? $this->normalizeTemporaryDisabledFlag($templatePackage['is_temporarily_disabled'] ?? 0)
            : 0;

        $query = 'INSERT INTO test_packages (
                    category_id,
                    name,
                    description,
                    price,
                    duration_days,
                    max_attempts,
                    question_count,
                    time_limit,
                    test_mode,
                    workflow_config,
                    is_temporarily_disabled
                  ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)';
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param(
            'issiiiissi',
            $categoryId,
            $name,
            $description,
            $price,
            $durationDays,
            $maxAttempts,
            $timeLimit,
            $testMode,
            $workflowConfig,
            $isTemporarilyDisabled
        );

        if (!$stmt->execute()) {
            sendResponse('error', 'Gagal menambahkan paket', ['details' => $stmt->error], 500);
        }

        sendResponse('success', 'Paket baru berhasil dibuat', ['package_id' => (int) $stmt->insert_id], 201);
    }

    public function deletePackage() {
        verifyAdmin();

        $packageId = (int) ($_GET['id'] ?? 0);
        if ($packageId <= 0) {
            sendResponse('error', 'Package ID harus diisi', null, 400);
        }

        $package = $this->getPackage($packageId);
        $totalResult = $this->mysqli->query('SELECT COUNT(*) AS total FROM test_packages');
        $totalPackages = (int) (($totalResult ? $totalResult->fetch_assoc() : [])['total'] ?? 0);
        if ($totalPackages <= 1) {
            sendResponse('error', 'Minimal harus ada 1 paket aktif', null, 422);
        }

        $stmt = $this->mysqli->prepare('DELETE FROM test_packages WHERE id = ?');
        $stmt->bind_param('i', $packageId);
        if (!$stmt->execute()) {
            sendResponse('error', 'Gagal menghapus paket', ['details' => $stmt->error], 500);
        }

        sendResponse('success', 'Paket "' . $package['name'] . '" berhasil dihapus');
    }

    public function getQuestions() {
        verifyAdmin();
        $workspace = $this->getRequestWorkspace();

        $packageId = (int) ($_GET['package_id'] ?? 0);
        if ($packageId <= 0) {
            sendResponse('error', 'Package ID harus diisi', null, 400);
        }

        $this->ensurePackageDraftExists($packageId);

        $tables = $this->getWorkspaceTables($workspace);

        $query = sprintf("SELECT q.*, GROUP_CONCAT(
                      JSON_OBJECT(
                        'id', qo.id,
                        'letter', qo.option_letter,
                        'text', qo.option_text,
                        'image_url', qo.option_image_url,
                        'is_correct', qo.is_correct,
                        'score_weight', CAST(COALESCE(qo.score_weight, qo.is_correct) AS UNSIGNED)
                      ) ORDER BY qo.id SEPARATOR ','
                  ) AS options
                  FROM %s q
                  LEFT JOIN %s qo ON qo.question_id = q.id
                  WHERE q.package_id = ?
                  GROUP BY q.id
                  ORDER BY q.section_order ASC, q.id ASC", $tables['questions'], $tables['question_options']);
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('i', $packageId);
        $stmt->execute();
        $result = $stmt->get_result();

        $questions = [];
        while ($row = $result->fetch_assoc()) {
            $row['options'] = $row['options'] ? json_decode('[' . $row['options'] . ']', true) : [];
            $questions[] = $row;
        }

        $publishedQuestions = [];
        $publishedQuery = "SELECT q.*, GROUP_CONCAT(
                      JSON_OBJECT(
                        'id', qo.id,
                        'letter', qo.option_letter,
                        'text', qo.option_text,
                        'image_url', qo.option_image_url,
                        'is_correct', qo.is_correct,
                        'score_weight', CAST(COALESCE(qo.score_weight, qo.is_correct) AS UNSIGNED)
                      ) ORDER BY qo.id SEPARATOR ','
                  ) AS options
                  FROM questions q
                  LEFT JOIN question_options qo ON qo.question_id = q.id
                  WHERE q.package_id = ?
                  GROUP BY q.id
                  ORDER BY q.section_order ASC, q.id ASC";
        $publishedStmt = $this->mysqli->prepare($publishedQuery);
        $publishedStmt->bind_param('i', $packageId);
        $publishedStmt->execute();
        $publishedResult = $publishedStmt->get_result();
        while ($row = $publishedResult->fetch_assoc()) {
            $row['options'] = $row['options'] ? json_decode('[' . $row['options'] . ']', true) : [];
            $publishedQuestions[] = $row;
        }

        $draftQuestions = [];
        $draftQuery = "SELECT q.*, GROUP_CONCAT(
                      JSON_OBJECT(
                        'id', qo.id,
                        'letter', qo.option_letter,
                        'text', qo.option_text,
                        'image_url', qo.option_image_url,
                        'is_correct', qo.is_correct,
                        'score_weight', CAST(COALESCE(qo.score_weight, qo.is_correct) AS UNSIGNED)
                      ) ORDER BY qo.id SEPARATOR ','
                  ) AS options
                  FROM question_drafts q
                  LEFT JOIN question_option_drafts qo ON qo.question_id = q.id
                  WHERE q.package_id = ?
                  GROUP BY q.id
                  ORDER BY q.section_order ASC, q.id ASC";
        $draftStmt = $this->mysqli->prepare($draftQuery);
        $draftStmt->bind_param('i', $packageId);
        $draftStmt->execute();
        $draftResult = $draftStmt->get_result();
        while ($row = $draftResult->fetch_assoc()) {
            $row['options'] = $row['options'] ? json_decode('[' . $row['options'] . ']', true) : [];
            $draftQuestions[] = $row;
        }

        $comparisonQuestions = $workspace === self::WORKSPACE_DRAFT ? $publishedQuestions : $draftQuestions;
        $questions = $this->annotateQuestionStatuses($questions, $comparisonQuestions, 'tryout');

        sendResponse('success', $workspace === self::WORKSPACE_DRAFT ? 'Data draft soal admin berhasil diambil' : 'Data soal admin berhasil diambil', $questions);
    }

    public function createQuestion() {
        verifyAdmin();
        $data = json_decode(file_get_contents('php://input'), true);
        $workspace = $this->getRequestWorkspace($data);

        $packageId = (int) ($data['package_id'] ?? 0);
        if ($packageId <= 0) {
            sendResponse('error', 'Package ID harus diisi', null, 400);
        }

        $transactionStarted = false;
        try {
            if ($workspace === self::WORKSPACE_DRAFT) {
                $this->ensurePackageDraftExists($packageId);
            }
            $payload = $this->normalizeQuestionPayload($packageId, $data, $workspace);
            $this->mysqli->begin_transaction();
            $transactionStarted = true;
            $questionId = $this->insertQuestionWithOptions($packageId, $payload, $workspace);

            $this->syncQuestionCount($packageId, $workspace);
            $this->mysqli->commit();
            if ($workspace === self::WORKSPACE_DRAFT) {
                $this->touchDraftPackage($packageId);
            }
            sendResponse('success', $workspace === self::WORKSPACE_DRAFT ? 'Soal draft berhasil ditambahkan' : 'Soal berhasil ditambahkan', ['question_id' => $questionId], 201);
        } catch (RuntimeException $error) {
            if ($transactionStarted) {
                $this->mysqli->rollback();
            }
            sendResponse('error', $error->getMessage(), null, $error->getCode() ?: 422);
        } catch (Throwable $error) {
            if ($transactionStarted) {
                $this->mysqli->rollback();
            }
            sendResponse('error', 'Gagal menambahkan soal', ['details' => $error->getMessage()], 500);
        }
    }

    public function updateQuestion() {
        verifyAdmin();
        $data = json_decode(file_get_contents('php://input'), true);
        $workspace = $this->getRequestWorkspace($data);

        $questionId = (int) ($data['question_id'] ?? 0);
        $packageId = (int) ($data['package_id'] ?? 0);
        if ($questionId <= 0 || $packageId <= 0) {
            sendResponse('error', 'Question ID dan Package ID harus diisi', null, 400);
        }

        $transactionStarted = false;
        try {
            if ($workspace === self::WORKSPACE_DRAFT) {
                $this->ensurePackageDraftExists($packageId);
            }
            $payload = $this->normalizeQuestionPayload($packageId, $data, $workspace);
            $this->mysqli->begin_transaction();
            $transactionStarted = true;
            $tables = $this->getWorkspaceTables($workspace);
            $updateQuestion = $this->mysqli->prepare(
                sprintf('UPDATE %s
                 SET question_text = ?,
                     question_image_url = ?,
                     question_image_layout = ?,
                     question_type = ?,
                     difficulty = ?,
                     explanation_notes = ?,
                     section_code = ?,
                     section_name = ?,
                     section_order = ?
                 WHERE id = ? AND package_id = ?', $tables['questions'])
            );
            $updateQuestion->bind_param(
                'ssssssssiii',
                $payload['question_text'],
                $payload['question_image_url'],
                $payload['question_image_layout'],
                $payload['question_type'],
                $payload['difficulty'],
                $payload['explanation_notes'],
                $payload['section_code'],
                $payload['section_name'],
                $payload['section_order'],
                $questionId,
                $packageId
            );
            $updateQuestion->execute();

            $deleteOptions = $this->mysqli->prepare(sprintf('DELETE FROM %s WHERE question_id = ?', $tables['question_options']));
            $deleteOptions->bind_param('i', $questionId);
            $deleteOptions->execute();

            $insertOption = $this->mysqli->prepare(
                sprintf('INSERT INTO %s (question_id, option_letter, option_text, option_image_url, is_correct, score_weight) VALUES (?, ?, ?, ?, ?, ?)', $tables['question_options'])
            );
            foreach ($payload['options'] as $option) {
                $scoreWeight = (int) ($option['score_weight'] ?? ($option['is_correct'] ? 5 : 0));
                $insertOption->bind_param(
                    'isssii',
                    $questionId,
                    $option['letter'],
                    $option['text'],
                    $option['image_url'],
                    $option['is_correct'],
                    $scoreWeight
                );
                $insertOption->execute();
            }

            $this->syncQuestionCount($packageId, $workspace);
            $this->mysqli->commit();
            if ($workspace === self::WORKSPACE_DRAFT) {
                $this->touchDraftPackage($packageId);
            }
            sendResponse('success', $workspace === self::WORKSPACE_DRAFT ? 'Soal draft berhasil diperbarui' : 'Soal berhasil diperbarui');
        } catch (RuntimeException $error) {
            if ($transactionStarted) {
                $this->mysqli->rollback();
            }
            sendResponse('error', $error->getMessage(), null, $error->getCode() ?: 422);
        } catch (Throwable $error) {
            if ($transactionStarted) {
                $this->mysqli->rollback();
            }
            sendResponse('error', 'Gagal memperbarui soal', ['details' => $error->getMessage()], 500);
        }
    }

    public function importQuestions() {
        verifyAdmin();
        $data = json_decode(file_get_contents('php://input'), true);
        $workspace = $this->getRequestWorkspace($data);

        $packageId = (int) ($data['package_id'] ?? 0);
        $rows = $data['rows'] ?? [];

        if ($packageId <= 0) {
            sendResponse('error', 'Package ID harus diisi', null, 400);
        }

        if (!is_array($rows) || count($rows) === 0) {
            sendResponse('error', 'Data import kosong', null, 422);
        }

        if (count($rows) > 500) {
            sendResponse('error', 'Maksimal 500 soal per sekali import', null, 422);
        }

        $transactionStarted = false;
        try {
            if ($workspace === self::WORKSPACE_DRAFT) {
                $this->ensurePackageDraftExists($packageId);
            }
            $payloads = [];
            foreach ($rows as $row) {
                if (!is_array($row)) {
                    throw new RuntimeException('Format baris import tidak valid', 422);
                }

                $payloads[] = $this->normalizeQuestionPayload($packageId, $row, $workspace);
            }

            $this->mysqli->begin_transaction();
            $transactionStarted = true;

            $imported = 0;
            foreach ($payloads as $payload) {
                $this->insertQuestionWithOptions($packageId, $payload, $workspace);
                $imported++;
            }

            $this->syncQuestionCount($packageId, $workspace);
            $this->mysqli->commit();
            if ($workspace === self::WORKSPACE_DRAFT) {
                $this->touchDraftPackage($packageId);
            }
            sendResponse('success', $workspace === self::WORKSPACE_DRAFT ? 'Import soal draft berhasil' : 'Import soal berhasil', [
                'imported_count' => $imported,
            ], 201);
        } catch (RuntimeException $error) {
            if ($transactionStarted) {
                $this->mysqli->rollback();
            }
            sendResponse('error', $error->getMessage(), null, $error->getCode() ?: 422);
        } catch (Throwable $error) {
            if ($transactionStarted) {
                $this->mysqli->rollback();
            }
            sendResponse('error', 'Gagal mengimpor soal', ['details' => $error->getMessage()], 500);
        }
    }

    public function deleteQuestion() {
        verifyAdmin();
        $workspace = $this->getRequestWorkspace();

        $questionId = (int) ($_GET['id'] ?? 0);
        if ($questionId <= 0) {
            sendResponse('error', 'Question ID harus diisi', null, 400);
        }

        $tables = $this->getWorkspaceTables($workspace);
        $findQuery = sprintf('SELECT package_id FROM %s WHERE id = ? LIMIT 1', $tables['questions']);
        $stmt = $this->mysqli->prepare($findQuery);
        $stmt->bind_param('i', $questionId);
        $stmt->execute();
        $question = $stmt->get_result()->fetch_assoc();

        if (!$question) {
            sendResponse('error', 'Soal tidak ditemukan', null, 404);
        }

        $deleteQuery = sprintf('DELETE FROM %s WHERE id = ?', $tables['questions']);
        $stmt = $this->mysqli->prepare($deleteQuery);
        $stmt->bind_param('i', $questionId);
        $stmt->execute();

        $packageId = (int) $question['package_id'];
        $this->syncQuestionCount($packageId, $workspace);
        if ($workspace === self::WORKSPACE_DRAFT) {
            $this->touchDraftPackage($packageId);
        }
        sendResponse('success', $workspace === self::WORKSPACE_DRAFT ? 'Soal draft berhasil dihapus' : 'Soal berhasil dihapus');
    }

    public function uploadMedia() {
        verifyAdmin();

        try {
            if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
                throw new RuntimeException('File gambar wajib dipilih', 422);
            }

            $context = trim((string) ($_POST['context'] ?? 'question'));
            $uploaded = $this->storeUploadedImage($_FILES['file'], $context);

            sendResponse('success', 'Gambar berhasil diupload', $uploaded, 201);
        } catch (RuntimeException $error) {
            sendResponse('error', $error->getMessage(), null, $error->getCode() ?: 422);
        } catch (Throwable $error) {
            sendResponse('error', 'Gagal mengupload gambar', ['details' => $error->getMessage()], 500);
        }
    }

    public function getLearningContent() {
        verifyAdmin();
        $workspace = $this->getRequestWorkspace();
        $packageId = (int) ($_GET['package_id'] ?? 0);
        if ($packageId <= 0) {
            sendResponse('error', 'Package ID harus diisi', null, 400);
        }

        $this->ensurePackageDraftExists($packageId);

        $package = $this->getPackageByWorkspace($packageId, $workspace);
        $workflow = TestWorkflow::buildPackageWorkflow($package);
        $loadMaterialMap = function (string $table, bool $includePublishedAt = false) use ($packageId): array {
            $query = $includePublishedAt
                ? "SELECT section_code, title, content_json, source_url, review_notes, published_at FROM {$table} WHERE package_id = ?"
                : "SELECT section_code, title, content_json, source_url, review_notes, NULL AS published_at FROM {$table} WHERE package_id = ?";
            $stmt = $this->mysqli->prepare($query);
            $stmt->bind_param('i', $packageId);
            $stmt->execute();
            $result = $stmt->get_result();
            $map = [];
            while ($row = $result->fetch_assoc()) {
                $materialPayload = json_decode((string) ($row['content_json'] ?? ''), true);
                $topics = $this->hydrateMaterialTopics($materialPayload, []);
                $map[(string) $row['section_code']] = [
                    'title' => $row['title'],
                    'topics' => $topics,
                    'pages' => $this->flattenMaterialTopics($topics),
                    'status' => 'published',
                    'source_url' => $row['source_url'] ?: null,
                    'review_notes' => (string) ($row['review_notes'] ?? ''),
                    'published_at' => $row['published_at'] ?? null,
                ];
            }

            return $map;
        };

        $loadQuestionMap = function (string $questionTable, string $optionTable) use ($packageId): array {
            $query = "SELECT q.*,
                        GROUP_CONCAT(
                          JSON_OBJECT(
                            'id', qo.id,
                            'letter', qo.option_letter,
                            'text', qo.option_text,
                            'image_url', qo.option_image_url,
                            'is_correct', qo.is_correct,
                            'score_weight', CAST(COALESCE(qo.score_weight, qo.is_correct) AS UNSIGNED)
                          ) ORDER BY qo.id SEPARATOR ','
                        ) AS options
                      FROM {$questionTable} q
                      LEFT JOIN {$optionTable} qo ON qo.question_id = q.id
                      WHERE q.package_id = ?
                      GROUP BY q.id
                      ORDER BY q.section_code ASC, q.question_order ASC, q.id ASC";
            $stmt = $this->mysqli->prepare($query);
            $stmt->bind_param('i', $packageId);
            $stmt->execute();
            $result = $stmt->get_result();
            $map = [];
            while ($row = $result->fetch_assoc()) {
                $sectionCode = (string) $row['section_code'];
                if (!isset($map[$sectionCode])) {
                    $map[$sectionCode] = [];
                }

                $row['id'] = (int) $row['id'];
                $row['question_order'] = (int) $row['question_order'];
                $row['options'] = $row['options'] ? json_decode('[' . $row['options'] . ']', true) : [];
                $map[$sectionCode][] = $row;
            }

            return $map;
        };

        $publishedMaterialMap = $loadMaterialMap('learning_materials', true);
        $draftMaterialMap = $loadMaterialMap('learning_material_drafts');
        $currentMaterialMap = $workspace === self::WORKSPACE_DRAFT ? $draftMaterialMap : $publishedMaterialMap;

        $publishedQuestionMap = $loadQuestionMap('learning_section_questions', 'learning_section_question_options');
        $draftQuestionMap = $loadQuestionMap('learning_section_question_drafts', 'learning_section_question_option_drafts');
        $currentQuestionMap = $workspace === self::WORKSPACE_DRAFT ? $draftQuestionMap : $publishedQuestionMap;

        $sections = [];
        foreach ($workflow['sections'] as $section) {
            $sectionCode = (string) $section['code'];
            $defaultMaterialPayload = LearningContent::defaultMaterialContent($section, (string) $workflow['mode']);
            $defaultTopics = $this->hydrateMaterialTopics($defaultMaterialPayload, []);
            $defaultPages = $this->flattenMaterialTopics($defaultTopics);
            $publishedMaterial = $publishedMaterialMap[$sectionCode] ?? [
                'title' => (string) $section['name'],
                'topics' => $defaultTopics,
                'pages' => $defaultPages,
                'status' => 'published',
                'source_url' => null,
                'review_notes' => '',
                'published_at' => null,
            ];
            $draftMaterial = $draftMaterialMap[$sectionCode] ?? $publishedMaterial;
            $material = $currentMaterialMap[$sectionCode] ?? ($workspace === self::WORKSPACE_DRAFT ? $draftMaterial : $publishedMaterial);
            $material = $this->annotateMaterialStatus($material, $draftMaterial, $publishedMaterial, $workspace === self::WORKSPACE_DRAFT);

            $publishedQuestions = $publishedQuestionMap[$sectionCode] ?? LearningContent::defaultSectionQuestions($section, (string) $workflow['mode']);
            $draftQuestions = $draftQuestionMap[$sectionCode] ?? $publishedQuestions;
            $currentQuestions = $currentQuestionMap[$sectionCode] ?? ($workspace === self::WORKSPACE_DRAFT ? $draftQuestions : $publishedQuestions);
            $comparisonQuestions = $workspace === self::WORKSPACE_DRAFT ? $publishedQuestions : $draftQuestions;
            $annotatedQuestions = $this->annotateQuestionStatuses($currentQuestions, $comparisonQuestions, 'learning');
            $miniTestStatus = count(array_filter($annotatedQuestions, static fn($question): bool => ($question['status'] ?? '') === 'draft')) > 0
                ? 'draft'
                : 'published';
            $sectionStatus = $material['status'] === 'draft' || $miniTestStatus === 'draft'
                ? 'draft'
                : 'published';

            $sections[] = [
                'code' => $sectionCode,
                'name' => $section['name'],
                'session_name' => $section['session_name'] ?? null,
                'order' => $section['order'],
                'status' => $sectionStatus,
                'mini_test_status' => $miniTestStatus,
                'material' => $material,
                'questions' => $annotatedQuestions,
            ];
        }

        sendResponse('success', $workspace === self::WORKSPACE_DRAFT ? 'Konten draft belajar berhasil diambil' : 'Konten belajar berhasil diambil', [
            'package_id' => $packageId,
            'sections' => $sections,
        ]);
    }

    public function updateLearningMaterial() {
        verifyAdmin();
        $data = json_decode(file_get_contents('php://input'), true);
        $workspace = $this->getRequestWorkspace($data);
        $packageId = (int) ($data['package_id'] ?? 0);
        $sectionCode = trim((string) ($data['section_code'] ?? ''));
        $topics = $data['topics'] ?? null;
        $pages = $data['pages'] ?? [];

        if ($packageId <= 0 || $sectionCode === '') {
            sendResponse('error', 'Package ID dan section harus diisi', null, 400);
        }

        if ($workspace === self::WORKSPACE_DRAFT) {
            $this->ensurePackageDraftExists($packageId);
        }

        [, , $section] = $this->getWorkflowSection($packageId, $sectionCode, $workspace);
        if (is_array($topics) && count($topics) > 0) {
            $normalizedTopics = $this->normalizeMaterialTopics($topics);
        } else {
            $normalizedTopics = $this->buildTopicsFromPages($this->normalizeMaterialPages(is_array($pages) ? $pages : []));
        }
        $title = trim((string) ($data['title'] ?? $section['name']));
        if ($title === '') {
            $title = (string) $section['name'];
        }

        $materialTable = $workspace === self::WORKSPACE_DRAFT ? 'learning_material_drafts' : 'learning_materials';
        $existingQuery = $workspace === self::WORKSPACE_DRAFT
            ? 'SELECT source_url, review_notes, NULL AS published_at FROM learning_material_drafts WHERE package_id = ? AND section_code = ? LIMIT 1'
            : 'SELECT source_url, review_notes, published_at FROM learning_materials WHERE package_id = ? AND section_code = ? LIMIT 1';
        $existingStmt = $this->mysqli->prepare($existingQuery);
        $existingStmt->bind_param('is', $packageId, $sectionCode);
        $existingStmt->execute();
        $existingMaterial = $existingStmt->get_result()->fetch_assoc() ?: null;

        $sourceUrl = array_key_exists('source_url', $data)
            ? trim((string) ($data['source_url'] ?? ''))
            : trim((string) ($existingMaterial['source_url'] ?? ''));
        $reviewNotes = array_key_exists('review_notes', $data)
            ? trim((string) ($data['review_notes'] ?? ''))
            : trim((string) ($existingMaterial['review_notes'] ?? ''));
        $sourceUrl = $sourceUrl !== '' ? $sourceUrl : null;
        $reviewNotes = $reviewNotes !== '' ? $reviewNotes : null;
        $publishedAt = $workspace === self::WORKSPACE_DRAFT
            ? null
            : (!empty($existingMaterial['published_at']) ? (string) $existingMaterial['published_at'] : date('Y-m-d H:i:s'));

        $contentJson = json_encode([
            'topics' => $normalizedTopics,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $query = $workspace === self::WORKSPACE_DRAFT
            ? "INSERT INTO learning_material_drafts (package_id, section_code, title, content_json, source_url, review_notes)
               VALUES (?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE
                 title = VALUES(title),
                 content_json = VALUES(content_json),
                 source_url = VALUES(source_url),
                 review_notes = VALUES(review_notes),
                 updated_at = CURRENT_TIMESTAMP"
            : "INSERT INTO learning_materials (package_id, section_code, title, content_json, status, source_url, review_notes, published_at)
               VALUES (?, ?, ?, ?, 'published', ?, ?, ?)
               ON DUPLICATE KEY UPDATE
                 title = VALUES(title),
                 content_json = VALUES(content_json),
                 status = 'published',
                 source_url = VALUES(source_url),
                 review_notes = VALUES(review_notes),
                 published_at = VALUES(published_at),
                 updated_at = CURRENT_TIMESTAMP";
        $stmt = $this->mysqli->prepare($query);
        if ($workspace === self::WORKSPACE_DRAFT) {
            $stmt->bind_param('isssss', $packageId, $sectionCode, $title, $contentJson, $sourceUrl, $reviewNotes);
        } else {
            $stmt->bind_param('issssss', $packageId, $sectionCode, $title, $contentJson, $sourceUrl, $reviewNotes, $publishedAt);
        }
        $stmt->execute();

        if ($workspace === self::WORKSPACE_DRAFT) {
            $this->touchDraftPackage($packageId);
        }

        sendResponse('success', $workspace === self::WORKSPACE_DRAFT ? 'Draft materi subtest berhasil disimpan' : 'Materi subtest berhasil diperbarui', [
            'material' => [
                'title' => $title,
                'topics' => $normalizedTopics,
                'pages' => $this->flattenMaterialTopics($normalizedTopics),
                'status' => $workspace === self::WORKSPACE_DRAFT ? 'draft' : 'published',
                'source_url' => $sourceUrl,
                'review_notes' => $reviewNotes ?? '',
                'published_at' => $publishedAt,
            ],
        ]);
    }

    public function updateLearningSectionQuestions() {
        verifyAdmin();
        $data = json_decode(file_get_contents('php://input'), true);
        $workspace = $this->getRequestWorkspace($data);
        $packageId = (int) ($data['package_id'] ?? 0);
        $sectionCode = trim((string) ($data['section_code'] ?? ''));
        $questions = $data['questions'] ?? [];

        if ($packageId <= 0 || $sectionCode === '') {
            sendResponse('error', 'Package ID dan section harus diisi', null, 400);
        }

        if ($workspace === self::WORKSPACE_DRAFT) {
            $this->ensurePackageDraftExists($packageId);
        }

        [, , $workflowSection] = $this->getWorkflowSection($packageId, $sectionCode, $workspace);
        $usesPointScoring = $this->isTkpSection(
            (string) ($workflowSection['code'] ?? $sectionCode),
            (string) ($workflowSection['name'] ?? '')
        );
        if (!is_array($questions) || count($questions) < 1) {
            sendResponse('error', 'Minimal isi 1 soal mini test', null, 422);
        }

        $normalizedQuestions = [];
        foreach ($questions as $index => $question) {
            if (!is_array($question)) {
                sendResponse('error', 'Format soal mini test tidak valid', null, 422);
            }

            $normalizedQuestions[] = $this->normalizeLearningQuestionPayload($question, $index + 1, $usesPointScoring);
        }

        $this->mysqli->begin_transaction();
        try {
            $tables = $this->getWorkspaceTables($workspace);
            $fetchExisting = $this->mysqli->prepare(
                sprintf('SELECT id FROM %s WHERE package_id = ? AND section_code = ?', $tables['learning_questions'])
            );
            $fetchExisting->bind_param('is', $packageId, $sectionCode);
            $fetchExisting->execute();
            $existingResult = $fetchExisting->get_result();
            $deleteOptions = $this->mysqli->prepare(sprintf('DELETE FROM %s WHERE question_id = ?', $tables['learning_question_options']));
            while ($row = $existingResult->fetch_assoc()) {
                $questionId = (int) $row['id'];
                $deleteOptions->bind_param('i', $questionId);
                $deleteOptions->execute();
            }

            $deleteQuestions = $this->mysqli->prepare(
                sprintf('DELETE FROM %s WHERE package_id = ? AND section_code = ?', $tables['learning_questions'])
            );
            $deleteQuestions->bind_param('is', $packageId, $sectionCode);
            $deleteQuestions->execute();

            $insertQuestion = $this->mysqli->prepare(
                sprintf(
                    'INSERT INTO %s (package_id, section_code, question_text, question_image_url, material_topic, difficulty, explanation_notes, question_order)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    $tables['learning_questions']
                )
            );
            $insertOption = $this->mysqli->prepare(
                sprintf(
                    'INSERT INTO %s (question_id, option_letter, option_text, option_image_url, is_correct, score_weight)
                     VALUES (?, ?, ?, ?, ?, ?)',
                    $tables['learning_question_options']
                )
            );

            $savedQuestions = [];
            foreach ($normalizedQuestions as $question) {
                $questionText = $question['question_text'];
                $questionImageUrl = $question['question_image_url'];
                $materialTopic = $question['material_topic'] !== '' ? $question['material_topic'] : null;
                $difficulty = $question['difficulty'];
                $explanationNotes = $question['explanation_notes'];
                $questionOrder = $question['question_order'];
                $insertQuestion->bind_param('issssssi', $packageId, $sectionCode, $questionText, $questionImageUrl, $materialTopic, $difficulty, $explanationNotes, $questionOrder);
                $insertQuestion->execute();
                $questionId = (int) $insertQuestion->insert_id;

                $savedQuestion = [
                    'id' => $questionId,
                    'question_text' => $questionText,
                    'question_image_url' => $questionImageUrl,
                    'material_topic' => $materialTopic ?? '',
                    'explanation_notes' => $explanationNotes,
                    'difficulty' => $difficulty,
                    'question_order' => $questionOrder,
                    'options' => [],
                ];

                foreach ($question['options'] as $option) {
                    $letter = $option['letter'];
                    $text = $option['text'];
                    $imageUrl = $option['image_url'];
                    $isCorrect = $option['is_correct'];
                    $scoreWeight = (int) ($option['score_weight'] ?? ($isCorrect ? 5 : 0));
                    $insertOption->bind_param('isssii', $questionId, $letter, $text, $imageUrl, $isCorrect, $scoreWeight);
                    $insertOption->execute();
                    $savedQuestion['options'][] = [
                        'letter' => $letter,
                        'text' => $text,
                        'image_url' => $imageUrl,
                        'is_correct' => $isCorrect,
                        'score_weight' => $scoreWeight,
                    ];
                }

                $savedQuestions[] = $savedQuestion;
            }

            $this->mysqli->commit();
            if ($workspace === self::WORKSPACE_DRAFT) {
                $this->touchDraftPackage($packageId);
            }
            sendResponse('success', $workspace === self::WORKSPACE_DRAFT ? 'Soal mini test draft berhasil disimpan' : 'Soal mini test subtest berhasil disimpan', [
                'section_code' => $sectionCode,
                'questions' => $savedQuestions,
            ]);
        } catch (Throwable $error) {
            $this->mysqli->rollback();
            sendResponse('error', 'Gagal menyimpan soal mini test', ['details' => $error->getMessage()], 500);
        }
    }

    private function replacePublishedQuestionsFromDraft(int $packageId): void {
        $deleteQuestions = $this->mysqli->prepare('DELETE FROM questions WHERE package_id = ?');
        $deleteQuestions->bind_param('i', $packageId);
        $deleteQuestions->execute();

        $query = "SELECT q.*,
                    GROUP_CONCAT(
                      JSON_OBJECT(
                        'letter', qo.option_letter,
                        'text', qo.option_text,
                        'image_url', qo.option_image_url,
                        'is_correct', qo.is_correct,
                        'score_weight', CAST(COALESCE(qo.score_weight, qo.is_correct) AS UNSIGNED)
                      ) ORDER BY qo.id SEPARATOR ','
                    ) AS options
                  FROM question_drafts q
                  LEFT JOIN question_option_drafts qo ON qo.question_id = q.id
                  WHERE q.package_id = ?
                  GROUP BY q.id
                  ORDER BY q.section_order ASC, q.id ASC";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('i', $packageId);
        $stmt->execute();
        $result = $stmt->get_result();

        while ($row = $result->fetch_assoc()) {
            $this->insertQuestionWithOptions($packageId, [
                'question_text' => (string) ($row['question_text'] ?? ''),
                'question_image_url' => $row['question_image_url'] ?: null,
                'question_image_layout' => (string) ($row['question_image_layout'] ?? 'top'),
                'question_type' => (string) ($row['question_type'] ?? 'single_choice'),
                'difficulty' => (string) ($row['difficulty'] ?? 'medium'),
                'explanation_notes' => (string) ($row['explanation_notes'] ?? ''),
                'section_code' => (string) ($row['section_code'] ?? ''),
                'section_name' => (string) ($row['section_name'] ?? ''),
                'section_order' => (int) ($row['section_order'] ?? 1),
                'options' => $row['options'] ? json_decode('[' . $row['options'] . ']', true) : [],
            ], self::WORKSPACE_PUBLISHED);
        }
    }

    private function replacePublishedMaterialsFromDraft(int $packageId): void {
        $deleteMaterials = $this->mysqli->prepare('DELETE FROM learning_materials WHERE package_id = ?');
        $deleteMaterials->bind_param('i', $packageId);
        $deleteMaterials->execute();

        $query = 'SELECT section_code, title, content_json, source_url, review_notes FROM learning_material_drafts WHERE package_id = ? ORDER BY section_code ASC';
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('i', $packageId);
        $stmt->execute();
        $result = $stmt->get_result();

        $insertMaterial = $this->mysqli->prepare(
            "INSERT INTO learning_materials (package_id, section_code, title, content_json, status, source_url, review_notes, published_at)
             VALUES (?, ?, ?, ?, 'published', ?, ?, CURRENT_TIMESTAMP)"
        );

        while ($row = $result->fetch_assoc()) {
            $sectionCode = (string) ($row['section_code'] ?? '');
            $title = (string) ($row['title'] ?? '');
            $contentJson = (string) ($row['content_json'] ?? '');
            $sourceUrl = ($row['source_url'] ?? null) ?: null;
            $reviewNotes = ($row['review_notes'] ?? null) ?: null;
            $insertMaterial->bind_param('isssss', $packageId, $sectionCode, $title, $contentJson, $sourceUrl, $reviewNotes);
            $insertMaterial->execute();
        }
    }

    private function replacePublishedMiniTestsFromDraft(int $packageId): void {
        $deleteQuestions = $this->mysqli->prepare('DELETE FROM learning_section_questions WHERE package_id = ?');
        $deleteQuestions->bind_param('i', $packageId);
        $deleteQuestions->execute();

        $query = "SELECT q.*,
                    GROUP_CONCAT(
                      JSON_OBJECT(
                        'letter', qo.option_letter,
                        'text', qo.option_text,
                        'image_url', qo.option_image_url,
                        'is_correct', qo.is_correct,
                        'score_weight', CAST(COALESCE(qo.score_weight, qo.is_correct) AS UNSIGNED)
                      ) ORDER BY qo.id SEPARATOR ','
                    ) AS options
                  FROM learning_section_question_drafts q
                  LEFT JOIN learning_section_question_option_drafts qo ON qo.question_id = q.id
                  WHERE q.package_id = ?
                  GROUP BY q.id
                  ORDER BY q.section_code ASC, q.question_order ASC, q.id ASC";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('i', $packageId);
        $stmt->execute();
        $result = $stmt->get_result();

        $insertQuestion = $this->mysqli->prepare(
            'INSERT INTO learning_section_questions (package_id, section_code, question_text, question_image_url, material_topic, difficulty, explanation_notes, question_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $insertOption = $this->mysqli->prepare(
            'INSERT INTO learning_section_question_options (question_id, option_letter, option_text, option_image_url, is_correct, score_weight)
             VALUES (?, ?, ?, ?, ?, ?)'
        );

        while ($row = $result->fetch_assoc()) {
            $sectionCode = (string) ($row['section_code'] ?? '');
            $questionText = (string) ($row['question_text'] ?? '');
            $questionImageUrl = ($row['question_image_url'] ?? null) ?: null;
            $materialTopic = ($row['material_topic'] ?? null) ? trim((string) $row['material_topic']) : null;
            $difficulty = (string) ($row['difficulty'] ?? 'medium');
            $explanationNotes = (string) ($row['explanation_notes'] ?? '');
            $questionOrder = (int) ($row['question_order'] ?? 1);
            $insertQuestion->bind_param('issssssi', $packageId, $sectionCode, $questionText, $questionImageUrl, $materialTopic, $difficulty, $explanationNotes, $questionOrder);
            $insertQuestion->execute();
            $publishedQuestionId = (int) $insertQuestion->insert_id;
            $options = $row['options'] ? json_decode('[' . $row['options'] . ']', true) : [];
            foreach ($options as $option) {
                $letter = (string) ($option['letter'] ?? 'A');
                $text = (string) ($option['text'] ?? '');
                $imageUrl = ($option['image_url'] ?? null) ?: null;
                $isCorrect = (int) ($option['is_correct'] ?? 0);
                $scoreWeight = (int) ($option['score_weight'] ?? ($isCorrect ? 5 : 0));
                $insertOption->bind_param('isssii', $publishedQuestionId, $letter, $text, $imageUrl, $isCorrect, $scoreWeight);
                $insertOption->execute();
            }
        }
    }

    private function normalizeNewsStatus($value): string {
        return strtolower(trim((string) $value)) === 'published' ? 'published' : 'draft';
    }

    private function normalizeNewsVisibility($value): string {
        return strtolower(trim((string) $value)) === 'private' ? 'private' : 'public';
    }

    private function normalizeNewsFlag($value): int {
        $normalized = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        return $normalized ? 1 : 0;
    }

    private function normalizeNewsOrder($value): int {
        return max(0, (int) $value);
    }

    private function normalizeNewsTags($value): array {
        if (is_string($value)) {
            $trimmed = trim($value);
            if ($trimmed === '') {
                return [];
            }

            $decoded = json_decode($trimmed, true);
            if (is_array($decoded)) {
                $value = $decoded;
            } else {
                $value = preg_split('/[,\\n]+/', $trimmed) ?: [];
            }
        }

        if (!is_array($value)) {
            return [];
        }

        $normalized = [];
        foreach ($value as $tag) {
            $cleanTag = trim((string) $tag);
            if ($cleanTag === '') {
                continue;
            }

            $alreadyExists = false;
            foreach ($normalized as $existingTag) {
                if (strtolower($existingTag) === strtolower($cleanTag)) {
                    $alreadyExists = true;
                    break;
                }
            }

            if (!$alreadyExists) {
                $normalized[] = $cleanTag;
            }
        }

        return array_values($normalized);
    }

    private function encodeNewsTags(array $tags): string {
        return json_encode($this->normalizeNewsTags($tags), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '[]';
    }

    private function decodeNewsTags($value): array {
        return $this->normalizeNewsTags($value);
    }

    private function normalizeNewsDateTime($value): ?string {
        $normalized = trim((string) $value);
        if ($normalized === '') {
            return null;
        }

        $timestamp = strtotime($normalized);
        if ($timestamp === false) {
            return null;
        }

        return date('Y-m-d H:i:s', $timestamp);
    }

    private function getNewsWorkspaceTable(string $workspace): string {
        return $workspace === self::WORKSPACE_DRAFT
            ? 'news_article_drafts'
            : 'news_articles';
    }

    private function slugifyNews(string $value): string {
        $normalized = strtolower(trim($value));
        $slug = preg_replace('/[^a-z0-9]+/', '-', $normalized) ?: '';
        $slug = trim($slug, '-');

        return $slug !== '' ? $slug : 'berita';
    }

    private function generateUniqueNewsSlug(string $candidate, string $workspace = self::WORKSPACE_PUBLISHED, int $excludeId = 0): string {
        $tableName = $this->getNewsWorkspaceTable($workspace);
        $baseSlug = $this->slugifyNews($candidate);
        $slug = $baseSlug;
        $suffix = 2;

        while (true) {
            $query = "SELECT id FROM {$tableName} WHERE slug = ?" . ($excludeId > 0 ? ' AND id != ?' : '') . ' LIMIT 1';
            $stmt = $this->mysqli->prepare($query);
            if ($excludeId > 0) {
                $stmt->bind_param('si', $slug, $excludeId);
            } else {
                $stmt->bind_param('s', $slug);
            }
            $stmt->execute();
            $existing = $stmt->get_result()->fetch_assoc();
            if (!$existing) {
                return $slug;
            }

            $slug = $baseSlug . '-' . $suffix;
            $suffix += 1;
        }
    }

    private function normalizeNewsArticle(array $row, string $workspace = self::WORKSPACE_PUBLISHED): array {
        return [
            'id' => (int) ($row['id'] ?? 0),
            'article_id' => (int) ($row['article_id'] ?? 0),
            'workspace' => $workspace,
            'slug' => (string) ($row['slug'] ?? ''),
            'title' => (string) ($row['title'] ?? ''),
            'excerpt' => (string) ($row['excerpt'] ?? ''),
            'content' => (string) ($row['content'] ?? ''),
            'cover_image_url' => (string) ($row['cover_image_url'] ?? ''),
            'category' => (string) ($row['category'] ?? 'Nasional'),
            'author_name' => (string) ($row['author_name'] ?? 'Tim Redaksi'),
            'read_time_minutes' => max(1, (int) ($row['read_time_minutes'] ?? 4)),
            'status' => $this->normalizeNewsStatus($row['status'] ?? 'draft'),
            'visibility' => $this->normalizeNewsVisibility($row['visibility'] ?? 'public'),
            'tags' => $this->decodeNewsTags($row['tags_json'] ?? ''),
            'tags_json' => (string) ($row['tags_json'] ?? '[]'),
            'focus_keyword' => (string) ($row['focus_keyword'] ?? ''),
            'allow_comments' => (int) ($row['allow_comments'] ?? 1),
            'is_featured' => (int) ($row['is_featured'] ?? 0),
            'featured_order' => (int) ($row['featured_order'] ?? 0),
            'is_popular' => (int) ($row['is_popular'] ?? 0),
            'popular_order' => (int) ($row['popular_order'] ?? 0),
            'is_editor_pick' => (int) ($row['is_editor_pick'] ?? 0),
            'editor_pick_order' => (int) ($row['editor_pick_order'] ?? 0),
            'published_at' => $row['published_at'] ?? null,
            'created_at' => $row['created_at'] ?? null,
            'updated_at' => $row['updated_at'] ?? null,
            'last_saved_at' => $row['last_saved_at'] ?? ($row['updated_at'] ?? null),
            'last_published_at' => $row['last_published_at'] ?? null,
        ];
    }

    private function getNewsArticleById(int $articleId, string $workspace = self::WORKSPACE_PUBLISHED): ?array {
        $tableName = $this->getNewsWorkspaceTable($workspace);
        $stmt = $this->mysqli->prepare("SELECT * FROM {$tableName} WHERE id = ? LIMIT 1");
        $stmt->bind_param('i', $articleId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();

        return $row ? $this->normalizeNewsArticle($row, $workspace) : null;
    }

    private function getNewsDraftByArticleId(int $articleId): ?array {
        $stmt = $this->mysqli->prepare('SELECT * FROM news_article_drafts WHERE article_id = ? LIMIT 1');
        $stmt->bind_param('i', $articleId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();

        return $row ? $this->normalizeNewsArticle($row, self::WORKSPACE_DRAFT) : null;
    }

    private function ensureNewsDraftExists(int $articleId): ?array {
        if ($articleId <= 0) {
            return null;
        }

        $existingDraft = $this->getNewsDraftByArticleId($articleId);
        if ($existingDraft) {
            return $existingDraft;
        }

        $publishedArticle = $this->getNewsArticleById($articleId, self::WORKSPACE_PUBLISHED);
        if (!$publishedArticle) {
            return null;
        }

        $tagsJson = $this->encodeNewsTags($publishedArticle['tags'] ?? []);
        $stmt = $this->mysqli->prepare(
            'INSERT INTO news_article_drafts (
                article_id, slug, title, excerpt, content, cover_image_url, category, author_name,
                read_time_minutes, status, visibility, tags_json, focus_keyword, allow_comments,
                is_featured, featured_order, is_popular, popular_order, is_editor_pick,
                editor_pick_order, published_at, last_published_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
        );
        $stmt->bind_param(
            'isssssssissssiiiiiiis',
            $articleId,
            $publishedArticle['slug'],
            $publishedArticle['title'],
            $publishedArticle['excerpt'],
            $publishedArticle['content'],
            $publishedArticle['cover_image_url'],
            $publishedArticle['category'],
            $publishedArticle['author_name'],
            $publishedArticle['read_time_minutes'],
            $publishedArticle['status'],
            $publishedArticle['visibility'],
            $tagsJson,
            $publishedArticle['focus_keyword'],
            $publishedArticle['allow_comments'],
            $publishedArticle['is_featured'],
            $publishedArticle['featured_order'],
            $publishedArticle['is_popular'],
            $publishedArticle['popular_order'],
            $publishedArticle['is_editor_pick'],
            $publishedArticle['editor_pick_order'],
            $publishedArticle['published_at']
        );
        $stmt->execute();

        return $this->getNewsArticleById((int) $stmt->insert_id, self::WORKSPACE_DRAFT);
    }

    private function ensureAllNewsDraftsExist(): void {
        $result = $this->mysqli->query('SELECT id FROM news_articles ORDER BY id ASC');
        if (!$result) {
            return;
        }

        while ($row = $result->fetch_assoc()) {
            $articleId = (int) ($row['id'] ?? 0);
            if ($articleId > 0) {
                $this->ensureNewsDraftExists($articleId);
            }
        }
    }

    private function normalizeNewsPayload(array $data, string $workspace, int $recordId = 0): array {
        $title = trim((string) ($data['title'] ?? ''));
        if ($title === '') {
            sendResponse('error', 'Judul berita wajib diisi', null, 422);
        }

        $status = $this->normalizeNewsStatus($data['status'] ?? 'draft');
        $slugSource = trim((string) ($data['slug'] ?? ''));
        $slug = $this->generateUniqueNewsSlug($slugSource !== '' ? $slugSource : $title, $workspace, $recordId);
        $publishedAt = $this->normalizeNewsDateTime($data['published_at'] ?? null);
        if ($status === 'published' && !$publishedAt) {
            $publishedAt = date('Y-m-d H:i:s');
        }

        $tags = $this->normalizeNewsTags($data['tags'] ?? []);

        return [
            'slug' => $slug,
            'title' => $title,
            'excerpt' => trim((string) ($data['excerpt'] ?? '')),
            'content' => trim((string) ($data['content'] ?? '')),
            'cover_image_url' => trim((string) ($data['cover_image_url'] ?? '')),
            'category' => trim((string) ($data['category'] ?? '')) ?: 'Nasional',
            'author_name' => trim((string) ($data['author_name'] ?? '')) ?: 'Tim Redaksi',
            'read_time_minutes' => max(1, (int) ($data['read_time_minutes'] ?? 4)),
            'status' => $status,
            'visibility' => $this->normalizeNewsVisibility($data['visibility'] ?? 'public'),
            'tags' => $tags,
            'tags_json' => $this->encodeNewsTags($tags),
            'focus_keyword' => trim((string) ($data['focus_keyword'] ?? '')),
            'allow_comments' => $this->normalizeNewsFlag($data['allow_comments'] ?? 1),
            'is_featured' => $this->normalizeNewsFlag($data['is_featured'] ?? 0),
            'featured_order' => $this->normalizeNewsOrder($data['featured_order'] ?? 0),
            'is_popular' => $this->normalizeNewsFlag($data['is_popular'] ?? 0),
            'popular_order' => $this->normalizeNewsOrder($data['popular_order'] ?? 0),
            'is_editor_pick' => $this->normalizeNewsFlag($data['is_editor_pick'] ?? 0),
            'editor_pick_order' => $this->normalizeNewsOrder($data['editor_pick_order'] ?? 0),
            'published_at' => $publishedAt,
        ];
    }

    public function getNewsArticles() {
        verifyAdmin();

        $workspace = $this->getRequestWorkspace();
        if ($workspace === self::WORKSPACE_DRAFT) {
            $this->ensureAllNewsDraftsExist();
        }

        $tableName = $this->getNewsWorkspaceTable($workspace);
        $statusFilter = strtolower(trim((string) ($_GET['status'] ?? '')));
        $orderBy = $workspace === self::WORKSPACE_DRAFT
            ? 'COALESCE(last_saved_at, updated_at, created_at)'
            : 'COALESCE(published_at, updated_at, created_at)';

        $query = "SELECT * FROM {$tableName}";
        if (in_array($statusFilter, ['published', 'draft'], true)) {
            $query .= ' WHERE status = ?';
        }
        $query .= " ORDER BY status ASC, {$orderBy} DESC, id DESC";

        if (in_array($statusFilter, ['published', 'draft'], true)) {
            $stmt = $this->mysqli->prepare($query);
            $stmt->bind_param('s', $statusFilter);
            $stmt->execute();
            $result = $stmt->get_result();
        } else {
            $result = $this->mysqli->query($query);
        }

        if (!$result) {
            sendResponse('error', 'Gagal mengambil daftar berita', null, 500);
        }

        $articles = [];
        while ($row = $result->fetch_assoc()) {
            $articles[] = $this->normalizeNewsArticle($row, $workspace);
        }

        sendResponse('success', 'Daftar berita berhasil diambil', $articles);
    }

    public function createNewsArticle() {
        verifyAdmin();
        $data = json_decode(file_get_contents('php://input'), true);
        if (!is_array($data)) {
            sendResponse('error', 'Body JSON tidak valid', null, 400);
        }

        $workspace = $this->getRequestWorkspace($data);
        if ($workspace !== self::WORKSPACE_DRAFT) {
            sendResponse('error', 'Tambah berita baru dilakukan di Draft workspace', null, 422);
        }

        $payload = $this->normalizeNewsPayload($data, $workspace);
        $stmt = $this->mysqli->prepare(
            'INSERT INTO news_article_drafts (
                slug, title, excerpt, content, cover_image_url, category, author_name,
                read_time_minutes, status, visibility, tags_json, focus_keyword, allow_comments,
                is_featured, featured_order, is_popular, popular_order, is_editor_pick,
                editor_pick_order, published_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->bind_param(
            'sssssssissssiiiiiiis',
            $payload['slug'],
            $payload['title'],
            $payload['excerpt'],
            $payload['content'],
            $payload['cover_image_url'],
            $payload['category'],
            $payload['author_name'],
            $payload['read_time_minutes'],
            $payload['status'],
            $payload['visibility'],
            $payload['tags_json'],
            $payload['focus_keyword'],
            $payload['allow_comments'],
            $payload['is_featured'],
            $payload['featured_order'],
            $payload['is_popular'],
            $payload['popular_order'],
            $payload['is_editor_pick'],
            $payload['editor_pick_order'],
            $payload['published_at']
        );

        if (!$stmt->execute()) {
            sendResponse('error', 'Gagal membuat draft berita', ['details' => $stmt->error], 500);
        }

        $article = $this->getNewsArticleById((int) $stmt->insert_id, self::WORKSPACE_DRAFT);
        sendResponse('success', 'Draft berita berhasil dibuat', $article, 201);
    }

    public function updateNewsArticle() {
        verifyAdmin();
        $data = json_decode(file_get_contents('php://input'), true);
        if (!is_array($data)) {
            sendResponse('error', 'Body JSON tidak valid', null, 400);
        }

        $workspace = $this->getRequestWorkspace($data);
        if ($workspace !== self::WORKSPACE_DRAFT) {
            sendResponse('error', 'Published workspace bersifat baca-saja. Gunakan Draft untuk mengedit berita.', null, 422);
        }

        $articleId = (int) ($data['id'] ?? 0);
        if ($articleId <= 0) {
            sendResponse('error', 'ID berita harus diisi', null, 422);
        }

        $existingArticle = $this->getNewsArticleById($articleId, self::WORKSPACE_DRAFT);
        if (!$existingArticle) {
            sendResponse('error', 'Draft berita tidak ditemukan', null, 404);
        }

        $payload = $this->normalizeNewsPayload($data, $workspace, $articleId);
        $stmt = $this->mysqli->prepare(
            'UPDATE news_article_drafts
             SET slug = ?, title = ?, excerpt = ?, content = ?, cover_image_url = ?, category = ?, author_name = ?,
                 read_time_minutes = ?, status = ?, visibility = ?, tags_json = ?, focus_keyword = ?,
                 allow_comments = ?, is_featured = ?, featured_order = ?, is_popular = ?, popular_order = ?,
                 is_editor_pick = ?, editor_pick_order = ?, published_at = ?
             WHERE id = ?'
        );
        $stmt->bind_param(
            'sssssssissssiiiiiiisi',
            $payload['slug'],
            $payload['title'],
            $payload['excerpt'],
            $payload['content'],
            $payload['cover_image_url'],
            $payload['category'],
            $payload['author_name'],
            $payload['read_time_minutes'],
            $payload['status'],
            $payload['visibility'],
            $payload['tags_json'],
            $payload['focus_keyword'],
            $payload['allow_comments'],
            $payload['is_featured'],
            $payload['featured_order'],
            $payload['is_popular'],
            $payload['popular_order'],
            $payload['is_editor_pick'],
            $payload['editor_pick_order'],
            $payload['published_at'],
            $articleId
        );

        if (!$stmt->execute()) {
            sendResponse('error', 'Gagal memperbarui draft berita', ['details' => $stmt->error], 500);
        }

        $article = $this->getNewsArticleById($articleId, self::WORKSPACE_DRAFT);
        sendResponse('success', 'Draft berita berhasil diperbarui', $article);
    }

    public function publishNewsDraft() {
        verifyAdmin();
        $data = json_decode(file_get_contents('php://input'), true);
        if (!is_array($data)) {
            sendResponse('error', 'Body JSON tidak valid', null, 400);
        }

        $draftId = (int) ($data['id'] ?? 0);
        if ($draftId <= 0) {
            sendResponse('error', 'ID draft berita harus diisi', null, 422);
        }

        $draftArticle = $this->getNewsArticleById($draftId, self::WORKSPACE_DRAFT);
        if (!$draftArticle) {
            sendResponse('error', 'Draft berita tidak ditemukan', null, 404);
        }

        $linkedArticleId = (int) ($draftArticle['article_id'] ?? 0);
        $publishedPayload = $this->normalizeNewsPayload($draftArticle, self::WORKSPACE_PUBLISHED, $linkedArticleId);
        $publishedArticle = $linkedArticleId > 0
            ? $this->getNewsArticleById($linkedArticleId, self::WORKSPACE_PUBLISHED)
            : null;

        $transactionStarted = false;

        try {
            $this->mysqli->begin_transaction();
            $transactionStarted = true;

            if ($publishedArticle) {
                $updatePublished = $this->mysqli->prepare(
                    'UPDATE news_articles
                     SET slug = ?, title = ?, excerpt = ?, content = ?, cover_image_url = ?, category = ?, author_name = ?,
                         read_time_minutes = ?, status = ?, visibility = ?, tags_json = ?, focus_keyword = ?,
                         allow_comments = ?, is_featured = ?, featured_order = ?, is_popular = ?, popular_order = ?,
                         is_editor_pick = ?, editor_pick_order = ?, published_at = ?
                     WHERE id = ?'
                );
                $updatePublished->bind_param(
                    'sssssssissssiiiiiiisi',
                    $publishedPayload['slug'],
                    $publishedPayload['title'],
                    $publishedPayload['excerpt'],
                    $publishedPayload['content'],
                    $publishedPayload['cover_image_url'],
                    $publishedPayload['category'],
                    $publishedPayload['author_name'],
                    $publishedPayload['read_time_minutes'],
                    $publishedPayload['status'],
                    $publishedPayload['visibility'],
                    $publishedPayload['tags_json'],
                    $publishedPayload['focus_keyword'],
                    $publishedPayload['allow_comments'],
                    $publishedPayload['is_featured'],
                    $publishedPayload['featured_order'],
                    $publishedPayload['is_popular'],
                    $publishedPayload['popular_order'],
                    $publishedPayload['is_editor_pick'],
                    $publishedPayload['editor_pick_order'],
                    $publishedPayload['published_at'],
                    $linkedArticleId
                );
                $updatePublished->execute();
            } else {
                $insertPublished = $this->mysqli->prepare(
                    'INSERT INTO news_articles (
                        slug, title, excerpt, content, cover_image_url, category, author_name,
                        read_time_minutes, status, visibility, tags_json, focus_keyword, allow_comments,
                        is_featured, featured_order, is_popular, popular_order, is_editor_pick,
                        editor_pick_order, published_at
                     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                );
                $insertPublished->bind_param(
                    'sssssssissssiiiiiiis',
                    $publishedPayload['slug'],
                    $publishedPayload['title'],
                    $publishedPayload['excerpt'],
                    $publishedPayload['content'],
                    $publishedPayload['cover_image_url'],
                    $publishedPayload['category'],
                    $publishedPayload['author_name'],
                    $publishedPayload['read_time_minutes'],
                    $publishedPayload['status'],
                    $publishedPayload['visibility'],
                    $publishedPayload['tags_json'],
                    $publishedPayload['focus_keyword'],
                    $publishedPayload['allow_comments'],
                    $publishedPayload['is_featured'],
                    $publishedPayload['featured_order'],
                    $publishedPayload['is_popular'],
                    $publishedPayload['popular_order'],
                    $publishedPayload['is_editor_pick'],
                    $publishedPayload['editor_pick_order'],
                    $publishedPayload['published_at']
                );
                $insertPublished->execute();
                $linkedArticleId = (int) $insertPublished->insert_id;
            }

            $syncDraft = $this->mysqli->prepare(
                'UPDATE news_article_drafts
                 SET article_id = ?, slug = ?, published_at = ?, last_published_at = CURRENT_TIMESTAMP
                 WHERE id = ?'
            );
            $syncDraft->bind_param(
                'issi',
                $linkedArticleId,
                $publishedPayload['slug'],
                $publishedPayload['published_at'],
                $draftId
            );
            $syncDraft->execute();

            $this->mysqli->commit();
        } catch (Throwable $error) {
            if ($transactionStarted) {
                $this->mysqli->rollback();
            }
            sendResponse('error', 'Gagal mempublish draft berita', ['details' => $error->getMessage()], 500);
        }

        sendResponse('success', 'Draft berita berhasil dipublish', [
            'draft' => $this->getNewsArticleById($draftId, self::WORKSPACE_DRAFT),
            'published' => $this->getNewsArticleById($linkedArticleId, self::WORKSPACE_PUBLISHED),
            'draft_id' => $draftId,
            'article_id' => $linkedArticleId,
        ]);
    }

    public function deleteNewsArticle() {
        verifyAdmin();

        $workspace = $this->getRequestWorkspace();
        $articleId = (int) ($_GET['id'] ?? 0);
        if ($articleId <= 0) {
            sendResponse('error', 'ID berita harus diisi', null, 422);
        }

        $article = $this->getNewsArticleById($articleId, $workspace);
        if (!$article) {
            sendResponse('error', $workspace === self::WORKSPACE_DRAFT ? 'Draft berita tidak ditemukan' : 'Berita tidak ditemukan', null, 404);
        }

        if ($workspace === self::WORKSPACE_DRAFT) {
            $stmt = $this->mysqli->prepare('DELETE FROM news_article_drafts WHERE id = ?');
            $stmt->bind_param('i', $articleId);
            $stmt->execute();

            sendResponse('success', 'Draft berita berhasil dihapus', [
                'id' => $articleId,
            ]);
        }

        $transactionStarted = false;

        try {
            $this->mysqli->begin_transaction();
            $transactionStarted = true;

            $deleteDraft = $this->mysqli->prepare('DELETE FROM news_article_drafts WHERE article_id = ?');
            $deleteDraft->bind_param('i', $articleId);
            $deleteDraft->execute();

            $deletePublished = $this->mysqli->prepare('DELETE FROM news_articles WHERE id = ?');
            $deletePublished->bind_param('i', $articleId);
            $deletePublished->execute();

            $this->mysqli->commit();
        } catch (Throwable $error) {
            if ($transactionStarted) {
                $this->mysqli->rollback();
            }
            sendResponse('error', 'Gagal menghapus berita published', ['details' => $error->getMessage()], 500);
        }

        sendResponse('success', 'Berita published berhasil dihapus', [
            'id' => $articleId,
        ]);
    }

    private function normalizeNewsSectionLayout($value): string {
        $normalized = strtolower(trim((string) $value));
        $allowedLayouts = ['hero', 'ranked', 'lead-grid', 'cards'];
        return in_array($normalized, $allowedLayouts, true) ? $normalized : 'cards';
    }

    private function getNewsSectionWorkspaceTable(string $workspace): string {
        return $workspace === self::WORKSPACE_DRAFT
            ? 'news_section_drafts'
            : 'news_sections';
    }

    private function getNewsSectionRelationTable(string $workspace): string {
        return $workspace === self::WORKSPACE_DRAFT
            ? 'news_section_draft_articles'
            : 'news_section_articles';
    }

    private function getNewsSectionRelationKey(string $workspace): string {
        return $workspace === self::WORKSPACE_DRAFT ? 'section_draft_id' : 'section_id';
    }

    private function getNewsSectionArticleKey(string $workspace): string {
        return $workspace === self::WORKSPACE_DRAFT ? 'draft_article_id' : 'article_id';
    }

    private function normalizeNewsSectionCount($value): int {
        return max(1, min(24, (int) $value));
    }

    private function generateUniqueNewsSectionSlug(string $candidate, string $workspace = self::WORKSPACE_PUBLISHED, int $excludeId = 0): string {
        $tableName = $this->getNewsSectionWorkspaceTable($workspace);
        $baseSlug = $this->slugifyNews($candidate);
        $slug = $baseSlug;
        $suffix = 2;

        while (true) {
            $query = "SELECT id FROM {$tableName} WHERE slug = ?" . ($excludeId > 0 ? ' AND id != ?' : '') . ' LIMIT 1';
            $stmt = $this->mysqli->prepare($query);
            if ($excludeId > 0) {
                $stmt->bind_param('si', $slug, $excludeId);
            } else {
                $stmt->bind_param('s', $slug);
            }
            $stmt->execute();
            $existing = $stmt->get_result()->fetch_assoc();
            if (!$existing) {
                return $slug;
            }

            $slug = $baseSlug . '-' . $suffix;
            $suffix += 1;
        }
    }

    private function normalizeNewsSection(array $row, string $workspace = self::WORKSPACE_PUBLISHED): array {
        return [
            'id' => (int) ($row['id'] ?? 0),
            'section_id' => (int) ($row['section_id'] ?? 0),
            'workspace' => $workspace,
            'slug' => (string) ($row['slug'] ?? ''),
            'title' => (string) ($row['title'] ?? ''),
            'description' => (string) ($row['description'] ?? ''),
            'layout_style' => $this->normalizeNewsSectionLayout($row['layout_style'] ?? 'cards'),
            'article_count' => $this->normalizeNewsSectionCount($row['article_count'] ?? 5),
            'section_order' => max(0, (int) ($row['section_order'] ?? 0)),
            'is_active' => (int) ($row['is_active'] ?? 1),
            'created_at' => $row['created_at'] ?? null,
            'updated_at' => $row['updated_at'] ?? null,
            'last_saved_at' => $row['last_saved_at'] ?? ($row['updated_at'] ?? null),
            'last_published_at' => $row['last_published_at'] ?? null,
        ];
    }

    private function getNewsSectionById(int $sectionId, string $workspace = self::WORKSPACE_PUBLISHED): ?array {
        $tableName = $this->getNewsSectionWorkspaceTable($workspace);
        $stmt = $this->mysqli->prepare("SELECT * FROM {$tableName} WHERE id = ? LIMIT 1");
        $stmt->bind_param('i', $sectionId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();

        return $row ? $this->normalizeNewsSection($row, $workspace) : null;
    }

    private function getNewsSectionDraftByPublishedId(int $publishedSectionId): ?array {
        $stmt = $this->mysqli->prepare('SELECT * FROM news_section_drafts WHERE section_id = ? LIMIT 1');
        $stmt->bind_param('i', $publishedSectionId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();

        return $row ? $this->normalizeNewsSection($row, self::WORKSPACE_DRAFT) : null;
    }

    private function normalizeNewsSectionPayload(array $data, string $workspace, int $recordId = 0): array {
        $title = trim((string) ($data['title'] ?? ''));
        if ($title === '') {
            sendResponse('error', 'Judul section berita wajib diisi', null, 422);
        }

        $slugSource = trim((string) ($data['slug'] ?? ''));
        return [
            'slug' => $this->generateUniqueNewsSectionSlug($slugSource !== '' ? $slugSource : $title, $workspace, $recordId),
            'title' => $title,
            'description' => trim((string) ($data['description'] ?? '')),
            'layout_style' => $this->normalizeNewsSectionLayout($data['layout_style'] ?? 'cards'),
            'article_count' => $this->normalizeNewsSectionCount($data['article_count'] ?? 5),
            'section_order' => max(0, (int) ($data['section_order'] ?? 0)),
            'is_active' => $this->normalizeNewsFlag($data['is_active'] ?? 1),
        ];
    }

    private function loadNewsSectionAssignments(int $sectionId, string $workspace = self::WORKSPACE_PUBLISHED): array {
        $relationTable = $this->getNewsSectionRelationTable($workspace);
        $relationKey = $this->getNewsSectionRelationKey($workspace);
        $articleKey = $this->getNewsSectionArticleKey($workspace);
        $articleTable = $workspace === self::WORKSPACE_DRAFT ? 'news_article_drafts' : 'news_articles';
        $publishedArticleIdSelect = $workspace === self::WORKSPACE_DRAFT ? 'a.article_id' : 'a.id';

        $query = "SELECT rsa.id AS relation_id,
                         rsa.article_order,
                         a.id AS article_id,
                         {$publishedArticleIdSelect} AS published_article_id,
                         a.slug,
                         a.title,
                         a.category,
                         a.cover_image_url,
                         a.status,
                         a.published_at,
                         a.updated_at
                  FROM {$relationTable} rsa
                  JOIN {$articleTable} a ON a.id = rsa.{$articleKey}
                  WHERE rsa.{$relationKey} = ?
                  ORDER BY rsa.article_order ASC, a.id ASC";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('i', $sectionId);
        $stmt->execute();
        $result = $stmt->get_result();

        $assignments = [];
        while ($row = $result->fetch_assoc()) {
            $assignments[] = [
                'relation_id' => (int) ($row['relation_id'] ?? 0),
                'article_order' => (int) ($row['article_order'] ?? 0),
                'article_id' => (int) ($row['article_id'] ?? 0),
                'published_article_id' => (int) ($row['published_article_id'] ?? 0),
                'slug' => (string) ($row['slug'] ?? ''),
                'title' => (string) ($row['title'] ?? ''),
                'category' => (string) ($row['category'] ?? 'Nasional'),
                'cover_image_url' => (string) ($row['cover_image_url'] ?? ''),
                'status' => $this->normalizeNewsStatus($row['status'] ?? 'draft'),
                'published_at' => $row['published_at'] ?? null,
                'updated_at' => $row['updated_at'] ?? null,
            ];
        }

        return $assignments;
    }

    private function syncNewsSectionAssignments(int $sectionId, array $articleIds, string $workspace): void {
        $relationTable = $this->getNewsSectionRelationTable($workspace);
        $relationKey = $this->getNewsSectionRelationKey($workspace);
        $articleKey = $this->getNewsSectionArticleKey($workspace);

        $normalizedArticleIds = [];
        foreach ($articleIds as $articleId) {
            $numericId = (int) $articleId;
            if ($numericId > 0 && !in_array($numericId, $normalizedArticleIds, true)) {
                $normalizedArticleIds[] = $numericId;
            }
        }

        $deleteStmt = $this->mysqli->prepare("DELETE FROM {$relationTable} WHERE {$relationKey} = ?");
        $deleteStmt->bind_param('i', $sectionId);
        $deleteStmt->execute();

        if ($normalizedArticleIds === []) {
            return;
        }

        $insertStmt = $this->mysqli->prepare(
            "INSERT INTO {$relationTable} ({$relationKey}, {$articleKey}, article_order)
             VALUES (?, ?, ?)"
        );

        foreach ($normalizedArticleIds as $index => $articleId) {
            $articleOrder = $index + 1;
            $insertStmt->bind_param('iii', $sectionId, $articleId, $articleOrder);
            $insertStmt->execute();
        }
    }

    private function ensureNewsSectionDraftExists(int $publishedSectionId): ?array {
        if ($publishedSectionId <= 0) {
            return null;
        }

        $existingDraft = $this->getNewsSectionDraftByPublishedId($publishedSectionId);
        if ($existingDraft) {
            return $existingDraft;
        }

        $publishedSection = $this->getNewsSectionById($publishedSectionId, self::WORKSPACE_PUBLISHED);
        if (!$publishedSection) {
            return null;
        }

        $this->ensureAllNewsDraftsExist();

        $insertDraft = $this->mysqli->prepare(
            'INSERT INTO news_section_drafts (
                section_id, slug, title, description, layout_style, article_count, section_order, is_active, last_published_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
        );
        $insertDraft->bind_param(
            'issssiii',
            $publishedSectionId,
            $publishedSection['slug'],
            $publishedSection['title'],
            $publishedSection['description'],
            $publishedSection['layout_style'],
            $publishedSection['article_count'],
            $publishedSection['section_order'],
            $publishedSection['is_active']
        );
        $insertDraft->execute();
        $draftSectionId = (int) $insertDraft->insert_id;

        $publishedAssignments = $this->loadNewsSectionAssignments($publishedSectionId, self::WORKSPACE_PUBLISHED);
        $insertAssignment = $this->mysqli->prepare(
            'INSERT INTO news_section_draft_articles (section_draft_id, draft_article_id, article_order)
             VALUES (?, ?, ?)'
        );

        foreach ($publishedAssignments as $assignment) {
            $draftArticle = $this->ensureNewsDraftExists((int) ($assignment['article_id'] ?? 0));
            if (!$draftArticle || (int) ($draftArticle['id'] ?? 0) <= 0) {
                continue;
            }

            $draftArticleId = (int) $draftArticle['id'];
            $articleOrder = (int) ($assignment['article_order'] ?? 0);
            $insertAssignment->bind_param('iii', $draftSectionId, $draftArticleId, $articleOrder);
            $insertAssignment->execute();
        }

        return $this->getNewsSectionById($draftSectionId, self::WORKSPACE_DRAFT);
    }

    private function ensureAllNewsSectionDraftsExist(): void {
        $result = $this->mysqli->query('SELECT id FROM news_sections ORDER BY id ASC');
        if (!$result) {
            return;
        }

        while ($row = $result->fetch_assoc()) {
            $publishedSectionId = (int) ($row['id'] ?? 0);
            if ($publishedSectionId > 0) {
                $this->ensureNewsSectionDraftExists($publishedSectionId);
            }
        }
    }

    private function syncPublishedNewsSectionOrderFromDrafts(): int {
        $this->ensureAllNewsSectionDraftsExist();

        $result = $this->mysqli->query(
            'SELECT id, section_id
             FROM news_section_drafts
             ORDER BY section_order ASC, id ASC'
        );
        if (!$result) {
            throw new RuntimeException('Gagal memuat urutan section draft');
        }

        $updateStmt = $this->mysqli->prepare('UPDATE news_sections SET section_order = ? WHERE id = ?');
        if (!$updateStmt) {
            throw new RuntimeException('Gagal menyiapkan sinkron urutan section live');
        }

        $nextOrder = 1;
        $updatedCount = 0;

        while ($row = $result->fetch_assoc()) {
            $publishedSectionId = (int) ($row['section_id'] ?? 0);
            if ($publishedSectionId <= 0) {
                continue;
            }

            $updateStmt->bind_param('ii', $nextOrder, $publishedSectionId);
            if (!$updateStmt->execute()) {
                throw new RuntimeException($updateStmt->error ?: 'Gagal menyimpan urutan section live');
            }

            $nextOrder += 1;
            $updatedCount += 1;
        }

        return $updatedCount;
    }

    public function getNewsSections() {
        verifyAdmin();

        $workspace = $this->getRequestWorkspace();
        if ($workspace === self::WORKSPACE_DRAFT) {
            $this->ensureAllNewsSectionDraftsExist();
        }

        $tableName = $this->getNewsSectionWorkspaceTable($workspace);
        $query = "SELECT * FROM {$tableName} ORDER BY section_order ASC, id ASC";
        $result = $this->mysqli->query($query);
        if (!$result) {
            sendResponse('error', 'Gagal mengambil master section berita', null, 500);
        }

        $sections = [];
        while ($row = $result->fetch_assoc()) {
            $section = $this->normalizeNewsSection($row, $workspace);
            $section['assignments'] = $this->loadNewsSectionAssignments((int) $section['id'], $workspace);
            $sections[] = $section;
        }

        sendResponse('success', 'Master section berita berhasil diambil', $sections);
    }

    public function createNewsSection() {
        verifyAdmin();
        $data = json_decode(file_get_contents('php://input'), true);
        if (!is_array($data)) {
            sendResponse('error', 'Body JSON tidak valid', null, 400);
        }

        $workspace = $this->getRequestWorkspace($data);
        if ($workspace !== self::WORKSPACE_DRAFT) {
            sendResponse('error', 'Section baru dibuat di Draft workspace', null, 422);
        }

        $payload = $this->normalizeNewsSectionPayload($data, $workspace);
        $assignedArticleIds = is_array($data['assigned_article_ids'] ?? null) ? $data['assigned_article_ids'] : [];

        $stmt = $this->mysqli->prepare(
            'INSERT INTO news_section_drafts (
                slug, title, description, layout_style, article_count, section_order, is_active
             ) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->bind_param(
            'ssssiii',
            $payload['slug'],
            $payload['title'],
            $payload['description'],
            $payload['layout_style'],
            $payload['article_count'],
            $payload['section_order'],
            $payload['is_active']
        );

        if (!$stmt->execute()) {
            sendResponse('error', 'Gagal membuat section berita', ['details' => $stmt->error], 500);
        }

        $draftSectionId = (int) $stmt->insert_id;
        $this->syncNewsSectionAssignments($draftSectionId, $assignedArticleIds, self::WORKSPACE_DRAFT);

        $section = $this->getNewsSectionById($draftSectionId, self::WORKSPACE_DRAFT);
        $section['assignments'] = $this->loadNewsSectionAssignments($draftSectionId, self::WORKSPACE_DRAFT);
        sendResponse('success', 'Section berita draft berhasil dibuat', $section, 201);
    }

    public function reorderNewsSections() {
        verifyAdmin();
        $data = json_decode(file_get_contents('php://input'), true);
        if (!is_array($data)) {
            sendResponse('error', 'Body JSON tidak valid', null, 400);
        }

        $workspace = $this->getRequestWorkspace($data);
        if ($workspace !== self::WORKSPACE_DRAFT) {
            sendResponse('error', 'Urutan section hanya bisa diubah dari Draft workspace.', null, 422);
        }

        $orderedIds = is_array($data['ordered_ids'] ?? null) ? $data['ordered_ids'] : [];
        if ($orderedIds === []) {
            sendResponse('error', 'Urutan section draft wajib dikirim', null, 422);
        }

        $this->ensureAllNewsSectionDraftsExist();

        $result = $this->mysqli->query('SELECT id FROM news_section_drafts ORDER BY section_order ASC, id ASC');
        if (!$result) {
            sendResponse('error', 'Gagal memuat section draft untuk diurutkan', null, 500);
        }

        $existingIds = [];
        while ($row = $result->fetch_assoc()) {
            $sectionId = (int) ($row['id'] ?? 0);
            if ($sectionId > 0) {
                $existingIds[] = $sectionId;
            }
        }

        if ($existingIds === []) {
            sendResponse('success', 'Belum ada section draft untuk diurutkan', []);
        }

        $existingLookup = array_fill_keys($existingIds, true);
        $normalizedOrderedIds = [];
        foreach ($orderedIds as $sectionId) {
            $numericId = (int) $sectionId;
            if ($numericId > 0 && isset($existingLookup[$numericId]) && !in_array($numericId, $normalizedOrderedIds, true)) {
                $normalizedOrderedIds[] = $numericId;
            }
        }

        foreach ($existingIds as $sectionId) {
            if (!in_array($sectionId, $normalizedOrderedIds, true)) {
                $normalizedOrderedIds[] = $sectionId;
            }
        }

        $transactionStarted = false;
        try {
            $this->mysqli->begin_transaction();
            $transactionStarted = true;

            $updateStmt = $this->mysqli->prepare(
                'UPDATE news_section_drafts
                 SET section_order = ?
                 WHERE id = ?'
            );
            if (!$updateStmt) {
                throw new RuntimeException('Gagal menyiapkan penyimpanan urutan section draft');
            }

            foreach ($normalizedOrderedIds as $index => $sectionId) {
                $sectionOrder = $index + 1;
                $updateStmt->bind_param('ii', $sectionOrder, $sectionId);
                if (!$updateStmt->execute()) {
                    throw new RuntimeException($updateStmt->error ?: 'Gagal menyimpan urutan section draft');
                }
            }

            $this->mysqli->commit();
        } catch (Throwable $error) {
            if ($transactionStarted) {
                $this->mysqli->rollback();
            }
            sendResponse('error', 'Gagal memperbarui urutan section draft', ['details' => $error->getMessage()], 500);
        }

        $query = 'SELECT * FROM news_section_drafts ORDER BY section_order ASC, id ASC';
        $orderedResult = $this->mysqli->query($query);
        if (!$orderedResult) {
            sendResponse('error', 'Urutan berhasil disimpan, tapi gagal memuat ulang section draft', null, 500);
        }

        $sections = [];
        while ($row = $orderedResult->fetch_assoc()) {
            $section = $this->normalizeNewsSection($row, self::WORKSPACE_DRAFT);
            $section['assignments'] = $this->loadNewsSectionAssignments((int) $section['id'], self::WORKSPACE_DRAFT);
            $sections[] = $section;
        }

        sendResponse('success', 'Urutan section draft berhasil diperbarui', $sections);
    }

    public function updateNewsSection() {
        verifyAdmin();
        $data = json_decode(file_get_contents('php://input'), true);
        if (!is_array($data)) {
            sendResponse('error', 'Body JSON tidak valid', null, 400);
        }

        $workspace = $this->getRequestWorkspace($data);
        if ($workspace !== self::WORKSPACE_DRAFT) {
            sendResponse('error', 'Published workspace bersifat baca-saja. Gunakan Draft untuk edit section berita.', null, 422);
        }

        $sectionId = (int) ($data['id'] ?? 0);
        if ($sectionId <= 0) {
            sendResponse('error', 'ID section berita harus diisi', null, 422);
        }

        $existingSection = $this->getNewsSectionById($sectionId, self::WORKSPACE_DRAFT);
        if (!$existingSection) {
            sendResponse('error', 'Section berita draft tidak ditemukan', null, 404);
        }

        $payload = $this->normalizeNewsSectionPayload($data, $workspace, $sectionId);
        $assignedArticleIds = is_array($data['assigned_article_ids'] ?? null) ? $data['assigned_article_ids'] : [];

        $stmt = $this->mysqli->prepare(
            'UPDATE news_section_drafts
             SET slug = ?, title = ?, description = ?, layout_style = ?, article_count = ?, section_order = ?, is_active = ?
             WHERE id = ?'
        );
        $stmt->bind_param(
            'ssssiiii',
            $payload['slug'],
            $payload['title'],
            $payload['description'],
            $payload['layout_style'],
            $payload['article_count'],
            $payload['section_order'],
            $payload['is_active'],
            $sectionId
        );

        if (!$stmt->execute()) {
            sendResponse('error', 'Gagal memperbarui section berita', ['details' => $stmt->error], 500);
        }

        $this->syncNewsSectionAssignments($sectionId, $assignedArticleIds, self::WORKSPACE_DRAFT);

        $section = $this->getNewsSectionById($sectionId, self::WORKSPACE_DRAFT);
        $section['assignments'] = $this->loadNewsSectionAssignments($sectionId, self::WORKSPACE_DRAFT);
        sendResponse('success', 'Section berita draft berhasil diperbarui', $section);
    }

    public function publishNewsSectionDraft() {
        verifyAdmin();
        $data = json_decode(file_get_contents('php://input'), true);
        if (!is_array($data)) {
            sendResponse('error', 'Body JSON tidak valid', null, 400);
        }

        $draftSectionId = (int) ($data['id'] ?? 0);
        if ($draftSectionId <= 0) {
            sendResponse('error', 'ID draft section berita harus diisi', null, 422);
        }

        $draftSection = $this->getNewsSectionById($draftSectionId, self::WORKSPACE_DRAFT);
        if (!$draftSection) {
            sendResponse('error', 'Draft section berita tidak ditemukan', null, 404);
        }

        $linkedSectionId = (int) ($draftSection['section_id'] ?? 0);
        $publishedSection = $linkedSectionId > 0
            ? $this->getNewsSectionById($linkedSectionId, self::WORKSPACE_PUBLISHED)
            : null;
        $draftAssignments = $this->loadNewsSectionAssignments($draftSectionId, self::WORKSPACE_DRAFT);
        $publishedPayload = $this->normalizeNewsSectionPayload($draftSection, self::WORKSPACE_PUBLISHED, $linkedSectionId);

        $transactionStarted = false;
        try {
            $this->mysqli->begin_transaction();
            $transactionStarted = true;

            if ($publishedSection) {
                $updateSection = $this->mysqli->prepare(
                    'UPDATE news_sections
                     SET slug = ?, title = ?, description = ?, layout_style = ?, article_count = ?, section_order = ?, is_active = ?
                     WHERE id = ?'
                );
                $updateSection->bind_param(
                    'ssssiiii',
                    $publishedPayload['slug'],
                    $publishedPayload['title'],
                    $publishedPayload['description'],
                    $publishedPayload['layout_style'],
                    $publishedPayload['article_count'],
                    $publishedPayload['section_order'],
                    $publishedPayload['is_active'],
                    $linkedSectionId
                );
                $updateSection->execute();
            } else {
                $insertSection = $this->mysqli->prepare(
                    'INSERT INTO news_sections (
                        slug, title, description, layout_style, article_count, section_order, is_active
                     ) VALUES (?, ?, ?, ?, ?, ?, ?)'
                );
                $insertSection->bind_param(
                    'ssssiii',
                    $publishedPayload['slug'],
                    $publishedPayload['title'],
                    $publishedPayload['description'],
                    $publishedPayload['layout_style'],
                    $publishedPayload['article_count'],
                    $publishedPayload['section_order'],
                    $publishedPayload['is_active']
                );
                $insertSection->execute();
                $linkedSectionId = (int) $insertSection->insert_id;
            }

            $deleteRelations = $this->mysqli->prepare('DELETE FROM news_section_articles WHERE section_id = ?');
            $deleteRelations->bind_param('i', $linkedSectionId);
            $deleteRelations->execute();

            $insertRelation = $this->mysqli->prepare(
                'INSERT INTO news_section_articles (section_id, article_id, article_order)
                 VALUES (?, ?, ?)'
            );
            foreach ($draftAssignments as $assignment) {
                $publishedArticleId = (int) ($assignment['published_article_id'] ?? 0);
                if ($publishedArticleId <= 0) {
                    continue;
                }

                $articleOrder = (int) ($assignment['article_order'] ?? 0);
                $insertRelation->bind_param('iii', $linkedSectionId, $publishedArticleId, $articleOrder);
                $insertRelation->execute();
            }

            $syncDraft = $this->mysqli->prepare(
                'UPDATE news_section_drafts
                 SET section_id = ?, slug = ?, last_published_at = CURRENT_TIMESTAMP
                 WHERE id = ?'
            );
            $syncDraft->bind_param('isi', $linkedSectionId, $publishedPayload['slug'], $draftSectionId);
            $syncDraft->execute();

            $this->syncPublishedNewsSectionOrderFromDrafts();

            $this->mysqli->commit();
        } catch (Throwable $error) {
            if ($transactionStarted) {
                $this->mysqli->rollback();
            }
            sendResponse('error', 'Gagal mempublish draft section berita', ['details' => $error->getMessage()], 500);
        }

        $draftSection = $this->getNewsSectionById($draftSectionId, self::WORKSPACE_DRAFT);
        $draftSection['assignments'] = $this->loadNewsSectionAssignments($draftSectionId, self::WORKSPACE_DRAFT);
        $publishedSection = $this->getNewsSectionById($linkedSectionId, self::WORKSPACE_PUBLISHED);
        $publishedSection['assignments'] = $this->loadNewsSectionAssignments($linkedSectionId, self::WORKSPACE_PUBLISHED);

        sendResponse('success', 'Draft section berita berhasil dipublish', [
            'draft' => $draftSection,
            'published' => $publishedSection,
        ]);
    }

    public function publishNewsSectionOrder() {
        verifyAdmin();

        $transactionStarted = false;
        try {
            $this->mysqli->begin_transaction();
            $transactionStarted = true;
            $syncedCount = $this->syncPublishedNewsSectionOrderFromDrafts();
            $this->mysqli->commit();
        } catch (Throwable $error) {
            if ($transactionStarted) {
                $this->mysqli->rollback();
            }
            sendResponse('error', 'Gagal mempublish urutan section berita', ['details' => $error->getMessage()], 500);
        }

        sendResponse('success', 'Urutan section berita live berhasil diperbarui', [
            'published_section_count' => $syncedCount ?? 0,
        ]);
    }

    public function deleteNewsSection() {
        verifyAdmin();

        $workspace = $this->getRequestWorkspace();
        $sectionId = (int) ($_GET['id'] ?? 0);
        if ($sectionId <= 0) {
            sendResponse('error', 'ID section berita harus diisi', null, 422);
        }

        $section = $this->getNewsSectionById($sectionId, $workspace);
        if (!$section) {
            sendResponse('error', $workspace === self::WORKSPACE_DRAFT ? 'Draft section berita tidak ditemukan' : 'Section berita tidak ditemukan', null, 404);
        }

        if ($workspace === self::WORKSPACE_DRAFT) {
            $deleteRelations = $this->mysqli->prepare('DELETE FROM news_section_draft_articles WHERE section_draft_id = ?');
            $deleteRelations->bind_param('i', $sectionId);
            $deleteRelations->execute();

            $deleteSection = $this->mysqli->prepare('DELETE FROM news_section_drafts WHERE id = ?');
            $deleteSection->bind_param('i', $sectionId);
            $deleteSection->execute();

            sendResponse('success', 'Draft section berita berhasil dihapus', [
                'id' => $sectionId,
            ]);
        }

        $transactionStarted = false;
        try {
            $this->mysqli->begin_transaction();
            $transactionStarted = true;

            $deleteDraftRelations = $this->mysqli->prepare(
                'DELETE rsa FROM news_section_draft_articles rsa
                 JOIN news_section_drafts rsd ON rsd.id = rsa.section_draft_id
                 WHERE rsd.section_id = ?'
            );
            $deleteDraftRelations->bind_param('i', $sectionId);
            $deleteDraftRelations->execute();

            $deleteDraftSection = $this->mysqli->prepare('DELETE FROM news_section_drafts WHERE section_id = ?');
            $deleteDraftSection->bind_param('i', $sectionId);
            $deleteDraftSection->execute();

            $deletePublishedRelations = $this->mysqli->prepare('DELETE FROM news_section_articles WHERE section_id = ?');
            $deletePublishedRelations->bind_param('i', $sectionId);
            $deletePublishedRelations->execute();

            $deletePublishedSection = $this->mysqli->prepare('DELETE FROM news_sections WHERE id = ?');
            $deletePublishedSection->bind_param('i', $sectionId);
            $deletePublishedSection->execute();

            $this->mysqli->commit();
        } catch (Throwable $error) {
            if ($transactionStarted) {
                $this->mysqli->rollback();
            }
            sendResponse('error', 'Gagal menghapus section berita published', ['details' => $error->getMessage()], 500);
        }

        sendResponse('success', 'Section berita published berhasil dihapus', [
            'id' => $sectionId,
        ]);
    }

    public function savePackageDraft() {
        verifyAdmin();
        $data = json_decode(file_get_contents('php://input'), true);
        $packageId = (int) ($data['package_id'] ?? 0);
        if ($packageId <= 0) {
            sendResponse('error', 'Package ID harus diisi', null, 400);
        }

        $this->ensurePackageDraftExists($packageId);
        $this->syncQuestionCount($packageId, self::WORKSPACE_DRAFT);
        $this->touchDraftPackage($packageId);

        $draftPackage = $this->getDraftPackage($packageId);
        sendResponse('success', 'Draft paket berhasil disimpan', [
            'package_id' => $packageId,
            'last_saved_at' => $draftPackage['last_saved_at'] ?? null,
        ]);
    }

    public function publishPackageDraft() {
        verifyAdmin();
        $data = json_decode(file_get_contents('php://input'), true);
        $packageId = (int) ($data['package_id'] ?? 0);
        if ($packageId <= 0) {
            sendResponse('error', 'Package ID harus diisi', null, 400);
        }

        $this->ensurePackageDraftExists($packageId);
        $draftPackage = $this->getPackageByWorkspace($packageId, self::WORKSPACE_DRAFT);
        $publishedPackage = $this->getPackage($packageId);
        $transactionStarted = false;

        try {
            $this->mysqli->begin_transaction();
            $transactionStarted = true;

            $updatePackage = $this->mysqli->prepare(
                'UPDATE test_packages
                 SET category_id = ?,
                     name = ?,
                     description = ?,
                     price = ?,
                     duration_days = ?,
                     max_attempts = ?,
                     time_limit = ?,
                     test_mode = ?,
                     workflow_config = ?,
                     is_temporarily_disabled = ?
                 WHERE id = ?'
            );
            $updatePackage->bind_param(
                'issiiiissii',
                $draftPackage['category_id'],
                $draftPackage['name'],
                $draftPackage['description'],
                $draftPackage['price'],
                $draftPackage['duration_days'],
                $draftPackage['max_attempts'],
                $draftPackage['time_limit'],
                $draftPackage['test_mode'],
                $draftPackage['workflow_config'],
                $this->normalizeTemporaryDisabledFlag($draftPackage['is_temporarily_disabled'] ?? 0),
                $packageId
            );
            $updatePackage->execute();

            $this->replacePublishedQuestionsFromDraft($packageId);
            $this->replacePublishedMaterialsFromDraft($packageId);
            $this->replacePublishedMiniTestsFromDraft($packageId);

            $previousWorkflow = TestWorkflow::buildPackageWorkflow($publishedPackage);
            $nextWorkflow = TestWorkflow::buildPackageWorkflow($draftPackage);
            $this->syncPackageWorkflowData($packageId, $previousWorkflow, $nextWorkflow, self::WORKSPACE_PUBLISHED);
            $this->syncQuestionCount($packageId, self::WORKSPACE_PUBLISHED);
            $this->touchDraftPackage($packageId, true);

            $this->mysqli->commit();
            sendResponse('success', 'Draft paket berhasil dipublish ke peserta', [
                'package_id' => $packageId,
            ]);
        } catch (Throwable $error) {
            if ($transactionStarted) {
                $this->mysqli->rollback();
            }
            sendResponse('error', 'Gagal mempublish draft paket', ['details' => $error->getMessage()], 500);
        }
    }
}

$requestMethod = $_SERVER['REQUEST_METHOD'];
$requestPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

$controller = new AdminController($mysqli);

if (strpos($requestPath, '/api/admin/package-types') !== false && $requestMethod === 'GET') {
    $controller->getPackageTypes();
} elseif (strpos($requestPath, '/api/admin/package-types') !== false && $requestMethod === 'POST') {
    $controller->createPackageType();
} elseif (strpos($requestPath, '/api/admin/package-types') !== false && $requestMethod === 'PUT') {
    $controller->updatePackageType();
} elseif (strpos($requestPath, '/api/admin/package-types') !== false && $requestMethod === 'DELETE') {
    $controller->deletePackageType();
} elseif (strpos($requestPath, '/api/admin/packages') !== false && $requestMethod === 'GET') {
    $controller->getPackages();
} elseif (strpos($requestPath, '/api/admin/packages') !== false && $requestMethod === 'POST') {
    $controller->createPackage();
} elseif (strpos($requestPath, '/api/admin/packages') !== false && $requestMethod === 'PUT') {
    $controller->updatePackage();
} elseif (strpos($requestPath, '/api/admin/packages') !== false && $requestMethod === 'DELETE') {
    $controller->deletePackage();
} elseif (strpos($requestPath, '/api/admin/questions') !== false && $requestMethod === 'GET') {
    $controller->getQuestions();
} elseif (strpos($requestPath, '/api/admin/questions/import') !== false && $requestMethod === 'POST') {
    $controller->importQuestions();
} elseif (strpos($requestPath, '/api/admin/questions') !== false && $requestMethod === 'POST') {
    $controller->createQuestion();
} elseif (strpos($requestPath, '/api/admin/questions') !== false && $requestMethod === 'PUT') {
    $controller->updateQuestion();
} elseif (strpos($requestPath, '/api/admin/questions') !== false && $requestMethod === 'DELETE') {
    $controller->deleteQuestion();
} elseif (strpos($requestPath, '/api/admin/media-upload') !== false && $requestMethod === 'POST') {
    $controller->uploadMedia();
} elseif (strpos($requestPath, '/api/admin/learning-content') !== false && $requestMethod === 'GET') {
    $controller->getLearningContent();
} elseif (strpos($requestPath, '/api/admin/learning-material') !== false && $requestMethod === 'PUT') {
    $controller->updateLearningMaterial();
} elseif (strpos($requestPath, '/api/admin/learning-section-questions') !== false && $requestMethod === 'PUT') {
    $controller->updateLearningSectionQuestions();
} elseif (strpos($requestPath, '/api/admin/news-sections/publish-order') !== false && $requestMethod === 'POST') {
    $controller->publishNewsSectionOrder();
} elseif (strpos($requestPath, '/api/admin/news-sections/publish') !== false && $requestMethod === 'POST') {
    $controller->publishNewsSectionDraft();
} elseif (strpos($requestPath, '/api/admin/news-sections/reorder') !== false && $requestMethod === 'PUT') {
    $controller->reorderNewsSections();
} elseif (strpos($requestPath, '/api/admin/news-sections') !== false && $requestMethod === 'GET') {
    $controller->getNewsSections();
} elseif (strpos($requestPath, '/api/admin/news-sections') !== false && $requestMethod === 'POST') {
    $controller->createNewsSection();
} elseif (strpos($requestPath, '/api/admin/news-sections') !== false && $requestMethod === 'PUT') {
    $controller->updateNewsSection();
} elseif (strpos($requestPath, '/api/admin/news-sections') !== false && $requestMethod === 'DELETE') {
    $controller->deleteNewsSection();
} elseif (strpos($requestPath, '/api/admin/news/publish') !== false && $requestMethod === 'POST') {
    $controller->publishNewsDraft();
} elseif (strpos($requestPath, '/api/admin/news') !== false && $requestMethod === 'GET') {
    $controller->getNewsArticles();
} elseif (strpos($requestPath, '/api/admin/news') !== false && $requestMethod === 'POST') {
    $controller->createNewsArticle();
} elseif (strpos($requestPath, '/api/admin/news') !== false && $requestMethod === 'PUT') {
    $controller->updateNewsArticle();
} elseif (strpos($requestPath, '/api/admin/news') !== false && $requestMethod === 'DELETE') {
    $controller->deleteNewsArticle();
} elseif (strpos($requestPath, '/api/admin/package-drafts/save') !== false && $requestMethod === 'POST') {
    $controller->savePackageDraft();
} elseif (strpos($requestPath, '/api/admin/package-drafts/publish') !== false && $requestMethod === 'POST') {
    $controller->publishPackageDraft();
} else {
    sendResponse('error', 'Endpoint admin tidak ditemukan', null, 404);
}
