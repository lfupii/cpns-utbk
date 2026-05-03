# Next.js Production Deploy Decision

Keputusan final saat ini:
- frontend Next.js deploy ke host Node terpisah
- backend PHP tetap deploy ke cPanel / `public_html/api`

Alasan:
- Next.js resmi menyatakan deployment `Node.js server` mendukung semua fitur
- static export hanya dukung fitur terbatas
- proyek ini punya route dinamis + auth + payment + admin editor, jadi butuh server Node penuh
- cPanel Node bisa dipakai, tapi lebih tergantung dukungan Passenger/Application Manager dan operasionalnya lebih rapuh

Sumber resmi:
- Next.js Deploying: https://nextjs.org/docs/app/getting-started/deploying
- Next.js Self-Hosting: https://nextjs.org/docs/app/guides/self-hosting
- cPanel Node.js Application: https://docs.cpanel.net/knowledge-base/web-services/how-to-install-a-node.js-application/
- cPanel Application Manager: https://docs.cpanel.net/cpanel/software/application-manager/

## Workflow baru

File:
- `.github/workflows/deploy-nextjs-production.yml`

Sifat:
- manual only (`workflow_dispatch`)
- aman untuk branch migrasi
- tidak mengganti workflow live lama

## Secret yang dibutuhkan

Frontend Next:
- `PROD_NEXT_PUBLIC_API_URL`
- `PROD_NEXT_PUBLIC_IS_PRODUCTION`
- `PROD_NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`
- `PROD_NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- `FRONTEND_SSH_HOST`
- `FRONTEND_SSH_PORT`
- `FRONTEND_SSH_USER`
- `FRONTEND_SSH_PRIVATE_KEY`
- `FRONTEND_DEPLOY_PATH`
- `FRONTEND_RESTART_COMMAND`

Backend PHP:
- tetap reuse secret `PROD_*` backend + `FTP_*`

## Bentuk deploy frontend

Workflow build `output: "standalone"` lalu upload bundle berikut ke host Node:
- `server.js`
- minimal runtime `node_modules` dari standalone output
- `.next/static`
- `public`

Lalu workflow:
1. copy release ke `${FRONTEND_DEPLOY_PATH}/releases/<git-sha>`
2. update symlink `current`
3. jalankan `FRONTEND_RESTART_COMMAND`

Contoh `FRONTEND_RESTART_COMMAND`:
- `pm2 restart ujiin-next --update-env`
- `pm2 start server.js --name ujiin-next`
- `systemctl --user restart ujiin-next`

## Catatan penting

- env `NEXT_PUBLIC_*` dibaca saat build, bukan runtime
- `PROD_FRONTEND_URL` backend harus diarahkan ke domain frontend Next final
- `PROD_CORS_ALLOWED_ORIGINS` backend harus memuat domain frontend Next final
- webhook Midtrans tetap ke backend PHP
- Google Authorized JavaScript Origins harus ditambah domain frontend Next final
