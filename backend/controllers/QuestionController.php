<?php
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../utils/TestWorkflow.php';
require_once __DIR__ . '/../middleware/Response.php';

class QuestionController {
    private $mysqli;

    public function __construct($mysqli) {
        $this->mysqli = $mysqli;
    }

    private function getAttemptWithPackage(int $userId, int $packageId, int $attemptId): array {
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

        $attemptQuery = "SELECT ta.*, tp.name AS package_name, tp.question_count, tp.time_limit, tp.test_mode, tp.workflow_config, tc.name AS category_name
                         FROM test_attempts ta
                         JOIN test_packages tp ON tp.id = ta.package_id
                         JOIN test_categories tc ON tc.id = tp.category_id
                         WHERE ta.id = ? AND ta.user_id = ? AND ta.package_id = ?
                         LIMIT 1";
        $stmt = $this->mysqli->prepare($attemptQuery);
        $stmt->bind_param('iii', $attemptId, $userId, $packageId);
        $stmt->execute();
        $attempt = $stmt->get_result()->fetch_assoc();

        if (!$attempt) {
            sendResponse('error', 'Attempt test tidak valid', null, 403);
        }

        if (($attempt['status'] ?? '') !== 'ongoing') {
            sendResponse('error', 'Attempt test sudah selesai', [
                'attempt_id' => $attemptId,
                'status' => $attempt['status'],
            ], 409);
        }

        return $attempt;
    }

    private function enrichPackage(array $package): array {
        $workflow = TestWorkflow::buildPackageWorkflow($package);
        $package['time_limit'] = (int) ($workflow['total_duration_minutes'] ?? (int) ($package['time_limit'] ?? 0));
        $package['workflow'] = $workflow;

        return $package;
    }

    private function getSavedAnswers(int $attemptId): array {
        $query = 'SELECT question_id, selected_option_id FROM user_answers WHERE attempt_id = ?';
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('i', $attemptId);
        $stmt->execute();
        $result = $stmt->get_result();

        $savedAnswers = [];
        while ($row = $result->fetch_assoc()) {
            $savedAnswers[(string) ((int) $row['question_id'])] = (int) $row['selected_option_id'];
        }

        return $savedAnswers;
    }

    private function getSectionCounts(int $packageId): array {
        $query = "SELECT COALESCE(NULLIF(section_code, ''), 'general') AS section_code, COUNT(*) AS total
                  FROM questions
                  WHERE package_id = ?
                  GROUP BY COALESCE(NULLIF(section_code, ''), 'general')";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('i', $packageId);
        $stmt->execute();
        $result = $stmt->get_result();

        $sectionCounts = [];
        while ($row = $result->fetch_assoc()) {
            $sectionCounts[(string) $row['section_code']] = (int) ($row['total'] ?? 0);
        }

        return $sectionCounts;
    }

    public function getPackages() {
        $query = "SELECT tp.*, tc.name AS category_name
                  FROM test_packages tp
                  JOIN test_categories tc ON tp.category_id = tc.id
                  ORDER BY tp.created_at DESC";
        $result = $this->mysqli->query($query);

        if (!$result) {
            sendResponse('error', 'Gagal mengambil paket test', null, 500);
        }

        $packages = [];
        while ($row = $result->fetch_assoc()) {
            $packages[] = $this->enrichPackage($row);
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

        $attempt = $this->getAttemptWithPackage((int) $tokenData['userId'], $packageId, $attemptId);
        $workflow = TestWorkflow::buildPackageWorkflow($attempt);
        $attemptState = TestWorkflow::computeAttemptState($attempt, $workflow);
        $savedAnswers = $this->getSavedAnswers($attemptId);
        $sectionCounts = $this->getSectionCounts($packageId);
        $totalQuestionCount = array_sum($sectionCounts);

        $activeSectionCode = null;
        if ($workflow['mode'] === TestWorkflow::MODE_UTBK_SECTIONED
            && empty($attemptState['is_expired'])
            && !empty($attemptState['active_section_code'])
        ) {
            $activeSectionCode = (string) $attemptState['active_section_code'];
        }

        if ($activeSectionCode !== null) {
            $query = "SELECT q.*,
                             GROUP_CONCAT(
                                JSON_OBJECT(
                                    'id', qo.id,
                                    'letter', qo.option_letter,
                                    'text', qo.option_text
                                )
                                ORDER BY qo.id SEPARATOR ','
                             ) AS options
                      FROM questions q
                      LEFT JOIN question_options qo ON qo.question_id = q.id
                      WHERE q.package_id = ? AND q.section_code = ?
                      GROUP BY q.id
                      ORDER BY q.section_order ASC, q.question_order ASC, q.id ASC";
            $stmt = $this->mysqli->prepare($query);
            $stmt->bind_param('is', $packageId, $activeSectionCode);
        } else {
            $query = "SELECT q.*,
                             GROUP_CONCAT(
                                JSON_OBJECT(
                                    'id', qo.id,
                                    'letter', qo.option_letter,
                                    'text', qo.option_text
                                )
                                ORDER BY qo.id SEPARATOR ','
                             ) AS options
                      FROM questions q
                      LEFT JOIN question_options qo ON qo.question_id = q.id
                      WHERE q.package_id = ?
                      GROUP BY q.id
                      ORDER BY q.section_order ASC, q.question_order ASC, q.id ASC";
            $stmt = $this->mysqli->prepare($query);
            $stmt->bind_param('i', $packageId);
        }
        $stmt->execute();
        $result = $stmt->get_result();

        $questions = [];

        while ($row = $result->fetch_assoc()) {
            $row['id'] = (int) $row['id'];
            $row['section_order'] = (int) ($row['section_order'] ?? 1);
            $row['question_order'] = (int) ($row['question_order'] ?? 0);
            $row['selected_option_id'] = isset($savedAnswers[(string) $row['id']])
                ? (int) $savedAnswers[(string) $row['id']]
                : null;
            $row['options'] = $row['options'] ? json_decode('[' . $row['options'] . ']', true) : [];

            $questions[] = $row;
        }

        $sections = [];
        foreach ($workflow['sections'] as $section) {
            $sectionCode = (string) $section['code'];
            $sections[] = [
                'code' => $sectionCode,
                'name' => $section['name'],
                'session_name' => $section['session_name'],
                'session_order' => $section['session_order'],
                'order' => $section['order'],
                'duration_minutes' => $section['duration_minutes'],
                'question_count' => (int) ($sectionCounts[$sectionCode] ?? 0),
            ];
        }

        sendResponse('success', 'Soal-soal berhasil diambil', [
            'questions' => $questions,
            'saved_answers' => $savedAnswers,
            'workflow' => $workflow,
            'sections' => $sections,
            'attempt' => [
                'id' => (int) $attempt['id'],
                'status' => $attempt['status'],
                'start_time' => $attempt['start_time'],
                'state' => $attemptState,
                'answered_count' => count($savedAnswers),
            ],
            'package' => [
                'id' => (int) $attempt['package_id'],
                'name' => $attempt['package_name'],
                'category_name' => $attempt['category_name'],
                'question_count' => $totalQuestionCount,
                'time_limit' => (int) ($workflow['total_duration_minutes'] ?? 0),
                'test_mode' => $workflow['mode'],
            ],
        ]);
    }
}

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
