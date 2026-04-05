<?php
error_reporting(E_ALL);

set_exception_handler(function (Throwable $exception): void {
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json');
    }

    echo json_encode([
        'status' => 'error',
        'message' => 'Unhandled exception on production API',
        'exception' => $exception->getMessage(),
        'file' => basename($exception->getFile()),
        'line' => $exception->getLine(),
    ]);
    exit();
});

register_shutdown_function(function (): void {
    $error = error_get_last();
    if (!$error) {
        return;
    }

    $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR];
    if (!in_array($error['type'], $fatalTypes, true)) {
        return;
    }

    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json');
    }

    echo json_encode([
        'status' => 'error',
        'message' => 'Fatal error on production API',
        'error' => $error['message'],
        'file' => basename($error['file']),
        'line' => $error['line'],
    ]);
});

// Load environment variables first
if (file_exists(__DIR__ . '/vendor/autoload.php')) {
    require_once __DIR__ . '/vendor/autoload.php';
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
    $dotenv->safeLoad();
} else {
    error_log('Composer autoload not found. Run "composer install" in backend.');
}

// Main API Router
require_once __DIR__ . '/middleware/Response.php';

$requestMethod = $_SERVER['REQUEST_METHOD'];
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Remove /api from the path if it exists
$requestPath = str_replace('/api', '', $requestUri);

if ($requestPath === '' || $requestPath === '/' || $requestPath === '/health') {
    $midtransEnvRaw = $_ENV['MIDTRANS_IS_PRODUCTION'] ?? getenv('MIDTRANS_IS_PRODUCTION') ?? 'false';
    $midtransEnv = filter_var($midtransEnvRaw, FILTER_VALIDATE_BOOLEAN) ? 'production' : 'sandbox';

    sendResponse('success', 'API aktif', [
        'service' => 'cpns-utbk-api',
        'status' => 'ok',
        'environment' => $midtransEnv,
        'time' => date(DATE_ATOM),
    ]);
}

// Database is loaded lazily inside controllers so health/CORS checks can succeed
// even when the production DB configuration still needs adjustment.

// Route requests to appropriate controllers
if (strpos($requestPath, '/auth/') !== false) {
    require_once __DIR__ . '/controllers/AuthController.php';
} elseif (strpos($requestPath, '/admin/') !== false) {
    require_once __DIR__ . '/controllers/AdminController.php';
} elseif (strpos($requestPath, '/payment/') !== false) {
    require_once __DIR__ . '/controllers/PaymentController.php';
} elseif (strpos($requestPath, '/questions/') !== false) {
    require_once __DIR__ . '/controllers/QuestionController.php';
} elseif (strpos($requestPath, '/test/') !== false) {
    require_once __DIR__ . '/controllers/TestController.php';
} else {
    sendResponse('error', 'Endpoint tidak ditemukan', null, 404);
}
