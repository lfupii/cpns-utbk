# Git History Cleanup Lokal Dulu

Tujuan dokumen ini:
- bersihkan history Git lokal dari file/env sensitif
- rehearsal aman tanpa push ke `origin`
- hindari trigger deploy live sebelum waktunya

## Prinsip aman

- jangan push branch hasil rewrite ke `origin` dulu
- jangan sentuh `main` remote sebelum verifikasi selesai
- kerjakan di clone terpisah atau mirror clone
- backup dulu sebelum rewrite history

## Yang perlu dibersihkan

File:
- `frontend/.env.production`
- `frontend-old/.env.production`

String sensitif lama:
- `OLD_MIDTRANS_CLIENT_KEY_PRODUCTION`
- `OLD_MIDTRANS_CLIENT_KEY_SANDBOX`
- `OLD_ADMIN_EMAIL`
- `OLD_ADMIN_PASSWORD_HASH`
- `OLD_ADMIN_PASSWORD`

## Opsi tool

Paling rapi:
- `git filter-repo`

Fallback:
- `BFG Repo-Cleaner`

Panduan ini pakai `git filter-repo`.

## Rehearsal lokal-only

1. Buat backup branch lokal dari kondisi sekarang.

```bash
git branch backup/pre-history-cleanup
```

2. Buat mirror clone lokal terpisah.

```bash
cd ..
git clone --mirror cpns-utbk cpns-utbk-history-clean
cd cpns-utbk-history-clean
```

3. Siapkan file replace text.

Buat file `replacements.txt` berisi:

```text
literal:OLD_MIDTRANS_CLIENT_KEY_PRODUCTION==>REMOVED_MIDTRANS_CLIENT_KEY
literal:OLD_MIDTRANS_CLIENT_KEY_SANDBOX==>REMOVED_MIDTRANS_CLIENT_KEY
literal:OLD_ADMIN_EMAIL==>REMOVED_ADMIN_EMAIL
literal:OLD_ADMIN_PASSWORD_HASH==>REMOVED_ADMIN_PASSWORD_HASH
literal:OLD_ADMIN_PASSWORD==>REMOVED_ADMIN_PASSWORD
```

Isi placeholder `OLD_*` dari hasil grep lokal Anda. Jangan commit file ini.

4. Rewrite history lokal.

```bash
git filter-repo \
  --invert-paths \
  --path frontend/.env.production \
  --path frontend-old/.env.production
```

5. Jalankan replace text di history yang tersisa.

```bash
git filter-repo --replace-text replacements.txt
```

6. Verifikasi hasil.

```bash
git log --all -- frontend/.env.production frontend-old/.env.production
git grep -n "OLD_MIDTRANS_CLIENT_KEY_PRODUCTION" $(git rev-list --all)
git grep -n "OLD_MIDTRANS_CLIENT_KEY_SANDBOX" $(git rev-list --all)
git grep -n "OLD_ADMIN_EMAIL" $(git rev-list --all)
git grep -n "OLD_ADMIN_PASSWORD" $(git rev-list --all)
git grep -n "OLD_ADMIN_PASSWORD_HASH" $(git rev-list --all)
```

Harapan:
- tidak ada hasil
- atau hanya placeholder/doc baru yang aman

7. Bandingkan dengan repo kerja sekarang.

```bash
git show --stat --summary HEAD
git branch
```

8. Jangan push dulu. Simpan hasil rehearsal lokal.

## Saat nanti siap cutover

Checklist sebelum push rewrite:
- branch kerja sekarang sudah bersih seperti commit lokal ini
- GitHub Secrets tetap benar
- tim tahu SHA history akan berubah
- semua clone lama siap re-clone atau hard reset
- deploy automation dipause atau push ke remote ditunda sampai window aman

Langkah cutover nanti:
1. buat backup remote default branch ke branch/tag terpisah
2. push hasil rewrite ke remote baru atau branch staging dulu
3. review di GitHub
4. baru force-push ke branch target saat window aman
5. minta semua collaborator re-clone

## Catatan live site

Repo ini punya workflow deploy untuk perubahan di `main`.
Jadi history cleanup jangan langsung dilakukan di repo remote aktif tanpa window khusus.
Rehearsal lokal dulu aman. Push rewrite nanti harus disengaja.
