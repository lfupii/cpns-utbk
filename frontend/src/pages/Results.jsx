import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../api';
import { formatDate, formatDurationSeconds } from '../utils/date';

const RESULT_EMAIL_STATUS_KEY = 'resultEmailStatusMessage';

export default function Results() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [statusTone, setStatusTone] = useState('info');
  const [resendingEmail, setResendingEmail] = useState(false);

  useEffect(() => {
    const flashMessage = window.sessionStorage.getItem(RESULT_EMAIL_STATUS_KEY);
    if (!flashMessage) {
      return;
    }

    const normalized = flashMessage.toLowerCase();
    setStatusMessage(flashMessage);
    setStatusTone(normalized.includes('belum berhasil') ? 'warning' : 'success');
    window.sessionStorage.removeItem(RESULT_EMAIL_STATUS_KEY);
  }, []);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const response = await apiClient.get(`/test/results?attempt_id=${attemptId}`);
        const rawResults = response.data.data;
        setResults({
          ...rawResults,
          total_questions: Number(rawResults.total_questions || 0),
          correct_answers: Number(rawResults.correct_answers || 0),
          score: Number(rawResults.score || 0),
          percentage: Number(rawResults.percentage || 0),
          time_taken: rawResults.time_taken == null ? null : Number(rawResults.time_taken),
        });
      } catch (err) {
        setError(err.response?.data?.message || 'Gagal memuat hasil test');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [attemptId]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={() => navigate('/')} className="btn-primary">
            Kembali ke Home
          </button>
        </div>
      </div>
    );
  }

  if (!results) {
    return <div className="min-h-screen flex items-center justify-center">Hasil tryout tidak ditemukan.</div>;
  }

  const percentage = Number.isFinite(results.percentage) ? results.percentage : 0;
  const score = Number.isFinite(results.score) ? results.score : 0;
  const scoreColor = percentage >= 75 ? 'text-green-600' :
    percentage >= 50 ? 'text-yellow-600' : 'text-red-600';
  const statusClasses = statusTone === 'warning'
    ? 'mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800'
    : 'mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800';

  const handleResendEmail = async () => {
    setResendingEmail(true);
    setError('');

    try {
      const response = await apiClient.post('/test/resend-result-email', {
        attempt_id: Number(attemptId),
      });
      setStatusMessage(response.data?.message || 'Hasil tryout berhasil dikirim ulang ke email Anda.');
      setStatusTone('success');
    } catch (err) {
      setStatusMessage(
        err.response?.data?.message ||
          'Email hasil tryout belum berhasil dikirim ulang. Silakan coba lagi sebentar.'
      );
      setStatusTone('warning');
    } finally {
      setResendingEmail(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 sm:py-12">
      <div className="container mx-auto max-w-2xl px-4">
        {statusMessage && (
          <div className={statusClasses}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p>{statusMessage}</p>
            </div>
          </div>
        )}

        {/* Result Card */}
        <div className="card text-center mb-8">
          <h1 className="mb-8 text-3xl font-bold sm:text-4xl">Test Selesai!</h1>

          {/* Score Circle */}
          <div className="mb-8">
            <div className="mx-auto mb-6 flex h-36 w-36 items-center justify-center rounded-full border-8 border-blue-600 sm:h-48 sm:w-48">
              <div className="text-center">
                <p className={`text-4xl font-bold sm:text-5xl ${scoreColor}`}>{percentage.toFixed(1)}%</p>
                <p className="text-gray-600 text-sm">Nilai Anda</p>
              </div>
            </div>
          </div>

          {/* Results Summary */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-gray-600 text-sm">Total Soal</p>
                <p className="text-2xl font-bold">{results.total_questions}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Benar</p>
                <p className="text-2xl font-bold text-green-600">{results.correct_answers}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Salah</p>
                <p className="text-2xl font-bold text-red-600">
                  {results.total_questions - results.correct_answers}
                </p>
              </div>
            </div>
          </div>

          {/* Grade */}
          <div className="mb-8">
            <p className="text-gray-600 mb-2">Nilai Akhir</p>
            <p className={`text-3xl font-bold sm:text-4xl ${scoreColor}`}>{score.toFixed(2)}</p>
          </div>

          {/* Evaluation */}
          <div className={`p-6 rounded-lg mb-8 ${
            percentage >= 75 ? 'bg-green-100 text-green-800' :
            percentage >= 50 ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            <p className="font-bold text-lg mb-2">
              {percentage >= 75 ? '🎉 Selamat! Nilai Anda Sangat Bagus!' :
               percentage >= 50 ? '👍 Bagus! Terus tingkatkan! ' :
               '📚 Perlu lebih banyak belajar. Coba lagi!'}
            </p>
            <p className="text-sm">
              {percentage >= 75 ? 'Anda telah menguasai materi dengan baik.' :
               percentage >= 50 ? 'Anda sudah cukup. Pelajari bagian yang lemah untuk hasil lebih baik.' :
               'Perbanyak latihan dan pembelajaran untuk meningkatkan skor Anda.'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 flex-col sm:flex-row">
            <button
              type="button"
              onClick={handleResendEmail}
              disabled={resendingEmail}
              className="btn-outline flex-1 disabled:opacity-50"
            >
              {resendingEmail ? 'Mengirim Ulang...' : 'Kirim Ulang Hasil ke Email'}
            </button>
            <button
              onClick={() => navigate('/')}
              className="btn-primary flex-1"
            >
              Kembali ke Beranda
            </button>
            <button
              onClick={() => navigate('/#paket')}
              className="btn-outline flex-1"
            >
              Lihat Paket Lain
            </button>
          </div>
        </div>

        {/* Additional Info */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Informasi Hasil Test</h2>
          <div className="space-y-3 text-sm">
            <div className="flex flex-col gap-1 pb-3 border-b border-gray-200 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-gray-600">Tanggal Test:</span>
              <span className="font-semibold sm:text-right">{formatDate(results.created_at)}</span>
            </div>
            <div className="flex flex-col gap-1 pb-3 border-b border-gray-200 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-gray-600">Waktu Pengerjaan:</span>
              <span className="font-semibold sm:text-right">
                {formatDurationSeconds(results.time_taken)}
              </span>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-gray-600">ID Hasil Test:</span>
              <span className="break-all font-semibold text-xs sm:text-right">{results.id}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
