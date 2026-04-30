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

    private function buildGoogleOnlyPassword(string $googleId): string {
        return 'google-auth-only:' . hash('sha256', $googleId);
    }

    private function isGoogleOnlyPassword(?string $password): bool {
        return is_string($password) && strpos($password, 'google-auth-only:') === 0;
    }

    private function issueAuthenticatedSession(array $user, string $message): void {
        $email = $this->normalizeEmail((string) ($user['email'] ?? ''));
        $role = (string) ($user['role'] ?? 'user');
        $token = JWTHandler::generateToken((int) $user['id'], $role);

        sendResponse('success', $message, [
            'userId' => (int) $user['id'],
            'email' => $email,
            'full_name' => $user['full_name'] ?? null,
            'role' => $role,
            'email_verified' => !empty($user['email_verified_at']),
            'token' => $token,
        ]);
    }

    private function findGoogleUserCandidate(string $googleId, string $email): ?array {
        $query = "SELECT id, email, password, full_name, role, email_verified_at, google_id
                  FROM users
                  WHERE google_id = ? OR email = ?
                  ORDER BY CASE WHEN google_id = ? THEN 0 ELSE 1 END
                  LIMIT 1";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('sss', $googleId, $email, $googleId);
        $stmt->execute();
        $user = $stmt->get_result()->fetch_assoc();

        return $user ?: null;
    }

    private function upsertGoogleLinkedUser(array $user, string $googleId, string $email, string $fullName): array {
        if (!empty($user['google_id']) && $user['google_id'] !== $googleId) {
            sendResponse('error', 'Email ini sudah terhubung dengan akun Google lain.', null, 409);
        }

        $resolvedName = trim((string) ($user['full_name'] ?? ''));
        if ($resolvedName === '') {
            $resolvedName = $fullName;
        }

        $updateQuery = "UPDATE users
                        SET email = ?,
                            full_name = ?,
                            google_id = ?,
                            email_verified_at = COALESCE(email_verified_at, NOW()),
                            email_verification_token = NULL,
                            email_verification_sent_at = NULL,
                            email_verification_expires_at = NULL
                        WHERE id = ?";
        $updateStmt = $this->mysqli->prepare($updateQuery);
        $userId = (int) $user['id'];
        $updateStmt->bind_param('sssi', $email, $resolvedName, $googleId, $userId);
        $updateStmt->execute();

        $user['email'] = $email;
        $user['full_name'] = $resolvedName;
        $user['google_id'] = $googleId;
        $user['email_verified_at'] = date('Y-m-d H:i:s');

        return $user;
    }

    private function createGoogleUser(string $googleId, string $email, string $fullName): array {
        $role = 'user';
        $password = $this->buildGoogleOnlyPassword($googleId);
        $insertQuery = "INSERT INTO users (
                            email,
                            password,
                            full_name,
                            role,
                            google_id,
                            email_verified_at
                        ) VALUES (?, ?, ?, ?, ?, NOW())";
        $insertStmt = $this->mysqli->prepare($insertQuery);
        $insertStmt->bind_param('sssss', $email, $password, $fullName, $role, $googleId);

        if (!$insertStmt->execute()) {
            sendResponse('error', 'Gagal membuat akun Google.', null, 500);
        }

        return [
            'id' => $insertStmt->insert_id,
            'email' => $email,
            'full_name' => $fullName,
            'role' => $role,
            'email_verified_at' => date('Y-m-d H:i:s'),
            'google_id' => $googleId,
        ];
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

    private function getVerificationRedirectUrl(string $token = ''): string {
        $baseUrl = rtrim(FRONTEND_URL, '/') . '/verify-email';
        if ($token === '') {
            return $baseUrl;
        }

        return $baseUrl . '?token=' . rawurlencode($token);
    }

    private function findUserByVerificationToken(string $token): ?array {
        $query = "SELECT id, email, full_name, email_verified_at, email_verification_expires_at
                  FROM users
                  WHERE email_verification_token = ?
                  LIMIT 1";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('s', $token);
        $stmt->execute();
        $user = $stmt->get_result()->fetch_assoc();

        return $user ?: null;
    }

    private function getVerificationState(string $token): array {
        if ($token === '') {
            return [
                'success' => false,
                'code' => 'missing_token',
                'message' => 'Token verifikasi tidak ditemukan.',
                'http_code' => 400,
            ];
        }

        $user = $this->findUserByVerificationToken($token);
        if (!$user) {
            return [
                'success' => false,
                'code' => 'invalid_token',
                'message' => 'Link verifikasi tidak valid atau sudah pernah digunakan.',
                'http_code' => 404,
            ];
        }

        if (!empty($user['email_verified_at'])) {
            return [
                'success' => true,
                'code' => 'already_verified',
                'message' => 'Email sudah terverifikasi. Silakan langsung login.',
                'http_code' => 200,
                'data' => [
                    'email' => $user['email'],
                    'email_verified' => true,
                ],
            ];
        }

        if (!empty($user['email_verification_expires_at']) && strtotime($user['email_verification_expires_at']) < time()) {
            return [
                'success' => false,
                'code' => 'expired_token',
                'message' => 'Masa berlaku link verifikasi sudah habis. Silakan kirim ulang email verifikasi.',
                'http_code' => 410,
                'data' => [
                    'email' => $user['email'],
                    'email_verified' => false,
                ],
            ];
        }

        return [
            'success' => true,
            'code' => 'ready_to_verify',
            'message' => 'Token valid. Lanjutkan verifikasi email.',
            'http_code' => 200,
            'data' => [
                'email' => $user['email'],
                'full_name' => $user['full_name'],
                'email_verified' => false,
            ],
        ];
    }

    private function requestJson(string $url): array {
        $statusCode = 0;
        $body = false;

        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 10,
                CURLOPT_HTTPHEADER => [
                    'Accept: application/json',
                ],
            ]);

            $body = curl_exec($ch);
            $statusCode = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
            curl_close($ch);
        } else {
            $context = stream_context_create([
                'http' => [
                    'method' => 'GET',
                    'timeout' => 10,
                    'ignore_errors' => true,
                    'header' => "Accept: application/json\r\n",
                ],
            ]);

            $body = @file_get_contents($url, false, $context);
            $responseHeaders = function_exists('http_get_last_response_headers')
                ? http_get_last_response_headers()
                : ($http_response_header ?? []);

            if (isset($responseHeaders[0]) && preg_match('/\s(\d{3})\s/', $responseHeaders[0], $matches)) {
                $statusCode = (int) $matches[1];
            }
        }

        if ($body === false || $body === '') {
            return [
                'success' => false,
                'status_code' => $statusCode,
                'message' => 'Respons Google tidak tersedia.',
            ];
        }

        $decoded = json_decode($body, true);
        if (!is_array($decoded)) {
            return [
                'success' => false,
                'status_code' => $statusCode,
                'message' => 'Respons Google tidak valid.',
            ];
        }

        return [
            'success' => $statusCode >= 200 && $statusCode < 300,
            'status_code' => $statusCode,
            'data' => $decoded,
        ];
    }

    private function verifyGoogleCredential(string $credential): array {
        if (GOOGLE_CLIENT_ID === '') {
            return [
                'success' => false,
                'message' => 'Login Google belum dikonfigurasi di server.',
                'http_code' => 503,
            ];
        }

        if ($credential === '') {
            return [
                'success' => false,
                'message' => 'Token Google tidak ditemukan.',
                'http_code' => 400,
            ];
        }

        $response = $this->requestJson(
            'https://oauth2.googleapis.com/tokeninfo?id_token=' . rawurlencode($credential)
        );

        if (!$response['success']) {
            return [
                'success' => false,
                'message' => 'Token Google tidak valid atau tidak dapat diverifikasi.',
                'http_code' => 401,
            ];
        }

        $payload = $response['data'] ?? [];
        $googleId = trim((string) ($payload['sub'] ?? ''));
        $email = $this->normalizeEmail((string) ($payload['email'] ?? ''));
        $fullName = trim((string) ($payload['name'] ?? ''));
        $issuer = trim((string) ($payload['iss'] ?? ''));
        $audience = trim((string) ($payload['aud'] ?? ''));
        $emailVerified = filter_var($payload['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $expiresAt = (int) ($payload['exp'] ?? 0);
        $allowedAudiences = array_values(array_filter(array_map('trim', explode(',', GOOGLE_CLIENT_ID))));

        if ($googleId === '' || $email === '') {
            return [
                'success' => false,
                'message' => 'Profil Google tidak lengkap.',
                'http_code' => 422,
            ];
        }

        if (!$emailVerified) {
            return [
                'success' => false,
                'message' => 'Email Google belum terverifikasi.',
                'http_code' => 403,
            ];
        }

        if (!in_array($issuer, ['accounts.google.com', 'https://accounts.google.com'], true)) {
            return [
                'success' => false,
                'message' => 'Penerbit token Google tidak valid.',
                'http_code' => 401,
            ];
        }

        if ($expiresAt > 0 && $expiresAt < time()) {
            return [
                'success' => false,
                'message' => 'Token Google sudah kedaluwarsa.',
                'http_code' => 401,
            ];
        }

        if (empty($allowedAudiences) || !in_array($audience, $allowedAudiences, true)) {
            return [
                'success' => false,
                'message' => 'Google Client ID tidak cocok.',
                'http_code' => 401,
            ];
        }

        if ($fullName === '') {
            $fullName = preg_replace('/@.*$/', '', $email) ?: 'Pengguna Google';
        }

        return [
            'success' => true,
            'data' => [
                'google_id' => $googleId,
                'email' => $email,
                'full_name' => $fullName,
            ],
        ];
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
            <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;">Ujiin</div>
            <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;">' . $safeTitle . '</h1>
        </div>
        <div style="padding:28px 24px;font-size:15px;line-height:1.7;">
            <p>' . $safeMessage . '</p>
            <p style="margin:24px 0 0;">
                <a href="' . $homeUrl . '" style="display:inline-block;background:' . $buttonColor . ';color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">Kembali ke Ujiin</a>
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
        $checkQuery = "SELECT id, email_verified_at, google_id FROM users WHERE email = ?";
        $stmt = $this->mysqli->prepare($checkQuery);
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $existingUser = $stmt->get_result()->fetch_assoc();

        if ($existingUser) {
            if (!empty($existingUser['google_id'])) {
                sendResponse('error', 'Email sudah terdaftar dengan akun Google. Silakan lanjut dengan Google.', [
                    'email' => $email,
                    'google_auth_available' => true,
                ], 409);
            }

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

        $query = "SELECT id, email, password, full_name, role, email_verified_at, google_id FROM users WHERE email = ?";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result->num_rows === 0) {
            sendResponse('error', 'Email atau password salah', null, 401);
        }

        $user = $result->fetch_assoc();

        if (!empty($user['google_id']) && $this->isGoogleOnlyPassword((string) ($user['password'] ?? ''))) {
            sendResponse('error', 'Akun ini terdaftar dengan Google. Silakan masuk menggunakan Google.', [
                'email' => $email,
                'google_auth_available' => true,
            ], 401);
        }

        if (!password_verify($password, (string) ($user['password'] ?? ''))) {
            sendResponse('error', 'Email atau password salah', null, 401);
        }

        if (empty($user['email_verified_at'])) {
            sendResponse('error', 'Email belum diverifikasi. Silakan cek inbox email Anda terlebih dahulu.', [
                'email' => $email,
                'requires_email_verification' => true,
            ], 403);
        }

        $this->issueAuthenticatedSession($user, 'Login berhasil');
    }

    public function authenticateWithGoogle() {
        $data = json_decode(file_get_contents('php://input'), true);
        $credential = trim((string) ($data['credential'] ?? $data['id_token'] ?? ''));
        $intent = trim((string) ($data['intent'] ?? 'login'));

        $verification = $this->verifyGoogleCredential($credential);
        if (!$verification['success']) {
            sendResponse('error', $verification['message'], null, $verification['http_code'] ?? 401);
        }

        $googleProfile = $verification['data'];
        $googleId = $googleProfile['google_id'];
        $email = $googleProfile['email'];
        $fullName = $googleProfile['full_name'];

        if (!in_array($intent, ['login', 'register'], true)) {
            sendResponse('error', 'Mode autentikasi Google tidak valid.', null, 400);
        }

        $user = $this->findGoogleUserCandidate($googleId, $email);

        if ($user) {
            $wasGoogleLinked = !empty($user['google_id']);
            $user = $this->upsertGoogleLinkedUser($user, $googleId, $email, $fullName);

            $message = $intent === 'register'
                ? ($wasGoogleLinked ? 'Akun Google sudah terdaftar. Login berhasil.' : 'Daftar dengan Google berhasil dan akun langsung aktif.')
                : ($wasGoogleLinked ? 'Login dengan Google berhasil.' : 'Akun berhasil dihubungkan ke Google dan login berhasil.');

            $this->issueAuthenticatedSession($user, $message);
        }

        if ($intent === 'login') {
            sendResponse('error', 'Akun Google belum terdaftar. Lanjutkan daftar dengan Google.', [
                'code' => 'google_registration_required',
                'requires_google_registration' => true,
                'email' => $email,
                'full_name' => $fullName,
            ], 404);
        }

        $user = $this->createGoogleUser($googleId, $email, $fullName);
        $this->issueAuthenticatedSession($user, 'Daftar dengan Google berhasil dan akun langsung aktif.');
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

    public function getVerificationStatus() {
        $token = trim((string) ($_GET['token'] ?? ''));
        $state = $this->getVerificationState($token);

        sendResponse(
            $state['success'] ? 'success' : 'error',
            $state['message'],
            [
                'code' => $state['code'],
                'token' => $token !== '',
            ] + ($state['data'] ?? []),
            $state['http_code']
        );
    }

    public function verifyEmail() {
        $requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';

        if ($requestMethod === 'GET') {
            $token = trim((string) ($_GET['token'] ?? ''));
            header('Location: ' . $this->getVerificationRedirectUrl($token), true, 302);
            exit();
        }

        $data = json_decode(file_get_contents('php://input'), true);
        $token = trim((string) ($data['token'] ?? ''));
        $state = $this->getVerificationState($token);

        if ($state['code'] === 'already_verified') {
            sendResponse('success', $state['message'], $state['data'] ?? [], 200);
        }

        if (!$state['success'] || $state['code'] !== 'ready_to_verify') {
            sendResponse('error', $state['message'], [
                'code' => $state['code'],
            ] + ($state['data'] ?? []), $state['http_code']);
        }

        $user = $this->findUserByVerificationToken($token);
        if (!$user) {
            sendResponse('error', 'Link verifikasi tidak valid atau sudah pernah digunakan.', [
                'code' => 'invalid_token',
            ], 404);
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

        sendResponse('success', 'Email berhasil diverifikasi. Silakan login untuk mulai tryout.', [
            'email' => $user['email'],
            'email_verified' => true,
        ]);
    }

    public function updateProfile() {
        $tokenData = verifyToken();
        $data = json_decode(file_get_contents('php://input'), true);

        $userId = $tokenData['userId'];
        $full_name = isset($data['full_name']) ? trim((string) $data['full_name']) : '';
        $phone = array_key_exists('phone', $data) ? trim((string) ($data['phone'] ?? '')) : '';
        $birth_date = array_key_exists('birth_date', $data) ? trim((string) ($data['birth_date'] ?? '')) : '';

        if ($full_name === '') {
            sendResponse('error', 'Nama lengkap wajib diisi', null, 422);
        }

        if ($phone === '') {
            $phone = null;
        }

        if ($birth_date === '') {
            $birth_date = null;
        }

        if ($birth_date !== null) {
            $parsedBirthDate = DateTime::createFromFormat('Y-m-d', $birth_date);
            $birthDateErrors = DateTime::getLastErrors();
            $hasBirthDateErrors = $birthDateErrors !== false
                && (
                    ((int) ($birthDateErrors['warning_count'] ?? 0)) > 0
                    || ((int) ($birthDateErrors['error_count'] ?? 0)) > 0
                );

            if (!$parsedBirthDate || $hasBirthDateErrors || $parsedBirthDate->format('Y-m-d') !== $birth_date) {
                sendResponse('error', 'Format tanggal lahir tidak valid', null, 422);
            }
        }

        $query = "UPDATE users SET full_name = ?, phone = ?, birth_date = ? WHERE id = ?";
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
                    tr.score_details_json,
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
} elseif (strpos($requestPath, '/api/auth/verify-email-status') !== false && $requestMethod === 'GET') {
    $controller->getVerificationStatus();
} elseif (strpos($requestPath, '/api/auth/verify-email') !== false && $requestMethod === 'GET') {
    $controller->verifyEmail();
} elseif (strpos($requestPath, '/api/auth/verify-email') !== false && $requestMethod === 'POST') {
    $controller->verifyEmail();
} elseif (strpos($requestPath, '/api/auth/resend-verification') !== false && $requestMethod === 'POST') {
    $controller->resendVerificationEmail();
} elseif (strpos($requestPath, '/api/auth/login') !== false && $requestMethod === 'POST') {
    $controller->login();
} elseif (strpos($requestPath, '/api/auth/google') !== false && $requestMethod === 'POST') {
    $controller->authenticateWithGoogle();
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
