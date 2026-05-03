"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from '@/utils/router-shim';
import { useAuth } from '../AuthContext';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const { getVerificationStatus, verifyEmail, resendVerification, loading } = useAuth();
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('Memeriksa link verifikasi...');
  const [email, setEmail] = useState('');
  const [resendMessage, setResendMessage] = useState('');

  const canResend = useMemo(() => email.trim() !== '', [email]);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      if (!token) {
        if (!cancelled) {
          setStatus('invalid');
          setMessage('Token verifikasi tidak ditemukan. Silakan minta kirim ulang email verifikasi.');
        }
        return;
      }

      const result = await getVerificationStatus(token);
      if (cancelled) {
        return;
      }

      if (result.success) {
        setEmail(result.data?.email || '');

        if (result.data?.code === 'already_verified') {
          setStatus('verified');
          setMessage(result.message || 'Email sudah terverifikasi. Silakan login.');
          return;
        }

        setStatus('ready');
        setMessage(result.message || 'Link valid. Lanjutkan verifikasi email.');
        return;
      }

      setEmail(result.data?.email || '');
      if (result.data?.code === 'expired_token') {
        setStatus('expired');
      } else {
        setStatus('invalid');
      }
      setMessage(result.message || 'Link verifikasi tidak valid.');
    }

    loadStatus();

    return () => {
      cancelled = true;
    };
  }, [getVerificationStatus, token]);

  const handleVerify = async () => {
    setResendMessage('');
    const result = await verifyEmail(token);
    if (result.success) {
      setStatus('verified');
      setMessage(result.message || 'Email berhasil diverifikasi. Silakan login.');
      setEmail(result.data?.email || email);
      return;
    }

    setEmail(result.data?.email || email);
    if (result.data?.code === 'expired_token') {
      setStatus('expired');
    } else {
      setStatus('invalid');
    }
    setMessage(result.message || 'Verifikasi email gagal.');
  };

  const handleResend = async () => {
    if (!canResend) {
      setResendMessage('Email tidak tersedia untuk kirim ulang verifikasi.');
      return;
    }

    const result = await resendVerification(email);
    setResendMessage(
      result.success
        ? (result.message || 'Email verifikasi berhasil dikirim ulang.')
        : (result.message || 'Gagal mengirim ulang email verifikasi.')
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600">Ujiin</h1>
          <p className="text-gray-600 mt-2">Verifikasi Email</p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 mb-6">
          <p className="text-slate-800 text-lg font-semibold">
            {status === 'verified' ? 'Email sudah aktif' : 'Status verifikasi email'}
          </p>
          <p className="text-slate-600 mt-2">{message}</p>
          {email && (
            <p className="text-sm text-slate-500 mt-3 break-all">
              Email: {email}
            </p>
          )}
        </div>

        {status === 'ready' && (
          <button
            type="button"
            onClick={handleVerify}
            disabled={loading}
            className="w-full btn-primary mb-4 disabled:opacity-50"
          >
            {loading ? 'Memverifikasi...' : 'Verifikasi Email Sekarang'}
          </button>
        )}

        {(status === 'expired' || status === 'invalid') && canResend && (
          <button
            type="button"
            onClick={handleResend}
            disabled={loading}
            className="w-full btn btn-outline mb-4 disabled:opacity-50"
          >
            {loading ? 'Memproses...' : 'Kirim Ulang Email Verifikasi'}
          </button>
        )}

        {resendMessage && (
          <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4">
            {resendMessage}
          </div>
        )}

        <div className="text-center">
          <Link to="/login" className="text-blue-600 font-semibold hover:underline">
            Kembali ke Login
          </Link>
        </div>
      </div>
    </div>
  );
}
