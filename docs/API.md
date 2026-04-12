# API Documentation

## Base URL
- **Development**: `http://localhost:8000/api`
- **Production**: `https://your-domain.com/api`

## Authentication

### JWT Token
Semua endpoint (kecuali login/register) memerlukan JWT token di header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

## Endpoints

### 1. AUTHENTICATION

#### Register User
```
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "John Doe"
}

Response (201):
{
  "status": "success",
  "message": "Registrasi berhasil. Silakan cek email untuk verifikasi akun.",
  "data": {
    "userId": 1,
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "user",
    "email_verified": false,
    "requires_email_verification": true,
    "email_delivery": {
      "success": true,
      "transport": "smtp",
      "message": "Email berhasil dikirim via SMTP."
    }
  }
}
```

Setelah register, akun belum bisa login sampai email diverifikasi dari link yang dikirim ke inbox.

#### Verify Email
Endpoint ini biasanya diakses langsung dari link email verifikasi:

```
GET /auth/verify-email?token=YOUR_TOKEN
```

Response:
- Menampilkan halaman HTML sukses/gagal verifikasi di browser.

#### Resend Verification Email
```
POST /auth/resend-verification
Content-Type: application/json

{
  "email": "user@example.com"
}

Response (200):
{
  "status": "success",
  "message": "Email verifikasi berhasil dikirim ulang.",
  "data": {
    "email": "user@example.com",
    "email_verified": false,
    "email_delivery": {
      "success": true,
      "transport": "smtp",
      "message": "Email berhasil dikirim via SMTP."
    }
  }
}
```

#### Login
```
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

Response (200):
{
  "status": "success",
  "message": "Login berhasil",
  "data": {
    "userId": 1,
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "user",
    "email_verified": true,
    "token": "eyJhbGci..."
  }
}
```

Response (403) jika email belum diverifikasi:
```json
{
  "status": "error",
  "message": "Email belum diverifikasi. Silakan cek inbox email Anda terlebih dahulu.",
  "data": {
    "email": "user@example.com",
    "requires_email_verification": true
  }
}
```

#### Get Profile
```
GET /auth/profile
Authorization: Bearer TOKEN

Response (200):
{
  "status": "success",
  "message": "Data profil berhasil diambil",
  "data": {
    "id": 1,
    "email": "user@example.com",
    "full_name": "John Doe",
    "phone": "081234567890",
    "birth_date": "2000-01-15",
    "email_verified_at": "2026-04-05 09:00:00",
    "email_verified": true,
    "created_at": "2026-04-04 10:00:00"
  }
}
```

#### Update Profile
```
PUT /auth/profile
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "full_name": "John Updated",
  "phone": "081234567899",
  "birth_date": "2000-01-16"
}

Response (200):
{
  "status": "success",
  "message": "Profil berhasil diperbarui"
}
```

---

### 2. QUESTIONS & PACKAGES

#### Get All Packages
```
GET /questions/packages

Response (200):
{
  "status": "success",
  "message": "Paket test berhasil diambil",
  "data": [
    {
      "id": 1,
      "category_id": 1,
      "name": "CPNS Intensif",
      "description": "Paket demo CPNS dengan simulasi soal dan evaluasi hasil.",
      "price": 10000,
      "duration_days": 30,
      "max_attempts": 1,
      "question_count": 30,
      "time_limit": 120,
      "category_name": "CPNS 2026"
    },
    ...
  ]
}
```

#### Get Questions by Package
```
GET /questions/list?package_id=1
Authorization: Bearer TOKEN (optional)

Response (200):
{
  "status": "success",
  "message": "Soal-soal berhasil diambil",
  "data": [
    {
      "id": 1,
      "package_id": 1,
      "question_text": "Kata 'isyarat' dalam kalimat...",
      "question_type": "single_choice",
      "difficulty": "easy",
      "options": [
        {
          "id": 1,
          "letter": "A",
          "text": "Tanda tangan"
        },
        {
          "id": 2,
          "letter": "B",
          "text": "Gerak tangan..."
        },
        ...
      ]
    },
    ...
  ]
}
```

---

### 3. PAYMENT

#### Create Payment Transaction
```
POST /payment/create
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "package_id": 1
}

Response (200):
{
  "status": "success",
  "message": "Snap token berhasil dibuat",
  "data": {
    "transaction_id": 5,
    "snap_token": "0031c08c-81b5-47d9-84f5...",
    "order_id": "ORDER-1-1712234567"
  }
}
```

#### Check Transaction Status
```
GET /payment/check?id=5
Authorization: Bearer TOKEN

Response (200):
{
  "status": "success",
  "message": "Status transaksi berhasil diambil",
  "data": {
    "id": 5,
    "user_id": 1,
    "package_id": 1,
    "amount": 10000,
    "status": "completed",
    "midtrans_order_id": "ORDER-1-1712234567",
    "created_at": "2026-04-04 10:00:00",
    "completed_at": "2026-04-04 10:15:00"
  }
}
```

#### Payment Notification Webhook
```
POST /payment/notification
Content-Type: application/json

{
  "transaction_time": "2026-04-04 10:15:00",
  "transaction_status": "settlement",
  "transaction_id": "xxx",
  "order_id": "ORDER-1-1712234567",
  "status_code": "200",
  "gross_amount": "10000.00",
  "signature_key": "xxx"
}

Response (200):
{
  "status": "success",
  "message": "Payment notification processed"
}
```

---

### 4. TEST

#### Check Test Access
```
GET /test/check-access?package_id=1
Authorization: Bearer TOKEN

Response (200):
{
  "status": "success",
  "message": "Akses terverifikasi",
  "data": {
    "canAccess": true
  }
}

Response (403):
{
  "status": "error",
  "message": "Anda belum membayar atau akses sudah kadaluarsa"
}
```

#### Start Test Attempt
```
POST /test/start
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "package_id": 1
}

Response (200):
{
  "status": "success",
  "message": "Test dimulai",
  "data": {
    "attempt_id": 3
  }
}
```

#### Submit Test Answers
```
POST /test/submit
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "attempt_id": 3,
  "answers": [
    {
      "question_id": 1,
      "option_id": 2
    },
    {
      "question_id": 2,
      "option_id": 5
    },
    ...
  ]
}

Response (200):
{
  "status": "success",
  "message": "Jawaban berhasil disimpan dan hasil tryout telah dikirim ke email.",
  "data": {
    "total_questions": 100,
    "correct_answers": 75,
    "percentage": 75.00,
    "score": 75,
    "email_delivery": {
      "success": true,
      "transport": "smtp",
      "message": "Email berhasil dikirim via SMTP."
    }
  }
}
```

Setelah submit, backend otomatis mengirim email hasil tryout ke email user yang sudah diverifikasi. Isi email mencakup ringkasan hasil, ucapan terima kasih dari Ujiin, dan doa sesuai jalur UTBK atau CPNS.

#### Get Test Results
```
GET /test/results?attempt_id=3
Authorization: Bearer TOKEN

Response (200):
{
  "status": "success",
  "message": "Hasil test berhasil diambil",
  "data": {
    "id": 3,
    "attempt_id": 3,
    "user_id": 1,
    "package_id": 1,
    "total_questions": 100,
    "correct_answers": 75,
    "score": 75,
    "percentage": 75.00,
    "time_taken": 4320,
    "created_at": "2026-04-04 10:20:00"
  }
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "status": "error",
  "message": "Required field is missing",
  "data": null
}
```

### 401 Unauthorized
```json
{
  "status": "error",
  "message": "Invalid or expired token",
  "data": null
}
```

### 403 Forbidden
```json
{
  "status": "error",
  "message": "You don't have access to this resource",
  "data": null
}
```

### 404 Not Found
```json
{
  "status": "error",
  "message": "Resource not found",
  "data": null
}
```

### 500 Server Error
```json
{
  "status": "error",
  "message": "Internal server error",
  "data": null
}
```

---

## Request/Response Examples

### Using cURL
```bash
# Register
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "password":"password",
    "full_name":"Test User"
  }'

# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "password":"password"
  }'

# Get packages (with token)
curl -X GET http://localhost:8000/api/questions/packages \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Using JavaScript (Axios)
```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api'
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Register
api.post('/auth/register', {
  email: 'test@example.com',
  password: 'password',
  full_name: 'Test User'
});

// Login
api.post('/auth/login', {
  email: 'test@example.com',
  password: 'password'
});

// Get packages
api.get('/questions/packages');
```

---

## Rate Limiting

Currently tidak ada rate limiting. Untuk production, tambahkan:
- Max 100 requests per minute per IP
- Max 10 file uploads per hour per user
- Max 5 login attempts per 15 minutes

---

## CORS Settings

Backend CORS headers:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

Untuk production, ubah `*` dengan specific domain.

---

## API Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request berhasil |
| 201 | Created - Resource berhasil dibuat |
| 400 | Bad Request - Input tidak valid |
| 401 | Unauthorized - Token tidak valid |
| 403 | Forbidden - Akses ditolak |
| 404 | Not Found - Resource tidak ditemukan |
| 500 | Server Error - Error di server |

---

**Last Updated**: April 2026
