<?php
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../utils/TestWorkflow.php';
require_once __DIR__ . '/../utils/LearningContent.php';
require_once __DIR__ . '/../middleware/Response.php';

class AdminController {
    private $mysqli;
    private const ADMIN_MEDIA_UPLOAD_DIR = __DIR__ . '/../uploads/admin-media';
    private const ADMIN_MEDIA_MAX_SIZE = 5242880;

    public function __construct($mysqli) {
        $this->mysqli = $mysqli;
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

    private function syncQuestionCount(int $packageId): void {
        $countQuery = 'SELECT COUNT(*) AS total FROM questions WHERE package_id = ?';
        $stmt = $this->mysqli->prepare($countQuery);
        $stmt->bind_param('i', $packageId);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();
        $total = (int) ($result['total'] ?? 0);

        $updateQuery = 'UPDATE test_packages SET question_count = ? WHERE id = ?';
        $stmt = $this->mysqli->prepare($updateQuery);
        $stmt->bind_param('ii', $total, $packageId);
        $stmt->execute();
    }

    private function enrichPackage(array $package): array {
        $workflow = TestWorkflow::buildPackageWorkflow($package);
        $package['time_limit'] = (int) ($workflow['total_duration_minutes'] ?? (int) ($package['time_limit'] ?? 0));
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

    private function getWorkflowSection(int $packageId, string $sectionCode): array {
        $package = $this->getPackage($packageId);
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

            $normalizedSections[] = array_filter([
                'code' => $code,
                'name' => $name,
                'session_name' => trim((string) ($section['session_name'] ?? '')) ?: null,
                'session_order' => isset($section['session_order']) ? max(1, (int) $section['session_order']) : null,
                'order' => $index + 1,
                'duration_minutes' => $durationMinutes,
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

    private function syncPackageWorkflowData(int $packageId, array $previousWorkflow, array $nextWorkflow): void {
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

            $deleteQuestions = $this->mysqli->prepare('DELETE FROM questions WHERE package_id = ? AND section_code = ?');
            $deleteQuestions->bind_param('is', $packageId, $code);
            $deleteQuestions->execute();

            $deleteMaterials = $this->mysqli->prepare('DELETE FROM learning_materials WHERE package_id = ? AND section_code = ?');
            $deleteMaterials->bind_param('is', $packageId, $code);
            $deleteMaterials->execute();

            $deleteLearningQuestions = $this->mysqli->prepare('DELETE FROM learning_section_questions WHERE package_id = ? AND section_code = ?');
            $deleteLearningQuestions->bind_param('is', $packageId, $code);
            $deleteLearningQuestions->execute();
        }

        foreach ($nextSections as $code => $section) {
            $sectionName = (string) ($section['name'] ?? 'Subtest');
            $sectionOrder = (int) ($section['order'] ?? 1);
            $updateQuestions = $this->mysqli->prepare(
                'UPDATE questions SET section_name = ?, section_order = ? WHERE package_id = ? AND section_code = ?'
            );
            $updateQuestions->bind_param('siis', $sectionName, $sectionOrder, $packageId, $code);
            $updateQuestions->execute();

            if (!isset($previousSections[$code])) {
                $emptyMaterialContent = json_encode([
                    'topics' => [],
                ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                $insertMaterial = $this->mysqli->prepare(
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

    private function normalizeLearningQuestionPayload(array $data, int $order): array {
        $questionText = trim((string) ($data['question_text'] ?? ''));
        $questionImageUrl = $this->normalizeMediaUrl($data['question_image_url'] ?? null);
        $difficulty = trim((string) ($data['difficulty'] ?? 'medium'));
        $options = $data['options'] ?? [];

        if ($questionText === '' && $questionImageUrl === null) {
            sendResponse('error', 'Pertanyaan mini test wajib memiliki teks atau gambar', null, 422);
        }

        if (!in_array($difficulty, ['easy', 'medium', 'hard'], true)) {
            sendResponse('error', 'Tingkat kesulitan mini test tidak valid', null, 422);
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
            $isCorrect = !empty($option['is_correct']);

            if ($text === '' && $imageUrl === null) {
                continue;
            }

            if ($isCorrect) {
                $correctCount++;
            }

            $normalizedOptions[] = [
                'letter' => $letter,
                'text' => $text,
                'image_url' => $imageUrl,
                'is_correct' => $isCorrect ? 1 : 0,
            ];
        }

        if (count($normalizedOptions) < 2) {
            sendResponse('error', 'Mini test minimal memiliki 2 opsi berisi teks atau gambar', null, 422);
        }

        if ($correctCount !== 1) {
            sendResponse('error', 'Setiap soal mini test harus memiliki tepat 1 jawaban benar', null, 422);
        }

        return [
            'question_text' => $questionText,
            'question_image_url' => $questionImageUrl,
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

    private function normalizeQuestionPayload(int $packageId, array $data): array {
        $questionText = trim((string) ($data['question_text'] ?? ''));
        $questionImageUrl = $this->normalizeMediaUrl($data['question_image_url'] ?? null);
        $questionImageLayout = strtolower(trim((string) ($data['question_image_layout'] ?? 'top')));
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

        $package = $this->getPackage($packageId);
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

        if (!is_array($options) || count($options) < 2) {
            throw new RuntimeException('Minimal harus ada 2 opsi jawaban', 422);
        }

        $normalizedOptions = [];
        $correctCount = 0;
        foreach ($options as $index => $option) {
            $letter = trim((string) ($option['letter'] ?? ''));
            $text = trim((string) ($option['text'] ?? ''));
            $imageUrl = $this->normalizeMediaUrl($option['image_url'] ?? null);
            $isCorrect = !empty($option['is_correct']);

            if ($letter === '') {
                $letter = chr(65 + $index);
            }

            if ($text === '' && $imageUrl === null) {
                throw new RuntimeException('Setiap opsi jawaban harus memiliki teks atau gambar', 422);
            }

            if ($isCorrect) {
                $correctCount++;
            }

            $normalizedOptions[] = [
                'letter' => strtoupper(substr($letter, 0, 5)),
                'text' => $text,
                'image_url' => $imageUrl,
                'is_correct' => $isCorrect ? 1 : 0,
            ];
        }

        if ($correctCount !== 1) {
            throw new RuntimeException('Harus ada tepat 1 jawaban benar', 422);
        }

        return [
            'question_text' => $questionText,
            'question_image_url' => $questionImageUrl,
            'question_image_layout' => $questionImageLayout,
            'difficulty' => $difficulty,
            'question_type' => $questionType,
            'section_code' => $sectionCode,
            'section_name' => (string) $sectionLookup[$sectionCode]['name'],
            'section_order' => (int) ($sectionLookup[$sectionCode]['order'] ?? 1),
            'options' => $normalizedOptions,
        ];
    }

    private function insertQuestionWithOptions(int $packageId, array $payload): int {
        $insertQuestion = $this->mysqli->prepare(
            'INSERT INTO questions (
                package_id,
                question_text,
                question_image_url,
                question_image_layout,
                question_type,
                difficulty,
                section_code,
                section_name,
                section_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $insertQuestion->bind_param(
            'isssssssi',
            $packageId,
            $payload['question_text'],
            $payload['question_image_url'],
            $payload['question_image_layout'],
            $payload['question_type'],
            $payload['difficulty'],
            $payload['section_code'],
            $payload['section_name'],
            $payload['section_order']
        );
        $insertQuestion->execute();
        $questionId = (int) $insertQuestion->insert_id;

        $insertOption = $this->mysqli->prepare(
            'INSERT INTO question_options (question_id, option_letter, option_text, option_image_url, is_correct) VALUES (?, ?, ?, ?, ?)'
        );
        foreach ($payload['options'] as $option) {
            $insertOption->bind_param(
                'isssi',
                $questionId,
                $option['letter'],
                $option['text'],
                $option['image_url'],
                $option['is_correct']
            );
            $insertOption->execute();
        }

        return $questionId;
    }

    public function getPackages() {
        verifyAdmin();

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

        $packageId = (int) ($data['package_id'] ?? 0);
        $categoryId = (int) ($data['category_id'] ?? 0);
        $name = trim((string) ($data['name'] ?? ''));
        $description = trim((string) ($data['description'] ?? ''));
        $price = (int) ($data['price'] ?? 0);
        $durationDays = (int) ($data['duration_days'] ?? 30);
        $maxAttempts = (int) ($data['max_attempts'] ?? 1);
        $timeLimit = (int) ($data['time_limit'] ?? 90);
        $package = $this->getPackage($packageId);
        $categoryId = $categoryId > 0 ? $categoryId : (int) ($package['category_id'] ?? 0);
        $testMode = $this->normalizeTestMode($data['test_mode'] ?? ($package['test_mode'] ?? ''));
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

        $query = "UPDATE test_packages
                  SET category_id = ?, name = ?, description = ?, price = ?, duration_days = ?, max_attempts = ?, time_limit = ?, test_mode = ?, workflow_config = ?
                  WHERE id = ?";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('issiiiissi', $categoryId, $name, $description, $price, $durationDays, $maxAttempts, $timeLimit, $testMode, $workflowConfig, $packageId);

        if (!$stmt->execute()) {
            sendResponse('error', 'Gagal memperbarui paket', null, 500);
        }

        $this->syncPackageWorkflowData($packageId, $previousWorkflow, $nextWorkflow);
        $this->syncQuestionCount($packageId);
        sendResponse('success', 'Paket berhasil diperbarui');
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
                    workflow_config
                  ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)';
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param(
            'issiiiiss',
            $categoryId,
            $name,
            $description,
            $price,
            $durationDays,
            $maxAttempts,
            $timeLimit,
            $testMode,
            $workflowConfig
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

        $packageId = (int) ($_GET['package_id'] ?? 0);
        if ($packageId <= 0) {
            sendResponse('error', 'Package ID harus diisi', null, 400);
        }

        $query = "SELECT q.*, GROUP_CONCAT(
                      JSON_OBJECT(
                        'id', qo.id,
                        'letter', qo.option_letter,
                        'text', qo.option_text,
                        'image_url', qo.option_image_url,
                        'is_correct', qo.is_correct
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

        $questions = [];
        while ($row = $result->fetch_assoc()) {
            $row['options'] = $row['options'] ? json_decode('[' . $row['options'] . ']', true) : [];
            $questions[] = $row;
        }

        sendResponse('success', 'Data soal admin berhasil diambil', $questions);
    }

    public function createQuestion() {
        verifyAdmin();
        $data = json_decode(file_get_contents('php://input'), true);

        $packageId = (int) ($data['package_id'] ?? 0);
        if ($packageId <= 0) {
            sendResponse('error', 'Package ID harus diisi', null, 400);
        }

        $transactionStarted = false;
        try {
            $payload = $this->normalizeQuestionPayload($packageId, $data);
            $this->mysqli->begin_transaction();
            $transactionStarted = true;
            $questionId = $this->insertQuestionWithOptions($packageId, $payload);

            $this->syncQuestionCount($packageId);
            $this->mysqli->commit();
            sendResponse('success', 'Soal berhasil ditambahkan', ['question_id' => $questionId], 201);
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

        $questionId = (int) ($data['question_id'] ?? 0);
        $packageId = (int) ($data['package_id'] ?? 0);
        if ($questionId <= 0 || $packageId <= 0) {
            sendResponse('error', 'Question ID dan Package ID harus diisi', null, 400);
        }

        $transactionStarted = false;
        try {
            $payload = $this->normalizeQuestionPayload($packageId, $data);
            $this->mysqli->begin_transaction();
            $transactionStarted = true;
            $updateQuestion = $this->mysqli->prepare(
                'UPDATE questions
                 SET question_text = ?,
                     question_image_url = ?,
                     question_image_layout = ?,
                     question_type = ?,
                     difficulty = ?,
                     section_code = ?,
                     section_name = ?,
                     section_order = ?
                 WHERE id = ? AND package_id = ?'
            );
            $updateQuestion->bind_param(
                'sssssssiii',
                $payload['question_text'],
                $payload['question_image_url'],
                $payload['question_image_layout'],
                $payload['question_type'],
                $payload['difficulty'],
                $payload['section_code'],
                $payload['section_name'],
                $payload['section_order'],
                $questionId,
                $packageId
            );
            $updateQuestion->execute();

            $deleteOptions = $this->mysqli->prepare('DELETE FROM question_options WHERE question_id = ?');
            $deleteOptions->bind_param('i', $questionId);
            $deleteOptions->execute();

            $insertOption = $this->mysqli->prepare(
                'INSERT INTO question_options (question_id, option_letter, option_text, option_image_url, is_correct) VALUES (?, ?, ?, ?, ?)'
            );
            foreach ($payload['options'] as $option) {
                $insertOption->bind_param(
                    'isssi',
                    $questionId,
                    $option['letter'],
                    $option['text'],
                    $option['image_url'],
                    $option['is_correct']
                );
                $insertOption->execute();
            }

            $this->syncQuestionCount($packageId);
            $this->mysqli->commit();
            sendResponse('success', 'Soal berhasil diperbarui');
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
            $payloads = [];
            foreach ($rows as $row) {
                if (!is_array($row)) {
                    throw new RuntimeException('Format baris import tidak valid', 422);
                }

                $payloads[] = $this->normalizeQuestionPayload($packageId, $row);
            }

            $this->mysqli->begin_transaction();
            $transactionStarted = true;

            $imported = 0;
            foreach ($payloads as $payload) {
                $this->insertQuestionWithOptions($packageId, $payload);
                $imported++;
            }

            $this->syncQuestionCount($packageId);
            $this->mysqli->commit();
            sendResponse('success', 'Import soal berhasil', [
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

        $questionId = (int) ($_GET['id'] ?? 0);
        if ($questionId <= 0) {
            sendResponse('error', 'Question ID harus diisi', null, 400);
        }

        $findQuery = 'SELECT package_id FROM questions WHERE id = ? LIMIT 1';
        $stmt = $this->mysqli->prepare($findQuery);
        $stmt->bind_param('i', $questionId);
        $stmt->execute();
        $question = $stmt->get_result()->fetch_assoc();

        if (!$question) {
            sendResponse('error', 'Soal tidak ditemukan', null, 404);
        }

        $deleteQuery = 'DELETE FROM questions WHERE id = ?';
        $stmt = $this->mysqli->prepare($deleteQuery);
        $stmt->bind_param('i', $questionId);
        $stmt->execute();

        $this->syncQuestionCount((int) $question['package_id']);
        sendResponse('success', 'Soal berhasil dihapus');
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
        $packageId = (int) ($_GET['package_id'] ?? 0);
        if ($packageId <= 0) {
            sendResponse('error', 'Package ID harus diisi', null, 400);
        }

        $package = $this->getPackage($packageId);
        $workflow = TestWorkflow::buildPackageWorkflow($package);

        $materialQuery = 'SELECT section_code, title, content_json, status, source_url, review_notes, published_at FROM learning_materials WHERE package_id = ?';
        $stmt = $this->mysqli->prepare($materialQuery);
        $stmt->bind_param('i', $packageId);
        $stmt->execute();
        $materialResult = $stmt->get_result();
        $materialMap = [];
        while ($row = $materialResult->fetch_assoc()) {
            $materialPayload = json_decode((string) ($row['content_json'] ?? ''), true);
            $topics = $this->hydrateMaterialTopics($materialPayload, []);
            $materialMap[(string) $row['section_code']] = [
                'title' => $row['title'],
                'topics' => $topics,
                'pages' => $this->flattenMaterialTopics($topics),
                'status' => $this->normalizeMaterialStatus($row['status'] ?? 'published'),
                'source_url' => $row['source_url'] ?: null,
                'review_notes' => (string) ($row['review_notes'] ?? ''),
                'published_at' => $row['published_at'] ?? null,
            ];
        }

        $questionQuery = "SELECT q.*,
                            GROUP_CONCAT(
                              JSON_OBJECT(
                                'id', qo.id,
                                'letter', qo.option_letter,
                                'text', qo.option_text,
                                'image_url', qo.option_image_url,
                                'is_correct', qo.is_correct
                              ) ORDER BY qo.id SEPARATOR ','
                            ) AS options
                          FROM learning_section_questions q
                          LEFT JOIN learning_section_question_options qo ON qo.question_id = q.id
                          WHERE q.package_id = ?
                          GROUP BY q.id
                          ORDER BY q.section_code ASC, q.question_order ASC, q.id ASC";
        $stmt = $this->mysqli->prepare($questionQuery);
        $stmt->bind_param('i', $packageId);
        $stmt->execute();
        $questionResult = $stmt->get_result();
        $questionMap = [];
        while ($row = $questionResult->fetch_assoc()) {
            $sectionCode = (string) $row['section_code'];
            if (!isset($questionMap[$sectionCode])) {
                $questionMap[$sectionCode] = [];
            }

            $row['id'] = (int) $row['id'];
            $row['question_order'] = (int) $row['question_order'];
            $row['options'] = $row['options'] ? json_decode('[' . $row['options'] . ']', true) : [];
            $questionMap[$sectionCode][] = $row;
        }

        $sections = [];
        foreach ($workflow['sections'] as $section) {
            $sectionCode = (string) $section['code'];
            $defaultPages = LearningContent::defaultMaterialPages($section, (string) $workflow['mode']);
            $defaultTopics = $this->buildTopicsFromPages($defaultPages);
            $sections[] = [
                'code' => $sectionCode,
                'name' => $section['name'],
                'session_name' => $section['session_name'] ?? null,
                'order' => $section['order'],
                'material' => $materialMap[$sectionCode] ?? [
                    'title' => (string) $section['name'],
                    'topics' => $defaultTopics,
                    'pages' => $defaultPages,
                    'status' => 'published',
                    'source_url' => null,
                    'review_notes' => '',
                    'published_at' => null,
                ],
                'questions' => $questionMap[$sectionCode] ?? LearningContent::defaultSectionQuestions($section, (string) $workflow['mode']),
            ];
        }

        sendResponse('success', 'Konten belajar berhasil diambil', [
            'package_id' => $packageId,
            'sections' => $sections,
        ]);
    }

    public function updateLearningMaterial() {
        verifyAdmin();
        $data = json_decode(file_get_contents('php://input'), true);
        $packageId = (int) ($data['package_id'] ?? 0);
        $sectionCode = trim((string) ($data['section_code'] ?? ''));
        $topics = $data['topics'] ?? null;
        $pages = $data['pages'] ?? [];
        $requestedStatus = $data['status'] ?? null;

        if ($packageId <= 0 || $sectionCode === '') {
            sendResponse('error', 'Package ID dan section harus diisi', null, 400);
        }

        [, , $section] = $this->getWorkflowSection($packageId, $sectionCode);
        if (is_array($topics) && count($topics) > 0) {
            $normalizedTopics = $this->normalizeMaterialTopics($topics);
        } else {
            $normalizedTopics = $this->buildTopicsFromPages($this->normalizeMaterialPages(is_array($pages) ? $pages : []));
        }
        $title = trim((string) ($data['title'] ?? $section['name']));
        if ($title === '') {
            $title = (string) $section['name'];
        }

        $existingStmt = $this->mysqli->prepare(
            'SELECT status, source_url, review_notes, published_at FROM learning_materials WHERE package_id = ? AND section_code = ? LIMIT 1'
        );
        $existingStmt->bind_param('is', $packageId, $sectionCode);
        $existingStmt->execute();
        $existingMaterial = $existingStmt->get_result()->fetch_assoc() ?: null;

        $statusFallback = $this->normalizeMaterialStatus($existingMaterial['status'] ?? 'published');
        $status = $this->normalizeMaterialStatus($requestedStatus, $statusFallback);
        $sourceUrl = array_key_exists('source_url', $data)
            ? trim((string) ($data['source_url'] ?? ''))
            : trim((string) ($existingMaterial['source_url'] ?? ''));
        $reviewNotes = array_key_exists('review_notes', $data)
            ? trim((string) ($data['review_notes'] ?? ''))
            : trim((string) ($existingMaterial['review_notes'] ?? ''));
        $sourceUrl = $sourceUrl !== '' ? $sourceUrl : null;
        $reviewNotes = $reviewNotes !== '' ? $reviewNotes : null;
        $publishedAt = null;
        if ($status === 'published') {
            $publishedAt = !empty($existingMaterial['published_at']) && ($existingMaterial['status'] ?? '') === 'published'
                ? (string) $existingMaterial['published_at']
                : date('Y-m-d H:i:s');
        }

        $contentJson = json_encode([
            'topics' => $normalizedTopics,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $query = "INSERT INTO learning_materials (package_id, section_code, title, content_json, status, source_url, review_notes, published_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                  ON DUPLICATE KEY UPDATE
                    title = VALUES(title),
                    content_json = VALUES(content_json),
                    status = VALUES(status),
                    source_url = VALUES(source_url),
                    review_notes = VALUES(review_notes),
                    published_at = VALUES(published_at),
                    updated_at = CURRENT_TIMESTAMP";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('isssssss', $packageId, $sectionCode, $title, $contentJson, $status, $sourceUrl, $reviewNotes, $publishedAt);
        $stmt->execute();

        sendResponse('success', $status === 'published' ? 'Materi subtest berhasil dipublish' : 'Draft materi subtest berhasil disimpan', [
            'material' => [
                'title' => $title,
                'topics' => $normalizedTopics,
                'pages' => $this->flattenMaterialTopics($normalizedTopics),
                'status' => $status,
                'source_url' => $sourceUrl,
                'review_notes' => $reviewNotes ?? '',
                'published_at' => $publishedAt,
            ],
        ]);
    }

    public function updateLearningSectionQuestions() {
        verifyAdmin();
        $data = json_decode(file_get_contents('php://input'), true);
        $packageId = (int) ($data['package_id'] ?? 0);
        $sectionCode = trim((string) ($data['section_code'] ?? ''));
        $questions = $data['questions'] ?? [];

        if ($packageId <= 0 || $sectionCode === '') {
            sendResponse('error', 'Package ID dan section harus diisi', null, 400);
        }

        $this->getWorkflowSection($packageId, $sectionCode);
        if (!is_array($questions) || count($questions) < 1) {
            sendResponse('error', 'Minimal isi 1 soal mini test', null, 422);
        }

        $normalizedQuestions = [];
        foreach ($questions as $index => $question) {
            if (!is_array($question)) {
                sendResponse('error', 'Format soal mini test tidak valid', null, 422);
            }

            $normalizedQuestions[] = $this->normalizeLearningQuestionPayload($question, $index + 1);
        }

        $this->mysqli->begin_transaction();
        try {
            $fetchExisting = $this->mysqli->prepare(
                'SELECT id FROM learning_section_questions WHERE package_id = ? AND section_code = ?'
            );
            $fetchExisting->bind_param('is', $packageId, $sectionCode);
            $fetchExisting->execute();
            $existingResult = $fetchExisting->get_result();
            $deleteOptions = $this->mysqli->prepare('DELETE FROM learning_section_question_options WHERE question_id = ?');
            while ($row = $existingResult->fetch_assoc()) {
                $questionId = (int) $row['id'];
                $deleteOptions->bind_param('i', $questionId);
                $deleteOptions->execute();
            }

            $deleteQuestions = $this->mysqli->prepare(
                'DELETE FROM learning_section_questions WHERE package_id = ? AND section_code = ?'
            );
            $deleteQuestions->bind_param('is', $packageId, $sectionCode);
            $deleteQuestions->execute();

            $insertQuestion = $this->mysqli->prepare(
                'INSERT INTO learning_section_questions (package_id, section_code, question_text, question_image_url, difficulty, question_order)
                 VALUES (?, ?, ?, ?, ?, ?)'
            );
            $insertOption = $this->mysqli->prepare(
                'INSERT INTO learning_section_question_options (question_id, option_letter, option_text, option_image_url, is_correct)
                 VALUES (?, ?, ?, ?, ?)'
            );

            $savedQuestions = [];
            foreach ($normalizedQuestions as $question) {
                $questionText = $question['question_text'];
                $questionImageUrl = $question['question_image_url'];
                $difficulty = $question['difficulty'];
                $questionOrder = $question['question_order'];
                $insertQuestion->bind_param('issssi', $packageId, $sectionCode, $questionText, $questionImageUrl, $difficulty, $questionOrder);
                $insertQuestion->execute();
                $questionId = (int) $insertQuestion->insert_id;

                $savedQuestion = [
                    'id' => $questionId,
                    'question_text' => $questionText,
                    'question_image_url' => $questionImageUrl,
                    'difficulty' => $difficulty,
                    'question_order' => $questionOrder,
                    'options' => [],
                ];

                foreach ($question['options'] as $option) {
                    $letter = $option['letter'];
                    $text = $option['text'];
                    $imageUrl = $option['image_url'];
                    $isCorrect = $option['is_correct'];
                    $insertOption->bind_param('isssi', $questionId, $letter, $text, $imageUrl, $isCorrect);
                    $insertOption->execute();
                    $savedQuestion['options'][] = [
                        'letter' => $letter,
                        'text' => $text,
                        'image_url' => $imageUrl,
                        'is_correct' => $isCorrect,
                    ];
                }

                $savedQuestions[] = $savedQuestion;
            }

            $this->mysqli->commit();
            sendResponse('success', 'Soal mini test subtest berhasil disimpan', [
                'section_code' => $sectionCode,
                'questions' => $savedQuestions,
            ]);
        } catch (Throwable $error) {
            $this->mysqli->rollback();
            sendResponse('error', 'Gagal menyimpan soal mini test', ['details' => $error->getMessage()], 500);
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
} else {
    sendResponse('error', 'Endpoint admin tidak ditemukan', null, 404);
}
