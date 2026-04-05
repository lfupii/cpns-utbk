# ✅ Setup Selesai! - Quick Start Guide

## Status Saat Ini

✅ MySQL 8.4 - **Running**  
✅ Database - **Created & Populated**  
✅ Backend PHP - **Running on port 8000**  
❌ Frontend React - **Belum setup**

---

## 📍 Backend Status

**Backend Server URL**: `http://localhost:8000/index.php/api`

**Test API (Copy-paste di browser):**
```
http://localhost:8000/index.php/api/questions/packages
```

**Response**: JSON dengan 2 paket aktif (CPNS Intensif + UTBK Intensif) ✓

---

## 🚀 Step Selanjutnya: Setup Frontend

**JANGAN CLOSE terminal yang menjalankan backend!** Buka terminal baru untuk frontend.

### Terminal Baru (Frontend)

```bash
# 1. Navigate ke frontend folder
cd /Users/luthfifadhlurrohman/Documents/cpns-utbk/frontend

# 2. Install dependencies (jika belum)
npm install

# 3. Update .env file untuk backend URL
# File: .env (create dari .env.example jika belum ada)
VITE_API_URL=http://localhost:8000/index.php

# 4. Jalankan development server
npm run dev
```

**Output yang diharapkan:**
```
VITE v5.0.8 ready in XXX ms
➜ Local:   http://localhost:5173/
```

---

## 🌐 Akses Aplikasi

**Setelah frontend running, buka di browser:**

```
http://localhost:5173
```

### Test Login

```
Email: test@example.com
Password: test1234
```

---

## 📋 Checklist Terminal Setup

Anda membutuhkan **minimal 2 terminal running**:

```
✅ Terminal 1 (ACTIVE - Backend)
$ cd backend && php -S localhost:8000
Development Server (http://127.0.0.1:8000) started
[Listening...]

✅ Terminal 2 (ACTIVE - Frontend)  
$ cd frontend && npm run dev
VITE v5.0.8 ready in XXX ms
➜ Local:   http://localhost:5173/
```

**MySQL running di background** (via Homebrew service)
```bash
# Check status
brew services list | grep mysql

# Should show: mysql@8.4 started
```

---

## 🔑 Important Files Modified

1. **backend/config/Database.php**
   - Changed `DB_HOST` dari `localhost` ke `127.0.0.1`
   - Untuk fix MySQL socket connection issue

2. Database struktur:
   - 10 tables sudah created
   - Sample data sudah populated
   - Test user sudah ada

---

## 🛠️ Jika Ada Error

### Backend 404 Error
**Jika akses `http://localhost:8000/api/...` return 404:**  
Gunakan path lengkap: `http://localhost:8000/index.php/api/...`

### Frontend CORS Error
**Jika frontend error connect ke backend:**  
1. Pastikan backend running (`php -S localhost:8000`)
2. Check `.env` file punya `VITE_API_URL=http://localhost:8000/index.php`
3. Refresh browser (Ctrl+Shift+Delete)

### MySQL Can't Connect
```bash
# Check if MySQL running
brew services list

# Restart if needed
brew services restart mysql@8.4
```

---

## 📚 Dokumentasi Lengkap

Untuk penjelasan detail, buka:

- **docs/SETUP.md** - Setup instructions
- **docs/API.md** - API documentation  
- **docs/PAYMENT.md** - Payment system
- **docs/SETUP-DETAILED.md** - Troubleshooting detail

---

## 🎯 Next Steps

1. **Setup Frontend** (follow instruksi di atas)
2. **Test Login** dengan test account
3. **Browse Packages** - pilih paket test
4. **Setup Midtrans** - untuk payment gateway (optional untuk testing lokal)
5. **Explore Application** - coba semua fitur

---

## 💾 Commands Reference

```bash
# Check MySQL status
brew services list | grep mysql

# Restart MySQL jika ada issue
brew services restart mysql@8.4

# Check backend is running
curl http://localhost:8000/index.php/api/questions/packages

# Stop backend (Close terminal running backend)
# Tidak bisa di-stop via command, harus close terminal

# Check frontend dev server
# Buka http://localhost:5173 di browser
```

---

## 📞 Troubleshooting Quick Links

| Problem | Solution |
|---------|----------|
| MySQL connection error | Change DB_HOST to 127.0.0.1 |
| 404 API error | Use /index.php/api in URL |
| Frontend CORS error | Check backend running & config |
| npm install error | `npm cache clean --force && npm install` |
| Port 8000 already in use | Change port: `php -S localhost:8001` |

---

## ✨ Selamat!

Backend setup **COMPLETE** dan **RUNNING** ✅  
Database **POPULATED** dengan data sample ✅  
Siap untuk frontend setup! 🚀

---

**Status**: Backend & Database Ready  
**Next**: Frontend Setup  
**Estimated Time**: ~5 menit
