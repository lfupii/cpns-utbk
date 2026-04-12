# Ujiin

Platform interaktif dan modern untuk tryout CPNS dan UTBK 2026 dengan sistem pembayaran terintegrasi Midtrans.

## 📋 Features

✅ **Autentikasi & User Management**
- Register dan Login dengan JWT
- Manajemen profile user
- Password validation

✅ **Test Packages**
- Paket CPNS dan UTBK
- Berbagai tingkat kesulitan
- Customizable soal dan waktu

✅ **Sistem Pembayaran Midtrans**
- Integrasi Snap Payment Gateway
- Berbagai metode pembayaran
- Notifikasi pembayaran realtime
- One-time payment per package

✅ **Test Interaktif**
- Timer countdown
- Navigasi soal yang mudah
- Tracking progress jawaban
- Instant scoring

✅ **Hasil & Analisis**
- Ringkasan hasil test
- Persentase nilai
- Breakdown correct/salah
- Detail waktu pengerjaan

## 🛠️ Tech Stack

### Frontend
- React JS 18
- React Router 6
- Axios untuk HTTP
- Tailwind CSS untuk styling
- Vite sebagai build tool

### Backend
- PHP 8.1+
- MySQL dengan PhpMyAdmin
- JWT Authentication
- CORS enabled

### Payment Gateway
- Midtrans (Sandbox & Production)

## 📁 Struktur Folder

```
cpns-utbk/
├── backend/
│   ├── api/
│   ├── config/
│   │   └── Database.php
│   ├── controllers/
│   │   ├── AuthController.php
│   │   ├── PaymentController.php
│   │   ├── QuestionController.php
│   │   └── TestController.php
│   ├── middleware/
│   │   └── Response.php
│   ├── utils/
│   │   ├── JWTHandler.php
│   │   └── MidtransHandler.php
│   ├── index.php
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Home.jsx
│   │   │   ├── Payment.jsx
│   │   │   ├── Test.jsx
│   │   │   └── Results.jsx
│   │   ├── components/
│   │   ├── AuthContext.jsx
│   │   ├── api.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── .env.example
│
├── database/
│   └── schema.sql
│
└── docs/
    ├── SETUP.md
    ├── API.md
    └── PAYMENT.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- PHP 8.1+
- MySQL Server
- PhpMyAdmin (optional)

### Database Setup
```bash
# Import 1 file SQL kanonik
mysql -u root -p < database/schema.sql
```

### Backend Setup
```bash
cd backend

# Copy config
cp .env.example .env

# Edit .env dengan konfigurasi database Anda
nano .env

# Run server (menggunakan built-in PHP server atau Apache)
php -S localhost:8000
```

### Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Copy env
cp .env.example .env

# Run development server
npm run dev
```

Server akan berjalan di:
- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- Database: localhost:3306 (PhpMyAdmin)

## 🔐 Security Notes

1. **JWT Secret Key**: Ubah `JWT_SECRET_KEY` di `backend/config/Database.php`
2. **Midtrans Keys**: Ganti dengan key asli di config database
3. **CORS**: Sesuaikan origin di production
4. **Database Password**: Set password yang kuat untuk MySQL

## 💳 Midtrans Integration

### Sandbox Testing
1. Register di https://dashboard.sandbox.midtrans.com
2. Copy Server Key dan Client Key
3. Masukkan di `backend/config/Database.php`
4. Set `MIDTRANS_IS_PRODUCTION = false`

### Test Payment Methods
- Kartu Kredit: 4111 1111 1111 1111
- Expiry: 12/25 | CVV: 123

### Notifikasi Pembayaran
Webhook URL akan ditangani otomatis oleh: `/api/payment/notification`

## 📊 Database Flow

```
User Registration/Login
    ↓
Browse Test Packages
    ↓
Select Package & Payment
    ↓
Midtrans Payment Processing
    ↓
Create User Access Record
    ↓
Start Test Attempt
    ↓
Answer Questions
    ↓
Submit & Get Results
```

## 🎯 System Flow

### Registration & Login
```
1. User register dengan email, password, nama
2. System hash password dan simpan ke database
3. Generate JWT token
4. Redirect ke dashboard
```

### Payment Flow
```
1. User pilih paket test
2. Klik "Bayar Sekarang"
3. Sistem buat order di Midtrans
4. User redirect ke Midtrans Snap
5. User pilih metode pembayaran
6. Pembayaran diproses
7. Webhook notifikasi diterima
8. User access dibuat
9. User bisa mulai test
```

### Test Flow
```
1. Check user punya akses (via user_access table)
2. Check belum exceeded max attempts
3. Create test attempt record
4. Load soal dari database
5. Start timer
6. User menjawab soal
7. Submit jawaban
8. Calculate score
9. Save results
10. Show hasil ke user
```

## 🔄 Key Features Explanation

### One-Time Test Access
- Setiap user hanya bisa test 1x untuk setiap paket (default)
- Untuk test ulang, harus bayar lagi
- Tracking di table `test_attempts` dengan status "completed"
- Check di controller sebelum allow start attempt

### Payment Verification
- Signature verification dari Midtrans
- Status confirmation via webhook
- Transaction status tracking
- Automatic access creation after payment success

### Test Security
- JWT token verification pada setiap request
- User access validation
- Attempt limit checking
- Time-based access expiry

## 📝 API Endpoints

### Authentication
- `POST /api/auth/register` - Register user baru
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

### Questions & Packages
- `GET /api/questions/packages` - Get semua paket
- `GET /api/questions/list` - Get soal berdasarkan package

### Payment
- `POST /api/payment/create` - Create transaksi pembayaran
- `POST /api/payment/notification` - Webhook dari Midtrans
- `GET /api/payment/check` - Check status transaksi

### Test
- `GET /api/test/check-access` - Verify user punya akses test
- `POST /api/test/start` - Start test attempt
- `POST /api/test/submit` - Submit jawaban
- `GET /api/test/results` - Get hasil test

## 🧪 Testing Lokal

### Test User Account
```
Email: test@example.com
Password: test1234 (lihat database/schema.sql)
```

### Test Payment
Gunakan test card Midtrans di sandbox

### Database
Lihat schema.sql untuk contoh data awal dan struktur database

## 📚 Dokumentasi Lebih Lanjut

- [Setup Guide](docs/SETUP.md)
- [API Documentation](docs/API.md)
- [Payment Integration](docs/PAYMENT.md)

## 🐛 Troubleshooting

### Database Connection Error
```
Check DB_HOST, DB_USER, DB_PASSWORD di config
Pastikan MySQL server running
```

### JWT Token Invalid
```
Clear localStorage di browser
Login ulang
```

### Payment Gateway Error
```
Check Midtrans keys
Pastikan API endpoint accessible
```

### CORS Issues
```
Check allowed origins
Pastikan backend CORS headers benar
```

## 📞 Support & Updates

Untuk update atau pertanyaan, silakan check dokumentasi di folder `/docs`

---

**Created**: April 2026  
**Version**: 1.0.0  
**License**: MIT
