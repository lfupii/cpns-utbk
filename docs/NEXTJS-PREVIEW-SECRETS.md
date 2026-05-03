# Next.js Preview Secrets

Workflow preview:
- `.github/workflows/deploy-nextjs-preview.yml`
- source preview build: `frontend-next/`

Secret yang perlu diisi di GitHub Actions:

Frontend preview build:
- `PREVIEW_NEXT_PUBLIC_API_URL`
- `PREVIEW_NEXT_PUBLIC_IS_PRODUCTION`
- `PREVIEW_NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`
- `PREVIEW_NEXT_PUBLIC_GOOGLE_CLIENT_ID`

Frontend preview deploy:
- `PREVIEW_FRONTEND_SSH_HOST`
- `PREVIEW_FRONTEND_SSH_PORT`
- `PREVIEW_FRONTEND_SSH_USER`
- `PREVIEW_FRONTEND_SSH_PRIVATE_KEY`
- `PREVIEW_FRONTEND_DEPLOY_PATH`
- `PREVIEW_FRONTEND_RESTART_COMMAND`

Nilai minimum yang disarankan:
- `PREVIEW_NEXT_PUBLIC_API_URL=https://api-preview.example.com` atau backend preview/staging
- `PREVIEW_NEXT_PUBLIC_IS_PRODUCTION=false`
- `PREVIEW_NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=` client key sandbox
- `PREVIEW_NEXT_PUBLIC_GOOGLE_CLIENT_ID=` web client ID khusus preview

Contoh restart command:
- `pm2 restart ujiin-next-preview --update-env`
- `pm2 start server.js --name ujiin-next-preview`

Catatan:
- workflow preview default `dry_run=true`
- saat `dry_run=true`, artifact preview tetap dibuild dan diupload, tapi tidak dikirim ke host
- ini aman untuk audit bundle sebelum staging host siap
