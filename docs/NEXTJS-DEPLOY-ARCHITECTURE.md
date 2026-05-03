# Next.js Deploy Architecture

Dokumen ini bandingkan 2 target deploy final:
- opsi A: Next.js tetap di cPanel
- opsi B: Next.js pindah ke host Node terpisah, backend PHP tetap di cPanel

Rekomendasi utama:
- pilih opsi B bila memungkinkan
- pilih opsi A hanya jika cPanel benar-benar mendukung Node.js app manager / Passenger dengan Node 20+

## Arsitektur Saat Ini

- frontend live lama: Vite static build
- backend live: PHP di `public_html/api`
- deploy live sekarang: FTP mirror static file frontend + backend PHP package

Masalah bila langsung pakai Next penuh di arsitektur lama:
- workflow deploy masih target `frontend/dist`
- source migrasi Next sekarang dipisah di `frontend-next/` agar `main` tetap aman
- Next App Router dengan dynamic route tidak cocok diperlakukan seperti static SPA biasa
- auth, payment, admin editor punya perilaku client-heavy dan route dinamis

## Opsi A: cPanel + Node.js App

Desain:
- domain utama `https://tocpnsutbk.com` -> Next.js Node app
- API tetap `https://api.tocpnsutbk.com` atau `https://tocpnsutbk.com/api` -> backend PHP
- Node app jalan via Passenger / Application Manager

Kelebihan:
- domain tetap sederhana
- frontend dan backend tetap dekat dengan hosting lama
- tidak perlu CDN/proxy lintas provider bila cPanel kuat

Kekurangan:
- banyak shared hosting cPanel tidak stabil untuk Next modern
- restart app, build cache, memory, logging biasanya lebih repot
- Node version sering tertinggal
- deploy pipeline lebih rumit daripada static FTP

Syarat minimum:
- Node 20.9+
- akses Application Manager / Passenger
- bisa jalankan `npm ci` dan `npm run build`
- bisa set startup file Node app
- resource RAM memadai

Pipeline final:
1. GitHub Actions build frontend Next
2. Upload artifact / source ke server Node app
3. Jalankan `npm ci --omit=dev`
4. Jalankan `npm run build`
5. Restart app Node
6. Backend PHP deploy terpisah

Catatan:
- `output: "standalone"` di Next layak dipakai untuk memudahkan packaging
- jangan deploy Next lewat mirror FTP `dist` seperti Vite

## Opsi B: Host Node Terpisah + Backend PHP Tetap di cPanel

Desain:
- domain utama `https://tocpnsutbk.com` -> host Node/Vercel/Railway/Render/VPS
- API PHP tetap `https://api.tocpnsutbk.com`
- frontend panggil backend via `NEXT_PUBLIC_API_URL=https://api.tocpnsutbk.com`

Kelebihan:
- paling cocok untuk Next.js modern
- deploy frontend jauh lebih mudah
- observability dan rollback biasanya lebih baik
- backend PHP live tidak perlu direwrite

Kekurangan:
- dua platform dikelola
- harus rapikan CORS, cookie/token origin, DNS
- cost bisa naik sedikit

Pipeline final:
1. GitHub Actions atau provider CI build frontend Next
2. Deploy frontend ke platform Node target
3. Backend PHP tetap deploy ke cPanel seperti sekarang
4. Update env frontend production ke API backend live

Rekomendasi implementasi:
- frontend: Vercel / VPS Node / Railway / Render
- backend: tetap Rumahweb cPanel
- DNS:
  - `tocpnsutbk.com` -> frontend Next
  - `api.tocpnsutbk.com` -> backend PHP

## Dampak Komponen Integrasi

### GitHub Actions

Saat ini:
- workflow live masih Vite-centric

Nanti:
- pisah workflow `audit-nextjs`
- pisah workflow `deploy-nextjs`
- backend deploy tetap bisa reuse pipeline PHP sekarang
- frontend deploy jangan campur dengan FTP static lama

### Midtrans

Tetap:
- webhook tetap ke backend PHP
- server key tetap hanya di backend

Harus diubah:
- `FRONTEND_URL` backend harus domain frontend Next final
- `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` harus tersedia di frontend
- tes lagi `finish_url` dan halaman payment success/pending

### Google Auth

Harus diubah:
- Authorized JavaScript Origins tambah domain frontend Next final
- local dev ganti ke `http://localhost:3000`
- env frontend pakai `NEXT_PUBLIC_GOOGLE_CLIENT_ID`

### cPanel

Kalau backend tetap di cPanel:
- hampir tidak perlu ubah besar selain env/CORS/domain

Kalau frontend juga di cPanel Node:
- perlu setup app manager
- perlu process restart dan log strategy
- perlu verifikasi limit RAM/CPU/build

## Rekomendasi Final

Paling aman:
1. Tahap A di branch `next.js-v1`
2. Audit frontend Next di CI terpisah
3. Backend PHP tetap live seperti sekarang
4. Pilih opsi B untuk produksi bila ada akses platform Node terpisah
5. Jika harus tetap cPanel, audit dulu support Node 20 + Passenger sebelum ubah workflow live

## Keputusan yang Perlu Kamu Ambil Nanti

- frontend final tetap di cPanel atau pindah ke host Node terpisah
- domain utama pindah ke Next kapan
- API tetap di subdomain sendiri atau path `/api`
- kapan workflow deploy live lama dinonaktifkan
- kapan `frontend-next/` resmi menggantikan `frontend/`
