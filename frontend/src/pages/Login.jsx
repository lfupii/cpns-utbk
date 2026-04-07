import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [showResendButton, setShowResendButton] = useState(false);
  const { login, resendVerification, loading, error: authError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');
    setShowResendButton(false);

    const result = await login(email, password);
    if (result.success) {
      navigate('/');
    } else {
      setError(result.message || 'Login gagal. Periksa email dan password Anda.');
      setShowResendButton(Boolean(result.data?.requires_email_verification));
    }
  };

  const handleResendVerification = async () => {
    const targetEmail = email.trim().toLowerCase();
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
          <p className="text-gray-600 mt-2">Platform Tryout CPNS & UTBK 2026</p>
        </div>

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
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary mb-4 disabled:opacity-50"
          >
            {loading ? 'Memproses...' : 'Login'}
          </button>
        </form>

        {showResendButton && (
          <button
            type="button"
            onClick={handleResendVerification}
            disabled={loading}
            className="w-full btn btn-outline mb-4 disabled:opacity-50"
          >
            Kirim ulang email verifikasi
          </button>
        )}

        <div className="text-center">
          <p className="text-gray-600">Belum punya akun?{' '}
            <Link to="/register" className="text-blue-600 font-semibold hover:underline">
              Daftar sekarang
            </Link>
          </p>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500 text-center">
            Gunakan email yang sudah diverifikasi untuk login dan menerima hasil tryout.
          </p>
          <p className="text-sm text-gray-500 text-center mt-3">
            Butuh informasi legal atau review merchant? Lihat{' '}
            <Link to="/terms" className="text-blue-600 font-semibold hover:underline">
              Syarat
            </Link>
            ,{' '}
            <Link to="/refund-policy" className="text-blue-600 font-semibold hover:underline">
              Kebijakan Refund
            </Link>
            ,{' '}
            <Link to="/privacy-policy" className="text-blue-600 font-semibold hover:underline">
              Kebijakan Privasi
            </Link>
            , dan{' '}
            <Link to="/midtrans-review" className="text-blue-600 font-semibold hover:underline">
              panduan reviewer
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
