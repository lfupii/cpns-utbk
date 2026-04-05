<?php
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../utils/JWTHandler.php';
require_once __DIR__ . '/../middleware/Response.php';

// AuthController untuk login dan register
class AuthController {
    private $mysqli;

    public function __construct($mysqli) {
        $this->mysqli = $mysqli;
    }

    public function register() {
        $data = json_decode(file_get_contents('php://input'), true);

        if (!isset($data['email']) || !isset($data['password']) || !isset($data['full_name'])) {
            sendResponse('error', 'Email, password, dan full_name harus diisi', null, 400);
        }

        $email = $data['email'];
        $password = password_hash($data['password'], PASSWORD_BCRYPT);
        $full_name = $data['full_name'];
        $phone = $data['phone'] ?? null;
        $birth_date = $data['birth_date'] ?? null;

        // Check if email already exists
        $checkQuery = "SELECT id FROM users WHERE email = ?";
        $stmt = $this->mysqli->prepare($checkQuery);
        $stmt->bind_param('s', $email);
        $stmt->execute();
        
        if ($stmt->get_result()->num_rows > 0) {
            sendResponse('error', 'Email sudah terdaftar', null, 409);
        }

        // Insert new user
        $role = 'user';
        $query = "INSERT INTO users (email, password, full_name, role, phone, birth_date) VALUES (?, ?, ?, ?, ?, ?)";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('ssssss', $email, $password, $full_name, $role, $phone, $birth_date);

        if ($stmt->execute()) {
            $userId = $stmt->insert_id;
            $token = JWTHandler::generateToken($userId, $role);
            sendResponse('success', 'Registrasi berhasil', [
                'userId' => $userId,
                'email' => $email,
                'full_name' => $full_name,
                'role' => $role,
                'token' => $token
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

        $email = $data['email'];
        $password = $data['password'];

        $query = "SELECT id, password, full_name, role FROM users WHERE email = ?";
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

        $token = JWTHandler::generateToken($user['id'], $user['role'] ?? 'user');
        sendResponse('success', 'Login berhasil', [
            'userId' => $user['id'],
            'email' => $email,
            'full_name' => $user['full_name'],
            'role' => $user['role'] ?? 'user',
            'token' => $token
        ]);
    }

    public function getProfile() {
        $tokenData = verifyToken();
        
        $query = "SELECT id, email, full_name, role, phone, birth_date, created_at FROM users WHERE id = ?";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('i', $tokenData['userId']);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result->num_rows === 0) {
            sendResponse('error', 'User tidak ditemukan', null, 404);
        }

        $user = $result->fetch_assoc();
        sendResponse('success', 'Data profil berhasil diambil', $user);
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
