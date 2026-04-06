<?php
function envValue(string $key, $default = null) {
    if (array_key_exists($key, $_ENV) && $_ENV[$key] !== '') {
        return $_ENV[$key];
    }

    $value = getenv($key);
    return ($value !== false && $value !== '') ? $value : $default;
}

function applyCorsHeaders(): void {
    $defaultOrigins = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5174',
    ];
    $configuredOrigins = array_filter(array_map('trim', explode(',', (string) envValue('CORS_ALLOWED_ORIGINS', ''))));
    $frontendUrl = trim((string) envValue('FRONTEND_URL', ''));

    $allowedOrigins = array_values(array_unique(array_filter(array_merge(
        $defaultOrigins,
        $frontendUrl !== '' ? [$frontendUrl] : [],
        $configuredOrigins
    ))));

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }

    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Expires: 0');
    header('Content-Type: application/json');
}

applyCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Response Helper
function sendResponse($status, $message, $data = null, $httpCode = 200) {
    http_response_code($httpCode);
    echo json_encode([
        'status' => $status,
        'message' => $message,
        'data' => $data
    ]);
    exit();
}

// Get JWT Token from Headers
function getBearerToken() {
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $authorizationHeader = $headers['Authorization']
        ?? $headers['authorization']
        ?? ($_SERVER['HTTP_AUTHORIZATION'] ?? null)
        ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? null);

    if ($authorizationHeader) {
        $matches = [];
        if (preg_match('/Bearer\s(\S+)/', $authorizationHeader, $matches)) {
            return $matches[1];
        }
    }
    return null;
}

// Auth Middleware
function verifyToken() {
    $token = getBearerToken();
    if (!$token) {
        sendResponse('error', 'No token provided', null, 401);
    }

    require_once __DIR__ . '/../utils/JWTHandler.php';
    $decoded = JWTHandler::verifyToken($token);
    
    if (!$decoded) {
        sendResponse('error', 'Invalid or expired token', null, 401);
    }

    return $decoded;
}

function userHasRole(array $decoded, mysqli $mysqli, string $role): bool {
    if (($decoded['role'] ?? null) === $role) {
        return true;
    }

    $userId = (int) ($decoded['userId'] ?? 0);
    if ($userId <= 0) {
        return false;
    }

    $stmt = $mysqli->prepare('SELECT role FROM users WHERE id = ? LIMIT 1');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();

    return ($user['role'] ?? 'user') === $role;
}

function verifyAdmin() {
    $decoded = verifyToken();

    if (($decoded['role'] ?? null) === 'admin') {
        return $decoded;
    }

    require_once __DIR__ . '/../config/Database.php';
    $mysqli = $GLOBALS['mysqli'] ?? null;

    if ($mysqli instanceof mysqli && userHasRole($decoded, $mysqli, 'admin')) {
        $decoded['role'] = 'admin';
        return $decoded;
    }

    sendResponse('error', 'Akses admin ditolak', null, 403);
}
