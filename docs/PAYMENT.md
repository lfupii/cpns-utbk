# Payment System Documentation

## Overview

Platform menggunakan **Midtrans** sebagai payment gateway untuk menghandle semua transaksi pembayaran. Sistem dirancang untuk:

- ✅ One-time test access per package
- ✅ Multiple payment methods
- ✅ Real-time payment verification
- ✅ Automatic access grant after payment
- ✅ Transaction history tracking

## Payment Flow Diagram

```
┌─────────────────┐
│ User Selects    │
│ Test Package    │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│ Create Order ID     │
│ in Backend          │
└────────┬────────────┘
         │
         ▼
┌──────────────────────┐
│ Get Snap Token from  │
│ Midtrans API         │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Business Logic:      │
│ - If failed, show    │
│   error message      │
│ - If success,        │
│   return token       │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Display Midtrans     │
│ Snap Widget          │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ User Choose Payment  │
│ Method & Pay         │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Midtrans Process     │
│ Payment              │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐        ┌─────────────────┐
│ Send Webhook to      │───────▶│ Backend Verify  │
│ Backend Notification │        │ & Update Status │
└──────────────────────┘        └────────┬────────┘
                                         │
                                         ▼
                                ┌─────────────────┐
                                │ Create User     │
                                │ Access Record   │
                                └────────┬────────┘
                                         │
                                         ▼
                                ┌─────────────────┐
                                │ User Can Now    │
                                │ Start Test      │
                                └─────────────────┘
```

## Implementation Details

### 1. Backend Payment Creation

**File**: `backend/controllers/PaymentController.php`

```php
public function createTransaction() {
    // 1. Verify user authenticated
    $tokenData = verifyToken();
    
    // 2. Get package details
    $package = getPackageFromDB($packageId);
    
    // 3. Create order ID
    $orderId = 'ORDER-' . $userId . '-' . time();
    
    // 4. Call Midtrans Snap API
    $response = MidtransHandler::getSnapToken(
        $orderId,
        $package['price'],
        $customerDetails,
        $itemDetails
    );
    
    // 5. Save transaction to DB (status='pending')
    saveTransactionToDB($userId, $packageId, $orderId);
    
    // 6. Return snap_token to frontend
    return $response['token'];
}
```

### 2. Midtrans Integration

**File**: `backend/utils/MidtransHandler.php`

```php
public static function getSnapToken($orderId, $grossAmount, $customerDetails, $itemDetails) {
    // Prepare request payload
    $params = [
        'transaction_details' => [
            'order_id' => $orderId,
            'gross_amount' => $grossAmount
        ],
        'customer_details' => $customerDetails,
        'item_details' => $itemDetails
    ];
    
    // Make API call to Midtrans
    $curl = curl_init();
    curl_setopt_array($curl, [
        CURLOPT_URL => 'https://app.sandbox.midtrans.com/snap/v1/transactions',
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Basic ' . base64_encode(MIDTRANS_SERVER_KEY . ':')
        ],
        CURLOPT_POSTFIELDS => json_encode($params),
        // ... other curl options
    ]);
    
    $response = curl_exec($curl);
    return json_decode($response, true);
}
```

### 3. Frontend Payment Integration

**File**: `frontend/src/pages/Payment.jsx`

```jsx
const handlePayment = async () => {
    // 1. Create transaction
    const response = await apiClient.post('/payment/create', {
        package_id: packageId
    });
    
    // 2. Get snap token
    const snapToken = response.data.data.snap_token;
    
    // 3. Load Midtrans snap script
    const script = document.createElement('script');
    script.src = 'https://app.sandbox.midtrans.com/snap/snap.js';
    script.setAttribute('data-client-key', MIDTRANS_CLIENT_KEY);
    
    // 4. Open Snap payment widget
    script.onload = () => {
        window.snap.pay(snapToken, {
            onSuccess: (result) => {
                // Payment successful - redirect to test
                navigate(`/test/${packageId}`);
            },
            onError: (result) => {
                // Payment failed - show error
                showErrorMessage(result);
            }
        });
    };
    
    document.body.appendChild(script);
};
```

### 4. Webhook Notification Handler

**File**: `backend/controllers/PaymentController.php`

```php
public function handleNotification() {
    // 1. Receive webhook from Midtrans
    $data = json_decode(file_get_contents('php://input'), true);
    
    // 2. Verify signature (preventing fraud)
    $expectedSignature = hash('sha512', 
        $data['order_id'] . 
        $data['status_code'] . 
        $data['gross_amount'] . 
        MIDTRANS_SERVER_KEY
    );
    
    if ($data['signature_key'] !== $expectedSignature) {
        return error('Invalid signature');
    }
    
    // 3. Check transaction status
    if ($data['transaction_status'] == 'settlement') {
        // Payment successful
        updateTransactionStatus($orderId, 'completed');
        
        // Create user access
        createUserAccess($userId, $packageId);
        
    } elseif ($data['transaction_status'] == 'deny') {
        // Payment failed
        updateTransactionStatus($orderId, 'failed');
    }
}
```

## Database Schema Relations

### Transaction Flow

```
users (1) ──────────────── (Many) transactions
          │
          │
          └──────────────── (Many) user_access
                            │
                            └─────── coupled with (1) transactions

transactions (1) ========================== (Many) test_packages
                │
                └─ status: pending → completed → failed → expired

user_access (1) ──────────────── (Many) test_attempts
               │
               └─ access_status: active → expired
               └─ access_expires_at: AUTO calculated
```

### Key Tables

**transactions**
```sql
id INT
user_id INT (FK → users)
package_id INT (FK → test_packages)
amount INT
status ENUM('pending', 'completed', 'failed', 'expired')
midtrans_order_id VARCHAR (unique)
midtrans_transaction_id VARCHAR (unique)
created_at TIMESTAMP
completed_at TIMESTAMP
```

**user_access**
```sql
id INT
user_id INT (FK → users)
package_id INT (FK → test_packages)
transaction_id INT (FK → transactions)
access_status ENUM('active', 'expired', 'revoked')
access_expires_at TIMESTAMP
UNIQUE(user_id, package_id) -- One package per user
```

## Payment Methods Available

Di Midtrans Snap, user bisa memilih:

1. **Credit/Debit Card**
   - Visa, Mastercard, JCB
   - Support cicilan 3, 6, 12 bulan

2. **Bank Transfer**
   - BCA, Mandiri, BNI, CIMB
   - Virtual account untuk pembayaran

3. **E-Wallet**
   - GoPay
   - OVO
   - Dana
   - LinkAja

4. **QRIS**
   - Scan untuk semua bank

5. **Cicilan Tanpa Kartu Kredit**
   - Akulaku
   - Kredivo

## Testing Payment Locally

### Setup Midtrans Sandbox
1. Register di https://dashboard.sandbox.midtrans.com
2. Copy Server Key & Client Key
3. Add ke `.env` files

### Test Card Numbers
```
Success Payment:
Visa: 4111 1111 1111 1111
Expiry: 12/25
CVV: 123

Failed Payment:
Visa: 4000 0000 0000 0002
```

### Simulate Payment Notifications
```bash
# Send test webhook to your backend
curl -X POST http://localhost:8000/api/payment/notification \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_time": "2026-04-04 10:00:00",
    "transaction_status": "settlement",
    "order_id": "ORDER-1-xxx",
    "status_code": "200",
    "gross_amount": "10000.00",
    "signature_key": "...",
    "transaction_id": "xxx"
  }'
```

## One-Time Access Logic

### How It Works

```
1. User pays untuk test package
2. Transaction status = 'completed'
3. Create user_access record dengan:
   - access_status = 'active'
   - access_expires_at = NOW + 30 hari
   
4. Saat user mulai test:
   - Check user_access status
   - If active dan belum expired:
     ✓ Allow test
   - Check test_attempts untuk package ini
   - Count completed attempts
   - If attempt_count >= max_attempts:
     ✗ Deny (must pay again)
     
5. After user selesai test:
   - Update test_attempts status = 'completed'
   - Next time user coba test:
     ✗ Denied (sudah pernah test)
     "Anda harus membayar untuk test lagi"
```

### Database Query untuk Check

```sql
-- Check if user can start test
SELECT * FROM user_access ua
WHERE ua.user_id = ? 
  AND ua.package_id = ?
  AND ua.access_status = 'active'
  AND ua.access_expires_at > NOW();

-- Check if already completed
SELECT COUNT(*) FROM test_attempts 
WHERE user_id = ? 
  AND package_id = ?
  AND status = 'completed';

-- If count >= max_attempts (default 1):
-- ✗ User must pay again
```

## Security Measures

### 1. Order ID Validation
```php
// Unique per user per timestamp
$orderId = 'ORDER-' . $userId . '-' . time();
```

### 2. Signature Verification
```php
// Prevent fake webhook from attacker
$expectedSignature = hash('sha512', 
    $orderId . $statusCode . $grossAmount . SERVER_KEY
);
if ($signature_key !== $expectedSignature) {
    reject_webhook();
}
```

### 3. JWT Token
```php
// All payment endpoints require valid JWT
function verifyToken() {
    // Check token in header
    // Verify signature & expiry
    // Return user ID
}
```

### 4. User Ownership Validation
```php
// Verify user owns the transaction
$trans = getTransaction($transactionId);
if ($trans['user_id'] !== $currentUserId) {
    return error('Unauthorized');
}
```

## Error Handling

### Common Errors

| Error | Solution |
|-------|----------|
| "Invalid Server Key" | Check Midtrans keys di config |
| "Cannot reach Midtrans API" | Check internet connection & firewall |
| "Signature verification failed" | Wrong SERVER_KEY or invalid webhook |
| "Order already exists" | Unique constraint on order_id |
| "User not found" | Verify user login before payment |

### Error Response Example

```json
{
  "status": "error",
  "message": "Gagal membuat transaksi pembayaran",
  "data": {
    "midtrans_error": "Invalid server key"
  }
}
```

## Future Enhancements

1. **Recurring Billing**
   - Subscribe untuk unlimited test access
   - Auto-charge per bulan

2. **Promo Codes**
   - Discount codes for campaigns
   - Bundle packages dengan diskon

3. **Refund System**
   - Full refund dalam 7 hari
   - Partial refund jika test tidak selesai

4. **Payment Retry**
   - Automatic retry jika gagal
   - Manual retry dari user

5. **Analytics**
   - Revenue tracking
   - Payment failure analysis
   - Customer lifetime value

---

**Last Updated**: April 2026  
**Created for**: CPNS UTBK 2026 Tryout Platform
