# Deploy Checklist Rumahweb untuk `tocpnsutbk.com`

Checklist ini disusun untuk struktur project saat ini:
- Frontend React/Vite dipublish di domain utama: `https://tocpnsutbk.com`
- Backend PHP API dipublish di subdomain: `https://api.tocpnsutbk.com`
- Database MySQL memakai file tunggal: `database/schema.sql`

Konfigurasi ini adalah yang paling aman dan paling praktis untuk project ini, karena:
- domain utama bisa fokus untuk frontend SPA
- backend punya document root sendiri
- webhook Midtrans bisa diarahkan ke endpoint HTTPS yang stabil

## 1. Struktur folder yang disarankan di Rumahweb

Di cPanel Rumahweb, pakai struktur seperti ini:

```text
public_html/
├── index.html
├── assets/
├── favicon.svg
├── .htaccess
└── ...isi hasil build frontend

public_html/api/
├── index.php
├── .htaccess
├── .env
├── composer.json
├── composer.lock
├── vendor/
├── config/
├── controllers/
├── middleware/
├── utils/
└── ...isi backend lain yang dibutuhkan
```

Catatan penting:
- `public_html` adalah document root default domain utama di cPanel.
- Untuk subdomain, Rumahweb menjelaskan document root subdomain harus berada di bawah `public_html`.
- Karena project ini memakai `vendor/autoload.php`, folder `backend/vendor` harus ikut diupload kalau kamu deploy manual dari laptop.

## 2. Mapping domain yang direkomendasikan

Pakai pembagian ini:
- `tocpnsutbk.com` -> document root `public_html`
- `api.tocpnsutbk.com` -> document root `public_html/api`

Kenapa ini direkomendasikan:
- frontend kamu sudah cocok untuk domain utama
- backend tidak bercampur dengan file static frontend
- `VITE_API_URL` bisa diarahkan ke `https://api.tocpnsutbk.com`

## 3. Persiapan di cPanel Rumahweb

Lakukan ini dulu di cPanel:

1. Pastikan domain utama `tocpnsutbk.com` sudah aktif.
2. Buat subdomain `api.tocpnsutbk.com`.
3. Saat membuat subdomain, pastikan document root-nya ke `public_html/api`.
4. Pastikan SSL/HTTPS untuk domain utama dan subdomain sudah aktif.
5. Buat database MySQL baru dan user database baru.
6. Catat:
   - nama database
   - username database
   - password database
   - host database jika berbeda dari `localhost`

## 3A. Langkah klik di cPanel untuk subdomain API

Ikuti urutan ini di cPanel Rumahweb:

1. Login ke ClientZone Rumahweb.
2. Buka layanan hosting untuk `tocpnsutbk.com`.
3. Klik masuk ke `cPanel`.
4. Cari menu `Domains` atau `Subdomains`.
5. Buat subdomain baru:
   - Subdomain: `api`
   - Domain induk: `tocpnsutbk.com`
6. Saat menentukan folder/document root, arahkan ke:

```text
public_html/api
```

7. Simpan.
8. Kalau subdomain sudah terbuat tapi folder salah, buka menu pengaturan subdomain lalu ubah document root ke `public_html/api`.

Catatan:
- Rumahweb menjelaskan document root subdomain harus berada di bawah `public_html`.
- Jangan arahkan subdomain API ke folder frontend utama.

## 3B. Langkah klik di cPanel untuk database

Ikuti ini di cPanel:

1. Buka menu `MySQL Databases`.
2. Pada bagian `Create New Database`, buat database baru.
3. Buat user database baru pada bagian `MySQL Users`.
4. Tambahkan user ke database pada bagian `Add User To Database`.
5. Beri privilege `ALL PRIVILEGES`.
6. Simpan nama database, user, dan password.

Setelah itu:

1. Buka `phpMyAdmin`.
2. Klik database yang baru dibuat di sidebar kiri.
3. Klik tab `Import`.
4. Pilih file [schema.sql](/Users/luthfifadhlurrohman/Documents/cpns-utbk/database/schema.sql).
5. Klik `Go` atau `Import`.
6. Tunggu sampai muncul pesan sukses.

## 3C. Langkah klik di cPanel untuk upload backend

Setelah subdomain dan database siap:

1. Buka `File Manager`.
2. Masuk ke folder:

```text
public_html/api
```

3. Upload file backend production ke folder ini.
4. Kalau upload dalam bentuk ZIP:
   - upload ZIP
   - klik file ZIP
   - pilih `Extract`
5. Pastikan isi folder `public_html/api` minimal berisi:
   - `index.php`
   - `.htaccess`
   - `.env`
   - `config/`
   - `controllers/`
   - `middleware/`
   - `utils/`
   - `vendor/`

Kalau file `.htaccess` atau `.env` tidak terlihat:
- klik `Settings` di File Manager
- aktifkan `Show Hidden Files`

## 3D. Langkah klik di cPanel untuk upload frontend

Sesudah frontend dibuild di lokal:

1. Buka `File Manager`.
2. Masuk ke folder:

```text
public_html
```

3. Backup dulu isi website lama kalau ada.
4. Hapus file lama yang tidak dipakai lagi dari deploy sebelumnya.
5. Upload **isi** folder `frontend/dist/`, bukan folder `dist`-nya.
6. Pastikan file berikut ada di `public_html`:
   - `index.html`
   - `.htaccess`
   - `favicon.svg`
   - folder `assets/`

Catatan:
- karena frontend kamu SPA, file `.htaccess` wajib ikut terupload
- kalau `.htaccess` tidak ikut, refresh route seperti `/login` atau `/admin` bisa 404

## 3E. Langkah klik di cPanel untuk SSL

Sebelum Midtrans production diaktifkan:

1. Di cPanel, cari menu `SSL/TLS Status` atau menu SSL yang disediakan Rumahweb.
2. Pastikan:
   - `tocpnsutbk.com`
   - `www.tocpnsutbk.com`
   - `api.tocpnsutbk.com`
   semuanya sudah aktif HTTPS.
3. Jika ada tombol `Run AutoSSL`, jalankan.
4. Setelah SSL aktif, tes buka:
   - `https://tocpnsutbk.com`
   - `https://api.tocpnsutbk.com/api/questions/packages`

## 4. File environment production

### Backend `.env`

Buat file `.env` production di folder backend yang akan diupload ke `public_html/api/.env`.

Contoh:

```env
DB_HOST=localhost
DB_USER=cpns_user
DB_PASSWORD=PASSWORD_DATABASE_KAMU
DB_NAME=cpns_utbk_2026
DB_PORT=3306

API_URL=https://api.tocpnsutbk.com
FRONTEND_URL=https://tocpnsutbk.com
CORS_ALLOWED_ORIGINS=https://tocpnsutbk.com,https://www.tocpnsutbk.com

JWT_SECRET_KEY=GANTI_DENGAN_RANDOM_SECRET_YANG_PANJANG
TOKEN_EXPIRY=86400

MIDTRANS_IS_PRODUCTION=true
MIDTRANS_SERVER_KEY=Mid-server-XXXXXXXX
MIDTRANS_CLIENT_KEY=Mid-client-XXXXXXXX
MERCHANT_ID=MXXXXXXXX

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=EMAIL_KAMU
SMTP_PASSWORD=APP_PASSWORD
FROM_EMAIL=noreply@tocpnsutbk.com
FROM_NAME=Ujiin
```

Catatan:
- `JWT_SECRET_KEY` wajib diganti dari default lokal.
- `CORS_ALLOWED_ORIGINS` isi domain frontend production.
- Kalau kamu ingin support `www`, masukkan dua-duanya.

### Frontend `.env.production`

Buat file production lokal sebelum build:

```env
VITE_API_URL=https://api.tocpnsutbk.com
VITE_IS_PRODUCTION=true
VITE_MIDTRANS_CLIENT_KEY=Mid-client-XXXXXXXX
```

## 5. Build frontend production

Di laptop/local:

```bash
cd frontend
npm install
npm run build
```

Yang diupload ke `public_html` adalah **isi folder `frontend/dist/`**, bukan folder `frontend/` utuh.

Pastikan file ini ikut terupload:
- `index.html`
- `assets/`
- `favicon.svg`
- `.htaccess`

Catatan:
- Project ini sudah punya `.htaccess` frontend di `frontend/public/.htaccess`, jadi file rewrite SPA akan ikut masuk ke `dist` saat build.

## 6. Upload backend production

Yang diupload ke `public_html/api` adalah isi folder `backend/`, minimal:
- `index.php`
- `.htaccess`
- `.env`
- `config/`
- `controllers/`
- `middleware/`
- `utils/`
- `vendor/`
- `composer.json`
- `composer.lock`

Kalau kamu deploy manual via ZIP:
- zip isi folder `backend/`
- upload ke `public_html/api`
- extract di sana

## 7. Import database production

Project ini sekarang memakai satu file setup utama:
- `database/schema.sql`

Langkah import:

1. Masuk cPanel.
2. Buat database dan user database.
3. Hubungkan user ke database dengan all privileges.
4. Buka phpMyAdmin.
5. Pilih database yang baru dibuat.
6. Import file `database/schema.sql`.

Setelah import, data awal yang tersedia:
- paket `CPNS Intensif`
- paket `UTBK Intensif`
- akun admin default

## 8. Akun default setelah import database

Setelah import `schema.sql`, akun admin default adalah:

- Email: `REMOVED_ADMIN_EMAIL`
- Password: `REMOVED_ADMIN_PASSWORD`

Saran setelah live:
1. login sebagai admin
2. cek panel admin `/admin`
3. ubah password admin langsung di database atau siapkan flow ganti password berikutnya

## 9. Webhook Midtrans production

Di dashboard Midtrans production:

1. Login ke MAP Midtrans.
2. Buka `Settings > Configuration`.
3. Set Payment Notification URL ke:

```text
https://api.tocpnsutbk.com/api/payment/notification
```

Catatan penting:
- Midtrans menyarankan webhook jangan mengarah ke localhost.
- Midtrans juga menyarankan endpoint memakai HTTPS.
- Backend kamu sekarang sudah memakai notifikasi + konfirmasi status via Get Status API.

## 10. Nilai env Midtrans yang wajib sinkron

Pastikan nilai ini cocok antara frontend, backend, dan dashboard Midtrans:
- `MIDTRANS_IS_PRODUCTION=true`
- `MIDTRANS_SERVER_KEY` production
- `VITE_MIDTRANS_CLIENT_KEY` production
- `MERCHANT_ID` production

Jangan campur key sandbox dan production.

## 11. Urutan deploy yang paling aman

Pakai urutan ini:

1. Siapkan subdomain `api.tocpnsutbk.com`.
2. Aktifkan SSL untuk domain utama dan subdomain.
3. Buat database production di cPanel.
4. Import `database/schema.sql`.
5. Siapkan backend `.env` production.
6. Upload backend ke `public_html/api`.
7. Tes endpoint:
   - `https://api.tocpnsutbk.com/api/questions/packages`
8. Siapkan frontend `.env.production`.
9. Build frontend lokal dengan `npm run build`.
10. Upload isi `frontend/dist/` ke `public_html`.
11. Tes frontend:
   - homepage
   - login
   - ambil paket
   - halaman payment
12. Set webhook Midtrans production.
13. Lakukan 1 transaksi uji nominal kecil.
14. Verifikasi:
   - transaksi masuk ke tabel `transactions`
   - akses masuk ke `user_access`
   - user bisa masuk test
   - hasil test tersimpan di `test_results`

## 12. Checklist uji setelah live

Sebelum mengumumkan website live, cek ini:

- `https://tocpnsutbk.com` terbuka normal
- refresh halaman route selain home tidak 404
- `https://api.tocpnsutbk.com/api/questions/packages` mengembalikan JSON
- login user normal
- login admin normal
- panel admin bisa edit harga paket
- panel admin bisa tambah/edit/hapus soal
- pembelian paket membuat transaksi baru
- webhook Midtrans tercatat sukses
- akses test aktif setelah pembayaran valid
- hasil test bisa muncul

## 13. Hal yang jangan terlewat

- Upload folder `vendor/` backend juga.
- Jangan upload `.env` lokal sandbox ke server production.
- Jangan pakai key sandbox di domain live.
- Simpan backup database sebelum mengubah data paket/soal besar-besaran.
- Kalau mau live penuh, ganti akun admin default setelah deployment.

## 14. Referensi

Panduan Rumahweb dan Midtrans yang relevan:

- Rumahweb, deploy React di cPanel: https://www.rumahweb.com/journal/deploy-react-js-di-cpanel-hosting/
- Rumahweb, document root subdomain/addon: https://www.rumahweb.com/journal/cara-mengganti-document-root-addon-dan-subdomain-di-cpanel/
- Rumahweb, membuat subdomain di cPanel: https://www.rumahweb.com/journal/subdomain-adalah/
- Rumahweb, import database via phpMyAdmin: https://www.rumahweb.com/journal/cara-import-database-di-phpmyadmin/
- Midtrans, HTTP Notification/Webhooks: https://docs.midtrans.com/docs/https-notification-webhooks
- Midtrans, transaction status: https://docs.midtrans.com/reference/snap-transaction-status
- Midtrans, Get Status API: https://docs.midtrans.com/docs/get-status-api-requests
