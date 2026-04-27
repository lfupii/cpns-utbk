<?php
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../utils/TestWorkflow.php';
require_once __DIR__ . '/../utils/UserNotificationService.php';
require_once __DIR__ . '/../middleware/Response.php';

class TestController {
    private $mysqli;

    public function __construct($mysqli) {
        $this->mysqli = $mysqli;
    }

    private function sendTryoutResultNotification(int $attemptId): array {
        $query = "SELECT
                    u.email,
                    u.full_name,
                    tr.total_questions,
                    tr.correct_answers,
                    tr.score,
                    tr.percentage,
                    tr.time_taken,
                    DATE_FORMAT(tr.created_at, '%d-%m-%Y %H:%i:%s') AS completed_at,
                    tp.name AS package_name,
                    tc.name AS category_name
                  FROM test_results tr
                  JOIN users u ON u.id = tr.user_id
                  JOIN test_packages tp ON tp.id = tr.package_id
                  JOIN test_categories tc ON tc.id = tp.category_id
                  WHERE tr.attempt_id = ?
                  LIMIT 1";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('i', $attemptId);
        $stmt->execute();
        $payload = $stmt->get_result()->fetch_assoc();

        if (!$payload) {
            return [
                'success' => false,
                'transport' => 'lookup',
                'message' => 'Data hasil tryout untuk email tidak ditemukan.',
            ];
        }

        try {
            return UserNotificationService::sendTryoutResultEmail($payload);
        } catch (Throwable $error) {
            error_log('Tryout result email failed: ' . $error->getMessage());

            return [
                'success' => false,
                'transport' => 'exception',
                'message' => 'Hasil tryout tersimpan, tetapi email belum berhasil dikirim.',
            ];
        }
    }

    private function assertActiveAccess(int $userId, int $packageId, bool $isAdmin = false): void {
        if ($isAdmin) {
            return;
        }

        $query = "SELECT ua.id FROM user_access ua
                  WHERE ua.user_id = ? AND ua.package_id = ? AND ua.access_status = 'active'
                    AND (ua.access_expires_at IS NULL OR ua.access_expires_at > NOW())
                  LIMIT 1";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('ii', $userId, $packageId);
        $stmt->execute();

        if (!$stmt->get_result()->fetch_assoc()) {
            throw new RuntimeException('Anda belum membayar atau akses sudah kadaluarsa', 403);
        }
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
            throw new RuntimeException('Paket test tidak ditemukan', 404);
        }

        return $package;
    }

    private function assertPackageAvailable(array $package, bool $isAdmin = false): void {
        if ($isAdmin) {
            return;
        }

        if ((int) ($package['is_temporarily_disabled'] ?? 0) === 1) {
            throw new RuntimeException('Mohon maaf, paket ini nonaktif sementara dan sedang maintenance.', 423);
        }
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
        $query = "SELECT ta.*, tp.name AS package_name, tp.time_limit, tp.test_mode, tp.workflow_config, tc.name AS category_name
                  FROM test_attempts ta
                  JOIN test_packages tp ON tp.id = ta.package_id
                  JOIN test_categories tc ON tc.id = tp.category_id
                  WHERE ta.user_id = ? AND ta.package_id = ? AND ta.status = 'ongoing'
                  ORDER BY ta.id DESC
                  LIMIT 1";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('ii', $userId, $packageId);
        $stmt->execute();
        $attempt = $stmt->get_result()->fetch_assoc();

        return $attempt ?: null;
    }

    private function getAttemptForUser(int $attemptId, int $userId, bool $forUpdate = false): ?array {
        $query = "SELECT ta.*, tp.name AS package_name, tp.time_limit, tp.test_mode, tp.workflow_config, tc.name AS category_name
                  FROM test_attempts ta
                  JOIN test_packages tp ON tp.id = ta.package_id
                  JOIN test_categories tc ON tc.id = tp.category_id
                  WHERE ta.id = ? AND ta.user_id = ?
                  LIMIT 1";
        if ($forUpdate) {
            $query .= ' FOR UPDATE';
        }

        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('ii', $attemptId, $userId);
        $stmt->execute();
        $attempt = $stmt->get_result()->fetch_assoc();

        return $attempt ?: null;
    }

    private function ensureAttemptQuota(int $userId, int $packageId, int $maxAttempts, bool $isAdmin = false): int {
        $completedAttempts = $this->getCompletedAttemptCount($userId, $packageId);

        if ($isAdmin) {
            return $completedAttempts;
        }

        if ($completedAttempts >= $maxAttempts) {
            throw new RuntimeException(
                'Anda sudah mencapai batas maksimal percobaan. Silakan bayar lagi untuk test ulang.',
                403
            );
        }

        return $completedAttempts;
    }

    private function getPackageQuestionIds(int $packageId): array {
        $query = 'SELECT id FROM questions WHERE package_id = ? ORDER BY section_order ASC, id ASC';
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('i', $packageId);
        $stmt->execute();
        $result = $stmt->get_result();

        $questionIds = [];
        while ($row = $result->fetch_assoc()) {
            $questionIds[] = (int) $row['id'];
        }

        if (count($questionIds) === 0) {
            throw new RuntimeException('Paket ini belum memiliki soal aktif', 422);
        }

        return $questionIds;
    }

    private function getQuestion(int $packageId, int $questionId): ?array {
        $query = 'SELECT id, package_id, section_code, section_name, section_order
                  FROM questions
                  WHERE id = ? AND package_id = ?
                  LIMIT 1';
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('ii', $questionId, $packageId);
        $stmt->execute();
        $question = $stmt->get_result()->fetch_assoc();

        return $question ?: null;
    }

    private function getExistingResult(int $attemptId, int $userId): ?array {
        $query = 'SELECT * FROM test_results WHERE attempt_id = ? AND user_id = ? LIMIT 1';
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('ii', $attemptId, $userId);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();

        return $result ?: null;
    }

    private function buildQuestionShuffleKey(int $attemptId, array $question): string {
        $sectionCode = (string) ($question['section_code'] ?? 'general');
        $questionId = (int) ($question['id'] ?? 0);

        return hash('sha256', $attemptId . '|' . $sectionCode . '|' . $questionId);
    }

    private function sortQuestionsForAttempt(array $questions, int $attemptId): array {
        usort($questions, function (array $left, array $right) use ($attemptId): int {
            $leftSectionOrder = (int) ($left['section_order'] ?? 1);
            $rightSectionOrder = (int) ($right['section_order'] ?? 1);

            if ($leftSectionOrder !== $rightSectionOrder) {
                return $leftSectionOrder <=> $rightSectionOrder;
            }

            $leftSectionCode = (string) ($left['section_code'] ?? '');
            $rightSectionCode = (string) ($right['section_code'] ?? '');
            if ($leftSectionCode !== $rightSectionCode) {
                return strcmp($leftSectionCode, $rightSectionCode);
            }

            $leftKey = $this->buildQuestionShuffleKey($attemptId, $left);
            $rightKey = $this->buildQuestionShuffleKey($attemptId, $right);
            $comparison = strcmp($leftKey, $rightKey);
            if ($comparison !== 0) {
                return $comparison;
            }

            return ((int) ($left['id'] ?? 0)) <=> ((int) ($right['id'] ?? 0));
        });

        return $questions;
    }

    private function getResultReviewItems(int $attemptId, array $attempt): array {
        $query = "SELECT q.id,
                         q.question_text,
                         q.question_image_url,
                         q.question_image_layout,
                         q.section_code,
                         q.section_name,
                         q.section_order,
                         q.explanation_notes,
                         ua.selected_option_id,
                         ua.is_correct AS selected_is_correct,
                         GROUP_CONCAT(
                            JSON_OBJECT(
                                'id', qo.id,
                                'letter', qo.option_letter,
                                'text', qo.option_text,
                                'image_url', qo.option_image_url,
                                'is_correct', qo.is_correct
                            )
                            ORDER BY qo.id SEPARATOR ','
                         ) AS options
                  FROM questions q
                  LEFT JOIN question_options qo ON qo.question_id = q.id
                  LEFT JOIN user_answers ua ON ua.question_id = q.id AND ua.attempt_id = ?
                  WHERE q.package_id = ?
                  GROUP BY q.id
                  ORDER BY q.section_order ASC, q.id ASC";
        $stmt = $this->mysqli->prepare($query);
        $packageId = (int) ($attempt['package_id'] ?? 0);
        $stmt->bind_param('ii', $attemptId, $packageId);
        $stmt->execute();
        $result = $stmt->get_result();

        $questions = [];
        while ($row = $result->fetch_assoc()) {
            $options = $row['options'] ? json_decode('[' . $row['options'] . ']', true) : [];
            $selectedOptionId = isset($row['selected_option_id']) ? (int) $row['selected_option_id'] : null;
            $correctOptionId = null;

            $normalizedOptions = array_map(static function (array $option) use ($selectedOptionId, &$correctOptionId): array {
                $optionId = (int) ($option['id'] ?? 0);
                $isCorrect = !empty($option['is_correct']);
                if ($isCorrect) {
                    $correctOptionId = $optionId;
                }

                return [
                    'id' => $optionId,
                    'letter' => (string) ($option['letter'] ?? ''),
                    'text' => (string) ($option['text'] ?? ''),
                    'image_url' => ($option['image_url'] ?? null) ?: null,
                    'is_correct' => $isCorrect,
                    'is_selected' => $selectedOptionId !== null && $optionId === $selectedOptionId,
                ];
            }, $options);

            $questions[] = [
                'id' => (int) ($row['id'] ?? 0),
                'question_text' => (string) ($row['question_text'] ?? ''),
                'question_image_url' => ($row['question_image_url'] ?? null) ?: null,
                'question_image_layout' => (string) ($row['question_image_layout'] ?? 'top'),
                'section_code' => (string) ($row['section_code'] ?? ''),
                'section_name' => (string) ($row['section_name'] ?? ''),
                'section_order' => (int) ($row['section_order'] ?? 1),
                'explanation_notes' => trim((string) ($row['explanation_notes'] ?? '')),
                'selected_option_id' => $selectedOptionId,
                'correct_option_id' => $correctOptionId,
                'is_answered' => $selectedOptionId !== null && $selectedOptionId > 0,
                'is_correct' => isset($row['selected_is_correct']) ? (int) ($row['selected_is_correct'] ?? 0) === 1 : false,
                'options' => $normalizedOptions,
            ];
        }

        $questions = $this->sortQuestionsForAttempt($questions, $attemptId);

        return array_map(static function (array $question, int $index): array {
            return [
                ...$question,
                'number' => $index + 1,
            ];
        }, $questions, array_keys($questions));
    }

    private function findSectionIndex(array $sections, array $attemptState): int {
        $activeCode = (string) ($attemptState['active_section_code'] ?? '');
        $activeOrder = (int) ($attemptState['active_section_order'] ?? 0);

        foreach ($sections as $index => $section) {
            if ($activeCode !== '' && (string) ($section['code'] ?? '') === $activeCode) {
                return $index;
            }

            if ($activeOrder > 0 && (int) ($section['order'] ?? ($index + 1)) === $activeOrder) {
                return $index;
            }
        }

        return 0;
    }

    private function getAnsweredCount(int $attemptId): int {
        $query = 'SELECT COUNT(*) AS total FROM user_answers WHERE attempt_id = ?';
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('i', $attemptId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();

        return (int) ($row['total'] ?? 0);
    }

    private function hasAnsweredQuestion(int $attemptId, int $questionId): bool {
        $query = 'SELECT selected_option_id FROM user_answers WHERE attempt_id = ? AND question_id = ? LIMIT 1';
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('ii', $attemptId, $questionId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();

        return isset($row['selected_option_id']) && (int) $row['selected_option_id'] > 0;
    }

    private function getMarkedReviewQuestionIds(int $attemptId, ?string $sectionCode = null): array {
        $query = 'SELECT aqf.question_id
                  FROM attempt_question_flags aqf
                  JOIN questions q ON q.id = aqf.question_id
                  WHERE aqf.attempt_id = ? AND aqf.is_marked_review = 1';

        if ($sectionCode !== null && $sectionCode !== '') {
            $query .= ' AND q.section_code = ?';
        }

        $stmt = $this->mysqli->prepare($query);
        if ($sectionCode !== null && $sectionCode !== '') {
            $stmt->bind_param('is', $attemptId, $sectionCode);
        } else {
            $stmt->bind_param('i', $attemptId);
        }
        $stmt->execute();
        $result = $stmt->get_result();

        $questionIds = [];
        while ($row = $result->fetch_assoc()) {
            $questionIds[] = (int) ($row['question_id'] ?? 0);
        }

        return array_values(array_filter($questionIds));
    }

    private function assertNoPendingReviewFlags(int $attemptId, array $workflow, array $attemptState, string $actionLabel): void {
        $sectionCode = $workflow['mode'] === TestWorkflow::MODE_UTBK_SECTIONED
            ? (string) ($attemptState['active_section_code'] ?? '')
            : null;
        $pendingReviewQuestionIds = $this->getMarkedReviewQuestionIds($attemptId, $sectionCode);

        if (count($pendingReviewQuestionIds) > 0) {
            throw new RuntimeException(
                'Masih ada soal bertanda ragu-ragu. Matikan status ragu-ragu sebelum ' . strtolower($actionLabel) . '.',
                409
            );
        }
    }

    private function assertQuestionAccessible(array $workflow, array $attemptState, array $question): void {
        if ($workflow['mode'] !== TestWorkflow::MODE_UTBK_SECTIONED) {
            return;
        }

        if (!empty($attemptState['is_expired'])) {
            throw new RuntimeException('Waktu subtes sudah berakhir.', 409);
        }

        $activeSectionCode = (string) ($attemptState['active_section_code'] ?? '');
        $questionSectionCode = (string) ($question['section_code'] ?? '');

        if ($activeSectionCode !== '' && $questionSectionCode === $activeSectionCode) {
            return;
        }

        if (in_array($questionSectionCode, $attemptState['completed_section_codes'] ?? [], true)) {
            throw new RuntimeException('Subtes sebelumnya sudah dikunci dan tidak bisa dikerjakan lagi.', 409);
        }

        throw new RuntimeException('Subtes ini belum aktif untuk dikerjakan.', 409);
    }

    private function getOptionCorrectness(int $questionId, int $optionId): int {
        $query = 'SELECT is_correct FROM question_options WHERE id = ? AND question_id = ? LIMIT 1';
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('ii', $optionId, $questionId);
        $stmt->execute();
        $option = $stmt->get_result()->fetch_assoc();

        if (!$option) {
            throw new RuntimeException('Pilihan jawaban tidak sesuai dengan soal yang dipilih', 422);
        }

        return (int) ($option['is_correct'] ?? 0);
    }

    private function upsertAnswer(int $attemptId, int $questionId, int $optionId, int $isCorrect): void {
        $query = "INSERT INTO user_answers (attempt_id, question_id, selected_option_id, is_correct)
                  VALUES (?, ?, ?, ?)
                  ON DUPLICATE KEY UPDATE
                    selected_option_id = VALUES(selected_option_id),
                    is_correct = VALUES(is_correct),
                    answered_at = CURRENT_TIMESTAMP";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('iiii', $attemptId, $questionId, $optionId, $isCorrect);
        $stmt->execute();
    }

    private function setReviewFlag(int $attemptId, int $questionId, bool $isMarkedReview): void {
        if (!$isMarkedReview) {
            $deleteStmt = $this->mysqli->prepare(
                'DELETE FROM attempt_question_flags WHERE attempt_id = ? AND question_id = ?'
            );
            $deleteStmt->bind_param('ii', $attemptId, $questionId);
            $deleteStmt->execute();
            return;
        }

        $markedValue = 1;
        $query = "INSERT INTO attempt_question_flags (attempt_id, question_id, is_marked_review)
                  VALUES (?, ?, ?)
                  ON DUPLICATE KEY UPDATE
                    is_marked_review = VALUES(is_marked_review),
                    updated_at = CURRENT_TIMESTAMP";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('iii', $attemptId, $questionId, $markedValue);
        $stmt->execute();
    }

    private function persistAnswers(
        int $attemptId,
        array $attempt,
        array $workflow,
        array $attemptState,
        array $answers
    ): void {
        if (!is_array($answers)) {
            throw new RuntimeException('Format jawaban tidak valid', 422);
        }

        $seenQuestionIds = [];
        foreach ($answers as $answer) {
            $questionId = (int) ($answer['question_id'] ?? 0);
            $optionId = array_key_exists('option_id', $answer) && $answer['option_id'] !== null
                ? (int) $answer['option_id']
                : 0;

            if ($questionId <= 0 || $optionId <= 0) {
                throw new RuntimeException('Data jawaban tidak lengkap', 422);
            }

            if (isset($seenQuestionIds[$questionId])) {
                throw new RuntimeException('Setiap soal hanya boleh dikirim sekali dalam satu request', 422);
            }

            $question = $this->getQuestion((int) $attempt['package_id'], $questionId);
            if (!$question) {
                throw new RuntimeException('Terdapat jawaban untuk soal yang tidak valid', 422);
            }

            $this->assertQuestionAccessible($workflow, $attemptState, $question);

            $isCorrect = $this->getOptionCorrectness($questionId, $optionId);
            $this->upsertAnswer($attemptId, $questionId, $optionId, $isCorrect);
            $seenQuestionIds[$questionId] = true;
        }
    }

    private function finalizeAttempt(int $attemptId, int $userId, array $answers = [], bool $isAdmin = false): array {
        $this->mysqli->begin_transaction();

        try {
            $attempt = $this->getAttemptForUser($attemptId, $userId, true);
            if (!$attempt) {
                throw new RuntimeException('Attempt tidak ditemukan', 404);
            }

            if (($attempt['status'] ?? '') === 'completed') {
                $existingResult = $this->getExistingResult($attemptId, $userId);
                if (!$existingResult) {
                    throw new RuntimeException('Hasil test tidak ditemukan', 404);
                }

                $this->mysqli->rollback();

                return [
                    'already_completed' => true,
                    'result' => $existingResult,
                    'email_delivery' => null,
                ];
            }

            if (($attempt['status'] ?? '') !== 'ongoing') {
                throw new RuntimeException('Attempt ini sudah tidak aktif lagi', 409);
            }

            $this->assertActiveAccess($userId, (int) $attempt['package_id'], $isAdmin);
            $workflow = TestWorkflow::buildPackageWorkflow($attempt);
            $attemptState = TestWorkflow::computeAttemptState($attempt, $workflow);

            if ($workflow['mode'] === TestWorkflow::MODE_UTBK_SECTIONED
                && empty($attemptState['is_expired'])
                && empty($workflow['manual_finish'])
                && empty($attemptState['is_last_section'])
            ) {
                throw new RuntimeException(
                    'Tes UTBK berjalan otomatis per subtes dan hanya bisa selesai ketika seluruh waktu habis.',
                    409
                );
            }

            if (!empty($answers)) {
                $this->persistAnswers($attemptId, $attempt, $workflow, $attemptState, $answers);
            }

            $packageQuestionIds = $this->getPackageQuestionIds((int) $attempt['package_id']);
            $correctQuery = 'SELECT COUNT(*) AS total FROM user_answers WHERE attempt_id = ? AND is_correct = 1';
            $stmt = $this->mysqli->prepare($correctQuery);
            $stmt->bind_param('i', $attemptId);
            $stmt->execute();
            $correctRow = $stmt->get_result()->fetch_assoc();

            $totalQuestions = count($packageQuestionIds);
            $correctAnswers = (int) ($correctRow['total'] ?? 0);
            $percentage = $totalQuestions > 0 ? ($correctAnswers / $totalQuestions) * 100 : 0;
            $score = round($percentage, 2);

            $updateAttempt = $this->mysqli->prepare(
                "UPDATE test_attempts SET status = 'completed', end_time = NOW() WHERE id = ?"
            );
            $updateAttempt->bind_param('i', $attemptId);
            $updateAttempt->execute();

            $insertResult = $this->mysqli->prepare(
                'INSERT INTO test_results (attempt_id, user_id, package_id, total_questions, correct_answers, score, percentage, time_taken)
                 VALUES (?, ?, ?, ?, ?, ?, ?, TIMESTAMPDIFF(SECOND, ?, NOW()))'
            );
            $insertResult->bind_param(
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
            $insertResult->execute();

            $this->mysqli->commit();

            $result = $this->getExistingResult($attemptId, $userId);
            $emailDelivery = $this->sendTryoutResultNotification($attemptId);

            return [
                'already_completed' => false,
                'result' => $result,
                'email_delivery' => $emailDelivery,
            ];
        } catch (Throwable $error) {
            $this->mysqli->rollback();
            throw $error;
        }
    }

    public function checkAccess() {
        $tokenData = verifyToken();
        $packageId = (int) ($_GET['package_id'] ?? 0);

        if ($packageId <= 0) {
            sendResponse('error', 'Package ID harus diisi', null, 400);
        }

        try {
            $userId = (int) $tokenData['userId'];
            $isAdmin = userHasRole($tokenData, $this->mysqli, 'admin');
            $this->assertActiveAccess($userId, $packageId, $isAdmin);
            $package = $this->getPackage($packageId);
            $this->assertPackageAvailable($package, $isAdmin);
            $completedAttempts = $this->ensureAttemptQuota($userId, $packageId, (int) $package['max_attempts'], $isAdmin);
            $ongoingAttempt = $this->getOngoingAttempt($userId, $packageId);

            sendResponse('success', 'Akses terverifikasi', [
                'can_access' => true,
                'remaining_attempts' => $isAdmin
                    ? null
                    : max(0, (int) $package['max_attempts'] - $completedAttempts),
                'admin_bypass' => $isAdmin,
                'ongoing_attempt_id' => $ongoingAttempt ? (int) $ongoingAttempt['id'] : null,
                'workflow' => TestWorkflow::buildPackageWorkflow($package),
            ]);
        } catch (RuntimeException $error) {
            sendResponse('error', $error->getMessage(), null, $error->getCode() ?: 400);
        }
    }

    public function startAttempt() {
        $tokenData = verifyToken();
        $data = json_decode(file_get_contents('php://input'), true);
        $packageId = (int) ($data['package_id'] ?? 0);

        if ($packageId <= 0) {
            sendResponse('error', 'Package ID harus diisi', null, 400);
        }

        try {
            $userId = (int) $tokenData['userId'];
            $isAdmin = userHasRole($tokenData, $this->mysqli, 'admin');
            $this->assertActiveAccess($userId, $packageId, $isAdmin);
            $package = $this->getPackage($packageId);
            $this->assertPackageAvailable($package, $isAdmin);
            $workflow = TestWorkflow::buildPackageWorkflow($package);

            $ongoingAttempt = $this->getOngoingAttempt($userId, $packageId);
            if ($ongoingAttempt) {
                $attemptState = TestWorkflow::computeAttemptState($ongoingAttempt, $workflow);
                if (!empty($attemptState['is_expired'])) {
                    $completion = $this->finalizeAttempt((int) $ongoingAttempt['id'], $userId, [], $isAdmin);
                    sendResponse('success', 'Waktu test sebelumnya sudah habis dan attempt ditutup otomatis.', [
                        'attempt_id' => (int) $ongoingAttempt['id'],
                        'completed_attempt_id' => (int) $ongoingAttempt['id'],
                        'resumed' => false,
                        'auto_submitted' => true,
                        'result_ready' => true,
                        'workflow' => $workflow,
                        'result' => $completion['result'],
                    ]);
                }

                sendResponse('success', 'Melanjutkan test yang sedang berjalan', [
                    'attempt_id' => (int) $ongoingAttempt['id'],
                    'resumed' => true,
                    'auto_submitted' => false,
                    'workflow' => $workflow,
                ]);
            }

            $this->ensureAttemptQuota($userId, $packageId, (int) $package['max_attempts'], $isAdmin);

            if ($workflow['mode'] === TestWorkflow::MODE_UTBK_SECTIONED) {
                $firstSectionOrder = (int) ($workflow['sections'][0]['order'] ?? 1);
                $attemptQuery = "INSERT INTO test_attempts (
                                    user_id,
                                    package_id,
                                    status,
                                    active_section_order,
                                    active_section_started_at
                                 ) VALUES (?, ?, 'ongoing', ?, NOW())";
                $stmt = $this->mysqli->prepare($attemptQuery);
                $stmt->bind_param('iii', $userId, $packageId, $firstSectionOrder);
            } else {
                $attemptQuery = "INSERT INTO test_attempts (user_id, package_id, status) VALUES (?, ?, 'ongoing')";
                $stmt = $this->mysqli->prepare($attemptQuery);
                $stmt->bind_param('ii', $userId, $packageId);
            }

            if (!$stmt->execute()) {
                sendResponse('error', 'Gagal memulai test', null, 500);
            }

            $attemptId = (int) $stmt->insert_id;
            sendResponse('success', 'Test dimulai', [
                'attempt_id' => $attemptId,
                'resumed' => false,
                'auto_submitted' => false,
                'workflow' => $workflow,
            ]);
        } catch (RuntimeException $error) {
            sendResponse('error', $error->getMessage(), null, $error->getCode() ?: 400);
        } catch (Throwable $error) {
            sendResponse('error', 'Gagal memulai test', ['details' => $error->getMessage()], 500);
        }
    }

    public function saveAnswer() {
        $tokenData = verifyToken();
        $data = json_decode(file_get_contents('php://input'), true);

        $attemptId = (int) ($data['attempt_id'] ?? 0);
        $questionId = (int) ($data['question_id'] ?? 0);
        $optionId = (int) ($data['option_id'] ?? 0);

        if ($attemptId <= 0 || $questionId <= 0 || $optionId <= 0) {
            sendResponse('error', 'Attempt ID, Question ID, dan Option ID harus diisi', null, 400);
        }

        $userId = (int) $tokenData['userId'];
        $this->mysqli->begin_transaction();

        try {
            $attempt = $this->getAttemptForUser($attemptId, $userId, true);
            if (!$attempt) {
                throw new RuntimeException('Attempt tidak ditemukan', 404);
            }

            if (($attempt['status'] ?? '') !== 'ongoing') {
                $existingResult = $this->getExistingResult($attemptId, $userId);
                throw new RuntimeException(
                    $existingResult ? 'Attempt ini sudah selesai.' : 'Attempt ini sudah tidak aktif lagi',
                    409
                );
            }

            $isAdmin = userHasRole($tokenData, $this->mysqli, 'admin');
            $this->assertActiveAccess($userId, (int) $attempt['package_id'], $isAdmin);
            $workflow = TestWorkflow::buildPackageWorkflow($attempt);
            $attemptState = TestWorkflow::computeAttemptState($attempt, $workflow);

            if (!empty($attemptState['is_expired'])) {
                $this->mysqli->rollback();
                $completion = $this->finalizeAttempt($attemptId, $userId, [], $isAdmin);
                sendResponse('error', 'Waktu ujian sudah habis. Attempt ditutup otomatis.', [
                    'attempt_completed' => true,
                    'attempt_id' => $attemptId,
                    'result' => $completion['result'],
                ], 409);
            }

            $question = $this->getQuestion((int) $attempt['package_id'], $questionId);
            if (!$question) {
                throw new RuntimeException('Soal tidak ditemukan pada paket ini', 404);
            }

            $this->assertQuestionAccessible($workflow, $attemptState, $question);
            $isCorrect = $this->getOptionCorrectness($questionId, $optionId);
            $this->upsertAnswer($attemptId, $questionId, $optionId, $isCorrect);

            $answeredCount = $this->getAnsweredCount($attemptId);
            $this->mysqli->commit();

            sendResponse('success', 'Jawaban berhasil disimpan', [
                'attempt_id' => $attemptId,
                'question_id' => $questionId,
                'answered_count' => $answeredCount,
            ]);
        } catch (RuntimeException $error) {
            $this->mysqli->rollback();
            sendResponse('error', $error->getMessage(), null, $error->getCode() ?: 400);
        } catch (Throwable $error) {
            $this->mysqli->rollback();
            sendResponse('error', 'Gagal menyimpan jawaban', ['details' => $error->getMessage()], 500);
        }
    }

    public function advanceSection() {
        $tokenData = verifyToken();
        $data = json_decode(file_get_contents('php://input'), true);

        $attemptId = (int) ($data['attempt_id'] ?? 0);
        if ($attemptId <= 0) {
            sendResponse('error', 'Attempt ID harus diisi', null, 400);
        }

        $userId = (int) $tokenData['userId'];
        $isAdmin = userHasRole($tokenData, $this->mysqli, 'admin');
        $this->mysqli->begin_transaction();

        try {
            $attempt = $this->getAttemptForUser($attemptId, $userId, true);
            if (!$attempt) {
                throw new RuntimeException('Attempt tidak ditemukan', 404);
            }

            if (($attempt['status'] ?? '') !== 'ongoing') {
                $existingResult = $this->getExistingResult($attemptId, $userId);
                throw new RuntimeException(
                    $existingResult ? 'Attempt ini sudah selesai.' : 'Attempt ini sudah tidak aktif lagi',
                    409
                );
            }

            $this->assertActiveAccess($userId, (int) $attempt['package_id'], $isAdmin);
            $workflow = TestWorkflow::buildPackageWorkflow($attempt);
            if ($workflow['mode'] !== TestWorkflow::MODE_UTBK_SECTIONED) {
                throw new RuntimeException('Fitur pindah subtes hanya tersedia untuk paket UTBK.', 400);
            }

            $attemptState = TestWorkflow::computeAttemptState($attempt, $workflow);
            if (!empty($attemptState['is_expired'])) {
                $this->mysqli->rollback();
                $completion = $this->finalizeAttempt($attemptId, $userId, [], $isAdmin);
                sendResponse('error', 'Waktu ujian sudah habis. Attempt ditutup otomatis.', [
                    'attempt_completed' => true,
                    'attempt_id' => $attemptId,
                    'result' => $completion['result'],
                ], 409);
            }

            $this->assertNoPendingReviewFlags($attemptId, $workflow, $attemptState, 'pindah ke subtes berikutnya');

            $sections = array_values($workflow['sections']);
            $currentIndex = $this->findSectionIndex($sections, $attemptState);
            $nextSection = $sections[$currentIndex + 1] ?? null;
            if (!$nextSection) {
                throw new RuntimeException('Subtes ini sudah berada di bagian terakhir.', 409);
            }

            $nextSectionOrder = (int) ($nextSection['order'] ?? ($currentIndex + 2));
            $updateStmt = $this->mysqli->prepare(
                'UPDATE test_attempts
                 SET active_section_order = ?, active_section_started_at = NOW()
                 WHERE id = ?'
            );
            $updateStmt->bind_param('ii', $nextSectionOrder, $attemptId);
            $updateStmt->execute();

            $this->mysqli->commit();

            sendResponse('success', 'Berhasil pindah ke subtes berikutnya.', [
                'attempt_id' => $attemptId,
                'next_section_code' => (string) ($nextSection['code'] ?? ''),
                'next_section_name' => (string) ($nextSection['name'] ?? ''),
                'next_section_order' => $nextSectionOrder,
            ]);
        } catch (RuntimeException $error) {
            $this->mysqli->rollback();
            sendResponse('error', $error->getMessage(), null, $error->getCode() ?: 400);
        } catch (Throwable $error) {
            $this->mysqli->rollback();
            sendResponse('error', 'Gagal pindah ke subtes berikutnya', ['details' => $error->getMessage()], 500);
        }
    }

    public function saveReviewFlag() {
        $tokenData = verifyToken();
        $data = json_decode(file_get_contents('php://input'), true);

        $attemptId = (int) ($data['attempt_id'] ?? 0);
        $questionId = (int) ($data['question_id'] ?? 0);
        $isMarkedReview = filter_var($data['is_marked_review'] ?? false, FILTER_VALIDATE_BOOLEAN);

        if ($attemptId <= 0 || $questionId <= 0) {
            sendResponse('error', 'Attempt ID dan Question ID harus diisi', null, 400);
        }

        $userId = (int) $tokenData['userId'];
        $this->mysqli->begin_transaction();

        try {
            $attempt = $this->getAttemptForUser($attemptId, $userId, true);
            if (!$attempt) {
                throw new RuntimeException('Attempt tidak ditemukan', 404);
            }

            if (($attempt['status'] ?? '') !== 'ongoing') {
                $existingResult = $this->getExistingResult($attemptId, $userId);
                throw new RuntimeException(
                    $existingResult ? 'Attempt ini sudah selesai.' : 'Attempt ini sudah tidak aktif lagi',
                    409
                );
            }

            $isAdmin = userHasRole($tokenData, $this->mysqli, 'admin');
            $this->assertActiveAccess($userId, (int) $attempt['package_id'], $isAdmin);
            $workflow = TestWorkflow::buildPackageWorkflow($attempt);
            $attemptState = TestWorkflow::computeAttemptState($attempt, $workflow);

            if (!empty($attemptState['is_expired'])) {
                $this->mysqli->rollback();
                $completion = $this->finalizeAttempt($attemptId, $userId, [], $isAdmin);
                sendResponse('error', 'Waktu ujian sudah habis. Attempt ditutup otomatis.', [
                    'attempt_completed' => true,
                    'attempt_id' => $attemptId,
                    'result' => $completion['result'],
                ], 409);
            }

            $question = $this->getQuestion((int) $attempt['package_id'], $questionId);
            if (!$question) {
                throw new RuntimeException('Soal tidak ditemukan pada paket ini', 404);
            }

            $this->assertQuestionAccessible($workflow, $attemptState, $question);
            if ($isMarkedReview && !$this->hasAnsweredQuestion($attemptId, $questionId)) {
                throw new RuntimeException('Jawab soal ini dulu sebelum menandai ragu-ragu.', 422);
            }
            $this->setReviewFlag($attemptId, $questionId, $isMarkedReview);
            $this->mysqli->commit();

            sendResponse('success', 'Status ragu-ragu berhasil disimpan', [
                'attempt_id' => $attemptId,
                'question_id' => $questionId,
                'is_marked_review' => $isMarkedReview,
            ]);
        } catch (RuntimeException $error) {
            $this->mysqli->rollback();
            sendResponse('error', $error->getMessage(), null, $error->getCode() ?: 400);
        } catch (Throwable $error) {
            $this->mysqli->rollback();
            sendResponse('error', 'Gagal menyimpan status ragu-ragu', ['details' => $error->getMessage()], 500);
        }
    }

    public function submitAnswers() {
        $tokenData = verifyToken();
        $data = json_decode(file_get_contents('php://input'), true);

        $attemptId = (int) ($data['attempt_id'] ?? 0);
        $answers = $data['answers'] ?? [];
        $autoSubmit = filter_var($data['auto_submit'] ?? false, FILTER_VALIDATE_BOOLEAN);

        if ($attemptId <= 0) {
            sendResponse('error', 'Attempt ID harus diisi', null, 400);
        }

        if (!is_array($answers)) {
            sendResponse('error', 'Format jawaban tidak valid', null, 422);
        }

        try {
            $userId = (int) $tokenData['userId'];
            $isAdmin = userHasRole($tokenData, $this->mysqli, 'admin');

            if (!$autoSubmit) {
                $attempt = $this->getAttemptForUser($attemptId, $userId);
                if ($attempt && ($attempt['status'] ?? '') === 'ongoing') {
                    $workflow = TestWorkflow::buildPackageWorkflow($attempt);
                    $attemptState = TestWorkflow::computeAttemptState($attempt, $workflow);
                    if (empty($attemptState['is_expired'])) {
                        $this->assertNoPendingReviewFlags($attemptId, $workflow, $attemptState, 'menyelesaikan ujian');
                    }
                }
            }

            $completion = $this->finalizeAttempt(
                $attemptId,
                $userId,
                $answers,
                $isAdmin
            );
            $emailDelivery = $completion['email_delivery'];

            if ($completion['already_completed']) {
                sendResponse('success', 'Attempt ini sudah selesai sebelumnya.', [
                    'attempt_id' => $attemptId,
                    'result' => $completion['result'],
                    'already_completed' => true,
                    'email_delivery' => $emailDelivery,
                ]);
            }

            $responseMessage = $emailDelivery && !empty($emailDelivery['success'])
                ? 'Jawaban berhasil disimpan dan hasil tryout telah dikirim ke email.'
                : 'Jawaban berhasil disimpan, tetapi email hasil tryout belum berhasil dikirim.';

            sendResponse('success', $responseMessage, [
                'attempt_id' => $attemptId,
                'result' => $completion['result'],
                'already_completed' => false,
                'email_delivery' => $emailDelivery,
            ]);
        } catch (RuntimeException $error) {
            sendResponse('error', $error->getMessage(), null, $error->getCode() ?: 400);
        } catch (Throwable $error) {
            sendResponse('error', 'Gagal menyimpan jawaban test', ['details' => $error->getMessage()], 500);
        }
    }

    public function getResults() {
        $tokenData = verifyToken();
        $attemptId = (int) ($_GET['attempt_id'] ?? 0);
        $userId = (int) ($tokenData['userId'] ?? 0);

        if ($attemptId <= 0) {
            sendResponse('error', 'Attempt ID harus diisi', null, 400);
        }

        $attempt = $this->getAttemptForUser($attemptId, $userId);
        if (!$attempt) {
            sendResponse('error', 'Attempt tidak ditemukan', null, 404);
        }

        $result = $this->getExistingResult($attemptId, $userId);
        if (!$result) {
            sendResponse('error', 'Hasil test tidak ditemukan', null, 404);
        }

        sendResponse('success', 'Hasil test berhasil diambil', [
            ...$result,
            'review_items' => $this->getResultReviewItems($attemptId, $attempt),
        ]);
    }

    public function resendResultEmail() {
        $tokenData = verifyToken();
        $data = json_decode(file_get_contents('php://input'), true);
        $attemptId = (int) ($data['attempt_id'] ?? 0);
        $userId = (int) ($tokenData['userId'] ?? 0);

        if ($attemptId <= 0) {
            sendResponse('error', 'Attempt ID harus diisi', null, 400);
        }

        $attempt = $this->getAttemptForUser($attemptId, $userId);
        if (!$attempt) {
            sendResponse('error', 'Attempt tidak ditemukan', null, 404);
        }

        $result = $this->getExistingResult($attemptId, $userId);
        if (!$result) {
            sendResponse('error', 'Hasil test tidak ditemukan', null, 404);
        }

        $emailDelivery = $this->sendTryoutResultNotification($attemptId);
        if (!empty($emailDelivery['success'])) {
            sendResponse('success', 'Hasil tryout berhasil dikirim ulang ke email Anda.', [
                'attempt_id' => $attemptId,
                'email_delivery' => $emailDelivery,
            ]);
        }

        sendResponse('error', $emailDelivery['message'] ?? 'Email hasil tryout belum berhasil dikirim ulang.', [
            'attempt_id' => $attemptId,
            'email_delivery' => $emailDelivery,
        ], 502);
    }
}

$requestMethod = $_SERVER['REQUEST_METHOD'];
$requestPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

$controller = new TestController($mysqli);

if (strpos($requestPath, '/api/test/check-access') !== false && $requestMethod === 'GET') {
    $controller->checkAccess();
} elseif (strpos($requestPath, '/api/test/start') !== false && $requestMethod === 'POST') {
    $controller->startAttempt();
} elseif (strpos($requestPath, '/api/test/save-answer') !== false && $requestMethod === 'POST') {
    $controller->saveAnswer();
} elseif (strpos($requestPath, '/api/test/review-flag') !== false && $requestMethod === 'POST') {
    $controller->saveReviewFlag();
} elseif (strpos($requestPath, '/api/test/advance-section') !== false && $requestMethod === 'POST') {
    $controller->advanceSection();
} elseif (strpos($requestPath, '/api/test/submit') !== false && $requestMethod === 'POST') {
    $controller->submitAnswers();
} elseif (strpos($requestPath, '/api/test/results') !== false && $requestMethod === 'GET') {
    $controller->getResults();
} elseif (strpos($requestPath, '/api/test/resend-result-email') !== false && $requestMethod === 'POST') {
    $controller->resendResultEmail();
} else {
    sendResponse('error', 'Endpoint tidak ditemukan', null, 404);
}
