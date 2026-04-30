import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../api';

function parseScoreDetails(rawValue) {
  if (!rawValue) {
    return null;
  }

  if (typeof rawValue === 'object') {
    return rawValue;
  }

  try {
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    return null;
  }
}

function ReviewOption({ option, isPointQuestion = false }) {
  const optionClasses = !isPointQuestion && option.is_correct
    ? 'border-green-300 bg-green-50'
    : option.is_selected
    ? isPointQuestion ? 'border-blue-200 bg-blue-50' : 'border-red-200 bg-red-50'
    : 'border-gray-200 bg-gray-50';

  return (
    <div className={`rounded-2xl border p-4 ${optionClasses}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <p className="font-semibold text-gray-900">{option.letter}. {option.text || 'Opsi berbasis gambar'}</p>
          {option.image_url && (
            <img
              src={option.image_url}
              alt={`Opsi ${option.letter}`}
              className="mt-3 max-h-64 rounded-xl"
              loading="lazy"
            />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {option.is_selected && (
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
              Jawaban Anda
            </span>
          )}
          {isPointQuestion && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {Number(option.score_value || 0)} poin
            </span>
          )}
          {!isPointQuestion && option.is_correct && (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
              Jawaban Benar
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResultsReview() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

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
          score_details: parseScoreDetails(rawResults.score_details || rawResults.score_details_json),
          review_items: Array.isArray(rawResults.review_items) ? rawResults.review_items : [],
        });
      } catch (err) {
        setError(err.response?.data?.message || 'Gagal memuat pembahasan soal');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [attemptId]);

  const reviewItems = useMemo(
    () => (Array.isArray(results?.review_items) ? results.review_items : []),
    [results?.review_items]
  );

  useEffect(() => {
    if (activeIndex > reviewItems.length - 1) {
      setActiveIndex(0);
    }
  }, [activeIndex, reviewItems.length]);

  const activeItem = reviewItems[activeIndex] || null;
  const scoreDetails = results?.score_details || {};
  const isCpnsPointScore = scoreDetails.scoring_type === 'cpns_skd_points';

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Memuat pembahasan...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
        <div className="text-center">
          <p className="mb-4 text-red-600">{error}</p>
          <button type="button" onClick={() => navigate(`/results/${attemptId}`)} className="btn-primary">
            Kembali ke Hasil
          </button>
        </div>
      </div>
    );
  }

  if (!results || reviewItems.length === 0 || !activeItem) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
        <div className="text-center">
          <p className="mb-4 text-gray-700">Pembahasan soal belum tersedia.</p>
          <button type="button" onClick={() => navigate(`/results/${attemptId}`)} className="btn-primary">
            Kembali ke Hasil
          </button>
        </div>
      </div>
    );
  }

  const isPointQuestion = activeItem.scoring_type === 'point';
  const activeStatusLabel = !activeItem.is_answered
    ? 'Tidak Dijawab'
    : isPointQuestion
    ? `${Number(activeItem.score_awarded || 0)} poin`
    : activeItem.is_correct ? 'Benar' : 'Salah';
  const activeStatusClasses = !activeItem.is_answered
    ? 'bg-gray-100 text-gray-700'
    : isPointQuestion
    ? 'bg-blue-100 text-blue-700'
    : activeItem.is_correct
    ? 'bg-green-100 text-green-700'
    : 'bg-red-100 text-red-700';

  return (
    <div className="min-h-screen bg-gray-100 py-8 sm:py-12">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Pembahasan Tryout</p>
              <h1 className="mt-2 text-3xl font-bold text-gray-900">Review Jawaban Anda</h1>
              <p className="mt-2 text-sm text-gray-600">
                Pilih nomor soal untuk melihat jawaban Anda, jawaban benar, dan catatan pembahasan.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate(`/results/${attemptId}`)}
                className="btn-outline"
              >
                Kembali ke Hasil
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-600">Total Soal</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{results.total_questions}</p>
            </div>
            {isCpnsPointScore ? (
              <>
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-sm text-blue-700">Total Skor</p>
                  <p className="mt-1 text-2xl font-bold text-blue-700">
                    {Number(scoreDetails.total_score || results.score).toLocaleString('id-ID')} poin
                  </p>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm text-gray-600">Status PG</p>
                  <p className={`mt-1 text-2xl font-bold ${scoreDetails.passing?.passed_all ? 'text-green-700' : 'text-red-700'}`}>
                    {scoreDetails.passing?.passed_all ? 'Lulus' : 'Belum'}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
                  <p className="text-sm text-green-700">Jawaban Benar</p>
                  <p className="mt-1 text-2xl font-bold text-green-700">{results.correct_answers}</p>
                </div>
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm text-red-700">Jawaban Salah</p>
                  <p className="mt-1 text-2xl font-bold text-red-700">{results.total_questions - results.correct_answers}</p>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Navigasi Soal</h2>
              <p className="text-sm text-gray-600">Hijau berarti benar, merah berarti salah, biru berarti soal berpoin TKP, abu berarti tidak dijawab.</p>
            </div>
            <p className="text-sm font-semibold text-gray-500">
              Soal aktif: {activeItem.number} / {reviewItems.length}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {reviewItems.map((item, index) => {
              const chipClasses = !item.is_answered
                ? 'border-gray-200 bg-gray-100 text-gray-700'
                : item.scoring_type === 'point'
                ? 'border-blue-300 bg-blue-100 text-blue-800'
                : item.is_correct
                ? 'border-green-300 bg-green-100 text-green-800'
                : 'border-red-300 bg-red-100 text-red-800';

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={[
                    'flex h-12 min-w-[3rem] items-center justify-center rounded-2xl border px-4 text-sm font-bold transition',
                    chipClasses,
                    index === activeIndex ? 'ring-2 ring-blue-500 ring-offset-2' : '',
                  ].join(' ')}
                  aria-current={index === activeIndex ? 'true' : 'false'}
                >
                  {item.number}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-4 border-b border-gray-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-600">
                Soal {activeItem.number}
                {activeItem.section_name ? ` • ${activeItem.section_name}` : ''}
              </p>
              {activeItem.question_text && (
                <p className="mt-3 whitespace-pre-line text-xl font-semibold text-gray-900">
                  {activeItem.question_text}
                </p>
              )}
            </div>
            <span className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold ${activeStatusClasses}`}>
              {activeStatusLabel}
            </span>
          </div>

          {activeItem.question_image_url && (
            <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <img
                src={activeItem.question_image_url}
                alt={`Soal ${activeItem.number}`}
                className="mx-auto max-h-[28rem] w-auto rounded-xl"
                loading="lazy"
              />
            </div>
          )}

          <div className="space-y-3">
            {activeItem.options.map((option) => (
              <ReviewOption
                key={option.id || `${activeItem.id}-${option.letter}`}
                option={option}
                isPointQuestion={isPointQuestion}
              />
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <p className="text-sm font-semibold text-blue-800">Catatan Pembahasan</p>
            <p className="mt-2 whitespace-pre-line text-sm text-blue-900">
              {activeItem.explanation_notes || 'Pembahasan untuk soal ini belum diisi admin.'}
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={() => setActiveIndex((current) => Math.max(0, current - 1))}
              disabled={activeIndex <= 0}
              className="btn-outline disabled:opacity-50"
            >
              ← Soal Sebelumnya
            </button>
            <button
              type="button"
              onClick={() => setActiveIndex((current) => Math.min(reviewItems.length - 1, current + 1))}
              disabled={activeIndex >= reviewItems.length - 1}
              className="btn-primary disabled:opacity-50"
            >
              Soal Berikutnya →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
