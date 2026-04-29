# Auto Deploy GitHub ke Website Live

Dokumen ini sudah disesuaikan dengan setup final yang saat ini berjalan untuk project ini:
- frontend live di `https://tocpnsutbk.com`
- backend live di `https://api.tocpnsutbk.com`
- deploy otomatis via GitHub Actions
- upload ke hosting Rumahweb via FTP account khusus deploy

Workflow yang dipakai:
- [.github/workflows/deploy-live.yml](/Users/luthfifadhlurrohman/Documents/cpns-utbk/.github/workflows/deploy-live.yml)

## Ringkasan cara kerja

Setiap ada `push` ke branch `main`:
- GitHub Actions build frontend React/Vite
- GitHub Actions install dependency backend PHP
- GitHub Actions membuat file `.env` backend dari GitHub Secrets
- frontend diupload ke root FTP account
- backend diupload ke folder `api` pada root FTP account

Catatan penting:
- akun FTP deploy yang dipakai sekarang diarahkan ke `public_html`
- karena root FTP sudah `public_html`, workflow mengupload frontend ke `.` dan backend ke `api`
- kalau nanti akun FTP diganti dengan root yang berbeda, path deploy di workflow harus ikut disesuaikan

## Struktur hosting yang diasumsikan

Di server, hasil akhirnya seperti ini:

```text
public_html/
├── index.html
├── assets/
├── favicon.svg
├── .htaccess
└── api/
    ├── index.php
    ├── .htaccess
    ├── .env
    ├── composer.json
    ├── composer.lock
    ├── vendor/
    ├── config/
    ├── controllers/
    ├── middleware/
    └── utils/
```

## Repository dan branch

Repo GitHub yang dipakai:
- `lfupii/cpns-utbk`

Branch deploy:
- `main`

Alur harian:

```bash
cd /Users/luthfifadhlurrohman/Documents/cpns-utbk
git add .
git commit -m "Pesan perubahan"
git push origin main
```

Setelah push:
- buka tab `Actions`
- tunggu workflow `Deploy Live` selesai hijau

## GitHub Secrets yang dipakai

Buka:
- `GitHub repo > Settings > Secrets and variables > Actions`

Lalu isi repository secrets berikut.

### FTP / Hosting

- `FTP_HOST`
- `FTP_PORT`
- `FTP_USERNAME`
- `FTP_PASSWORD`

Setup yang terbukti jalan di hosting ini:
- `FTP_HOST` memakai hostname server FTP, bukan domain website
- contoh hostname server Rumahweb yang sempat dipakai: `dempo.iixcp.rumahweb.net`
- `FTP_PORT` umumnya `21`
- `FTP_USERNAME` sebaiknya memakai akun FTP khusus deploy
- akun FTP deploy sebaiknya diarahkan ke folder `public_html`

### Frontend

- `PROD_VITE_API_URL`
- `PROD_VITE_IS_PRODUCTION`
- `PROD_VITE_MIDTRANS_CLIENT_KEY`
- `PROD_VITE_GOOGLE_CLIENT_ID`

Nilai tetap untuk project ini:
- `PROD_VITE_API_URL=https://api.tocpnsutbk.com`
- `PROD_VITE_IS_PRODUCTION=true`

Catatan kompatibilitas:
- workflow masih menerima secret lama `VITE_API_URL` dan `VITE_MIDTRANS_CLIENT_KEY`
- workflow juga menerima `VITE_GOOGLE_CLIENT_ID` atau `PROD_GOOGLE_CLIENT_ID` sebagai fallback
- tetapi untuk setup baru, pakai prefix `PROD_` agar tidak rancu dengan sandbox/local

### Backend Database

- `PROD_DB_HOST`
- `PROD_DB_USER`
- `PROD_DB_PASSWORD`
- `PROD_DB_NAME`
- `PROD_DB_PORT`

Nilai umum di cPanel:
- `PROD_DB_HOST=localhost`
- `PROD_DB_PORT=3306`

### Backend App

- `PROD_API_URL`
- `PROD_FRONTEND_URL`
- `PROD_CORS_ALLOWED_ORIGINS`
- `PROD_JWT_SECRET_KEY`
- `PROD_TOKEN_EXPIRY`
- `PROD_GOOGLE_CLIENT_ID`

Nilai tetap untuk project ini:
- `PROD_API_URL=https://api.tocpnsutbk.com`
- `PROD_FRONTEND_URL=https://tocpnsutbk.com`
- `PROD_CORS_ALLOWED_ORIGINS=https://tocpnsutbk.com,https://www.tocpnsutbk.com`
- `PROD_TOKEN_EXPIRY=86400`

### Midtrans

- `PROD_MIDTRANS_IS_PRODUCTION`
- `PROD_MIDTRANS_SERVER_KEY`
- `PROD_MIDTRANS_CLIENT_KEY`
- `PROD_MERCHANT_ID`

### Email

- `PROD_SMTP_HOST`
- `PROD_SMTP_PORT`
- `PROD_SMTP_USER`
- `PROD_SMTP_PASSWORD`
- `PROD_FROM_EMAIL`
- `PROD_FROM_NAME`

Catatan:
- value `PROD_FROM_NAME` aman dipakai, karena workflow sekarang sudah meng-quote semua value saat membuat `.env`

## Template secrets

Template umum:

```text
FTP_HOST=ISI_HOST_SERVER_FTP
FTP_PORT=21
FTP_USERNAME=ISI_USERNAME_FTP
FTP_PASSWORD=ISI_PASSWORD_FTP

PROD_VITE_API_URL=https://api.tocpnsutbk.com
PROD_VITE_IS_PRODUCTION=true
PROD_VITE_MIDTRANS_CLIENT_KEY=ISI_CLIENT_KEY_PRODUCTION
PROD_VITE_GOOGLE_CLIENT_ID=ISI_GOOGLE_WEB_CLIENT_ID

PROD_DB_HOST=localhost
PROD_DB_USER=ISI_DB_USER
PROD_DB_PASSWORD=ISI_DB_PASSWORD
PROD_DB_NAME=ISI_DB_NAME
PROD_DB_PORT=3306

PROD_API_URL=https://api.tocpnsutbk.com
PROD_FRONTEND_URL=https://tocpnsutbk.com
PROD_CORS_ALLOWED_ORIGINS=https://tocpnsutbk.com,https://www.tocpnsutbk.com
PROD_JWT_SECRET_KEY=ISI_SECRET_JWT
PROD_TOKEN_EXPIRY=86400
PROD_GOOGLE_CLIENT_ID=ISI_GOOGLE_WEB_CLIENT_ID

PROD_MIDTRANS_IS_PRODUCTION=false
PROD_MIDTRANS_SERVER_KEY=ISI_SERVER_KEY
PROD_MIDTRANS_CLIENT_KEY=ISI_CLIENT_KEY
PROD_MERCHANT_ID=ISI_MERCHANT_ID

PROD_SMTP_HOST=ISI_SMTP_HOST
PROD_SMTP_PORT=587
PROD_SMTP_USER=ISI_SMTP_USER
PROD_SMTP_PASSWORD=ISI_SMTP_PASSWORD
PROD_FROM_EMAIL=ISI_FROM_EMAIL
PROD_FROM_NAME="Ujiin - TO CPNS UTBK"
```

## Mode Midtrans

### 1. Sandbox untuk uji coba pribadi

Kalau Midtrans Production belum selesai verifikasi, isi:

```text
PROD_VITE_API_URL=https://api.tocpnsutbk.com
PROD_VITE_IS_PRODUCTION=false
PROD_VITE_MIDTRANS_CLIENT_KEY=CLIENT_KEY_SANDBOX
PROD_MIDTRANS_IS_PRODUCTION=false
PROD_MIDTRANS_SERVER_KEY=SERVER_KEY_SANDBOX
PROD_MIDTRANS_CLIENT_KEY=CLIENT_KEY_SANDBOX
PROD_MERCHANT_ID=MERCHANT_ID_SANDBOX
```

Efeknya:
- frontend memuat Snap sandbox
- backend memakai endpoint sandbox
- aman untuk testing alur pembayaran sendiri
- jangan dianggap sebagai payment live

### 2. Production saat verifikasi Midtrans selesai

Ganti jadi:

```text
PROD_VITE_API_URL=https://api.tocpnsutbk.com
PROD_VITE_IS_PRODUCTION=true
PROD_VITE_MIDTRANS_CLIENT_KEY=CLIENT_KEY_PRODUCTION
PROD_MIDTRANS_IS_PRODUCTION=true
PROD_MIDTRANS_SERVER_KEY=SERVER_KEY_PRODUCTION
PROD_MIDTRANS_CLIENT_KEY=CLIENT_KEY_PRODUCTION
PROD_MERCHANT_ID=MERCHANT_ID_PRODUCTION
```

## Checklist transisi Sandbox ke Production

Urutan yang paling aman untuk repo ini:

1. Pastikan perubahan code payment terbaru sudah ada di branch yang akan dideploy.
2. Di dashboard Midtrans production, siapkan:
   - `Server Key`
   - `Client Key`
   - `Merchant ID`
3. Ubah GitHub Actions secrets berikut ke nilai production:
   - `PROD_VITE_IS_PRODUCTION=true`
   - `PROD_VITE_MIDTRANS_CLIENT_KEY=Mid-client-...` production
   - `PROD_MIDTRANS_IS_PRODUCTION=true`
   - `PROD_MIDTRANS_SERVER_KEY=Mid-server-...` production
   - `PROD_MIDTRANS_CLIENT_KEY=Mid-client-...` production
   - `PROD_MERCHANT_ID=M...` production
4. Pastikan URL aplikasi production tetap benar:
   - `PROD_VITE_API_URL=https://api.tocpnsutbk.com`
   - `PROD_API_URL=https://api.tocpnsutbk.com`
   - `PROD_FRONTEND_URL=https://tocpnsutbk.com`
   - `PROD_CORS_ALLOWED_ORIGINS=https://tocpnsutbk.com,https://www.tocpnsutbk.com`
5. Di dashboard Midtrans production, set HTTP Notification / Payment Notification URL ke:
   - `https://api.tocpnsutbk.com/api/payment/notification`
6. Push ke `main` atau jalankan `Deploy Live` secara manual dari tab Actions.
7. Setelah deploy selesai, verifikasi:
   - `https://api.tocpnsutbk.com/api/health` mengembalikan `environment: production`
   - halaman payment memuat Snap production
   - satu transaksi real nominal kecil bisa membuat row `transactions` menjadi `completed`
   - row `user_access` terbentuk
   - paket muncul di halaman `Paket Aktif`
   - user bisa masuk test

## Secret lama yang boleh dibersihkan

Kalau workflow baru sudah dipakai dan secret baru sudah terisi, secret frontend lama ini boleh dihapus agar konfigurasi lebih bersih:
- `VITE_API_URL`
- `VITE_MIDTRANS_CLIENT_KEY`

## Cara deploy

1. Ubah code lokal.
2. Commit perubahan.
3. Push ke `main`.
4. Tunggu `Deploy Live` di GitHub Actions selesai hijau.
5. Cek website live.

Contoh:

```bash
cd /Users/luthfifadhlurrohman/Documents/cpns-utbk
git add .
git commit -m "Update landing page"
git push origin main
```

## Cara cek hasil deploy

Sesudah workflow sukses, cek:
- `https://tocpnsutbk.com`
- `https://api.tocpnsutbk.com/api/health`
- `https://api.tocpnsutbk.com/api/questions/packages`

Kalau API sehat, `/api/health` harus mengembalikan JSON.

## Troubleshooting yang paling sering

### 1. Workflow hijau tapi website tidak berubah

Kemungkinan:
- browser cache
- akun FTP diarahkan ke root yang berbeda

Cek:
- hard refresh browser dengan `Cmd+Shift+R`
- pastikan akun FTP deploy memang root-nya `public_html`

### 2. FTP login gagal

Gejala:
- `530 Login authentication failed`

Solusi:
- buat akun FTP deploy baru di cPanel
- arahkan akun FTP itu ke `public_html`
- update `FTP_USERNAME` dan `FTP_PASSWORD` di GitHub Secrets

### 3. FTP certificate mismatch

Gejala:
- certificate common name tidak cocok

Solusi:
- pakai `FTP_HOST` berupa hostname server Rumahweb
- jangan pakai domain website kalau sertifikat FTP-nya tidak cocok

### 4. API 500 setelah deploy

Cek:
- `https://api.tocpnsutbk.com/api/health`

Penyebab umum:
- database secret salah
- privilege user database belum benar
- `.env` production rusak
- PHP extension yang dibutuhkan belum aktif

### 5. Error CORS

Kalau frontend tampil tapi data paket gagal dimuat:
- cek respons `https://api.tocpnsutbk.com/api/health`
- cek apakah backend benar-benar hidup
- pastikan `PROD_CORS_ALLOWED_ORIGINS` berisi:
  `https://tocpnsutbk.com,https://www.tocpnsutbk.com`

## Catatan penting

- Workflow ini belum menjalankan migrasi database otomatis.
- Kalau ada perubahan schema database, database production tetap harus diupdate manual.
- Jangan commit `.env` production ke repo.
- Setelah setup stabil, sebaiknya rotasi password yang pernah tampil di screenshot, chat, atau log:
  - password FTP
  - password database
  - password SMTP

## Referensi file penting

- Workflow deploy: [.github/workflows/deploy-live.yml](/Users/luthfifadhlurrohman/Documents/cpns-utbk/.github/workflows/deploy-live.yml)
- Panduan Rumahweb manual: [docs/DEPLOY-RUMAHWEB.md](/Users/luthfifadhlurrohman/Documents/cpns-utbk/docs/DEPLOY-RUMAHWEB.md)
- Schema database: [database/schema.sql](/Users/luthfifadhlurrohman/Documents/cpns-utbk/database/schema.sql)
