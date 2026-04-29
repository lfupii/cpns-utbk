import React, { useCallback, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import GoogleAuthButton from '../components/GoogleAuthButton';
import { setPendingGoogleCredential } from '../utils/googleAuth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [showResendButton, setShowResendButton] = useState(false);
  const [googleRedirectPending, setGoogleRedirectPending] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const { login, loginWithGoogle, resendVerification, loading, error: authError } = useAuth();
  const navigate = useNavigate();
  const hasGoogleAuth = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim());

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');
    setShowResendButton(false);
    setShowEmailForm(true);

    const result = await login(email, password);
    if (result.success) {
      navigate('/');
    } else {
      setError(result.message || 'Login gagal. Periksa email dan password Anda.');
      setShowResendButton(Boolean(result.data?.requires_email_verification));
    }
  };

  const handleResendVerification = async () => {
    setShowEmailForm(true);
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

  const handleGoogleLogin = useCallback(async (credential) => {
    setError('');
    setInfoMessage('');
    setShowResendButton(false);
    setGoogleRedirectPending(false);

    const result = await loginWithGoogle(credential);
    if (result.success) {
      navigate('/');
    } else if (result.data?.requires_google_registration) {
      setGoogleRedirectPending(true);
      setInfoMessage('Akun Google belum terdaftar. Kami sedang mengarahkan Anda ke halaman daftar...');
      setPendingGoogleCredential(credential);
      navigate('/register', {
        state: {
          googleRegistrationRequired: true,
          email: result.data?.email || '',
          fullName: result.data?.full_name || '',
        },
      });
    } else {
      setGoogleRedirectPending(false);
      setError(result.message || 'Login dengan Google gagal.');
    }
  }, [loginWithGoogle, navigate]);

  const handleShowEmailForm = useCallback(() => {
    setShowEmailForm(true);
    setError('');
    setInfoMessage('');
    setGoogleRedirectPending(false);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600">Ujiin</h1>
          <p className="text-gray-600 mt-2">Platform belajar CPNS & UTBK</p>
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

        {hasGoogleAuth && (
          <>
            <div className="mb-6">
              <GoogleAuthButton
                onCredential={handleGoogleLogin}
                disabled={loading || googleRedirectPending}
                text="signin_with"
                locale="id"
              />
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-[0.2em] text-gray-400">
                <span className="bg-white px-3">Atau login dengan email</span>
              </div>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={handleShowEmailForm}
          disabled={googleRedirectPending}
          className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Login dengan Email
        </button>

        {showEmailForm && (
          <form onSubmit={handleSubmit} className="mt-6">
            <div className="mb-4">
              <label className="block text-gray-700 font-semibold mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 disabled:bg-slate-100"
                placeholder="you@example.com"
                required
                disabled={googleRedirectPending}
              />
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 font-semibold mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 disabled:bg-slate-100"
                placeholder="••••••••"
                required
                disabled={googleRedirectPending}
              />
            </div>

            <button
              type="submit"
              disabled={loading || googleRedirectPending}
              className="w-full btn-primary mb-4 disabled:opacity-50"
            >
              {googleRedirectPending ? 'Mengalihkan ke Daftar...' : loading ? 'Memproses...' : 'Login'}
            </button>
          </form>
        )}

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
            <Link to="/terms#refund-policy" className="text-blue-600 font-semibold hover:underline">
              Kebijakan Refund
            </Link>
            ,{' '}
            <Link to="/terms#privacy-policy" className="text-blue-600 font-semibold hover:underline">
              Kebijakan Privasi
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
