import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../api';

const MODE_CPNS = 'cpns_cat';
const MODE_UTBK = 'utbk_sectioned';

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function computeAttemptState(workflow, elapsedSeconds) {
  const totalDurationSeconds = Math.max(0, Number(workflow?.total_duration_minutes || 0) * 60);
  const remainingSeconds = Math.max(0, totalDurationSeconds - elapsedSeconds);
  const isExpired = totalDurationSeconds > 0 && remainingSeconds <= 0;

  if (workflow?.mode !== MODE_UTBK) {
    return {
      remainingSeconds,
      totalDurationSeconds,
      isExpired,
      activeSectionCode: null,
      activeSectionName: null,
      activeSectionRemainingSeconds: remainingSeconds,
      completedSectionCodes: [],
      lockedSectionCodes: [],
    };
  }

  const sections = workflow.sections || [];
  let cursor = 0;
  let activeSection = sections[sections.length - 1] || null;
  let activeRemaining = remainingSeconds;
  const completedSectionCodes = [];
  const lockedSectionCodes = [];

  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index];
    const durationSeconds = Math.max(0, Number(section.duration_minutes || 0) * 60);
    const sectionEnd = cursor + durationSeconds;

    if (!isExpired && elapsedSeconds < sectionEnd) {
      activeSection = section;
      activeRemaining = Math.max(0, sectionEnd - elapsedSeconds);
      for (let futureIndex = index + 1; futureIndex < sections.length; futureIndex += 1) {
        lockedSectionCodes.push(sections[futureIndex].code);
      }
      break;
    }

    completedSectionCodes.push(section.code);
    cursor = sectionEnd;
  }

  return {
    remainingSeconds,
    totalDurationSeconds,
    isExpired,
    activeSectionCode: activeSection?.code || null,
    activeSectionName: activeSection?.name || null,
    activeSectionRemainingSeconds: activeRemaining,
    completedSectionCodes: isExpired ? sections.map((section) => section.code) : completedSectionCodes,
    lockedSectionCodes: isExpired ? [] : lockedSectionCodes,
  };
}

export default function Test() {
  const { packageId } = useParams();
  const navigate = useNavigate();
  const numericPackageId = Number(packageId);
  const submitTriggeredRef = useRef(false);
  const isSavingRef = useRef(false);
  const pendingAutoSaveRef = useRef(null);
  const loadedSectionCodeRef = useRef(null);
  const currentQuestionIdRef = useRef(null);

  const [questions, setQuestions] = useState([]);
  const [savedAnswers, setSavedAnswers] = useState({});
  const [draftAnswers, setDraftAnswers] = useState({});
  const [workflow, setWorkflow] = useState(null);
  const [sections, setSections] = useState([]);
  const [packageMeta, setPackageMeta] = useState(null);
  const [attemptId, setAttemptId] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentQuestionId, setCurrentQuestionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdvancingSection, setIsAdvancingSection] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const attemptState = useMemo(
    () => computeAttemptState(workflow, elapsedSeconds),
    [workflow, elapsedSeconds]
  );

  const questionMap = useMemo(
    () => new Map(questions.map((question) => [Number(question.id), question])),
    [questions]
  );

  const activeQuestions = useMemo(() => {
    if (!workflow) {
      return [];
    }

    if (workflow.mode !== MODE_UTBK) {
      return questions;
    }

    return questions.filter((question) => question.section_code === attemptState.activeSectionCode);
  }, [attemptState.activeSectionCode, questions, workflow]);

  const currentQuestion = useMemo(() => {
    if (workflow?.mode === MODE_UTBK) {
      if (!currentQuestionId) {
        return activeQuestions[0] || null;
      }

      return activeQuestions.find(
        (question) => Number(question.id) === Number(currentQuestionId)
      ) || activeQuestions[0] || null;
    }

    if (!currentQuestionId) {
      return questions[0] || null;
    }

    return questionMap.get(Number(currentQuestionId)) || questions[0] || null;
  }, [activeQuestions, currentQuestionId, questionMap, questions, workflow]);

  const currentQuestionIndex = useMemo(() => (
    activeQuestions.findIndex((question) => Number(question.id) === Number(currentQuestion?.id))
  ), [activeQuestions, currentQuestion]);

  const orderedQuestions = useMemo(() => (
    workflow?.mode === MODE_UTBK ? activeQuestions : questions
  ), [activeQuestions, questions, workflow]);

  const orderedCurrentQuestionIndex = useMemo(() => (
    orderedQuestions.findIndex((question) => Number(question.id) === Number(currentQuestion?.id))
  ), [currentQuestion, orderedQuestions]);

  const activeSectionIndex = useMemo(() => (
    (workflow?.sections || []).findIndex(
      (section) => section.code === attemptState.activeSectionCode
    )
  ), [attemptState.activeSectionCode, workflow]);

  const nextSection = useMemo(() => (
    activeSectionIndex >= 0 ? (workflow?.sections || [])[activeSectionIndex + 1] || null : null
  ), [activeSectionIndex, workflow]);

  const unsavedAnswers = useMemo(() => (
    Object.entries(draftAnswers)
      .filter(([questionId, optionId]) => Number(savedAnswers[questionId] || 0) !== Number(optionId || 0))
      .map(([questionId, optionId]) => ({
        question_id: Number(questionId),
        option_id: Number(optionId),
      }))
  ), [draftAnswers, savedAnswers]);

  const answeredCount = useMemo(() => (
    Object.values(savedAnswers).filter(Boolean).length
  ), [savedAnswers]);
  const allQuestionsAnswered = useMemo(() => (
    questions.length > 0 && questions.every((question) => {
      const questionDraft = Number(draftAnswers[String(question.id)] || draftAnswers[question.id] || 0);
      const questionSaved = Number(savedAnswers[String(question.id)] || savedAnswers[question.id] || 0);
      return questionDraft > 0 || questionSaved > 0;
    })
  ), [draftAnswers, questions, savedAnswers]);

  const totalQuestionCount = useMemo(() => {
    const packageCount = Number(packageMeta?.question_count || 0);
    if (packageCount > 0) {
      return packageCount;
    }

    const sectionCount = sections.reduce((sum, section) => sum + Number(section.question_count || 0), 0);
    return sectionCount > 0 ? sectionCount : questions.length;
  }, [packageMeta, questions.length, sections]);

  const pickInitialQuestionId = useCallback((nextQuestions, nextSavedAnswers, nextWorkflow, nextElapsedSeconds) => {
    const initialState = computeAttemptState(nextWorkflow, nextElapsedSeconds);
    const initialQuestions = nextWorkflow?.mode === MODE_UTBK
      ? nextQuestions.filter((question) => question.section_code === initialState.activeSectionCode)
      : nextQuestions;
    const initialCurrentQuestion = initialQuestions.find(
      (question) => !nextSavedAnswers[String(question.id)]
    ) || initialQuestions[0] || nextQuestions[0] || null;

    return initialCurrentQuestion ? Number(initialCurrentQuestion.id) : null;
  }, []);

  useEffect(() => {
    currentQuestionIdRef.current = currentQuestionId;
  }, [currentQuestionId]);

  const loadQuestions = useCallback(async (nextAttemptId, { preserveCurrentQuestion = false } = {}) => {
    const questionsResponse = await apiClient.get(
      `/questions/list?package_id=${numericPackageId}&attempt_id=${nextAttemptId}`
    );
    const payload = questionsResponse.data.data || {};
    const nextQuestions = payload.questions || [];
    const nextSavedAnswers = payload.saved_answers || {};
    const nextWorkflow = payload.workflow || null;
    const nextSections = payload.sections || [];
    const nextElapsedSeconds = Number(payload.attempt?.state?.elapsed_seconds || 0);
    const currentQuestionIdValue = currentQuestionIdRef.current;
    const canPreserveCurrentQuestion = preserveCurrentQuestion && nextQuestions.some(
      (question) => Number(question.id) === Number(currentQuestionIdValue)
    );
    const nextCurrentQuestionId = canPreserveCurrentQuestion
      ? currentQuestionIdValue
      : pickInitialQuestionId(nextQuestions, nextSavedAnswers, nextWorkflow, nextElapsedSeconds);

    setQuestions(nextQuestions);
    setSavedAnswers(nextSavedAnswers);
    setDraftAnswers(nextSavedAnswers);
    setWorkflow(nextWorkflow);
    setSections(nextSections);
    setPackageMeta(payload.package || null);
    setElapsedSeconds(nextElapsedSeconds);
    setCurrentQuestionId(nextCurrentQuestionId);
    loadedSectionCodeRef.current = payload.attempt?.state?.active_section_code || '__all__';
  }, [numericPackageId, pickInitialQuestionId]);

  const saveAnswer = useCallback(async (questionId, optionId, nextQuestionId = null) => {
    if (!attemptId || !questionId || !optionId) {
      return;
    }

    if (isSavingRef.current) {
      pendingAutoSaveRef.current = {
        questionId: Number(questionId),
        optionId: Number(optionId),
        nextQuestionId: nextQuestionId ? Number(nextQuestionId) : null,
      };
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    setSaveMessage('');

    try {
      await apiClient.post('/test/save-answer', {
        attempt_id: attemptId,
        question_id: questionId,
        option_id: optionId,
      });

      setSavedAnswers((current) => ({
        ...current,
        [questionId]: Number(optionId),
      }));
      setDraftAnswers((current) => ({
        ...current,
        [questionId]: Number(optionId),
      }));
      setSaveMessage('Jawaban tersimpan.');

      if (nextQuestionId) {
        setCurrentQuestionId(Number(nextQuestionId));
      }
    } catch (err) {
      const payload = err.response?.data?.data;
      if (payload?.attempt_completed) {
        navigate(`/results/${attemptId}`);
        return;
      }

      setError(err.response?.data?.message || 'Gagal menyimpan jawaban');
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);

      const pendingSave = pendingAutoSaveRef.current;
      pendingAutoSaveRef.current = null;

      if (
        pendingSave
        && (pendingSave.questionId !== Number(questionId)
          || pendingSave.optionId !== Number(optionId)
          || pendingSave.nextQuestionId !== (nextQuestionId ? Number(nextQuestionId) : null))
      ) {
        await saveAnswer(pendingSave.questionId, pendingSave.optionId, pendingSave.nextQuestionId);
      }
    }
  }, [attemptId, navigate]);

  const handleSubmit = useCallback(async ({ confirmManual = false } = {}) => {
    if (!attemptId || isSubmitting) {
      return;
    }

    if (confirmManual) {
      if (workflow?.mode === MODE_CPNS && !allQuestionsAnswered) {
        setError('Jawab seluruh soal terlebih dahulu sebelum menyelesaikan ujian.');
        return;
      }

      const confirmationMessage = workflow?.mode === MODE_UTBK
        ? 'Yakin ingin menyelesaikan ujian sekarang? Sisa waktu subtes terakhir akan hangus dan nilai langsung diproses.'
        : 'Yakin ingin menyelesaikan ujian sekarang? Nilai akan langsung diproses.';
      const confirmed = window.confirm(confirmationMessage);
      if (!confirmed) {
        return;
      }
    }

    submitTriggeredRef.current = true;
    setIsSubmitting(true);
    setError('');

    try {
      await apiClient.post('/test/submit', {
        attempt_id: attemptId,
        answers: unsavedAnswers,
      });

      navigate(`/results/${attemptId}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyelesaikan ujian');
      setIsSubmitting(false);
      submitTriggeredRef.current = false;
    }
  }, [allQuestionsAnswered, attemptId, isSubmitting, navigate, unsavedAnswers, workflow]);

  const handleAdvanceSection = useCallback(async () => {
    if (!attemptId || isAdvancingSection || !nextSection) {
      return;
    }

    const confirmed = window.confirm(
      `Pindah ke subtes "${nextSection.name}" sekarang? Sisa waktu subtes saat ini akan dilepas.`
    );
    if (!confirmed) {
      return;
    }

    setError('');
    setSaveMessage('');
    setIsAdvancingSection(true);

    try {
      await apiClient.post('/test/advance-section', {
        attempt_id: attemptId,
      });
      await loadQuestions(attemptId);
    } catch (err) {
      const payload = err.response?.data?.data;
      if (payload?.attempt_completed) {
        navigate(`/results/${attemptId}`);
        return;
      }

      setError(err.response?.data?.message || 'Gagal pindah ke subtes berikutnya');
    } finally {
      setIsAdvancingSection(false);
    }
  }, [attemptId, isAdvancingSection, loadQuestions, navigate, nextSection]);

  useEffect(() => {
    const boot = async () => {
      if (!Number.isInteger(numericPackageId) || numericPackageId <= 0) {
        setError('Link test tidak valid. Silakan pilih ulang paket dari halaman utama.');
        setLoading(false);
        return;
      }

      try {
        await apiClient.get(`/test/check-access?package_id=${numericPackageId}`);

        const startResponse = await apiClient.post('/test/start', {
          package_id: numericPackageId,
        });
        const startData = startResponse.data.data || {};

        if (startData.result_ready && startData.completed_attempt_id) {
          navigate(`/results/${startData.completed_attempt_id}`);
          return;
        }

        const nextAttemptId = Number(startData.attempt_id || 0);
        setAttemptId(nextAttemptId);
        setWorkflow(startData.workflow || null);
        await loadQuestions(nextAttemptId);
      } catch (err) {
        setError(err.response?.data?.message || 'Gagal mengakses test ini');
      } finally {
        setLoading(false);
      }
    };

    boot();
  }, [loadQuestions, navigate, numericPackageId]);

  useEffect(() => {
    if (!workflow || submitTriggeredRef.current) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [workflow]);

  useEffect(() => {
    if (!workflow || !attemptId || submitTriggeredRef.current || !attemptState.isExpired) {
      return;
    }

    handleSubmit();
  }, [attemptId, attemptState.isExpired, handleSubmit, workflow]);

  useEffect(() => {
    if (loading || !workflow || workflow.mode !== MODE_UTBK || !attemptId || submitTriggeredRef.current) {
      return;
    }

    const activeSectionCode = attemptState.activeSectionCode || '__none__';
    if (loadedSectionCodeRef.current === activeSectionCode) {
      return;
    }

    loadQuestions(attemptId).catch((err) => {
      setError(err.response?.data?.message || 'Gagal memuat subtes aktif');
    });
  }, [attemptId, attemptState.activeSectionCode, loadQuestions, loading, workflow]);

  useEffect(() => {
    if (!workflow || questions.length === 0) {
      return;
    }

    if (workflow.mode !== MODE_UTBK) {
      if (!currentQuestion && questions[0]) {
        setCurrentQuestionId(Number(questions[0].id));
      }
      return;
    }

    const firstActiveQuestion = activeQuestions.find(
      (question) => !savedAnswers[String(question.id)]
    ) || activeQuestions[0] || null;

    if (!currentQuestion || currentQuestion.section_code !== attemptState.activeSectionCode) {
      setCurrentQuestionId(firstActiveQuestion ? Number(firstActiveQuestion.id) : null);
    }
  }, [
    activeQuestions,
    attemptState.activeSectionCode,
    currentQuestion,
    questions,
    savedAnswers,
    workflow,
  ]);

  const handleAnswerSelect = (questionId, optionId) => {
    setError('');
    setSaveMessage('');
    setDraftAnswers((current) => ({
      ...current,
      [questionId]: Number(optionId),
    }));

    if (workflow?.save_behavior === 'auto' || workflow?.mode === MODE_CPNS) {
      saveAnswer(questionId, optionId);
    }
  };

  const goToQuestion = (questionId) => {
    if (!questionId) {
      return;
    }

    if (currentQuestion) {
      const currentSavedAnswerValue = Number(savedAnswers[String(currentQuestion.id)] || savedAnswers[currentQuestion.id] || 0);
      const currentDraftAnswerValue = Number(draftAnswers[String(currentQuestion.id)] || draftAnswers[currentQuestion.id] || 0);
      const hasUnsavedCurrentAnswer = currentDraftAnswerValue > 0 && currentDraftAnswerValue !== currentSavedAnswerValue;

      if ((workflow?.save_behavior === 'auto' || workflow?.mode === MODE_CPNS) && hasUnsavedCurrentAnswer) {
        saveAnswer(currentQuestion.id, currentDraftAnswerValue);
      }
    }

    setCurrentQuestionId(Number(questionId));
    setSaveMessage('');
  };

  const handleRelativeNavigation = (direction) => {
    const nextIndex = orderedCurrentQuestionIndex + direction;
    const targetQuestion = orderedQuestions[nextIndex] || null;
    if (!targetQuestion) {
      return;
    }

    goToQuestion(targetQuestion.id);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Memuat soal...</div>;
  }

  if (error && questions.length === 0) {
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

  if (!workflow || !currentQuestion) {
    return <div className="min-h-screen flex items-center justify-center">Memuat sesi ujian...</div>;
  }

  const isCpnsMode = workflow.mode === MODE_CPNS;
  const isUtbkMode = workflow.mode === MODE_UTBK;
  const currentAnswerValue = draftAnswers[String(currentQuestion.id)] || draftAnswers[currentQuestion.id] || null;
  const isCurrentSaved = Number(savedAnswers[String(currentQuestion.id)] || 0) === Number(currentAnswerValue || 0)
    && Boolean(currentAnswerValue);
  const currentGlobalQuestionIndex = questions.findIndex(
    (question) => Number(question.id) === Number(currentQuestion.id)
  );
  const previousQuestionId = orderedCurrentQuestionIndex > 0 ? orderedQuestions[orderedCurrentQuestionIndex - 1]?.id : null;
  const nextQuestionId = orderedCurrentQuestionIndex >= 0 ? orderedQuestions[orderedCurrentQuestionIndex + 1]?.id : null;
  const hasMultipleActiveQuestions = orderedQuestions.length > 1;
  const questionTitleNumber = isUtbkMode
    ? Math.max(1, orderedCurrentQuestionIndex + 1)
    : Math.max(1, currentGlobalQuestionIndex + 1);

  return (
    <div className="min-h-screen bg-gray-100 test-shell">
      <div className="container mx-auto px-4 py-8">
        <section className="test-hero">
          <div className="test-hero-copy">
            <p className="test-hero-kicker">
              {isCpnsMode ? 'CPNS Simulation' : 'UTBK Simulation'}
            </p>
            <h1 className="test-hero-title">
              {isCpnsMode ? 'Tryout CPNS' : 'Tryout UTBK'}
            </h1>
            <p className="test-hero-description">
              {isCpnsMode
                ? 'Navigasi soal bebas dengan penyimpanan jawaban otomatis setiap kali Anda memilih opsi.'
                : 'Kerjakan setiap bagian sesuai alur tryout dan fokus pada waktu yang masih tersedia di tiap sesi.'}
            </p>
          </div>
        </section>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}
        {saveMessage && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-700">
            {saveMessage}
          </div>
        )}

        <div className="test-layout-grid">
          <div className="test-main-column">
            <div className="card test-question-card">
              <div key={currentQuestion.id} className="test-question-stage">
              <div className="mb-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold">
                      Soal Nomor {questionTitleNumber}
                    </h2>
                    <p className="test-question-section-label">
                      {currentQuestion.section_name || 'Bagian umum'}
                    </p>
                  </div>
                </div>
                {currentQuestion.question_text && (
                  <p className="text-gray-800 leading-relaxed text-lg">{currentQuestion.question_text}</p>
                )}
                {currentQuestion.question_image_url && (
                  <img
                    src={currentQuestion.question_image_url}
                    alt={`Soal ${currentQuestionIndex + 1}`}
                    className="test-question-image"
                    loading="lazy"
                  />
                )}
              </div>

              <div className="space-y-3 mb-8">
                {currentQuestion.options?.map((option) => (
                  <label
                    key={option.id}
                    className={`test-option ${Number(currentAnswerValue) === Number(option.id) ? 'test-option-active' : ''}`}
                  >
                    <input
                      type="radio"
                      name={`question-${currentQuestion.id}`}
                      value={option.id ?? ''}
                      checked={Number(currentAnswerValue) === Number(option.id)}
                      onChange={() => handleAnswerSelect(currentQuestion.id, option.id)}
                      className="mt-1 w-5 h-5 accent-blue-600"
                    />
                    <div className="ml-4">
                      <p className="font-semibold">{option.letter}.</p>
                      {option.text && <p className="text-gray-800">{option.text}</p>}
                      {option.image_url && (
                        <img
                          src={option.image_url}
                          alt={`Opsi ${option.letter}`}
                          className="test-option-image"
                          loading="lazy"
                        />
                      )}
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex flex-wrap gap-3 pt-6 border-t border-gray-200">
                {(isCpnsMode || hasMultipleActiveQuestions) && (
                  <button
                    type="button"
                    onClick={() => handleRelativeNavigation(-1)}
                    disabled={!previousQuestionId}
                    className="btn btn-outline test-action-button disabled:opacity-50"
                  >
                    ← Sebelumnya
                  </button>
                )}

                {(isCpnsMode || hasMultipleActiveQuestions) && (
                  <button
                    type="button"
                    onClick={() => handleRelativeNavigation(1)}
                    disabled={!nextQuestionId}
                    className="btn btn-outline test-action-button disabled:opacity-50"
                  >
                    Selanjutnya →
                  </button>
                )}

                {isCpnsMode && allQuestionsAnswered && (
                  <button
                    type="button"
                    onClick={() => handleSubmit({ confirmManual: true })}
                    disabled={isSubmitting}
                    className="btn btn-primary test-action-button test-action-button-primary disabled:opacity-50"
                  >
                    {isSubmitting ? 'Memproses...' : 'Selesai Ujian'}
                  </button>
                )}

                {isUtbkMode && (
                  <>
                    <div className="w-full flex-1 self-center text-sm text-gray-600 sm:min-w-[220px]">
                      {isCurrentSaved ? 'Jawaban aktif sudah tersimpan otomatis.' : 'Jawaban akan tersimpan otomatis saat dipilih.'}
                      {!hasMultipleActiveQuestions ? ' Subtes ini hanya memiliki 1 soal aktif.' : ''}
                    </div>

                    {nextSection ? (
                      <button
                        type="button"
                        onClick={handleAdvanceSection}
                        disabled={isAdvancingSection || isSubmitting}
                        className="btn btn-primary test-action-button disabled:opacity-50"
                      >
                        {isAdvancingSection ? 'Membuka Subtes...' : `Lanjut ke ${nextSection.name} →`}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSubmit({ confirmManual: true })}
                        disabled={isSubmitting}
                        className="btn btn-primary test-action-button disabled:opacity-50"
                      >
                        {isSubmitting ? 'Memproses...' : 'Selesaikan Ujian'}
                      </button>
                    )}
                  </>
                )}
              </div>
              </div>
            </div>
          </div>

          <div className="test-sidebar-column">
            <div className="test-sidebar-metrics">
              <div className="test-header-stat">
                <p className="test-header-stat-label">Terjawab</p>
                <p className="test-header-stat-value">{answeredCount} / {totalQuestionCount}</p>
              </div>
              <div className="test-header-stat">
                <p className="test-header-stat-label">
                  {isUtbkMode ? 'Sisa Waktu Subtes' : 'Sisa Waktu'}
                </p>
                <p className={`test-header-stat-value ${
                  (isUtbkMode ? attemptState.activeSectionRemainingSeconds : attemptState.remainingSeconds) < 300
                    ? 'test-header-stat-value-danger'
                    : 'test-header-stat-value-success'
                }`}>
                  {formatTime(isUtbkMode ? attemptState.activeSectionRemainingSeconds : attemptState.remainingSeconds)}
                </p>
              </div>
              {isUtbkMode && (
                <div className="test-header-stat">
                  <p className="test-header-stat-label">Sisa Waktu Total</p>
                  <p className="test-header-stat-value">{formatTime(attemptState.remainingSeconds)}</p>
                </div>
              )}
            </div>

            <div className="card test-sidebar-card">
              <h3 className="font-bold mb-4">Navigasi Soal</h3>

              {isCpnsMode ? (
                <>
                  <div className="test-question-strip test-question-strip-grid" role="tablist" aria-label="Navigasi soal">
                    {questions.map((question, index) => {
                      const savedValue = savedAnswers[String(question.id)] || savedAnswers[question.id];

                      return (
                        <button
                          key={question.id}
                          type="button"
                          onClick={() => goToQuestion(question.id)}
                          className={`test-nav-chip test-nav-chip-button ${
                            Number(question.id) === Number(currentQuestion?.id)
                              ? 'bg-blue-600 text-white'
                              : savedValue
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {index + 1}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-4 border-t text-xs text-gray-600 space-y-2">
                    <p><span className="inline-block w-3 h-3 rounded bg-green-100 mr-2" />Sudah tersimpan</p>
                    <p><span className="inline-block w-3 h-3 rounded bg-red-100 mr-2" />Belum dijawab</p>
                  </div>
                </>
              ) : (
                <div className="test-question-strip test-question-strip-stack" role="tablist" aria-label="Navigasi soal subtes aktif">
                  {activeQuestions.map((question, index) => {
                    const savedValue = savedAnswers[String(question.id)] || savedAnswers[question.id];
                    return (
                      <button
                        key={question.id}
                        type="button"
                        onClick={() => goToQuestion(question.id)}
                        className={`test-subtest-chip test-subtest-chip-inline ${
                          Number(question.id) === Number(currentQuestion?.id)
                            ? 'border-blue-500 bg-blue-50'
                            : savedValue
                            ? 'border-green-300 bg-green-50'
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        <p className="font-semibold">Soal {index + 1}</p>
                        <p className="text-xs text-gray-600">
                          {savedValue ? 'Sudah dijawab' : 'Belum dijawab'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
