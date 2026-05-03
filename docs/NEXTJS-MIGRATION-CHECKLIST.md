# Next.js Migration Checklist

Branch kerja migrasi aman: `next.js-v1`

Tujuan Tahap A:
- frontend Next.js bisa dibangun dan diaudit tanpa mengganggu website live
- route lama tetap hidup lewat wrapper `src/app/** -> src/legacy-pages/**`
- backend PHP tetap jadi source of truth untuk auth, payment, question, test, admin

Status global saat dokumen dibuat:
- `frontend/` = frontend Vite live lama
- `frontend-next/` = frontend Next.js migrasi
- deploy live production masih asumsi Vite dan belum boleh dipakai untuk branch migrasi

## 1. Repo / Branch Safety

- [ ] Semua kerja migrasi lanjut di branch `next.js-v1`
- [ ] Jangan merge ke `main` sebelum checklist smoke test selesai
- [ ] Jangan hapus frontend live sebelum parity + deploy final lolos audit
- [ ] Pastikan workflow baru hanya audit branch migrasi, bukan deploy live

## 2. Frontend App Router Shell

Files:
- `frontend-next/src/app/layout.js`
- `frontend-next/src/app/**/page.jsx`
- `frontend-next/src/legacy-pages/**`
- `frontend-next/src/components/**`
- `frontend-next/src/utils/router-shim.jsx`

Checklist:
- [ ] Semua route user-facing lama punya route App Router padanan
- [ ] Wrapper route Next hanya fase transisi, bukan final state
- [ ] Tambah `loading.js`, `error.js`, `not-found.js` untuk route penting bila perlu
- [ ] Hilangkan ketergantungan perilaku `react-router-dom`
- [ ] `router-shim` kompatibel untuk `useNavigate`, `useLocation`, `useParams`, `useSearchParams`
- [ ] Semua akses query string yang mutasi URL benar-benar bekerja

## 3. Session / Auth Layer

Files:
- `frontend-next/src/AuthContext.jsx`
- `frontend-next/src/api.js`
- `frontend-next/src/components/GoogleAuthButton.jsx`
- `frontend-next/src/utils/googleAuth.js`
- `backend/controllers/AuthController.php`

Checklist:
- [ ] Tidak ada akses `window`, `document`, `localStorage`, `sessionStorage` saat server render
- [ ] Hydration auth aman saat page refresh
- [ ] Unauthorized handler tidak loop
- [ ] Login email/password parity dengan app lama
- [ ] Register parity dengan app lama
- [ ] Verify email parity dengan app lama
- [ ] Google login/register parity dengan app lama

## 4. Public Pages

Files:
- `frontend-next/src/app/page.jsx`
- `frontend-next/src/app/contact/page.jsx`
- `frontend-next/src/app/terms/page.jsx`
- `frontend-next/src/legacy-pages/Home.jsx`
- `frontend-next/src/legacy-pages/Contact.jsx`
- `frontend-next/src/legacy-pages/TermsConditions.jsx`

Checklist:
- [ ] Landing page render stabil di desktop/mobile
- [ ] Anchor nav (`/#tentang`, `/#paket`, dll) tetap bekerja
- [ ] SEO metadata dasar diisi
- [ ] Asset public lama tetap termuat

## 5. Payment / Midtrans

Files:
- `frontend-next/src/app/payment/[packageId]/page.jsx`
- `frontend-next/src/legacy-pages/Payment.jsx`
- `backend/controllers/PaymentController.php`
- `backend/utils/MidtransHandler.php`
- `backend/config/Database.php`

Checklist:
- [ ] Payment page load snap script benar untuk sandbox/production
- [ ] `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` dipakai di frontend Next
- [ ] `FRONTEND_URL` backend mengarah ke domain frontend Next target
- [ ] `finish_url` balik ke route payment Next
- [ ] Confirm payment tetap jalan
- [ ] Retry / pending flow tetap jalan
- [ ] Midtrans webhook tetap ke backend PHP, bukan ke Next
- [ ] Test nominal kecil sandbox lolos end-to-end

## 6. Learning / Test / Result

Files:
- `frontend-next/src/app/learning/**`
- `frontend-next/src/app/test/**`
- `frontend-next/src/app/results/**`
- `frontend-next/src/legacy-pages/Learning.jsx`
- `frontend-next/src/legacy-pages/Test.jsx`
- `frontend-next/src/legacy-pages/Results.jsx`
- `frontend-next/src/legacy-pages/ResultsReview.jsx`
- `frontend-next/src/legacy-pages/MiniTestReview.jsx`
- `backend/controllers/TestController.php`
- `backend/controllers/QuestionController.php`

Checklist:
- [ ] Load paket dan materi berhasil
- [ ] Mini test route dedicated berhasil
- [ ] Start test berhasil
- [ ] Save jawaban otomatis berhasil
- [ ] Submit hasil berhasil
- [ ] Review hasil berhasil
- [ ] Resume session / local cache tetap aman

## 7. Admin

Files:
- `frontend-next/src/app/admin/**`
- `frontend-next/src/legacy-pages/AdminPanel.jsx`
- `frontend-next/src/legacy-pages/AdminQuestionEditor.jsx`
- `frontend-next/src/legacy-pages/AdminMiniTestQuestionEditor.jsx`
- `frontend-next/src/legacy-pages/AdminLearningMaterialEditor.jsx`
- `backend/controllers/AdminController.php`

Checklist:
- [ ] Admin route terproteksi
- [ ] Query params editor sinkron dengan URL
- [ ] Upload media/editor rich text tetap jalan
- [ ] OCR/PDF asset tersedia
- [ ] Semua editor berat lolos smoke test manual

## 8. Assets / OCR / PDF

Files:
- `frontend-next/public/pdfjs/**`
- `frontend-next/public/tesseract/**`
- `frontend-next/scripts/sync-ocr-assets.mjs`

Checklist:
- [ ] `eng.traineddata.gz` tersedia saat build
- [ ] PDF worker termuat di browser
- [ ] OCR fallback jelas bila asset lokal hilang
- [ ] Tidak ada asset build yang cuma ada di `frontend/` live

## 9. Env / Config

Files:
- `frontend-next/.env.example`
- `backend/.env.example`
- `.github/workflows/*.yml`

Checklist:
- [ ] Frontend Next hanya pakai `NEXT_PUBLIC_*`
- [ ] Backend hanya pakai env backend sendiri
- [ ] CORS origin local Next = `http://127.0.0.1:3000,http://localhost:3000`
- [ ] Secret production tidak campur env Vite lama
- [ ] Google client ID tersedia di frontend + backend jika diperlukan

## 10. CI / Audit

Checklist:
- [ ] Ada workflow audit untuk branch migrasi
- [ ] Workflow audit pakai Node >= 20.9
- [ ] `npm run lint` hijau atau debt yang sengaja ditoleransi terdokumentasi
- [ ] `npm run build` hijau di CI migrasi
- [ ] Audit backend minimal syntax/lint/health smoke siap ditambah

## 11. Smoke Test Sebelum Merge

- [ ] Home
- [ ] Login
- [ ] Register
- [ ] Verify email
- [ ] Google auth
- [ ] Active packages
- [ ] Payment create
- [ ] Payment finish/pending/success
- [ ] Learning material
- [ ] Mini test
- [ ] Main test
- [ ] Results
- [ ] Results review
- [ ] Profile update
- [ ] Admin dashboard
- [ ] Admin question editor
- [ ] Admin mini test editor
- [ ] Admin learning editor

## 12. Exit Criteria Sebelum Hapus Frontend Live Lama

- [ ] Semua route parity selesai
- [ ] Workflow deploy final Next sudah dipilih dan diuji
- [ ] Domain/origin/secret production sudah disesuaikan
- [ ] Midtrans production test pass
- [ ] Google production origin pass
- [ ] Rollback plan tertulis
- [ ] Branch `next.js-v1` di-review dan lolos audit
- [ ] Baru merge ke `main`
- [ ] Baru hapus frontend Vite lama atau ganti `frontend-next/` menjadi `frontend/`
