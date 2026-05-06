<?php
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../middleware/Response.php';

class ReportController {
    private const REPORT_MEDIA_UPLOAD_DIR = __DIR__ . '/../uploads/question-reports';
    private const REPORT_MEDIA_MAX_SIZE = 5242880;
    private const ALLOWED_ASSESSMENT_TYPES = ['tryout', 'mini_test'];
    private const ALLOWED_TARGET_TYPES = ['question', 'explanation'];
    private const ALLOWED_STATUS_TYPES = ['open', 'reviewed', 'resolved'];
    private const ALLOWED_ORIGIN_CONTEXTS = ['tryout_active', 'mini_test_active', 'tryout_review', 'mini_test_review'];

    private mysqli $mysqli;

    public function __construct(mysqli $mysqli) {
        $this->mysqli = $mysqli;
    }

    private function buildPublicMediaUrl(string $relativePath): string {
        $baseUrl = rtrim((string) API_URL, '/');
        $normalizedPath = ltrim(str_replace(DIRECTORY_SEPARATOR, '/', $relativePath), '/');

        return $baseUrl . '/' . $normalizedPath;
    }

    private function ensureReportMediaDirectory(string $directory): void {
        if (is_dir($directory)) {
            return;
        }

        if (!mkdir($directory, 0775, true) && !is_dir($directory)) {
            throw new RuntimeException('Folder upload laporan tidak dapat dibuat', 500);
        }
    }

    private function storeUploadedImage(array $file, string $context = 'question-report'): array {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw new RuntimeException('Upload gambar gagal diproses', 422);
        }

        $size = (int) ($file['size'] ?? 0);
        if ($size <= 0 || $size > self::REPORT_MEDIA_MAX_SIZE) {
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

        $contextSlug = preg_replace('/[^a-z0-9_-]+/i', '-', strtolower(trim($context))) ?: 'question-report';
        $dateSegment = date('Y/m');
        $targetDirectory = self::REPORT_MEDIA_UPLOAD_DIR . '/' . $contextSlug . '/' . $dateSegment;
        $this->ensureReportMediaDirectory($targetDirectory);

        $fileName = bin2hex(random_bytes(16)) . '.' . $allowedMimeTypes[$mimeType];
        $targetPath = $targetDirectory . '/' . $fileName;
        if (!move_uploaded_file($tmpName, $targetPath)) {
            throw new RuntimeException('Gagal menyimpan gambar ke server', 500);
        }

        $relativePath = 'uploads/question-reports/' . $contextSlug . '/' . $dateSegment . '/' . $fileName;

        return [
            'url' => $this->buildPublicMediaUrl($relativePath),
            'path' => $relativePath,
            'mime_type' => $mimeType,
            'size' => $size,
        ];
    }

    private function bindDynamicParams(mysqli_stmt $stmt, string $types, array $values): void {
        if ($types === '' || count($values) === 0) {
            return;
        }

        $references = [];
        foreach ($values as $index => $value) {
            $references[$index] = &$values[$index];
        }

        array_unshift($references, $types);
        call_user_func_array([$stmt, 'bind_param'], $references);
    }

    private function getTryoutAttemptForUser(int $userId, int $attemptId): ?array {
        $query = "SELECT id, package_id, status
                  FROM test_attempts
                  WHERE id = ? AND user_id = ?
                  LIMIT 1";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('ii', $attemptId, $userId);
        $stmt->execute();
        $attempt = $stmt->get_result()->fetch_assoc();

        return $attempt ?: null;
    }

    private function getMiniTestAttemptForUser(int $userId, int $attemptId): ?array {
        $query = "SELECT id, package_id, section_code, status
                  FROM learning_section_test_attempts
                  WHERE id = ? AND user_id = ?
                  LIMIT 1";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('ii', $attemptId, $userId);
        $stmt->execute();
        $attempt = $stmt->get_result()->fetch_assoc();

        return $attempt ?: null;
    }

    private function getTryoutQuestion(int $packageId, int $questionId): ?array {
        $query = "SELECT id, question_text, question_image_url, explanation_notes, section_code, section_name
                  FROM questions
                  WHERE id = ? AND package_id = ?
                  LIMIT 1";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('ii', $questionId, $packageId);
        $stmt->execute();
        $question = $stmt->get_result()->fetch_assoc();

        return $question ?: null;
    }

    private function getMiniTestQuestion(int $packageId, string $sectionCode, int $questionId): ?array {
        $query = "SELECT id, question_text, question_image_url, explanation_notes, section_code
                  FROM learning_section_questions
                  WHERE id = ? AND package_id = ? AND section_code = ?
                  LIMIT 1";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('iis', $questionId, $packageId, $sectionCode);
        $stmt->execute();
        $question = $stmt->get_result()->fetch_assoc();

        return $question ?: null;
    }

    private function normalizeAssessmentType(string $value): string {
        $normalized = strtolower(trim($value));
        if (!in_array($normalized, self::ALLOWED_ASSESSMENT_TYPES, true)) {
            throw new RuntimeException('Jenis laporan soal tidak valid', 422);
        }

        return $normalized;
    }

    private function normalizeTargetType(string $value): string {
        $normalized = strtolower(trim($value));
        if (!in_array($normalized, self::ALLOWED_TARGET_TYPES, true)) {
            throw new RuntimeException('Target laporan tidak valid', 422);
        }

        return $normalized;
    }

    private function normalizeStatusType(string $value): string {
        $normalized = strtolower(trim($value));
        if (!in_array($normalized, self::ALLOWED_STATUS_TYPES, true)) {
            throw new RuntimeException('Status laporan tidak valid', 422);
        }

        return $normalized;
    }

    private function normalizeOriginContext(string $value): string {
        $normalized = strtolower(trim($value));
        if (!in_array($normalized, self::ALLOWED_ORIGIN_CONTEXTS, true)) {
            return 'tryout_active';
        }

        return $normalized;
    }

    private function getStatusSummary(?int $packageId = null, string $assessmentType = 'all'): array {
        $conditions = [];
        $types = '';
        $values = [];

        if ($packageId !== null && $packageId > 0) {
            $conditions[] = 'package_id = ?';
            $types .= 'i';
            $values[] = $packageId;
        }

        if (in_array($assessmentType, self::ALLOWED_ASSESSMENT_TYPES, true)) {
            $conditions[] = 'assessment_type = ?';
            $types .= 's';
            $values[] = $assessmentType;
        }

        $whereSql = count($conditions) > 0 ? 'WHERE ' . implode(' AND ', $conditions) : '';
        $query = "SELECT status, COUNT(*) AS total
                  FROM question_reports
                  {$whereSql}
                  GROUP BY status";
        $stmt = $this->mysqli->prepare($query);
        $this->bindDynamicParams($stmt, $types, $values);
        $stmt->execute();
        $result = $stmt->get_result();

        $summary = [
            'all' => 0,
            'open' => 0,
            'reviewed' => 0,
            'resolved' => 0,
        ];

        while ($row = $result->fetch_assoc()) {
            $status = (string) ($row['status'] ?? 'open');
            $count = (int) ($row['total'] ?? 0);
            $summary['all'] += $count;
            if (isset($summary[$status])) {
                $summary[$status] = $count;
            }
        }

        return $summary;
    }

    public function uploadMedia(): void {
        verifyToken();

        try {
            if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
                throw new RuntimeException('File gambar wajib dipilih', 422);
            }

            $context = trim((string) ($_POST['context'] ?? 'question-report'));
            $uploaded = $this->storeUploadedImage($_FILES['file'], $context);

            sendResponse('success', 'Lampiran laporan berhasil diupload', $uploaded, 201);
        } catch (RuntimeException $error) {
            sendResponse('error', $error->getMessage(), null, $error->getCode() ?: 422);
        } catch (Throwable $error) {
            sendResponse('error', 'Gagal mengupload lampiran laporan', ['details' => $error->getMessage()], 500);
        }
    }

    public function submitQuestionReport(): void {
        $tokenData = verifyToken();
        $userId = (int) ($tokenData['userId'] ?? 0);
        $data = json_decode(file_get_contents('php://input'), true);

        try {
            $assessmentType = $this->normalizeAssessmentType((string) ($data['assessment_type'] ?? ''));
            $targetType = $this->normalizeTargetType((string) ($data['target_type'] ?? ''));
            $originContext = $this->normalizeOriginContext((string) ($data['origin_context'] ?? ''));
            $questionId = (int) ($data['question_id'] ?? 0);
            $message = trim((string) ($data['message'] ?? ''));
            $imageUrl = trim((string) ($data['image_url'] ?? ''));
            $imagePath = trim((string) ($data['image_path'] ?? ''));
            $questionNumber = (int) ($data['question_number'] ?? 0);
            $sectionLabel = trim((string) ($data['section_label'] ?? ''));

            if ($questionId <= 0) {
                throw new RuntimeException('Soal yang dilaporkan tidak valid', 422);
            }

            if ($message === '' && $imageUrl === '') {
                throw new RuntimeException('Tulis catatan atau lampirkan gambar untuk laporan ini', 422);
            }

            $packageId = 0;
            $tryoutAttemptId = null;
            $sectionTestAttemptId = null;
            $sectionCode = null;
            $reportedContentSnapshot = '';

            if ($assessmentType === 'tryout') {
                $tryoutAttemptId = (int) ($data['attempt_id'] ?? 0);
                if ($tryoutAttemptId <= 0) {
                    throw new RuntimeException('Attempt tryout tidak ditemukan untuk laporan ini', 422);
                }

                $attempt = $this->getTryoutAttemptForUser($userId, $tryoutAttemptId);
                if (!$attempt) {
                    throw new RuntimeException('Attempt tryout tidak valid untuk akun ini', 403);
                }

                $packageId = (int) ($attempt['package_id'] ?? 0);
                $question = $this->getTryoutQuestion($packageId, $questionId);
                if (!$question) {
                    throw new RuntimeException('Soal tryout yang dilaporkan tidak ditemukan', 404);
                }

                $sectionCode = trim((string) ($question['section_code'] ?? '')) ?: null;
                $sectionLabel = $sectionLabel !== '' ? $sectionLabel : trim((string) ($question['section_name'] ?? ''));
                $reportedContentSnapshot = $targetType === 'explanation'
                    ? trim((string) ($question['explanation_notes'] ?? ''))
                    : trim((string) ($question['question_text'] ?? ''));
            } else {
                $sectionTestAttemptId = (int) ($data['section_test_attempt_id'] ?? 0);
                if ($sectionTestAttemptId <= 0) {
                    throw new RuntimeException('Attempt mini test tidak ditemukan untuk laporan ini', 422);
                }

                $attempt = $this->getMiniTestAttemptForUser($userId, $sectionTestAttemptId);
                if (!$attempt) {
                    throw new RuntimeException('Attempt mini test tidak valid untuk akun ini', 403);
                }

                $packageId = (int) ($attempt['package_id'] ?? 0);
                $sectionCode = trim((string) ($data['section_code'] ?? ''));
                if ($sectionCode === '') {
                    $sectionCode = trim((string) ($attempt['section_code'] ?? ''));
                }
                if ($sectionCode === '') {
                    throw new RuntimeException('Section mini test tidak valid untuk laporan ini', 422);
                }

                $question = $this->getMiniTestQuestion($packageId, $sectionCode, $questionId);
                if (!$question) {
                    throw new RuntimeException('Soal mini test yang dilaporkan tidak ditemukan', 404);
                }

                $reportedContentSnapshot = $targetType === 'explanation'
                    ? trim((string) ($question['explanation_notes'] ?? ''))
                    : trim((string) ($question['question_text'] ?? ''));
            }

            $insertQuery = "INSERT INTO question_reports (
                                user_id,
                                package_id,
                                tryout_attempt_id,
                                section_test_attempt_id,
                                assessment_type,
                                target_type,
                                origin_context,
                                question_id,
                                question_number,
                                section_code,
                                section_label,
                                reported_content_snapshot,
                                message,
                                image_url,
                                image_path,
                                status,
                                admin_note
                            ) VALUES (
                                ?,
                                ?,
                                NULLIF(?, 0),
                                NULLIF(?, 0),
                                ?,
                                ?,
                                ?,
                                ?,
                                NULLIF(?, 0),
                                NULLIF(?, ''),
                                NULLIF(?, ''),
                                ?,
                                NULLIF(?, ''),
                                NULLIF(?, ''),
                                NULLIF(?, ''),
                                'open',
                                NULL
                            )";
            $stmt = $this->mysqli->prepare($insertQuery);
            $stmt->bind_param(
                'iiiisssiissssss',
                $userId,
                $packageId,
                $tryoutAttemptId,
                $sectionTestAttemptId,
                $assessmentType,
                $targetType,
                $originContext,
                $questionId,
                $questionNumber,
                $sectionCode,
                $sectionLabel,
                $reportedContentSnapshot,
                $message,
                $imageUrl,
                $imagePath
            );
            $stmt->execute();

            sendResponse('success', 'Laporan berhasil dikirim ke admin', [
                'report_id' => (int) $this->mysqli->insert_id,
                'assessment_type' => $assessmentType,
                'target_type' => $targetType,
                'status' => 'open',
            ], 201);
        } catch (RuntimeException $error) {
            sendResponse('error', $error->getMessage(), null, $error->getCode() ?: 422);
        } catch (Throwable $error) {
            sendResponse('error', 'Gagal mengirim laporan soal', ['details' => $error->getMessage()], 500);
        }
    }

    public function getAdminReports(): void {
        verifyAdmin();

        try {
            $packageId = (int) ($_GET['package_id'] ?? 0);
            $statusFilter = strtolower(trim((string) ($_GET['status'] ?? 'open')));
            $assessmentType = strtolower(trim((string) ($_GET['assessment_type'] ?? 'all')));
            $limit = max(10, min(200, (int) ($_GET['limit'] ?? 100)));

            if ($statusFilter !== 'all' && !in_array($statusFilter, self::ALLOWED_STATUS_TYPES, true)) {
                throw new RuntimeException('Filter status laporan tidak valid', 422);
            }

            if ($assessmentType !== 'all' && !in_array($assessmentType, self::ALLOWED_ASSESSMENT_TYPES, true)) {
                throw new RuntimeException('Filter jenis assessment tidak valid', 422);
            }

            $conditions = [];
            $types = '';
            $values = [];

            if ($packageId > 0) {
                $conditions[] = 'qr.package_id = ?';
                $types .= 'i';
                $values[] = $packageId;
            }

            if ($statusFilter !== 'all') {
                $conditions[] = 'qr.status = ?';
                $types .= 's';
                $values[] = $statusFilter;
            }

            if ($assessmentType !== 'all') {
                $conditions[] = 'qr.assessment_type = ?';
                $types .= 's';
                $values[] = $assessmentType;
            }

            $whereSql = count($conditions) > 0 ? 'WHERE ' . implode(' AND ', $conditions) : '';

            $query = "SELECT qr.*,
                             u.full_name,
                             u.email,
                             tp.name AS package_name,
                             tc.name AS category_name,
                             q.question_text AS tryout_question_text,
                             q.question_image_url AS tryout_question_image_url,
                             q.explanation_notes AS tryout_explanation_notes,
                             q.section_name AS tryout_section_name,
                             lq.question_text AS mini_question_text,
                             lq.question_image_url AS mini_question_image_url,
                             lq.explanation_notes AS mini_explanation_notes
                      FROM question_reports qr
                      JOIN users u ON u.id = qr.user_id
                      JOIN test_packages tp ON tp.id = qr.package_id
                      LEFT JOIN test_categories tc ON tc.id = tp.category_id
                      LEFT JOIN questions q ON qr.assessment_type = 'tryout' AND q.id = qr.question_id
                      LEFT JOIN learning_section_questions lq ON qr.assessment_type = 'mini_test' AND lq.id = qr.question_id
                      {$whereSql}
                      ORDER BY qr.created_at DESC
                      LIMIT ?";
            $stmt = $this->mysqli->prepare($query);
            $queryTypes = $types . 'i';
            $queryValues = [...$values, $limit];
            $this->bindDynamicParams($stmt, $queryTypes, $queryValues);
            $stmt->execute();
            $result = $stmt->get_result();

            $items = [];
            while ($row = $result->fetch_assoc()) {
                $isTryout = ($row['assessment_type'] ?? '') === 'tryout';
                $currentQuestionText = $isTryout
                    ? (string) ($row['tryout_question_text'] ?? '')
                    : (string) ($row['mini_question_text'] ?? '');
                $currentQuestionImageUrl = $isTryout
                    ? (($row['tryout_question_image_url'] ?? null) ?: null)
                    : (($row['mini_question_image_url'] ?? null) ?: null);
                $currentExplanationNotes = $isTryout
                    ? trim((string) ($row['tryout_explanation_notes'] ?? ''))
                    : trim((string) ($row['mini_explanation_notes'] ?? ''));
                $sectionLabel = trim((string) ($row['section_label'] ?? ''));
                if ($sectionLabel === '' && $isTryout) {
                    $sectionLabel = trim((string) ($row['tryout_section_name'] ?? ''));
                }
                if ($sectionLabel === '') {
                    $sectionLabel = trim((string) ($row['section_code'] ?? ''));
                }

                $items[] = [
                    'id' => (int) ($row['id'] ?? 0),
                    'status' => (string) ($row['status'] ?? 'open'),
                    'assessment_type' => (string) ($row['assessment_type'] ?? 'tryout'),
                    'target_type' => (string) ($row['target_type'] ?? 'question'),
                    'origin_context' => (string) ($row['origin_context'] ?? 'tryout_active'),
                    'package_id' => (int) ($row['package_id'] ?? 0),
                    'package_name' => (string) ($row['package_name'] ?? ''),
                    'category_name' => (string) ($row['category_name'] ?? ''),
                    'question_id' => (int) ($row['question_id'] ?? 0),
                    'question_number' => (int) ($row['question_number'] ?? 0),
                    'section_code' => (string) ($row['section_code'] ?? ''),
                    'section_label' => $sectionLabel,
                    'message' => trim((string) ($row['message'] ?? '')),
                    'image_url' => ($row['image_url'] ?? null) ?: null,
                    'reported_content_snapshot' => trim((string) ($row['reported_content_snapshot'] ?? '')),
                    'current_question_text' => $currentQuestionText,
                    'current_question_image_url' => $currentQuestionImageUrl,
                    'current_explanation_notes' => $currentExplanationNotes,
                    'admin_note' => trim((string) ($row['admin_note'] ?? '')),
                    'tryout_attempt_id' => isset($row['tryout_attempt_id']) ? (int) $row['tryout_attempt_id'] : null,
                    'section_test_attempt_id' => isset($row['section_test_attempt_id']) ? (int) $row['section_test_attempt_id'] : null,
                    'reporter' => [
                        'full_name' => (string) ($row['full_name'] ?? ''),
                        'email' => (string) ($row['email'] ?? ''),
                    ],
                    'created_at' => $row['created_at'] ?? null,
                    'updated_at' => $row['updated_at'] ?? null,
                ];
            }

            sendResponse('success', 'Laporan soal berhasil diambil', [
                'items' => $items,
                'summary' => $this->getStatusSummary($packageId > 0 ? $packageId : null, $assessmentType),
            ]);
        } catch (RuntimeException $error) {
            sendResponse('error', $error->getMessage(), null, $error->getCode() ?: 422);
        } catch (Throwable $error) {
            sendResponse('error', 'Gagal memuat laporan soal', ['details' => $error->getMessage()], 500);
        }
    }

    public function updateAdminReportStatus(): void {
        verifyAdmin();
        $data = json_decode(file_get_contents('php://input'), true);

        try {
            $reportId = (int) ($data['report_id'] ?? 0);
            $status = $this->normalizeStatusType((string) ($data['status'] ?? ''));
            $adminNote = trim((string) ($data['admin_note'] ?? ''));

            if ($reportId <= 0) {
                throw new RuntimeException('Report ID tidak valid', 422);
            }

            $select = $this->mysqli->prepare('SELECT id FROM question_reports WHERE id = ? LIMIT 1');
            $select->bind_param('i', $reportId);
            $select->execute();
            if (!$select->get_result()->fetch_assoc()) {
                throw new RuntimeException('Laporan soal tidak ditemukan', 404);
            }

            $update = $this->mysqli->prepare(
                'UPDATE question_reports
                 SET status = ?, admin_note = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?'
            );
            $update->bind_param('ssi', $status, $adminNote, $reportId);
            $update->execute();

            sendResponse('success', 'Status laporan berhasil diperbarui', [
                'report_id' => $reportId,
                'status' => $status,
                'admin_note' => $adminNote,
            ]);
        } catch (RuntimeException $error) {
            sendResponse('error', $error->getMessage(), null, $error->getCode() ?: 422);
        } catch (Throwable $error) {
            sendResponse('error', 'Gagal memperbarui status laporan', ['details' => $error->getMessage()], 500);
        }
    }
}

$requestMethod = $_SERVER['REQUEST_METHOD'];
$requestPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

$controller = new ReportController($mysqli);

if (strpos($requestPath, '/api/reports/media-upload') !== false && $requestMethod === 'POST') {
    $controller->uploadMedia();
} elseif (strpos($requestPath, '/api/reports/question') !== false && $requestMethod === 'POST') {
    $controller->submitQuestionReport();
} elseif (strpos($requestPath, '/api/reports/admin-list') !== false && $requestMethod === 'GET') {
    $controller->getAdminReports();
} elseif (strpos($requestPath, '/api/reports/admin-status') !== false && $requestMethod === 'PUT') {
    $controller->updateAdminReportStatus();
} else {
    sendResponse('error', 'Endpoint laporan tidak ditemukan', null, 404);
}
