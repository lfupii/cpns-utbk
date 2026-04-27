import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../api';

function ReviewOption({ option }) {
  const optionClasses = option.is_correct
    ? 'border-green-300 bg-green-50'
    : option.is_selected
    ? 'border-red-200 bg-red-50'
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
          {option.is_correct && (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
              Jawaban Benar
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MiniTestReview() {
  const { packageId, sectionCode } = useParams();
  const navigate = useNavigate();
  const [reviewData, setReviewData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const fetchReview = async () => {
      try {
        const query = new URLSearchParams({
          package_id: String(Number(packageId || 0)),
          section_code: String(sectionCode || ''),
        });
        const response = await apiClient.get(`/learning/section-test/review?${query.toString()}`);
        const payload = response.data?.data || {};
        setReviewData({
          ...payload,
          review_items: Array.isArray(payload.review_items) ? payload.review_items : [],
        });
      } catch (err) {
        setError(err.response?.data?.message || 'Gagal memuat pembahasan mini test');
      } finally {
        setLoading(false);
      }
    };

    fetchReview();
  }, [packageId, sectionCode]);

  const reviewItems = useMemo(
    () => (Array.isArray(reviewData?.review_items) ? reviewData.review_items : []),
    [reviewData?.review_items]
  );

  useEffect(() => {
    if (activeIndex > reviewItems.length - 1) {
      setActiveIndex(0);
    }
  }, [activeIndex, reviewItems.length]);

  const activeItem = reviewItems[activeIndex] || null;
  const result = reviewData?.result || {};
  const totalQuestions = Number(result.total_questions || reviewItems.length || 0);
  const correctAnswers = Number(result.correct_answers || 0);
  const unansweredCount = reviewItems.filter((item) => !item.is_answered).length;
  const wrongAnswers = Math.max(0, totalQuestions - correctAnswers - unansweredCount);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Memuat pembahasan mini test...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
        <div className="text-center">
          <p className="mb-4 text-red-600">{error}</p>
          <button type="button" onClick={() => navigate(`/learning/${packageId}`)} className="btn-primary">
            Kembali ke Mini Test
          </button>
        </div>
      </div>
    );
  }

  if (!reviewData || reviewItems.length === 0 || !activeItem) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
        <div className="text-center">
          <p className="mb-4 text-gray-700">Pembahasan mini test belum tersedia.</p>
          <button type="button" onClick={() => navigate(`/learning/${packageId}`)} className="btn-primary">
            Kembali ke Mini Test
          </button>
        </div>
      </div>
    );
  }

  const activeStatusLabel = !activeItem.is_answered ? 'Tidak Dijawab' : activeItem.is_correct ? 'Benar' : 'Salah';
  const activeStatusClasses = !activeItem.is_answered
    ? 'bg-gray-100 text-gray-700'
    : activeItem.is_correct
    ? 'bg-green-100 text-green-700'
    : 'bg-red-100 text-red-700';

  return (
    <div className="min-h-screen bg-gray-100 py-8 sm:py-12">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Pembahasan Mini Test</p>
              <h1 className="mt-2 text-3xl font-bold text-gray-900">
                {reviewData.section?.name || 'Review Jawaban Mini Test'}
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Pembahasan ini memakai submit mini test terakhir Anda untuk subtest ini.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/learning/${packageId}`)}
              className="btn-outline"
            >
              Kembali ke Mini Test
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-600">Total Soal</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{totalQuestions}</p>
            </div>
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
              <p className="text-sm text-green-700">Jawaban Benar</p>
              <p className="mt-1 text-2xl font-bold text-green-700">{correctAnswers}</p>
            </div>
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700">Jawaban Salah</p>
              <p className="mt-1 text-2xl font-bold text-red-700">{wrongAnswers}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-600">Belum Dijawab</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{unansweredCount}</p>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Navigasi Soal</h2>
              <p className="text-sm text-gray-600">Hijau berarti benar, merah berarti salah, abu berarti tidak dijawab.</p>
            </div>
            <p className="text-sm font-semibold text-gray-500">
              Soal aktif: {activeItem.number} / {reviewItems.length}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {reviewItems.map((item, index) => {
              const chipClasses = !item.is_answered
                ? 'border-gray-200 bg-gray-100 text-gray-700'
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
                {reviewData.section?.name ? ` • ${reviewData.section.name}` : ''}
              </p>
              {activeItem.question_text ? (
                <p className="mt-3 whitespace-pre-line text-xl font-semibold text-gray-900">
                  {activeItem.question_text}
                </p>
              ) : (
                <p className="mt-3 text-sm text-gray-500">Soal ini menggunakan gambar tanpa teks.</p>
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
              <ReviewOption key={option.id || `${activeItem.id}-${option.letter}`} option={option} />
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
