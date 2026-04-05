<?php
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../middleware/Response.php';

class TestController {
    private $mysqli;

    public function __construct($mysqli) {
        $this->mysqli = $mysqli;
    }

    private function getActiveAccess(int $userId, int $packageId): array {
        $query = "SELECT ua.* FROM user_access ua
                  WHERE ua.user_id = ? AND ua.package_id = ? AND ua.access_status = 'active'
                    AND (ua.access_expires_at IS NULL OR ua.access_expires_at > NOW())
                  LIMIT 1";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('ii', $userId, $packageId);
        $stmt->execute();
        $access = $stmt->get_result()->fetch_assoc();

        if (!$access) {
            sendResponse('error', 'Anda belum membayar atau akses sudah kadaluarsa', null, 403);
        }

        return $access;
    }

    private function getPackage(int $packageId): array {
        $query = "SELECT id, max_attempts, question_count FROM test_packages WHERE id = ? LIMIT 1";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('i', $packageId);
        $stmt->execute();
        $package = $stmt->get_result()->fetch_assoc();

        if (!$package) {
            sendResponse('error', 'Paket test tidak ditemukan', null, 404);
        }

        return $package;
    }

    private function getCompletedAttemptCount(int $userId, int $packageId): int {
        $query = "SELECT COUNT(*) AS attempt_count
                  FROM test_attempts
                  WHERE user_id = ? AND package_id = ? AND status = 'completed'";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('ii', $userId, $packageId);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();

        return (int) ($result['attempt_count'] ?? 0);
    }

    private function getOngoingAttempt(int $userId, int $packageId): ?array {
        $query = "SELECT id, start_time
                  FROM test_attempts
                  WHERE user_id = ? AND package_id = ? AND status = 'ongoing'
                  ORDER BY id DESC
                  LIMIT 1";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('ii', $userId, $packageId);
        $stmt->execute();
        $attempt = $stmt->get_result()->fetch_assoc();

        return $attempt ?: null;
    }

    private function ensureAttemptQuota(int $userId, int $packageId, int $maxAttempts): int {
        $completedAttempts = $this->getCompletedAttemptCount($userId, $packageId);

        if ($completedAttempts >= $maxAttempts) {
            sendResponse('error', 'Anda sudah mencapai batas maksimal percobaan. Silakan bayar lagi untuk test ulang.', null, 403);
        }

        return $completedAttempts;
    }

    public function checkAccess() {
        $tokenData = verifyToken();
        $packageId = (int) ($_GET['package_id'] ?? 0);

        if ($packageId <= 0) {
            sendResponse('error', 'Package ID harus diisi', null, 400);
        }

        $userId = (int) $tokenData['userId'];
        $this->getActiveAccess($userId, $packageId);
        $package = $this->getPackage($packageId);
        $completedAttempts = $this->ensureAttemptQuota($userId, $packageId, (int) $package['max_attempts']);
        $ongoingAttempt = $this->getOngoingAttempt($userId, $packageId);

        sendResponse('success', 'Akses terverifikasi', [
            'canAccess' => true,
            'remaining_attempts' => max(0, (int) $package['max_attempts'] - $completedAttempts),
            'ongoing_attempt_id' => $ongoingAttempt ? (int) $ongoingAttempt['id'] : null,
        ]);
    }

    public function startAttempt() {
        $tokenData = verifyToken();
        $data = json_decode(file_get_contents('php://input'), true);
        $packageId = (int) ($data['package_id'] ?? 0);

        if ($packageId <= 0) {
            sendResponse('error', 'Package ID harus diisi', null, 400);
        }

        $userId = (int) $tokenData['userId'];
        $this->getActiveAccess($userId, $packageId);
        $package = $this->getPackage($packageId);

        $ongoingAttempt = $this->getOngoingAttempt($userId, $packageId);
        if ($ongoingAttempt) {
            sendResponse('success', 'Melanjutkan test yang sedang berjalan', [
                'attempt_id' => (int) $ongoingAttempt['id'],
                'resumed' => true,
            ]);
        }

        $this->ensureAttemptQuota($userId, $packageId, (int) $package['max_attempts']);

        $attemptQuery = "INSERT INTO test_attempts (user_id, package_id, status) VALUES (?, ?, 'ongoing')";
        $stmt = $this->mysqli->prepare($attemptQuery);
        $stmt->bind_param('ii', $userId, $packageId);
        
        if (!$stmt->execute()) {
            sendResponse('error', 'Gagal memulai test', null, 500);
        }

        $attemptId = $stmt->insert_id;
        sendResponse('success', 'Test dimulai', ['attempt_id' => $attemptId, 'resumed' => false]);
    }

    public function submitAnswers() {
        $tokenData = verifyToken();
        $data = json_decode(file_get_contents('php://input'), true);

        $attemptId = (int) ($data['attempt_id'] ?? 0);
        $answers = $data['answers'] ?? [];

        if ($attemptId <= 0) {
            sendResponse('error', 'Attempt ID harus diisi', null, 400);
        }

        if (!is_array($answers)) {
            sendResponse('error', 'Format jawaban tidak valid', null, 422);
        }

        $userId = (int) $tokenData['userId'];
        $this->mysqli->begin_transaction();

        try {
            $attemptQuery = "SELECT ta.*, tp.question_count
                             FROM test_attempts ta
                             JOIN test_packages tp ON tp.id = ta.package_id
                             WHERE ta.id = ? AND ta.user_id = ?
                             LIMIT 1
                             FOR UPDATE";
            $stmt = $this->mysqli->prepare($attemptQuery);
            $stmt->bind_param('ii', $attemptId, $userId);
            $stmt->execute();
            $attempt = $stmt->get_result()->fetch_assoc();

            if (!$attempt) {
                throw new RuntimeException('Attempt tidak ditemukan', 404);
            }

            if (($attempt['status'] ?? '') !== 'ongoing') {
                throw new RuntimeException('Attempt ini sudah disubmit atau tidak aktif lagi', 409);
            }

            $this->getActiveAccess($userId, (int) $attempt['package_id']);

            $questionsQuery = "SELECT id FROM questions WHERE package_id = ? ORDER BY id ASC";
            $stmt = $this->mysqli->prepare($questionsQuery);
            $stmt->bind_param('i', $attempt['package_id']);
            $stmt->execute();
            $questionResult = $stmt->get_result();

            $packageQuestionIds = [];
            while ($question = $questionResult->fetch_assoc()) {
                $packageQuestionIds[] = (int) $question['id'];
            }

            if (count($packageQuestionIds) === 0) {
                throw new RuntimeException('Paket ini belum memiliki soal aktif', 422);
            }

            $validQuestionMap = array_fill_keys($packageQuestionIds, true);
            $submittedAnswers = [];

            foreach ($answers as $answer) {
                $questionId = (int) ($answer['question_id'] ?? 0);
                if ($questionId <= 0 || !isset($validQuestionMap[$questionId])) {
                    throw new RuntimeException('Terdapat jawaban untuk soal yang tidak valid', 422);
                }

                if (isset($submittedAnswers[$questionId])) {
                    throw new RuntimeException('Setiap soal hanya boleh dikirim sekali dalam satu submit', 422);
                }

                $optionId = array_key_exists('option_id', $answer) && $answer['option_id'] !== null
                    ? (int) $answer['option_id']
                    : null;

                $submittedAnswers[$questionId] = [
                    'option_id' => $optionId,
                    'is_correct' => 0,
                ];
            }

            $optionQuery = "SELECT id, is_correct FROM question_options WHERE id = ? AND question_id = ? LIMIT 1";
            $optionStmt = $this->mysqli->prepare($optionQuery);

            foreach ($submittedAnswers as $questionId => $answerData) {
                if ($answerData['option_id'] === null) {
                    continue;
                }

                $optionStmt->bind_param('ii', $answerData['option_id'], $questionId);
                $optionStmt->execute();
                $option = $optionStmt->get_result()->fetch_assoc();

                if (!$option) {
                    throw new RuntimeException('Pilihan jawaban tidak sesuai dengan soal yang dipilih', 422);
                }

                $submittedAnswers[$questionId]['is_correct'] = (int) ($option['is_correct'] ?? 0);
            }

            $deleteQuery = "DELETE FROM user_answers WHERE attempt_id = ?";
            $stmt = $this->mysqli->prepare($deleteQuery);
            $stmt->bind_param('i', $attemptId);
            $stmt->execute();

            $insertQuery = "INSERT INTO user_answers (attempt_id, question_id, selected_option_id, is_correct)
                            VALUES (?, ?, ?, ?)";
            $insertStmt = $this->mysqli->prepare($insertQuery);

            foreach ($submittedAnswers as $questionId => $answerData) {
                if ($answerData['option_id'] === null) {
                    continue;
                }

                $insertStmt->bind_param(
                    'iiii',
                    $attemptId,
                    $questionId,
                    $answerData['option_id'],
                    $answerData['is_correct']
                );
                $insertStmt->execute();
            }

            $totalQuestions = count($packageQuestionIds);
            $correctAnswers = array_sum(array_column($submittedAnswers, 'is_correct'));
            $percentage = $totalQuestions > 0 ? ($correctAnswers / $totalQuestions) * 100 : 0;
            $score = round($percentage, 2);

            $updateQuery = "UPDATE test_attempts SET status = 'completed', end_time = NOW() WHERE id = ?";
            $stmt = $this->mysqli->prepare($updateQuery);
            $stmt->bind_param('i', $attemptId);
            $stmt->execute();

            $resultQuery = "INSERT INTO test_results (attempt_id, user_id, package_id, total_questions, correct_answers, score, percentage, time_taken)
                            VALUES (?, ?, ?, ?, ?, ?, ?, TIMESTAMPDIFF(SECOND, ?, NOW()))";
            $stmt = $this->mysqli->prepare($resultQuery);
            $stmt->bind_param(
                'iiiiidds',
                $attemptId,
                $userId,
                $attempt['package_id'],
                $totalQuestions,
                $correctAnswers,
                $score,
                $percentage,
                $attempt['start_time']
            );
            $stmt->execute();

            $this->mysqli->commit();

            sendResponse('success', 'Jawaban berhasil disimpan', [
                'total_questions' => $totalQuestions,
                'correct_answers' => $correctAnswers,
                'percentage' => round($percentage, 2),
                'score' => $score,
            ]);
        } catch (RuntimeException $error) {
            $this->mysqli->rollback();
            sendResponse('error', $error->getMessage(), null, $error->getCode() ?: 400);
        } catch (Throwable $error) {
            $this->mysqli->rollback();
            sendResponse('error', 'Gagal menyimpan jawaban test', ['details' => $error->getMessage()], 500);
        }
    }

    public function getResults() {
        $tokenData = verifyToken();
        $attemptId = $_GET['attempt_id'] ?? null;

        if (!$attemptId) {
            sendResponse('error', 'Attempt ID harus diisi', null, 400);
        }

        $query = "SELECT tr.* FROM test_results tr
                  WHERE tr.attempt_id = ? AND tr.user_id = ?";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('ii', $attemptId, $tokenData['userId']);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result->num_rows === 0) {
            sendResponse('error', 'Hasil test tidak ditemukan', null, 404);
        }

        $testResult = $result->fetch_assoc();
        sendResponse('success', 'Hasil test berhasil diambil', $testResult);
    }
}

// Router
$requestMethod = $_SERVER['REQUEST_METHOD'];
$requestPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

$controller = new TestController($mysqli);

if (strpos($requestPath, '/api/test/check-access') !== false && $requestMethod === 'GET') {
    $controller->checkAccess();
} elseif (strpos($requestPath, '/api/test/start') !== false && $requestMethod === 'POST') {
    $controller->startAttempt();
} elseif (strpos($requestPath, '/api/test/submit') !== false && $requestMethod === 'POST') {
    $controller->submitAnswers();
} elseif (strpos($requestPath, '/api/test/results') !== false && $requestMethod === 'GET') {
    $controller->getResults();
} else {
    sendResponse('error', 'Endpoint tidak ditemukan', null, 404);
}
