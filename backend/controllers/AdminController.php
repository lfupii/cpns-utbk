<?php
require_once __DIR__ . '/../config/Database.php';
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

    private function normalizeQuestionPayload(array $data): array {
        $questionText = trim((string) ($data['question_text'] ?? ''));
        $difficulty = (string) ($data['difficulty'] ?? 'medium');
        $questionType = (string) ($data['question_type'] ?? 'single_choice');
        $options = $data['options'] ?? [];

        if ($questionText === '') {
            sendResponse('error', 'Pertanyaan tidak boleh kosong', null, 422);
        }

        $allowedDifficulty = ['easy', 'medium', 'hard'];
        if (!in_array($difficulty, $allowedDifficulty, true)) {
            sendResponse('error', 'Tingkat kesulitan tidak valid', null, 422);
        }

        if ($questionType !== 'single_choice') {
            sendResponse('error', 'Tipe soal belum didukung', null, 422);
        }

        if (!is_array($options) || count($options) < 2) {
            sendResponse('error', 'Minimal harus ada 2 opsi jawaban', null, 422);
        }

        $normalizedOptions = [];
        $correctCount = 0;
        foreach ($options as $index => $option) {
            $letter = trim((string) ($option['letter'] ?? ''));
            $text = trim((string) ($option['text'] ?? ''));
            $isCorrect = !empty($option['is_correct']);

            if ($letter === '') {
                $letter = chr(65 + $index);
            }

            if ($text === '') {
                sendResponse('error', 'Teks opsi jawaban tidak boleh kosong', null, 422);
            }

            if ($isCorrect) {
                $correctCount++;
            }

            $normalizedOptions[] = [
                'letter' => strtoupper(substr($letter, 0, 5)),
                'text' => $text,
                'is_correct' => $isCorrect ? 1 : 0,
            ];
        }

        if ($correctCount !== 1) {
            sendResponse('error', 'Harus ada tepat 1 jawaban benar', null, 422);
        }

        return [
            'question_text' => $questionText,
            'difficulty' => $difficulty,
            'question_type' => $questionType,
            'options' => $normalizedOptions,
        ];
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
            $packages[] = $row;
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
                        'is_correct', qo.is_correct
                      ) ORDER BY qo.id SEPARATOR ','
                  ) AS options
                  FROM questions q
                  LEFT JOIN question_options qo ON qo.question_id = q.id
                  WHERE q.package_id = ?
                  GROUP BY q.id
                  ORDER BY q.id ASC";
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

        $payload = $this->normalizeQuestionPayload($data);
        $this->mysqli->begin_transaction();

        try {
            $insertQuestion = $this->mysqli->prepare(
                'INSERT INTO questions (package_id, question_text, question_type, difficulty) VALUES (?, ?, ?, ?)'
            );
            $insertQuestion->bind_param(
                'isss',
                $packageId,
                $payload['question_text'],
                $payload['question_type'],
                $payload['difficulty']
            );
            $insertQuestion->execute();
            $questionId = (int) $insertQuestion->insert_id;

            $insertOption = $this->mysqli->prepare(
                'INSERT INTO question_options (question_id, option_letter, option_text, is_correct) VALUES (?, ?, ?, ?)'
            );
            foreach ($payload['options'] as $option) {
                $insertOption->bind_param('issi', $questionId, $option['letter'], $option['text'], $option['is_correct']);
                $insertOption->execute();
            }

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

        $payload = $this->normalizeQuestionPayload($data);
        $this->mysqli->begin_transaction();

        try {
            $updateQuestion = $this->mysqli->prepare(
                'UPDATE questions SET question_text = ?, question_type = ?, difficulty = ? WHERE id = ? AND package_id = ?'
            );
            $updateQuestion->bind_param(
                'sssii',
                $payload['question_text'],
                $payload['question_type'],
                $payload['difficulty'],
                $questionId,
                $packageId
            );
            $updateQuestion->execute();

            $deleteOptions = $this->mysqli->prepare('DELETE FROM question_options WHERE question_id = ?');
            $deleteOptions->bind_param('i', $questionId);
            $deleteOptions->execute();

            $insertOption = $this->mysqli->prepare(
                'INSERT INTO question_options (question_id, option_letter, option_text, is_correct) VALUES (?, ?, ?, ?)'
            );
            foreach ($payload['options'] as $option) {
                $insertOption->bind_param('issi', $questionId, $option['letter'], $option['text'], $option['is_correct']);
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
} elseif (strpos($requestPath, '/api/admin/questions') !== false && $requestMethod === 'POST') {
    $controller->createQuestion();
} elseif (strpos($requestPath, '/api/admin/questions') !== false && $requestMethod === 'PUT') {
    $controller->updateQuestion();
} elseif (strpos($requestPath, '/api/admin/questions') !== false && $requestMethod === 'DELETE') {
    $controller->deleteQuestion();
} else {
    sendResponse('error', 'Endpoint admin tidak ditemukan', null, 404);
}
