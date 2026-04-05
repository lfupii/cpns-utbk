<?php
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../utils/JWTHandler.php';
require_once __DIR__ . '/../utils/UserNotificationService.php';
require_once __DIR__ . '/../middleware/Response.php';

// AuthController untuk login dan register
class AuthController {
    private $mysqli;

    public function __construct($mysqli) {
        $this->mysqli = $mysqli;
    }

    private function normalizeEmail(string $email): string {
        return strtolower(trim($email));
    }

    private function buildVerificationExpiryAt(): string {
        return date('Y-m-d H:i:s', time() + (EMAIL_VERIFICATION_EXPIRY_HOURS * 3600));
    }

    private function persistVerificationToken(int $userId): string {
        $token = UserNotificationService::generateVerificationToken();
        $expiresAt = $this->buildVerificationExpiryAt();

        $query = "UPDATE users
                  SET email_verification_token = ?,
                      email_verification_sent_at = NOW(),
                      email_verification_expires_at = ?
                  WHERE id = ?";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('ssi', $token, $expiresAt, $userId);
        $stmt->execute();

        return $token;
    }

    private function renderVerificationPage(string $title, string $message, bool $success): void {
        http_response_code($success ? 200 : 400);
        header('Content-Type: text/html; charset=UTF-8');

        $safeTitle = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
        $safeMessage = nl2br(htmlspecialchars($message, ENT_QUOTES, 'UTF-8'));
        $accent = $success ? '#0f766e' : '#b91c1c';
        $buttonColor = $success ? '#0d9488' : '#dc2626';
        $homeUrl = htmlspecialchars(rtrim(FRONTEND_URL, '/'), ENT_QUOTES, 'UTF-8');

        echo '<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>' . $safeTitle . '</title>
</head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 18px 48px rgba(15,23,42,0.08);">
        <div style="padding:28px 24px;background:' . $accent . ';color:#ffffff;">
            <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;">TO CPNS UTBK</div>
            <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;">' . $safeTitle . '</h1>
        </div>
        <div style="padding:28px 24px;font-size:15px;line-height:1.7;">
            <p>' . $safeMessage . '</p>
            <p style="margin:24px 0 0;">
                <a href="' . $homeUrl . '" style="display:inline-block;background:' . $buttonColor . ';color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">Kembali ke TO CPNS UTBK</a>
            </p>
        </div>
    </div>
</body>
</html>';
        exit();
    }

    public function register() {
        $data = json_decode(file_get_contents('php://input'), true);

        if (!isset($data['email']) || !isset($data['password']) || !isset($data['full_name'])) {
            sendResponse('error', 'Email, password, dan full_name harus diisi', null, 400);
        }

        $email = $this->normalizeEmail((string) $data['email']);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            sendResponse('error', 'Format email tidak valid', null, 422);
        }

        $password = password_hash($data['password'], PASSWORD_BCRYPT);
        $full_name = trim((string) $data['full_name']);
        $phone = $data['phone'] ?? null;
        $birth_date = $data['birth_date'] ?? null;

        // Check if email already exists
        $checkQuery = "SELECT id, email_verified_at FROM users WHERE email = ?";
        $stmt = $this->mysqli->prepare($checkQuery);
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $existingUser = $stmt->get_result()->fetch_assoc();

        if ($existingUser) {
            if (empty($existingUser['email_verified_at'])) {
                sendResponse('error', 'Email sudah terdaftar tetapi belum diverifikasi. Silakan kirim ulang email verifikasi.', [
                    'email' => $email,
                    'requires_email_verification' => true,
                ], 409);
            }

            sendResponse('error', 'Email sudah terdaftar', null, 409);
        }

        // Insert new user
        $role = 'user';
        $verificationToken = UserNotificationService::generateVerificationToken();
        $verificationExpiresAt = $this->buildVerificationExpiryAt();
        $query = "INSERT INTO users (
                    email,
                    password,
                    full_name,
                    role,
                    phone,
                    birth_date,
                    email_verification_token,
                    email_verification_sent_at,
                    email_verification_expires_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('ssssssss', $email, $password, $full_name, $role, $phone, $birth_date, $verificationToken, $verificationExpiresAt);

        if ($stmt->execute()) {
            $userId = $stmt->insert_id;
            try {
                $delivery = UserNotificationService::sendVerificationEmail([
                    'email' => $email,
                    'full_name' => $full_name,
                ], $verificationToken);
            } catch (Throwable $error) {
                error_log('Verification email send failed: ' . $error->getMessage());
                $delivery = [
                    'success' => false,
                    'transport' => 'exception',
                    'message' => 'Registrasi berhasil, tetapi email verifikasi belum berhasil dikirim.',
                ];
            }

            $message = $delivery['success']
                ? 'Registrasi berhasil. Silakan cek email untuk verifikasi akun.'
                : 'Registrasi berhasil, tetapi email verifikasi belum berhasil dikirim. Silakan gunakan kirim ulang verifikasi.';

            sendResponse('success', $message, [
                'userId' => $userId,
                'email' => $email,
                'full_name' => $full_name,
                'role' => $role,
                'email_verified' => false,
                'requires_email_verification' => true,
                'email_delivery' => $delivery,
            ], 201);
        } else {
            sendResponse('error', 'Gagal melakukan registrasi', null, 500);
        }
    }

    public function login() {
        $data = json_decode(file_get_contents('php://input'), true);

        if (!isset($data['email']) || !isset($data['password'])) {
            sendResponse('error', 'Email dan password harus diisi', null, 400);
        }

        $email = $this->normalizeEmail((string) $data['email']);
        $password = $data['password'];

        $query = "SELECT id, password, full_name, role, email_verified_at FROM users WHERE email = ?";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result->num_rows === 0) {
            sendResponse('error', 'Email atau password salah', null, 401);
        }

        $user = $result->fetch_assoc();

        if (!password_verify($password, $user['password'])) {
            sendResponse('error', 'Email atau password salah', null, 401);
        }

        if (empty($user['email_verified_at'])) {
            sendResponse('error', 'Email belum diverifikasi. Silakan cek inbox email Anda terlebih dahulu.', [
                'email' => $email,
                'requires_email_verification' => true,
            ], 403);
        }

        $token = JWTHandler::generateToken($user['id'], $user['role'] ?? 'user');
        sendResponse('success', 'Login berhasil', [
            'userId' => $user['id'],
            'email' => $email,
            'full_name' => $user['full_name'],
            'role' => $user['role'] ?? 'user',
            'email_verified' => true,
            'token' => $token
        ]);
    }

    public function getProfile() {
        $tokenData = verifyToken();
        
        $query = "SELECT id, email, full_name, role, phone, birth_date, email_verified_at, created_at FROM users WHERE id = ?";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('i', $tokenData['userId']);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result->num_rows === 0) {
            sendResponse('error', 'User tidak ditemukan', null, 404);
        }

        $user = $result->fetch_assoc();
        $user['email_verified'] = !empty($user['email_verified_at']);
        sendResponse('success', 'Data profil berhasil diambil', $user);
    }

    public function resendVerificationEmail() {
        $data = json_decode(file_get_contents('php://input'), true);

        if (!isset($data['email'])) {
            sendResponse('error', 'Email harus diisi', null, 400);
        }

        $email = $this->normalizeEmail((string) $data['email']);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            sendResponse('error', 'Format email tidak valid', null, 422);
        }

        $query = "SELECT id, email, full_name, email_verified_at FROM users WHERE email = ?";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $user = $stmt->get_result()->fetch_assoc();

        if (!$user) {
            sendResponse('error', 'Email belum terdaftar', null, 404);
        }

        if (!empty($user['email_verified_at'])) {
            sendResponse('success', 'Email sudah terverifikasi. Silakan langsung login.', [
                'email' => $email,
                'email_verified' => true,
            ]);
        }

        $token = $this->persistVerificationToken((int) $user['id']);
        try {
            $delivery = UserNotificationService::sendVerificationEmail($user, $token);
        } catch (Throwable $error) {
            error_log('Verification resend failed: ' . $error->getMessage());
            $delivery = [
                'success' => false,
                'transport' => 'exception',
                'message' => 'Akun ditemukan, tetapi email verifikasi belum berhasil dikirim.',
            ];
        }

        if (!$delivery['success']) {
            sendResponse('error', 'Akun ditemukan, tetapi email verifikasi belum berhasil dikirim.', [
                'email' => $email,
                'email_verified' => false,
                'email_delivery' => $delivery,
            ], 500);
        }

        sendResponse('success', 'Email verifikasi berhasil dikirim ulang.', [
            'email' => $email,
            'email_verified' => false,
            'email_delivery' => $delivery,
        ]);
    }

    public function verifyEmail() {
        $token = trim((string) ($_GET['token'] ?? ''));

        if ($token === '') {
            $this->renderVerificationPage(
                'Verifikasi gagal',
                'Token verifikasi tidak ditemukan. Silakan minta kirim ulang email verifikasi dari halaman login atau pendaftaran.',
                false
            );
        }

        $query = "SELECT id, full_name, email_verified_at, email_verification_expires_at
                  FROM users
                  WHERE email_verification_token = ?
                  LIMIT 1";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('s', $token);
        $stmt->execute();
        $user = $stmt->get_result()->fetch_assoc();

        if (!$user) {
            $this->renderVerificationPage(
                'Link tidak valid',
                'Link verifikasi tidak valid atau sudah pernah digunakan. Silakan minta kirim ulang email verifikasi.',
                false
            );
        }

        if (!empty($user['email_verified_at'])) {
            $this->renderVerificationPage(
                'Email sudah aktif',
                'Email ini sebenarnya sudah terverifikasi. Kamu bisa langsung login dan melanjutkan tryout.',
                true
            );
        }

        if (!empty($user['email_verification_expires_at']) && strtotime($user['email_verification_expires_at']) < time()) {
            $this->renderVerificationPage(
                'Link kedaluwarsa',
                'Masa berlaku link verifikasi sudah habis. Silakan minta kirim ulang email verifikasi agar mendapatkan link baru.',
                false
            );
        }

        $updateQuery = "UPDATE users
                        SET email_verified_at = NOW(),
                            email_verification_token = NULL,
                            email_verification_sent_at = NULL,
                            email_verification_expires_at = NULL
                        WHERE id = ?";
        $stmt = $this->mysqli->prepare($updateQuery);
        $stmt->bind_param('i', $user['id']);
        $stmt->execute();

        $this->renderVerificationPage(
            'Email berhasil diverifikasi',
            'Akunmu sekarang sudah aktif. Terima kasih sudah bergabung di TO CPNS UTBK. Semoga setiap latihanmu dilancarkan dan membawamu makin dekat ke target UTBK atau CPNS yang kamu perjuangkan.',
            true
        );
    }

    public function updateProfile() {
        $tokenData = verifyToken();
        $data = json_decode(file_get_contents('php://input'), true);

        $userId = $tokenData['userId'];
        $full_name = $data['full_name'] ?? null;
        $phone = $data['phone'] ?? null;
        $birth_date = $data['birth_date'] ?? null;

        $query = "UPDATE users SET full_name = COALESCE(?, full_name), phone = COALESCE(?, phone), birth_date = COALESCE(?, birth_date) WHERE id = ?";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('sssi', $full_name, $phone, $birth_date, $userId);

        if ($stmt->execute()) {
            sendResponse('success', 'Profil berhasil diperbarui');
        } else {
            sendResponse('error', 'Gagal memperbarui profil', null, 500);
        }
    }

    public function getActivePackages() {
        $tokenData = verifyToken();
        $userId = (int) $tokenData['userId'];

        $query = "SELECT
                    ua.id AS access_id,
                    ua.access_status,
                    ua.access_expires_at,
                    ua.created_at AS purchased_at,
                    tp.id AS package_id,
                    tp.name AS package_name,
                    tp.description,
                    tp.price,
                    tp.duration_days,
                    tp.max_attempts,
                    tp.question_count,
                    tp.time_limit,
                    tc.name AS category_name,
                    COALESCE(stats.completed_attempts, 0) AS completed_attempts,
                    COALESCE(stats.ongoing_attempts, 0) AS ongoing_attempts
                  FROM user_access ua
                  JOIN test_packages tp ON tp.id = ua.package_id
                  JOIN test_categories tc ON tc.id = tp.category_id
                  LEFT JOIN (
                    SELECT
                      user_id,
                      package_id,
                      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_attempts,
                      SUM(CASE WHEN status = 'ongoing' THEN 1 ELSE 0 END) AS ongoing_attempts
                    FROM test_attempts
                    WHERE user_id = ?
                    GROUP BY user_id, package_id
                  ) stats ON stats.user_id = ua.user_id AND stats.package_id = ua.package_id
                  WHERE ua.user_id = ?
                    AND ua.access_status = 'active'
                    AND (ua.access_expires_at IS NULL OR ua.access_expires_at > NOW())
                  ORDER BY ua.created_at DESC";

        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('ii', $userId, $userId);
        $stmt->execute();
        $result = $stmt->get_result();

        $packages = [];
        while ($row = $result->fetch_assoc()) {
            $completedAttempts = (int) $row['completed_attempts'];
            $remainingAttempts = max(0, (int) $row['max_attempts'] - $completedAttempts);

            $row['completed_attempts'] = $completedAttempts;
            $row['ongoing_attempts'] = (int) $row['ongoing_attempts'];
            $row['remaining_attempts'] = $remainingAttempts;
            $row['is_unused'] = $completedAttempts === 0;
            $row['can_start_test'] = $remainingAttempts > 0;

            $packages[] = $row;
        }

        sendResponse('success', 'Paket aktif berhasil diambil', $packages);
    }

    public function getTestHistory() {
        $tokenData = verifyToken();
        $userId = (int) $tokenData['userId'];

        $query = "SELECT
                    ta.id AS attempt_id,
                    ta.package_id,
                    ta.start_time,
                    ta.end_time,
                    ta.status,
                    tp.name AS package_name,
                    tp.question_count,
                    tp.time_limit,
                    tc.name AS category_name,
                    tr.id AS result_id,
                    tr.total_questions,
                    tr.correct_answers,
                    tr.score,
                    tr.percentage,
                    tr.created_at AS result_created_at
                  FROM test_attempts ta
                  JOIN test_packages tp ON tp.id = ta.package_id
                  JOIN test_categories tc ON tc.id = tp.category_id
                  LEFT JOIN test_results tr ON tr.attempt_id = ta.id
                  WHERE ta.user_id = ?
                    AND ta.status = 'completed'
                  ORDER BY COALESCE(ta.end_time, ta.created_at) DESC, ta.id DESC";

        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('i', $userId);
        $stmt->execute();
        $result = $stmt->get_result();

        $history = [];
        while ($row = $result->fetch_assoc()) {
            $history[] = $row;
        }

        sendResponse('success', 'Riwayat test berhasil diambil', $history);
    }
}

// Router
$requestMethod = $_SERVER['REQUEST_METHOD'];
$requestPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

$controller = new AuthController($mysqli);

if (strpos($requestPath, '/api/auth/register') !== false && $requestMethod === 'POST') {
    $controller->register();
} elseif (strpos($requestPath, '/api/auth/verify-email') !== false && $requestMethod === 'GET') {
    $controller->verifyEmail();
} elseif (strpos($requestPath, '/api/auth/resend-verification') !== false && $requestMethod === 'POST') {
    $controller->resendVerificationEmail();
} elseif (strpos($requestPath, '/api/auth/login') !== false && $requestMethod === 'POST') {
    $controller->login();
} elseif (strpos($requestPath, '/api/auth/active-packages') !== false && $requestMethod === 'GET') {
    $controller->getActivePackages();
} elseif (strpos($requestPath, '/api/auth/test-history') !== false && $requestMethod === 'GET') {
    $controller->getTestHistory();
} elseif (strpos($requestPath, '/api/auth/profile') !== false && $requestMethod === 'GET') {
    $controller->getProfile();
} elseif (strpos($requestPath, '/api/auth/profile') !== false && $requestMethod === 'PUT') {
    $controller->updateProfile();
} else {
    sendResponse('error', 'Endpoint tidak ditemukan', null, 404);
}
