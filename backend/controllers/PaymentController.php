<?php
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../utils/MidtransHandler.php';
require_once __DIR__ . '/../middleware/Response.php';

class PaymentController {
    private $mysqli;

    public function __construct($mysqli) {
        $this->mysqli = $mysqli;
    }

    private function findTransactionByOrderId(string $orderId): ?array {
        $query = "SELECT id, user_id, package_id, status
                  FROM transactions
                  WHERE midtrans_order_id = ?
                  LIMIT 1";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('s', $orderId);
        $stmt->execute();
        $transaction = $stmt->get_result()->fetch_assoc();

        return $transaction ?: null;
    }

    private function markTransactionStatus(string $orderId, string $status, ?string $midtransTransactionId = null): void {
        if ($midtransTransactionId) {
            $query = "UPDATE transactions
                      SET status = ?, midtrans_transaction_id = COALESCE(midtrans_transaction_id, ?)
                      WHERE midtrans_order_id = ?";
            $stmt = $this->mysqli->prepare($query);
            $stmt->bind_param('sss', $status, $midtransTransactionId, $orderId);
            $stmt->execute();
            return;
        }

        $query = "UPDATE transactions SET status = ? WHERE midtrans_order_id = ?";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('ss', $status, $orderId);
        $stmt->execute();
    }

    private function isPaidStatus(array $statusData): bool {
        $transactionStatus = $statusData['transaction_status'] ?? null;
        $fraudStatus = $statusData['fraud_status'] ?? null;

        return $transactionStatus === 'settlement'
            || ($transactionStatus === 'capture' && ($fraudStatus === null || $fraudStatus === 'accept'));
    }

    private function completeTransactionAccess($orderId, $expectedUserId = null, $midtransTransactionId = null) {
        $query = "SELECT t.id, t.user_id, t.package_id, t.status, tp.duration_days
                  FROM transactions t
                  JOIN test_packages tp ON tp.id = t.package_id
                  WHERE t.midtrans_order_id = ?
                  LIMIT 1";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('s', $orderId);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result->num_rows === 0) {
            sendResponse('error', 'Transaksi tidak ditemukan', null, 404);
        }

        $transaction = $result->fetch_assoc();

        if ($expectedUserId !== null && (int) $transaction['user_id'] !== (int) $expectedUserId) {
            sendResponse('error', 'Transaksi tidak ditemukan untuk akun ini', null, 404);
        }

        if ($midtransTransactionId) {
            $updateQuery = "UPDATE transactions
                            SET status = 'completed',
                                completed_at = NOW(),
                                midtrans_transaction_id = COALESCE(midtrans_transaction_id, ?)
                            WHERE id = ?";
            $stmt = $this->mysqli->prepare($updateQuery);
            $stmt->bind_param('si', $midtransTransactionId, $transaction['id']);
            $stmt->execute();
        } else {
            $updateQuery = "UPDATE transactions
                            SET status = 'completed', completed_at = NOW()
                            WHERE id = ?";
            $stmt = $this->mysqli->prepare($updateQuery);
            $stmt->bind_param('i', $transaction['id']);
            $stmt->execute();
        }

        $accessQuery = "INSERT INTO user_access (user_id, package_id, transaction_id, access_status, access_expires_at)
                        VALUES (?, ?, ?, 'active', DATE_ADD(NOW(), INTERVAL ? DAY))
                        ON DUPLICATE KEY UPDATE
                            transaction_id = VALUES(transaction_id),
                            access_status = 'active',
                            access_expires_at = VALUES(access_expires_at)";
        $stmt = $this->mysqli->prepare($accessQuery);
        $stmt->bind_param(
            'iiii',
            $transaction['user_id'],
            $transaction['package_id'],
            $transaction['id'],
            $transaction['duration_days']
        );
        $stmt->execute();

        return [
            'transaction_id' => (int) $transaction['id'],
            'package_id' => (int) $transaction['package_id'],
            'status' => 'completed',
        ];
    }

    public function createTransaction() {
        $tokenData = verifyToken();
        $data = json_decode(file_get_contents('php://input'), true);

        if (!isset($data['package_id'])) {
            sendResponse('error', 'Package ID harus diisi', null, 400);
        }

        $userId = $tokenData['userId'];
        $packageId = $data['package_id'];

        // Get package details
        $packageQuery = "SELECT id, name, price FROM test_packages WHERE id = ?";
        $stmt = $this->mysqli->prepare($packageQuery);
        $stmt->bind_param('i', $packageId);
        $stmt->execute();
        $packageResult = $stmt->get_result();

        if ($packageResult->num_rows === 0) {
            sendResponse('error', 'Package tidak ditemukan', null, 404);
        }

        $package = $packageResult->fetch_assoc();

        // Get user details
        $userQuery = "SELECT email, full_name FROM users WHERE id = ?";
        $stmt = $this->mysqli->prepare($userQuery);
        $stmt->bind_param('i', $userId);
        $stmt->execute();
        $userResult = $stmt->get_result();
        $user = $userResult->fetch_assoc();

        // Create order ID
        $orderId = 'ORDER-' . $userId . '-' . time();

        // Prepare Midtrans request
        $customerDetails = [
            'first_name' => $user['full_name'],
            'email' => $user['email']
        ];

        $itemDetails = [
            [
                'id' => $packageId,
                'price' => $package['price'],
                'quantity' => 1,
                'name' => $package['name']
            ]
        ];

        // Get Snap Token dari Midtrans
        $midtransResponse = MidtransHandler::getSnapToken($orderId, $package['price'], $customerDetails, $itemDetails);

        if (!isset($midtransResponse['token'])) {
            $errorMessage = $midtransResponse['error_messages'][0]
                ?? $midtransResponse['message']
                ?? 'Gagal membuat transaksi di Midtrans';
            sendResponse('error', $errorMessage, $midtransResponse, 500);
        }

        // Save transaction to database
        $transQuery = "INSERT INTO transactions (user_id, package_id, amount, status, midtrans_order_id) VALUES (?, ?, ?, 'pending', ?)";
        $stmt = $this->mysqli->prepare($transQuery);
        $stmt->bind_param('iiis', $userId, $packageId, $package['price'], $orderId);
        
        if (!$stmt->execute()) {
            sendResponse('error', 'Gagal menyimpan transaksi', null, 500);
        }

        $transactionId = $stmt->insert_id;

        sendResponse('success', 'Snap token berhasil dibuat', [
            'transaction_id' => $transactionId,
            'snap_token' => $midtransResponse['token'],
            'order_id' => $orderId
        ]);
    }

    public function handleNotification() {
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
            sendResponse('success', 'Notification endpoint reachable', [
                'method' => $_SERVER['REQUEST_METHOD'] ?? 'GET',
            ]);
        }

        $rawBody = file_get_contents('php://input');
        $data = json_decode($rawBody, true);

        if (!is_array($data) || empty($data)) {
            sendResponse('success', 'Notification endpoint reachable', [
                'message' => 'Payload kosong atau bukan JSON valid',
            ]);
        }

        $orderId = trim((string) ($data['order_id'] ?? ''));
        $statusCode = trim((string) ($data['status_code'] ?? ''));
        $grossAmount = trim((string) ($data['gross_amount'] ?? ''));
        $signatureKey = trim((string) ($data['signature_key'] ?? ''));

        if ($orderId === '' || $statusCode === '' || $grossAmount === '' || $signatureKey === '') {
            sendResponse('success', 'Notification endpoint reachable', [
                'message' => 'Payload test diterima, field Midtrans belum lengkap',
                'received_keys' => array_keys($data),
            ]);
        }

        $expectedSignature = hash('sha512', $orderId . $statusCode . $grossAmount . MIDTRANS_SERVER_KEY);

        if (!hash_equals($expectedSignature, $signatureKey)) {
            sendResponse('error', 'Invalid signature', null, 401);
        }

        if (strpos($orderId, 'payment_notif_test_') === 0) {
            sendResponse('success', 'Midtrans notification test acknowledged', [
                'order_id' => $orderId,
                'test' => true,
            ]);
        }

        $transaction = $this->findTransactionByOrderId($orderId);
        if (!$transaction) {
            sendResponse('success', 'Notification received for unknown order and safely ignored', [
                'order_id' => $orderId,
                'ignored' => true,
            ]);
        }

        $transactionStatus = $data['transaction_status'] ?? null;
        $fraudStatus = $data['fraud_status'] ?? null;

        // Update transaction status
        if ($transactionStatus === 'settlement' || ($transactionStatus === 'capture' && $fraudStatus === 'accept')) {
            $this->completeTransactionAccess($orderId, null, $data['transaction_id'] ?? null);
            sendResponse('success', 'Payment notification processed');
        } elseif ($transactionStatus === 'capture' && $fraudStatus === 'challenge') {
            $this->markTransactionStatus($orderId, 'pending', $data['transaction_id'] ?? null);
            sendResponse('success', 'Payment notification processed');
        } elseif ($transactionStatus === 'deny' || $transactionStatus === 'cancel' || $transactionStatus === 'failure') {
            $this->markTransactionStatus($orderId, 'failed', $data['transaction_id'] ?? null);
            sendResponse('success', 'Payment notification processed');
        } elseif ($transactionStatus === 'pending') {
            $this->markTransactionStatus($orderId, 'pending', $data['transaction_id'] ?? null);
            sendResponse('success', 'Payment notification processed');
        } elseif ($transactionStatus === 'expire') {
            $this->markTransactionStatus($orderId, 'expired', $data['transaction_id'] ?? null);
            sendResponse('success', 'Payment notification processed');
        }

        $this->markTransactionStatus($orderId, 'pending', $data['transaction_id'] ?? null);
        sendResponse('success', 'Payment notification processed');
    }

    public function checkTransactionStatus() {
        $tokenData = verifyToken();
        $transactionId = $_GET['id'] ?? null;

        if (!$transactionId) {
            sendResponse('error', 'Transaction ID harus diisi', null, 400);
        }

        $query = "SELECT * FROM transactions WHERE id = ? AND user_id = ?";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('ii', $transactionId, $tokenData['userId']);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result->num_rows === 0) {
            sendResponse('error', 'Transaction tidak ditemukan', null, 404);
        }

        $transaction = $result->fetch_assoc();
        sendResponse('success', 'Status transaksi berhasil diambil', $transaction);
    }

    public function completeSandboxTransaction() {
        $tokenData = verifyToken();

        if (MIDTRANS_IS_PRODUCTION) {
            sendResponse('error', 'Endpoint sandbox tidak tersedia pada mode production', null, 403);
        }

        $data = json_decode(file_get_contents('php://input'), true);
        $orderId = $data['order_id'] ?? null;

        if (!$orderId) {
            sendResponse('error', 'Order ID harus diisi', null, 400);
        }

        $result = $this->completeTransactionAccess(
            $orderId,
            (int) $tokenData['userId'],
            $data['transaction_id'] ?? null
        );

        sendResponse('success', 'Pembayaran sandbox berhasil dikonfirmasi', $result);
    }

    public function confirmTransaction() {
        $tokenData = verifyToken();
        $data = json_decode(file_get_contents('php://input'), true);
        $orderId = trim((string) ($data['order_id'] ?? ''));

        if ($orderId === '') {
            sendResponse('error', 'Order ID harus diisi', null, 400);
        }

        if (!MIDTRANS_IS_PRODUCTION) {
            $result = $this->completeTransactionAccess(
                $orderId,
                (int) $tokenData['userId'],
                $data['transaction_id'] ?? null
            );

            sendResponse('success', 'Pembayaran sandbox berhasil dikonfirmasi', $result);
        }

        $statusData = MidtransHandler::checkTransactionStatus($orderId);
        if (($statusData['status'] ?? null) === 'error') {
            sendResponse(
                'error',
                $statusData['message'] ?? 'Gagal memverifikasi status pembayaran',
                $statusData,
                502
            );
        }

        $transactionStatus = $statusData['transaction_status'] ?? null;
        $midtransTransactionId = $statusData['transaction_id'] ?? ($data['transaction_id'] ?? null);

        if ($this->isPaidStatus($statusData)) {
            $result = $this->completeTransactionAccess(
                $orderId,
                (int) $tokenData['userId'],
                $midtransTransactionId
            );

            sendResponse('success', 'Pembayaran berhasil diverifikasi', $result);
        }

        if ($transactionStatus === 'pending' || ($transactionStatus === 'capture' && ($statusData['fraud_status'] ?? null) === 'challenge')) {
            $this->markTransactionStatus($orderId, 'pending', $midtransTransactionId);
            sendResponse('error', 'Pembayaran masih menunggu konfirmasi Midtrans', [
                'transaction_status' => $transactionStatus,
            ], 409);
        }

        if ($transactionStatus === 'expire') {
            $this->markTransactionStatus($orderId, 'expired', $midtransTransactionId);
            sendResponse('error', 'Pembayaran sudah kedaluwarsa', [
                'transaction_status' => $transactionStatus,
            ], 409);
        }

        $this->markTransactionStatus($orderId, 'failed', $midtransTransactionId);
        sendResponse('error', 'Pembayaran belum valid atau ditolak Midtrans', [
            'transaction_status' => $transactionStatus,
        ], 409);
    }
}

// Router
$requestMethod = $_SERVER['REQUEST_METHOD'];
$requestPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

$controller = new PaymentController($mysqli);

if (strpos($requestPath, '/api/payment/create') !== false && $requestMethod === 'POST') {
    $controller->createTransaction();
} elseif (strpos($requestPath, '/api/payment/confirm') !== false && $requestMethod === 'POST') {
    $controller->confirmTransaction();
} elseif (strpos($requestPath, '/api/payment/complete-sandbox') !== false && $requestMethod === 'POST') {
    $controller->completeSandboxTransaction();
} elseif (strpos($requestPath, '/api/payment/notification') !== false && in_array($requestMethod, ['GET', 'POST'], true)) {
    $controller->handleNotification();
} elseif (strpos($requestPath, '/api/payment/check') !== false && $requestMethod === 'GET') {
    $controller->checkTransactionStatus();
} else {
    sendResponse('error', 'Endpoint tidak ditemukan', null, 404);
}
