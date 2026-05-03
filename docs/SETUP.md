# Setup Guide - Platform Tryout CPNS & UTBK 2026

## Prerequisites

Pastikan Anda sudah install:
- **Node.js** 16+ (download dari https://nodejs.org)
- **PHP** 8.1+ dengan extension curl dan pdo_mysql
- **MySQL Server** (XAMPP, WAMP, atau standalone)
- **Git** (optional)

## Step 1: Database Setup

### Menggunakan XAMPP (Windows/Mac)
```bash
# Buka XAMPP Control Panel
# Start Apache dan MySQL

# Buka browser dan pergi ke:
http://localhost/phpmyadmin
```

### Menggunakan Terminal (All OS)
```bash
# Login ke MySQL
mysql -u root -p

# Import file setup database tunggal
SOURCE /path/to/database/schema.sql;

# Exit MySQL
EXIT;
```

### Verifikasi Database
```bash
mysql -u root -p -e "USE cpns_utbk_2026; SHOW TABLES;"
```

Anda seharusnya melihat 10 tables:
- users
- test_categories
- test_packages
- questions
- question_options
- transactions
- user_access
- test_attempts
- user_answers
- test_results

## Step 2: Backend Setup (PHP)

### Windows & macOS

```bash
# Navigate ke folder backend
cd cpns-utbk/backend

# Copy environment file
cp .env.example .env

# Edit .env dengan text editor
# Ganti:
# - DB_PASSWORD sesuai MySQL password Anda
# - MIDTRANS_SERVER_KEY dan MIDTRANS_CLIENT_KEY dengan Sandbox key dari Midtrans

# Run PHP server
php -S localhost:8000
```

### Menggunakan XAMPP
```bash
# Copy folder backend ke htdocs
cp -r cpns-utbk/backend /Applications/XAMPP/htdocs/cpns-api

# Buka http://localhost/cpns-api/
```

### Verifikasi Backend
Buka di browser:
```
http://localhost:8000/api/questions/packages
```

Anda akan melihat response JSON dari database (butuh login untuk endpoint tertentu)

## Step 3: Frontend Setup (React)

```bash
# Navigate ke folder frontend
cd cpns-utbk/frontend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Run development server
npm run dev
```

Frontend akan running di: `http://localhost:5173`

### Troubleshoot npm install error
```bash
# Clear npm cache
npm cache clean --force

# Install ulang
npm install
```

## Step 4: Midtrans Setup (Payment Gateway)

### 1. Register di Midtrans
- Pergi ke https://dashboard.sandbox.midtrans.com
- Click "Sign Up"
- Daftar dengan email
- Verify email Anda
- Login ke dashboard

### 2. Copy Midtrans Keys
- Buka Settings → Merchant Information
- Copy **Server Key** (untuk backend)
- Copy **Client Key** (untuk frontend)

### 3. Setup Keys di Project

**Backend (`cpns-utbk/backend/.env`)**
```
MIDTRANS_SERVER_KEY=your_copied_server_key_here
MIDTRANS_CLIENT_KEY=your_copied_client_key_here
MIDTRANS_IS_PRODUCTION=false
```

**Frontend live (`cpns-utbk/frontend/.env`)**
```
VITE_MIDTRANS_CLIENT_KEY=your_copied_client_key_here
```

### 4. Setup Webhook (untuk production)
- Dashboard Midtrans → Settings → HTTP Notification
- Copy URL Anda
- Masukkan webhook endpoint: `http://localhost:8000/api/payment/notification`

## Step 5: Testing Aplikasi

### 1. Test Database & Backend
```bash
# Di terminal backend, pastikan running
# PHP -S localhost:8000

# Test di browser atau Postman
# GET: http://localhost:8000/api/questions/packages

# Anda harus lihat response JSON dengan list paket
```

### 2. Test Frontend
```bash
# Di terminal frontend, pastikan running
# npm run dev

# Buka di browser: http://localhost:5173
# Anda akan diredirect ke /login
```

### 3. Test User Registration
```
1. Click "Daftar sekarang"
2. Isi form dengan data dummy:
   - Nama: Test User
   - Email: test@example.com
   - Password: password123
3. Click Daftar
4. Anda akan login otomatis dan redirect ke homepage
```

### 4. Test Payment (Midtrans Sandbox)
```
1. Di homepage, pilih salah satu paket
2. Click "Mulai Tryout"
3. Review data pembeli
4. Click "Lanjut ke Pembayaran"
5. Midtrans Snap akan terbuka
6. Pilih metode pembayaran (misalnya: Bank Transfer)
7. Gunakan test card Midtrans:
   - Card Number: 4111 1111 1111 1111
   - Expiry: 12/25
   - CVV: 123
8. Submit pembayaran
9. Anda akan redirect ke hasil test (karena belum ada soal)
```

## Step 6: Running Everything

### Terminal 1 - Backend
```bash
cd cpns-utbk/backend
php -S localhost:8000
# Output: Development Server (http://127.0.0.1:8000) started
```

### Terminal 2 - Frontend
```bash
cd cpns-utbk/frontend
npm run dev
# Output: VITE v5.0.8 ready in XXX ms
# ➜ Local:   http://localhost:5173/
```

### Terminal 3 - Database (optional)
```bash
# Pastikan MySQL running
# XAMPP: Start MySQL dari control panel
# Atau di terminal: mysql.server start (macOS)
```

Sekarang akses aplikasi di: **http://localhost:5173**

## File Structure yang Penting

```
cpns-utbk/
├── backend/
│   ├── config/Database.php        ← Main config file
│   ├── controllers/               ← Business logic
│   ├── index.php                  ← API router
│   └── .env                       ← Environment variables (CREATE ini)
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx               ← Main routing
│   │   ├── AuthContext.jsx        ← Auth state
│   │   ├── pages/                ← Page components
│   │   └── api.js                ← API client
│   ├── index.html                ← Entry HTML
│   ├── package.json              ← Dependencies
│   └── vite.config.js            ← Vite config
│
├── frontend-next/
│   ├── src/app/                  ← Next App Router migration
│   ├── src/legacy-pages/         ← Wrapper ke page lama saat transisi
│   ├── package.json              ← Next.js dependencies
│   └── next.config.mjs           ← Next config
│
└── database/
    └── schema.sql                ← Setup database tunggal (structure + data awal)
```

## Troubleshooting

### Error: "Cannot GET /api/questions/packages"
**Solusi:**
- Pastikan backend running di port 8000
- Check PHP error logs
- Verify database connection di `.env`

### Error: "Failed to fetch from API"
**Solusi:**
- Pastikan backend URLs di frontend benar
- Check CORS di backend middleware
- Try disable browser cache (Ctrl+Shift+Delete)

### Error: "Cannot find module axios"
**Solusi:**
```bash
cd frontend
npm install axios
```

### Database "Access denied for user"
**Solusi:**
- Check DB_USER dan DB_PASSWORD di `.env`
- Default MySQL: user=root, password=""

### Midtrans Payment tidak muncul
**Solusi:**
- Check Midtrans Client Key di environment
- Pastikan script loading di browser (check browser console)
- Verify sandbox mode aktif

## Development Tips

### Debugging Backend
```bash
# Add di PHP file
error_log("Debug message", 0);
error_log(json_encode($variable), 0);

# Lihat logs di terminal
tail -f error.log
```

### Debugging Frontend
```javascript
// Buka browser DevTools (F12)
// Console tab untuk error checking
// Network tab untuk API calls
console.log('Debug:', variable);
```

### Database Debugging
```bash
# Login MySQL
mysql -u root -p

# Query data
USE cpns_utbk_2026;
SELECT * FROM users;
SELECT * FROM transactions;
SELECT * FROM test_attempts;
```

## Production Deployment (Future)

### Backend Production
```
- Setup di server dengan PHP 8.1+
- Enable MySQL remote access
- Setup HTTPS dengan SSL certificate
- Change JWT_SECRET_KEY yang kompleks
- Setup proper environment variables
- Enable logging
```

### Frontend Production
```bash
# Build untuk production
npm run build

# Output akan di folder dist/
# Upload ke web server atau cloud hosting
```

## Next Steps

1. **Add lebih banyak soal** ke database (edit schema.sql atau buat migrasi lanjutan)
2. **Customize styling** sesuai brand Anda
3. **Add admin panel** untuk manage soal dan paket
4. **Setup email notification** untuk konfirmasi pembayaran
5. **Add detailed analytics** untuk performance test
6. **Deploy ke production** dengan proper infrastructure

---

**Selamat!** Aplikasi Anda sudah siap.  
Jika ada pertanyaan, check API.md dan PAYMENT.md untuk info lebih detail.
