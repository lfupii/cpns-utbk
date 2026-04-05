import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../api';

export default function Test() {
  const { packageId } = useParams();
  const navigate = useNavigate();
  const numericPackageId = Number(packageId);

  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attemptId, setAttemptId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const checkAccessAndStartTest = async () => {
      if (!Number.isInteger(numericPackageId) || numericPackageId <= 0) {
        setError('Link test tidak valid. Silakan pilih ulang paket dari halaman utama.');
        setLoading(false);
        return;
      }

      try {
        await apiClient.get(`/test/check-access?package_id=${numericPackageId}`);

        const startResponse = await apiClient.post('/test/start', {
          package_id: numericPackageId
        });

        const newAttemptId = startResponse.data.data.attempt_id;
        setAttemptId(newAttemptId);

        const questionsResponse = await apiClient.get(
          `/questions/list?package_id=${numericPackageId}&attempt_id=${newAttemptId}`
        );
        setQuestions(questionsResponse.data.data);

        const packagesResponse = await apiClient.get('/questions/packages');
        const pkg = packagesResponse.data.data.find((p) => Number(p.id) === numericPackageId);
        if (!pkg) {
          setError('Paket test tidak ditemukan. Silakan pilih ulang dari halaman utama.');
          return;
        }

        setTimeLeft(pkg.time_limit * 60);
        setStarted(true);
      } catch (err) {
        setError(err.response?.data?.message || 'Gagal mengakses test ini');
      } finally {
        setLoading(false);
      }
    };

    checkAccessAndStartTest();
  }, [numericPackageId]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const answersArray = questions.map((q) => ({
        question_id: q.id,
        option_id: answers[q.id] ?? null
      }));

      await apiClient.post('/test/submit', {
        attempt_id: attemptId,
        answers: answersArray
      });

      navigate(`/results/${attemptId}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan jawaban');
      setIsSubmitting(false);
    }
  }, [answers, attemptId, isSubmitting, navigate, questions]);

  useEffect(() => {
    if (!timeLeft || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [handleSubmit, timeLeft]);

  const handleAnswerSelect = (questionId, optionId) => {
    setAnswers({
      ...answers,
      [questionId]: Number(optionId)
    });
  };

  const currentQuestion = questions[currentQuestionIndex];
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading soal...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <p className="text-red-600 mb-4">{error}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => navigate('/#paket')} className="btn-primary">
              Pilih Paket Lagi
            </button>
            <button onClick={() => navigate('/')} className="btn-outline">
              Kembali ke Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!started || !currentQuestion) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold">Test Tryout</h1>
            <div className="flex gap-8 items-center">
              <div>
                <p className="text-gray-600 text-sm">Soal</p>
                <p className="font-bold">{currentQuestionIndex + 1} / {questions.length}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Sisa Waktu</p>
                <p className={`font-bold text-lg ${timeLeft < 300 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatTime(timeLeft)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Question Panel */}
          <div className="lg:col-span-3">
            <div className="card">
              <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold">Soal Nomor {currentQuestionIndex + 1}</h2>
                  <span className={`px-3 py-1 rounded text-sm font-semibold ${
                    currentQuestion.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                    currentQuestion.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {currentQuestion.difficulty === 'easy' ? 'Mudah' :
                     currentQuestion.difficulty === 'medium' ? 'Sedang' : 'Sulit'}
                  </span>
                </div>
                <p className="text-gray-800 leading-relaxed text-lg">{currentQuestion.question_text}</p>
              </div>

              <div className="space-y-3 mb-8">
                {currentQuestion.options?.map((option) => (
                  <label key={option.id} className="flex items-start p-4 border-2 rounded-lg cursor-pointer transition hover:border-blue-500" style={{
                    borderColor: answers[currentQuestion.id] === Number(option.id) ? '#2563eb' : '#d1d5db'
                  }}>
                    <input
                      type="radio"
                      name={`question-${currentQuestion.id}`}
                      value={option.id ?? ''}
                      checked={answers[currentQuestion.id] === Number(option.id)}
                      onChange={() => handleAnswerSelect(currentQuestion.id, option.id)}
                      className="mt-1 w-5 h-5 accent-blue-600"
                    />
                    <div className="ml-4">
                      <p className="font-semibold">{option.letter}.</p>
                      <p className="text-gray-800">{option.text}</p>
                    </div>
                  </label>
                ))}
              </div>

              {/* Navigation Buttons */}
              <div className="flex gap-4 pt-6 border-t border-gray-200">
                <button
                  onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                  disabled={currentQuestionIndex === 0}
                  className="btn-outline disabled:opacity-50"
                >
                  ← Sebelumnya
                </button>
                <button
                  onClick={() => setCurrentQuestionIndex(Math.min(questions.length - 1, currentQuestionIndex + 1))}
                  disabled={currentQuestionIndex === questions.length - 1}
                  className="btn-outline disabled:opacity-50"
                >
                  Selanjutnya →
                </button>
                {currentQuestionIndex === questions.length - 1 && (
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="ml-auto btn-primary disabled:opacity-50"
                  >
                    {isSubmitting ? 'Submitting...' : 'Selesai & Submit'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Question Navigation Sidebar */}
          <div className="card max-h-96 overflow-y-auto">
            <h3 className="font-bold mb-4">Navigasi Soal</h3>
            <div className="grid grid-cols-4 gap-2">
              {questions.map((q, idx) => (
                <button
                  key={q.id}
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className={`w-full py-2 rounded font-semibold transition ${
                    idx === currentQuestionIndex
                      ? 'bg-blue-600 text-white'
                      : answers[q.id]
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-4 pt-4 border-t">
              <span className="inline-block w-3 h-3 bg-green-100 rounded mr-2"></span>Sudah dijawab
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
