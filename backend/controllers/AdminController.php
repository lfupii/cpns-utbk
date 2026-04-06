<?php
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../utils/TestWorkflow.php';
require_once __DIR__ . '/../middleware/Response.php';

class AdminController {
    private $mysqli;

    public function __construct($mysqli) {
        $this->mysqli = $mysqli;
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
        $difficulty = (string) ($data['difficulty'] ?? 'medium');
        $questionType = (string) ($data['question_type'] ?? 'single_choice');
        $sectionCode = trim((string) ($data['section_code'] ?? ''));
        $questionOrder = max(1, (int) ($data['question_order'] ?? 1));
        $options = $data['options'] ?? [];

        if ($questionText === '' && $questionImageUrl === null) {
            sendResponse('error', 'Pertanyaan harus memiliki teks atau gambar', null, 422);
        }

        $allowedDifficulty = ['easy', 'medium', 'hard'];
        if (!in_array($difficulty, $allowedDifficulty, true)) {
            sendResponse('error', 'Tingkat kesulitan tidak valid', null, 422);
        }

        if ($questionType !== 'single_choice') {
            sendResponse('error', 'Tipe soal belum didukung', null, 422);
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
            sendResponse('error', 'Bagian/subtes soal tidak valid untuk paket ini', null, 422);
        }

        if (!is_array($options) || count($options) < 2) {
            sendResponse('error', 'Minimal harus ada 2 opsi jawaban', null, 422);
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
                sendResponse('error', 'Setiap opsi jawaban harus memiliki teks atau gambar', null, 422);
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
            sendResponse('error', 'Harus ada tepat 1 jawaban benar', null, 422);
        }

        return [
            'question_text' => $questionText,
            'question_image_url' => $questionImageUrl,
            'difficulty' => $difficulty,
            'question_type' => $questionType,
            'section_code' => $sectionCode,
            'section_name' => (string) $sectionLookup[$sectionCode]['name'],
            'section_order' => (int) ($sectionLookup[$sectionCode]['order'] ?? 1),
            'question_order' => $questionOrder,
            'options' => $normalizedOptions,
        ];
    }

    private function insertQuestionWithOptions(int $packageId, array $payload): int {
        $insertQuestion = $this->mysqli->prepare(
            'INSERT INTO questions (
                package_id,
                question_text,
                question_image_url,
                question_type,
                difficulty,
                section_code,
                section_name,
                section_order,
                question_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $insertQuestion->bind_param(
            'issssssii',
            $packageId,
            $payload['question_text'],
            $payload['question_image_url'],
            $payload['question_type'],
            $payload['difficulty'],
            $payload['section_code'],
            $payload['section_name'],
            $payload['section_order'],
            $payload['question_order']
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

    public function updatePackage() {
        verifyAdmin();
        $data = json_decode(file_get_contents('php://input'), true);

        $packageId = (int) ($data['package_id'] ?? 0);
        $name = trim((string) ($data['name'] ?? ''));
        $description = trim((string) ($data['description'] ?? ''));
        $price = (int) ($data['price'] ?? 0);
        $durationDays = (int) ($data['duration_days'] ?? 30);
        $maxAttempts = (int) ($data['max_attempts'] ?? 1);
        $timeLimit = (int) ($data['time_limit'] ?? 90);
        $package = $this->getPackage($packageId);
        $workflow = TestWorkflow::buildPackageWorkflow($package);

        if (in_array($workflow['mode'], [TestWorkflow::MODE_CPNS_CAT, TestWorkflow::MODE_UTBK_SECTIONED], true)) {
            $timeLimit = (int) ($workflow['total_duration_minutes'] ?? $timeLimit);
        }

        if ($packageId <= 0 || $name === '' || $price <= 0 || $durationDays <= 0 || $maxAttempts <= 0 || $timeLimit <= 0) {
            sendResponse('error', 'Data paket tidak lengkap atau tidak valid', null, 422);
        }

        $query = "UPDATE test_packages
                  SET name = ?, description = ?, price = ?, duration_days = ?, max_attempts = ?, time_limit = ?
                  WHERE id = ?";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('ssiiiii', $name, $description, $price, $durationDays, $maxAttempts, $timeLimit, $packageId);

        if (!$stmt->execute()) {
            sendResponse('error', 'Gagal memperbarui paket', null, 500);
        }

        $this->syncQuestionCount($packageId);
        sendResponse('success', 'Paket berhasil diperbarui');
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
                  ORDER BY q.section_order ASC, q.question_order ASC, q.id ASC";
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

        $payload = $this->normalizeQuestionPayload($packageId, $data);
        $this->mysqli->begin_transaction();

        try {
            $questionId = $this->insertQuestionWithOptions($packageId, $payload);

            $this->syncQuestionCount($packageId);
            $this->mysqli->commit();
            sendResponse('success', 'Soal berhasil ditambahkan', ['question_id' => $questionId], 201);
        } catch (Throwable $error) {
            $this->mysqli->rollback();
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

        $payload = $this->normalizeQuestionPayload($packageId, $data);
        $this->mysqli->begin_transaction();

        try {
            $updateQuestion = $this->mysqli->prepare(
                'UPDATE questions
                 SET question_text = ?,
                     question_image_url = ?,
                     question_type = ?,
                     difficulty = ?,
                     section_code = ?,
                     section_name = ?,
                     section_order = ?,
                     question_order = ?
                 WHERE id = ? AND package_id = ?'
            );
            $updateQuestion->bind_param(
                'ssssssiiii',
                $payload['question_text'],
                $payload['question_image_url'],
                $payload['question_type'],
                $payload['difficulty'],
                $payload['section_code'],
                $payload['section_name'],
                $payload['section_order'],
                $payload['question_order'],
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
        } catch (Throwable $error) {
            $this->mysqli->rollback();
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

        $this->mysqli->begin_transaction();

        try {
            $imported = 0;
            foreach ($rows as $row) {
                if (!is_array($row)) {
                    throw new RuntimeException('Format baris import tidak valid', 422);
                }

                $payload = $this->normalizeQuestionPayload($packageId, $row);
                $this->insertQuestionWithOptions($packageId, $payload);
                $imported++;
            }

            $this->syncQuestionCount($packageId);
            $this->mysqli->commit();
            sendResponse('success', 'Import soal berhasil', [
                'imported_count' => $imported,
            ], 201);
        } catch (RuntimeException $error) {
            $this->mysqli->rollback();
            sendResponse('error', $error->getMessage(), null, $error->getCode() ?: 422);
        } catch (Throwable $error) {
            $this->mysqli->rollback();
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
}

$requestMethod = $_SERVER['REQUEST_METHOD'];
$requestPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

$controller = new AdminController($mysqli);

if (strpos($requestPath, '/api/admin/packages') !== false && $requestMethod === 'GET') {
    $controller->getPackages();
} elseif (strpos($requestPath, '/api/admin/packages') !== false && $requestMethod === 'PUT') {
    $controller->updatePackage();
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
} else {
    sendResponse('error', 'Endpoint admin tidak ditemukan', null, 404);
}
