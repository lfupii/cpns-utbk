# Auto Deploy GitHub ke Website Live

File workflow untuk auto deploy sudah disiapkan di:
- [.github/workflows/deploy-live.yml](/Users/luthfifadhlurrohman/Documents/cpns-utbk/.github/workflows/deploy-live.yml)

Workflow ini bekerja seperti ini:
- setiap ada `push` ke branch `main`, GitHub Actions build frontend React
- GitHub Actions install dependency backend PHP
- GitHub Actions membuat file `.env` production backend dari GitHub Secrets
- hasil frontend diupload ke `public_html`
- backend diupload ke `public_html/api`

## Secrets yang wajib dibuat di GitHub

Buka `GitHub repo > Settings > Secrets and variables > Actions > New repository secret`, lalu isi:

### FTP / Hosting

- `FTP_HOST`
- `FTP_PORT`
- `FTP_USERNAME`
- `FTP_PASSWORD`

Contoh umum Rumahweb:
- `FTP_HOST`: hostname FTP hosting atau domain FTP yang diberikan cPanel
- `FTP_PORT`: `21` untuk FTP atau `22` kalau nanti kamu ubah ke SFTP/SSH workflow lain

### Frontend

- `VITE_API_URL`
- `VITE_MIDTRANS_CLIENT_KEY`

Contoh production:
- `VITE_API_URL=https://api.tocpnsutbk.com`

### Backend Database

- `PROD_DB_HOST`
- `PROD_DB_USER`
- `PROD_DB_PASSWORD`
- `PROD_DB_NAME`
- `PROD_DB_PORT`

### Backend App

- `PROD_API_URL`
- `PROD_FRONTEND_URL`
- `PROD_CORS_ALLOWED_ORIGINS`
- `PROD_JWT_SECRET_KEY`
- `PROD_TOKEN_EXPIRY`

Contoh:
- `PROD_API_URL=https://api.tocpnsutbk.com`
- `PROD_FRONTEND_URL=https://tocpnsutbk.com`
- `PROD_CORS_ALLOWED_ORIGINS=https://tocpnsutbk.com,https://www.tocpnsutbk.com`
- `PROD_TOKEN_EXPIRY=86400`

### Midtrans

- `PROD_MIDTRANS_IS_PRODUCTION`
- `PROD_MIDTRANS_SERVER_KEY`
- `PROD_MIDTRANS_CLIENT_KEY`
- `PROD_MERCHANT_ID`

Contoh:
- `PROD_MIDTRANS_IS_PRODUCTION=true`

### Email

- `PROD_SMTP_HOST`
- `PROD_SMTP_PORT`
- `PROD_SMTP_USER`
- `PROD_SMTP_PASSWORD`
- `PROD_FROM_EMAIL`
- `PROD_FROM_NAME`

## Langkah 1. Commit workflow ke repo GitHub yang benar

File yang harus ikut ke GitHub:
- [.github/workflows/deploy-live.yml](/Users/luthfifadhlurrohman/Documents/cpns-utbk/.github/workflows/deploy-live.yml)
- [docs/AUTO-DEPLOY-GITHUB.md](/Users/luthfifadhlurrohman/Documents/cpns-utbk/docs/AUTO-DEPLOY-GITHUB.md)
- [backend/composer.lock](/Users/luthfifadhlurrohman/Documents/cpns-utbk/backend/composer.lock)
- [.gitignore](/Users/luthfifadhlurrohman/Documents/cpns-utbk/.gitignore)

Urutannya:
1. Pastikan file workflow berada di root repo GitHub, yaitu path `.github/workflows/deploy-live.yml`.
2. Pastikan branch production yang akan memicu deploy adalah `main`.
3. Commit perubahan file di atas.
4. Push ke GitHub.

Catatan:
- Di mesin lokal ini, folder `cpns-utbk` bukan git root. Jadi kalau repo GitHub kamu root-nya ada di folder lain, file workflow harus ikut dipindahkan ke root repo itu saat commit.
- Jangan commit file `.env` production ke GitHub. Semua nilai sensitif tetap lewat GitHub Secrets.

## Langkah 2. Isi GitHub Secrets satu per satu

Masuk ke:
- `GitHub repo > Settings > Secrets and variables > Actions`

Lalu buat repository secret sesuai daftar berikut.

### Daftar final secrets untuk domain dan hosting ini

Nilai yang sudah bisa dipastikan dari project ini:

| Secret Name | Isi Value |
| --- | --- |
| `VITE_API_URL` | `https://api.tocpnsutbk.com` |
| `PROD_API_URL` | `https://api.tocpnsutbk.com` |
| `PROD_FRONTEND_URL` | `https://tocpnsutbk.com` |
| `PROD_CORS_ALLOWED_ORIGINS` | `https://tocpnsutbk.com,https://www.tocpnsutbk.com` |
| `PROD_TOKEN_EXPIRY` | `86400` |
| `PROD_MIDTRANS_IS_PRODUCTION` | `true` |
| `PROD_FROM_EMAIL` | `noreply@tocpnsutbk.com` |
| `PROD_FROM_NAME` | `TO CPNS UTBK` |

Nilai yang harus kamu ambil dari hosting Rumahweb / cPanel / Midtrans:

| Secret Name | Ambil dari mana |
| --- | --- |
| `FTP_HOST` | hostname FTP dari Rumahweb atau server hostname cPanel |
| `FTP_PORT` | biasanya `21` |
| `FTP_USERNAME` | username FTP / cPanel |
| `FTP_PASSWORD` | password FTP / cPanel |
| `VITE_MIDTRANS_CLIENT_KEY` | Midtrans production client key |
| `PROD_DB_HOST` | host database production, biasanya `localhost` |
| `PROD_DB_USER` | user database production |
| `PROD_DB_PASSWORD` | password database production |
| `PROD_DB_NAME` | nama database production |
| `PROD_DB_PORT` | biasanya `3306` |
| `PROD_JWT_SECRET_KEY` | string acak panjang untuk JWT production |
| `PROD_MIDTRANS_SERVER_KEY` | Midtrans production server key |
| `PROD_MIDTRANS_CLIENT_KEY` | Midtrans production client key |
| `PROD_MERCHANT_ID` | merchant ID production Midtrans |
| `PROD_SMTP_HOST` | host SMTP email |
| `PROD_SMTP_PORT` | port SMTP, biasanya `587` |
| `PROD_SMTP_USER` | username SMTP |
| `PROD_SMTP_PASSWORD` | password SMTP / app password |

### Template final yang bisa langsung kamu isi

Copy daftar ini saat membuat secrets:

```text
FTP_HOST=ISI_DARI_RUMAHWEB
FTP_PORT=21
FTP_USERNAME=ISI_USERNAME_FTP
FTP_PASSWORD=ISI_PASSWORD_FTP

VITE_API_URL=https://api.tocpnsutbk.com
VITE_MIDTRANS_CLIENT_KEY=ISI_MIDTRANS_CLIENT_KEY_PRODUCTION

PROD_DB_HOST=localhost
PROD_DB_USER=ISI_DB_USER
PROD_DB_PASSWORD=ISI_DB_PASSWORD
PROD_DB_NAME=ISI_DB_NAME
PROD_DB_PORT=3306

PROD_API_URL=https://api.tocpnsutbk.com
PROD_FRONTEND_URL=https://tocpnsutbk.com
PROD_CORS_ALLOWED_ORIGINS=https://tocpnsutbk.com,https://www.tocpnsutbk.com
PROD_JWT_SECRET_KEY=ISI_RANDOM_SECRET_PANJANG
PROD_TOKEN_EXPIRY=86400

PROD_MIDTRANS_IS_PRODUCTION=true
PROD_MIDTRANS_SERVER_KEY=ISI_MIDTRANS_SERVER_KEY_PRODUCTION
PROD_MIDTRANS_CLIENT_KEY=ISI_MIDTRANS_CLIENT_KEY_PRODUCTION
PROD_MERCHANT_ID=ISI_MERCHANT_ID_PRODUCTION

PROD_SMTP_HOST=smtp.gmail.com
PROD_SMTP_PORT=587
PROD_SMTP_USER=ISI_EMAIL_SMTP
PROD_SMTP_PASSWORD=ISI_APP_PASSWORD_SMTP
PROD_FROM_EMAIL=noreply@tocpnsutbk.com
PROD_FROM_NAME=TO CPNS UTBK
```

### Cara mencari nilai yang belum pasti

Untuk Rumahweb / cPanel:
- `FTP_HOST`: cek email aktivasi hosting, menu `FTP Accounts`, atau `General Information` di cPanel.
- `FTP_USERNAME` dan `FTP_PASSWORD`: pakai akun FTP yang punya akses ke `public_html`.
- `PROD_DB_HOST`, `PROD_DB_NAME`, `PROD_DB_USER`, `PROD_DB_PASSWORD`: cek di menu `MySQL Databases`.

Untuk Midtrans:
- buka dashboard Midtrans production
- ambil `Server Key`, `Client Key`, dan `Merchant ID`

Untuk JWT:
- buat string random panjang, minimal 32 karakter
- contoh format aman: gabungan huruf besar, huruf kecil, angka, dan simbol

Untuk SMTP:
- kalau pakai Gmail, gunakan `smtp.gmail.com`, port `587`, dan `App Password`

## Langkah 3. Jalankan deploy pertama dan tes

Setelah semua secrets terisi:
1. Push perubahan kecil ke branch `main`.
2. Buka tab `Actions` di GitHub.
3. Pilih workflow `Deploy Live`.
4. Pastikan semua step sukses.
5. Tes website live:
   - `https://tocpnsutbk.com`
   - `https://api.tocpnsutbk.com/api/questions/packages`
6. Tes login.
7. Tes panel admin.
8. Tes payment flow kalau Midtrans production sudah aktif.

Kalau job gagal:
- cek step yang merah di GitHub Actions
- paling sering masalah ada di `FTP_HOST`, `FTP_USERNAME`, `FTP_PASSWORD`, atau secret yang belum terisi
- kalau frontend sukses tapi backend gagal, biasanya masalah ada di credential FTP atau file `.env` production

## Catatan penting

- Workflow ini mengasumsikan frontend live ada di `public_html` dan backend live ada di `public_html/api`.
- Workflow ini belum menjalankan migrasi database otomatis. Kalau ada perubahan schema database, update database production tetap perlu dilakukan terpisah.
- Workflow ini memakai deploy FTP langsung ke hosting, jadi perubahan code akan live setelah job sukses.
- Karena deploy frontend diarahkan ke `public_html`, workflow ini sengaja tidak melakukan delete sinkron penuh supaya folder `api/` tidak ikut terhapus.
- Secara lokal, folder ini bukan git root. Kalau repo GitHub kamu root-nya berbeda, file workflow harus berada di root repo GitHub tersebut, bukan hanya di subfolder project.
