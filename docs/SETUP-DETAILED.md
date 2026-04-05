# 🚀 Setup Backend & Database - Step by Step

## Status Sistem Anda
- ✅ PHP 8.4.12 (sudah terinstall via Homebrew)
- ❌ MySQL (belum terinstall)
- ✅ Node.js & npm (untuk frontend nanti)

---

## STEP 1: Install MySQL (macOS)

### Opsi A: Menggunakan Homebrew (Recommended)

```bash
# 1. Update Homebrew
brew update

# 2. Install MySQL
brew install mysql

# 3. Start MySQL service
brew services start mysql

# 4. Verify installation
mysql --version
```

### Opsi B: Download dari MySQL Official
- Website: https://dev.mysql.com/downloads/mysql/
- Download: MySQL Community Server 8.0 (macOS)
- Install dan follow wizard

### Opsi C: Menggunakan XAMPP (Bundled)
- Download: https://www.apachefriends.org/
- Extract & Run
- Includes: Apache, MySQL, PHP, PhpMyAdmin

---

## STEP 2: Secure MySQL (Setup Root Password)

**PENTING:** Jika baru install, default root tidak ada password. Kita perlu set:

```bash
# Login ke MySQL tanpa password (default)
mysql -u root

# Di dalam MySQL shell, jalankan:
ALTER USER 'root'@'localhost' IDENTIFIED BY 'your_password_here';
FLUSH PRIVILEGES;
EXIT;

# Sekarang login dengan password
mysql -u root -p
# Ketik password yang Anda buat
```

---

## STEP 3: Create Database

### Cara A: Menggunakan Terminal MySQL

```bash
# 1. Login ke MySQL
mysql -u root -p
# Masukkan password Anda

# 2. Di dalam MySQL shell, copy-paste ini:
CREATE DATABASE IF NOT EXISTS cpns_utbk_2026;
SHOW DATABASES;
EXIT;
```

### Cara B: Run Script SQL File

```bash
# 1. Dari terminal (tidak perlu login MySQL dulu)
mysql -u root -p cpns_utbk_2026 < database/schema.sql

# Akan minta password, ketik password MySQL Anda
```

**Output yang diharapkan:**
```
Query OK, 1 row affected
Query OK, 1 row affected
... (banyak queries)
```

---

## STEP 4: Setup Data Awal

```bash
# Tidak perlu file seed terpisah.
# database/schema.sql sudah berisi structure + data awal.
```

---

## STEP 5: Verify Database Setup

```bash
# Login ke MySQL
mysql -u root -p

# Di dalam MySQL shell:
USE cpns_utbk_2026;
SHOW TABLES;
```

**Anda harus lihat 10 tables:**
```
+---------------------------+
| Tables_in_cpns_utbk_2026  |
+---------------------------+
| question_options          |
| questions                 |
| test_attempts             |
| test_categories           |
| test_packages             |
| test_results              |
| transactions              |
| user_access               |
| user_answers              |
| users                     |
+---------------------------+
```

---

## STEP 6: Check Data

```bash
# Masih di MySQL shell
# Check users
SELECT COUNT(*) as total_users FROM users;

# Check packages
SELECT * FROM test_packages;

# Check soal
SELECT COUNT(*) as total_questions FROM questions;

# Exit
EXIT;
```

---

## STEP 7: Setup Backend Config

```bash
# 1. Go ke folder backend
cd /Users/luthfifadhlurrohman/Documents/cpns-utbk/backend

# 2. Check config file
cat config/Database.php

# 3. Perhatikan bagian database credentials:
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASSWORD', '');           # ← Ganti jika ada password
define('DB_NAME', 'cpns_utbk_2026');
define('DB_PORT', 3306);

# 4. Jika MySQL ada password, edit Database.php
nano config/Database.php
# Ubah DB_PASSWORD dari '' menjadi 'your_password'
# Save: Ctrl+O, Enter, Ctrl+X
```

---

## STEP 8: Setup Midtrans Keys

**Di file `backend/config/Database.php`, cari:**

```php
define('MIDTRANS_SERVER_KEY', 'YOUR_MIDTRANS_SERVER_KEY');
define('MIDTRANS_CLIENT_KEY', 'YOUR_MIDTRANS_CLIENT_KEY');
```

**Untuk testing lokal (sandbox):**

1. Register di: https://dashboard.sandbox.midtrans.com
2. Login ke dashboard
3. Pergi ke: Settings → Server Key
4. Copy Server Key & Client Key
5. Edit `config/Database.php` dan replace keys

**Contoh:**
```php
define('MIDTRANS_SERVER_KEY', 'SB-Mid-server-abcd1234efgh5678');
define('MIDTRANS_CLIENT_KEY', 'SB-Mid-client-abcd1234efgh5678');
define('MIDTRANS_IS_PRODUCTION', false); // Sandbox mode
```

---

## STEP 9: Run Backend Server

```bash
# 1. Navigate ke backend folder (if not already)
cd /Users/luthfifadhlurrohman/Documents/cpns-utbk/backend

# 2. Start PHP Built-in Server
php -S localhost:8000

# Output yang diharapkan:
# Development Server (http://127.0.0.1:8000) started
```

**Biarkan terminal ini running!** Jangan close.

---

## STEP 10: Test Backend (Buka Terminal Baru)

```bash
# Buka terminal baru, jangan close yang lama

# Test API packages
curl http://localhost:8000/api/questions/packages

# Output yang diharapkan:
# JSON response dengan list paket
```

**Jika error:**
- Check MySQL running: `brew services list`
- Check database: `mysql -u root -p`
- Check PHP error logs

---

## STEP 11: Continue Setup Frontend (Nanti)

```bash
# Di terminal ketiga (jangan tutup terminal backend)
cd /Users/luthfifadhlurrohman/Documents/cpns-utbk/frontend

npm install
npm run dev

# Frontend akan running di http://localhost:5173
```

---

## 📋 Terminal Setup Summary

**Anda butuh 3 terminal running:**

```
Terminal 1 (Database - Optional)
$ mysql -u root -p
mysql> 
[Keep login untuk monitoring]

Terminal 2 (Backend - WAJIB)
$ cd backend && php -S localhost:8000
Development Server running...

Terminal 3 (Frontend - Nanti)
$ cd frontend && npm run dev
VITE v5.0.8 running at http://localhost:5173
```

---

## 🔍 Troubleshooting

### Error: "mysql command not found"
```bash
# Check Homebrew installation
brew list | grep mysql

# If not installed:
brew install mysql

# Start service:
brew services start mysql
```

### Error: "Can't connect to MySQL server"
```bash
# Check if MySQL is running
brew services list

# If not running:
brew services start mysql

# Check MySQL socket:
ls -la /tmp/mysql.sock
```

### Error: "Access denied for user 'root'@'localhost'"
```bash
# Meaning: Database password mismatch
# 1. Fix config di backend/config/Database.php
# 2. Atau reset MySQL root password:

mysql -u root
ALTER USER 'root'@'localhost' IDENTIFIED BY 'newpassword';
FLUSH PRIVILEGES;
EXIT;

# Update config dengan password yang baru
```

### Error: "Database cpns_utbk_2026 not found"
```bash
# Berarti schema belum di-import
# Run ini:
mysql -u root -p < database/schema.sql
```

### Error: "CORS error" di frontend
```bash
# Berarti backend tidak running
# Check terminal 2, pastikan:
php -S localhost:8000
# Lihat "Development Server running..."
```

---

## ✅ Verification Checklist

Setelah semua steps, verify dengan:

```bash
# 1. MySQL running?
brew services list | grep mysql
# Output should show "started"

# 2. Database exists?
mysql -u root -p -e "SHOW DATABASES;"
# Harus ada cpns_utbk_2026

# 3. Tables exist?
mysql -u root -p -e "USE cpns_utbk_2026; SHOW TABLES;"
# Harus ada 10 tables

# 4. Backend running?
curl http://localhost:8000/api/questions/packages
# Harus return JSON

# 5. Frontend ready? (nanti)
# Buka http://localhost:5173
```

---

## 🎯 Next: Frontend Setup

Setelah semua ini selesai, buka `docs/SETUP.md` untuk frontend setup.

---

**Selamat! Database & Backend ready untuk testing.** 🚀
