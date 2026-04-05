<?php
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../middleware/Response.php';

class QuestionController {
    private $mysqli;

    public function __construct($mysqli) {
        $this->mysqli = $mysqli;
    }

    private function verifyQuestionAccess(int $userId, int $packageId, int $attemptId): void {
        $accessQuery = "SELECT ua.id
                        FROM user_access ua
                        WHERE ua.user_id = ? AND ua.package_id = ? AND ua.access_status = 'active'
                          AND (ua.access_expires_at IS NULL OR ua.access_expires_at > NOW())
                        LIMIT 1";
        $stmt = $this->mysqli->prepare($accessQuery);
        $stmt->bind_param('ii', $userId, $packageId);
        $stmt->execute();
        $access = $stmt->get_result()->fetch_assoc();

        if (!$access) {
            sendResponse('error', 'Anda belum memiliki akses aktif ke paket ini', null, 403);
        }

        $attemptQuery = "SELECT id
                         FROM test_attempts
                         WHERE id = ? AND user_id = ? AND package_id = ? AND status = 'ongoing'
                         LIMIT 1";
        $stmt = $this->mysqli->prepare($attemptQuery);
        $stmt->bind_param('iii', $attemptId, $userId, $packageId);
        $stmt->execute();
        $attempt = $stmt->get_result()->fetch_assoc();

        if (!$attempt) {
            sendResponse('error', 'Attempt test tidak valid atau sudah selesai', null, 403);
        }
    }

    public function getPackages() {
        $query = "SELECT tp.*, tc.name as category_name FROM test_packages tp
                  JOIN test_categories tc ON tp.category_id = tc.id
                  ORDER BY tp.created_at DESC";
        $result = $this->mysqli->query($query);
        
        if (!$result) {
            sendResponse('error', 'Gagal mengambil paket test', null, 500);
        }

        $packages = [];
        while ($row = $result->fetch_assoc()) {
            $packages[] = $row;
        }

        sendResponse('success', 'Paket test berhasil diambil', $packages);
    }

    public function getQuestions() {
        $tokenData = verifyToken();
        $packageId = (int) ($_GET['package_id'] ?? 0);
        $attemptId = (int) ($_GET['attempt_id'] ?? 0);

        if ($packageId <= 0 || $attemptId <= 0) {
            sendResponse('error', 'Package ID dan Attempt ID harus diisi', null, 400);
        }

        $this->verifyQuestionAccess((int) $tokenData['userId'], $packageId, $attemptId);

        $query = "SELECT q.*, GROUP_CONCAT(
                      JSON_OBJECT('id', qo.id, 'letter', qo.option_letter, 'text', qo.option_text)
                      ORDER BY qo.id SEPARATOR ','
                  ) as options
                  FROM questions q
                  LEFT JOIN question_options qo ON q.id = qo.question_id
                  WHERE q.package_id = ?
                  GROUP BY q.id
                  ORDER BY q.id ASC";
        
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('i', $packageId);
        $stmt->execute();
        $result = $stmt->get_result();

        $questions = [];
        while ($row = $result->fetch_assoc()) {
            $row['options'] = $row['options'] ? json_decode('[' . $row['options'] . ']') : [];
            $questions[] = $row;
        }

        sendResponse('success', 'Soal-soal berhasil diambil', $questions);
    }
}

// Router
$requestMethod = $_SERVER['REQUEST_METHOD'];
$requestPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

$controller = new QuestionController($mysqli);

if (strpos($requestPath, '/api/questions/packages') !== false && $requestMethod === 'GET') {
    $controller->getPackages();
} elseif (strpos($requestPath, '/api/questions/list') !== false && $requestMethod === 'GET') {
    $controller->getQuestions();
} else {
    sendResponse('error', 'Endpoint tidak ditemukan', null, 404);
}
