import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import GoogleAuthButton from '../components/GoogleAuthButton';
import { clearPendingGoogleCredential, getPendingGoogleCredential } from '../utils/googleAuth';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [googleRedirectInProgress, setGoogleRedirectInProgress] = useState(false);
  const { register, registerWithGoogle, resendVerification, loading, error: authError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const hasGoogleAuth = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim());

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

  const completeGoogleRegistration = useCallback(async (credential) => {
    setError('');
    setInfoMessage('');
    setSuccessMessage('');
    setGoogleRedirectInProgress(true);

    const result = await registerWithGoogle(credential);
    if (result.success) {
      clearPendingGoogleCredential();
      navigate('/');
    } else {
      clearPendingGoogleCredential();
      setGoogleRedirectInProgress(false);
      setError(result.message || 'Daftar dengan Google gagal.');
    }
  }, [navigate, registerWithGoogle]);

  const handleGoogleRegister = useCallback(async (credential) => {
    await completeGoogleRegistration(credential);
  }, [completeGoogleRegistration]);

  useEffect(() => {
    if (!hasGoogleAuth) {
      return;
    }

    const pendingCredential = getPendingGoogleCredential();
    const requiresGoogleRegistration = Boolean(location.state?.googleRegistrationRequired);
    if (!requiresGoogleRegistration || !pendingCredential) {
      return;
    }

    clearPendingGoogleCredential();

    if (location.state?.email) {
      setEmail(location.state.email);
      setRegisteredEmail(location.state.email);
    }

    if (location.state?.fullName) {
      setFullName(location.state.fullName);
    }

    setInfoMessage('Menyelesaikan pendaftaran Google Anda...');
    completeGoogleRegistration(pendingCredential);
  }, [completeGoogleRegistration, hasGoogleAuth, location.state]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 relative overflow-hidden">
        {googleRedirectInProgress && (
          <div className="absolute inset-0 z-10 bg-white/90 backdrop-blur-[1px] flex items-center justify-center px-6">
            <div className="w-full max-w-sm rounded-2xl border border-blue-100 bg-white shadow-lg p-6 text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
              <h2 className="text-lg font-bold text-slate-800">Menyelesaikan Daftar Google</h2>
              <p className="text-sm text-slate-600 mt-2">
                Kami sedang mengaktifkan akun Anda dan akan langsung melanjutkan login otomatis.
              </p>
            </div>
          </div>
        )}

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600">Ujiin</h1>
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

        {location.state?.googleRegistrationRequired && !error && (
          <div className="bg-slate-100 border border-slate-300 text-slate-700 px-4 py-3 rounded mb-4">
            Akun Google Anda belum terdaftar. Kami sedang melanjutkan proses daftar dengan Google, lalu akun akan langsung login otomatis.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 font-semibold mb-2">Nama Lengkap</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 disabled:bg-slate-100"
              placeholder="John Doe"
              required
              disabled={googleRedirectInProgress}
            />
          </div>

          <div className="mb-4">
            <p className="mb-2 text-sm font-semibold text-red-600">
              * gunakan email aktif untuk melakukan verifikasi. *
            </p>
            <label className="block text-gray-700 font-semibold mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 disabled:bg-slate-100"
              placeholder="you@example.com"
              required
              disabled={googleRedirectInProgress}
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
              disabled={googleRedirectInProgress}
            />
            <p className="text-gray-500 text-sm mt-1">Minimal 6 karakter</p>
          </div>

          <button
            type="submit"
            disabled={loading || googleRedirectInProgress}
            className="w-full btn-primary mb-4 disabled:opacity-50"
          >
            {googleRedirectInProgress ? 'Menyiapkan Akun Google...' : loading ? 'Memproses...' : 'Daftar'}
          </button>

          <p className="text-sm text-gray-500 text-center mb-4">
            Dengan mendaftar, Anda menyetujui{' '}
            <Link to="/terms" className="text-blue-600 font-semibold hover:underline">
              Syarat &amp; Ketentuan
            </Link>{' '}
            ,{' '}
            <Link to="/terms#privacy-policy" className="text-blue-600 font-semibold hover:underline">
              Kebijakan Privasi
            </Link>
            , dan memahami{' '}
            <Link to="/terms#refund-policy" className="text-blue-600 font-semibold hover:underline">
              Kebijakan Refund
            </Link>
            .
          </p>
        </form>

        {hasGoogleAuth && (
          <>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-[0.2em] text-gray-400">
                <span className="bg-white px-3">Atau daftar dengan Google</span>
              </div>
            </div>

            <div className="mb-6">
              <GoogleAuthButton
                onCredential={handleGoogleRegister}
                disabled={loading || googleRedirectInProgress}
                text="signup_with"
                locale="id"
              />
            </div>
          </>
        )}

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
              disabled={loading || googleRedirectInProgress}
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
