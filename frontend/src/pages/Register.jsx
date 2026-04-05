import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const { register, resendVerification, loading, error: authError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');
    setSuccessMessage('');

    if (password.length < 6) {
      setError('Password harus minimal 6 karakter');
      return;
    }

    const result = await register(email, password, fullName);
    if (result.success) {
      setRegisteredEmail(email.trim().toLowerCase());
      setPassword('');
      setSuccessMessage(result.message || 'Registrasi berhasil. Silakan cek email untuk verifikasi akun.');
    } else {
      setRegisteredEmail(result.data?.email || email.trim().toLowerCase());
      setError(result.message || 'Registrasi gagal.');
    }
  };

  const handleResendVerification = async () => {
    const targetEmail = (registeredEmail || email).trim().toLowerCase();
    if (!targetEmail) {
      setError('Masukkan email terlebih dahulu.');
      return;
    }

    setError('');
    setInfoMessage('');
    const result = await resendVerification(targetEmail);
    if (result.success) {
      setInfoMessage(result.message || 'Email verifikasi berhasil dikirim ulang.');
    } else {
      setError(result.message || 'Gagal mengirim ulang email verifikasi.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600">CPNS UTBK</h1>
          <p className="text-gray-600 mt-2">Daftar Akun Baru</p>
        </div>

        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {successMessage}
          </div>
        )}

        {infoMessage && (
          <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4">
            {infoMessage}
          </div>
        )}

        {(error || authError) && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {authError || error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 font-semibold mb-2">Nama Lengkap</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600"
              placeholder="John Doe"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 font-semibold mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600"
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 font-semibold mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600"
              placeholder="••••••••"
              required
            />
            <p className="text-gray-500 text-sm mt-1">Minimal 6 karakter</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary mb-4 disabled:opacity-50"
          >
            {loading ? 'Memproses...' : 'Daftar'}
          </button>
        </form>

        {registeredEmail && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-slate-700">
              Setelah daftar, akun belum langsung aktif. Cek inbox email Anda lalu klik link verifikasi sebelum login.
            </p>
            <p className="text-sm text-slate-500 mt-2 break-all">
              Email verifikasi akan dikirim ke: {registeredEmail}
            </p>
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={loading}
              className="w-full btn btn-outline mt-3 disabled:opacity-50"
            >
              Kirim ulang email verifikasi
            </button>
          </div>
        )}

        {successMessage && (
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full btn btn-outline mb-4"
          >
            Lanjut ke Login
          </button>
        )}

        <div className="text-center">
          <p className="text-gray-600">Sudah punya akun?{' '}
            <Link to="/login" className="text-blue-600 font-semibold hover:underline">
              Login di sini
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
