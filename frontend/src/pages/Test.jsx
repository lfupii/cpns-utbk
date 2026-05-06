import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../api';
import FloatingTestDock, { useFloatingTestDock } from '../components/FloatingTestDock';
import LatexContent from '../components/LatexContent';
import QuestionReportModal from '../components/QuestionReportModal';
import {
  clearActiveTryoutSession,
  persistActiveTryoutSession,
} from '../utils/activeAssessmentSession';

const MODE_CPNS = 'cpns_cat';
const MODE_UTBK = 'utbk_sectioned';
const RESULT_EMAIL_STATUS_KEY = 'resultEmailStatusMessage';

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
  const [isAdvancingSection, setIsAdvancingSection] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [reviewFlags, setReviewFlags] = useState({});
  const [reportFeedback, setReportFeedback] = useState('');
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const {
    isCompactViewport,
    shouldShowDock: shouldShowFloatingDock,
    timerRef: floatingTimerRef,
  } = useFloatingTestDock(!loading);

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

  const currentQuestionImageLayout = useMemo(() => {
    const layout = String(currentQuestion?.question_image_layout || 'top').toLowerCase();
    return ['top', 'bottom', 'left', 'right'].includes(layout) ? layout : 'top';
  }, [currentQuestion]);

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
  const activeSectionAnsweredCount = useMemo(() => (
    activeQuestions.filter((question) => {
      const savedValue = savedAnswers[String(question.id)] || savedAnswers[question.id];
      return Boolean(savedValue);
    }).length
  ), [activeQuestions, savedAnswers]);
  const pendingReviewQuestionNumbers = useMemo(() => (
    orderedQuestions.reduce((numbers, question, index) => {
      if (reviewFlags[String(question.id)] || reviewFlags[question.id]) {
        numbers.push(index + 1);
      }
      return numbers;
    }, [])
  ), [orderedQuestions, reviewFlags]);
  const pendingReviewQuestionNumberLabel = useMemo(
    () => pendingReviewQuestionNumbers.join(', '),
    [pendingReviewQuestionNumbers]
  );

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
    const nextReviewFlags = payload.review_flags || {};
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
    setReviewFlags(nextReviewFlags);
    setWorkflow(nextWorkflow);
    setSections(nextSections);
    setPackageMeta(payload.package || null);
    setElapsedSeconds(nextElapsedSeconds);
    setCurrentQuestionId(nextCurrentQuestionId);
    loadedSectionCodeRef.current = payload.attempt?.state?.active_section_code || '__all__';
    persistActiveTryoutSession({
      packageId: numericPackageId,
      attemptId: nextAttemptId,
    });
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
        clearActiveTryoutSession();
        navigate(`/results/${attemptId}`);
        return;
      }

      setError(err.response?.data?.message || 'Gagal menyimpan jawaban');
    } finally {
      isSavingRef.current = false;

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

  const handleSubmit = useCallback(async ({ confirmManual = false, autoSubmit = false } = {}) => {
    if (!attemptId || isSubmitting) {
      return;
    }

    if (!autoSubmit && pendingReviewQuestionNumbers.length > 0) {
      setError(`Matikan status ragu-ragu pada soal nomor ${pendingReviewQuestionNumberLabel} sebelum submit.`);
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
      const response = await apiClient.post('/test/submit', {
        attempt_id: attemptId,
        answers: unsavedAnswers,
        auto_submit: autoSubmit,
      });

      const responseMessage = response.data?.message;
      if (responseMessage) {
        window.sessionStorage.setItem(RESULT_EMAIL_STATUS_KEY, responseMessage);
      }

      clearActiveTryoutSession();
      navigate(`/results/${attemptId}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyelesaikan ujian');
      setIsSubmitting(false);
      submitTriggeredRef.current = false;
    }
  }, [
    allQuestionsAnswered,
    attemptId,
    isSubmitting,
    navigate,
    pendingReviewQuestionNumberLabel,
    pendingReviewQuestionNumbers.length,
    unsavedAnswers,
    workflow,
  ]);

  const handleAdvanceSection = useCallback(async () => {
    if (!attemptId || isAdvancingSection || !nextSection) {
      return;
    }

    if (pendingReviewQuestionNumbers.length > 0) {
      setError(`Matikan status ragu-ragu pada soal nomor ${pendingReviewQuestionNumberLabel} sebelum pindah subtes.`);
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
        clearActiveTryoutSession();
        navigate(`/results/${attemptId}`);
        return;
      }

      setError(err.response?.data?.message || 'Gagal pindah ke subtes berikutnya');
    } finally {
      setIsAdvancingSection(false);
    }
  }, [
    attemptId,
    isAdvancingSection,
    loadQuestions,
    navigate,
    nextSection,
    pendingReviewQuestionNumberLabel,
    pendingReviewQuestionNumbers.length,
  ]);

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
          clearActiveTryoutSession();
          navigate(`/results/${startData.completed_attempt_id}`);
          return;
        }

        const nextAttemptId = Number(startData.attempt_id || 0);
        setAttemptId(nextAttemptId);
        setWorkflow(startData.workflow || null);
        persistActiveTryoutSession({
          packageId: numericPackageId,
          attemptId: nextAttemptId,
        });
        await loadQuestions(nextAttemptId);
      } catch (err) {
        if (err.response?.status === 401) {
          setError('Sesi login Anda sudah habis atau tidak valid. Silakan login ulang lalu coba masuk ke test lagi.');
        } else {
          setError(err.response?.data?.message || 'Gagal mengakses test ini');
        }
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

    handleSubmit({ autoSubmit: true });
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

  const toggleReviewFlag = useCallback(async (questionId) => {
    if (!attemptId || !questionId) {
      return;
    }

    const questionKey = String(questionId);
    const currentDraftAnswerValue = Number(draftAnswers[questionKey] || draftAnswers[questionId] || 0);
    const currentSavedAnswerValue = Number(savedAnswers[questionKey] || savedAnswers[questionId] || 0);

    if (currentDraftAnswerValue <= 0 && currentSavedAnswerValue <= 0) {
      setError('Pilih jawaban dulu sebelum menandai ragu-ragu.');
      return;
    }

    setError('');
    setSaveMessage('');

    if (currentDraftAnswerValue > 0 && currentDraftAnswerValue !== currentSavedAnswerValue) {
      await saveAnswer(questionId, currentDraftAnswerValue);
    }

    const nextMarkedReview = !(reviewFlags[questionKey] || reviewFlags[questionId]);

    setReviewFlags((current) => {
      const next = { ...current };
      if (nextMarkedReview) {
        next[questionKey] = true;
      } else {
        delete next[questionKey];
      }
      return next;
    });

    try {
      await apiClient.post('/test/review-flag', {
        attempt_id: attemptId,
        question_id: questionId,
        is_marked_review: nextMarkedReview,
      });
    } catch (err) {
      setReviewFlags((current) => {
        const reverted = { ...current };
        if (nextMarkedReview) {
          delete reverted[questionKey];
        } else {
          reverted[questionKey] = true;
        }
        return reverted;
      });

      const payload = err.response?.data?.data;
      if (payload?.attempt_completed) {
        clearActiveTryoutSession();
        navigate(`/results/${attemptId}`);
        return;
      }

      setError(err.response?.data?.message || 'Gagal menyimpan status ragu-ragu');
    }
  }, [attemptId, draftAnswers, navigate, reviewFlags, saveAnswer, savedAnswers]);

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
  const currentSavedAnswerValue = savedAnswers[String(currentQuestion.id)] || savedAnswers[currentQuestion.id] || null;
  const hasCurrentAnswerSelected = Boolean(currentAnswerValue || currentSavedAnswerValue);
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
  const isCurrentQuestionMarkedForReview = Boolean(
    reviewFlags[String(currentQuestion.id)] || reviewFlags[currentQuestion.id]
  );
  const activeRemainingSeconds = isUtbkMode
    ? attemptState.activeSectionRemainingSeconds
    : attemptState.remainingSeconds;
  const floatingTimerStat = {
    label: isUtbkMode ? 'Sisa waktu subtes' : 'Sisa waktu',
    value: formatTime(activeRemainingSeconds),
    tone: activeRemainingSeconds < 300 ? 'danger' : 'success',
  };

  return (
    <div className="min-h-screen test-shell">
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
            <div className="test-hero-pills" aria-label="Ringkasan sesi test">
              <span>{packageMeta?.name || 'Paket aktif'}</span>
              <span>{totalQuestionCount} soal</span>
              {isUtbkMode && attemptState.activeSectionName && (
                <span>{attemptState.activeSectionName}</span>
              )}
            </div>
          </div>

          <div className="test-hero-stats">
            <div className="test-hero-stat-card">
              <span>Terjawab</span>
              <strong>{answeredCount} / {totalQuestionCount}</strong>
              <small>Progress seluruh soal</small>
            </div>
            <div ref={floatingTimerRef} className="test-hero-stat-card">
              <span>{isUtbkMode ? 'Timer subtes' : 'Timer utama'}</span>
              <strong>
                {formatTime(isUtbkMode ? attemptState.activeSectionRemainingSeconds : attemptState.remainingSeconds)}
              </strong>
              <small>{isUtbkMode ? 'Waktu aktif saat ini' : 'Waktu tersisa ujian'}</small>
            </div>
            <div className="test-hero-stat-card">
              <span>{isUtbkMode ? 'Subtes aktif' : 'Mode pengerjaan'}</span>
              <strong>{isUtbkMode ? (attemptState.activeSectionName || 'Menunggu') : 'Navigasi bebas'}</strong>
              <small>
                {isUtbkMode
                  ? `${activeSectionAnsweredCount}/${activeQuestions.length} soal terisi`
                  : allQuestionsAnswered ? 'Siap diselesaikan' : 'Jawab semua soal dulu'}
              </small>
            </div>
          </div>
        </section>

        {error && (
          <div className="test-feedback test-feedback-error">
            {error}
          </div>
        )}
        {saveMessage && (
          <div className="test-feedback test-feedback-success">
            {saveMessage}
          </div>
        )}
        {reportFeedback && (
          <div className="test-feedback test-feedback-success">
            {reportFeedback}
          </div>
        )}

        <FloatingTestDock
          ariaLabel={isUtbkMode ? 'Timer subtes mengambang' : 'Timer ujian mengambang'}
          stat={floatingTimerStat}
          visible={shouldShowFloatingDock}
        />

        <div className="test-layout-grid">
          <div className="test-main-column">
            <div className="card test-question-card">
              <div key={currentQuestion.id} className="test-question-stage">
                <div className="test-inline-navigation">
                  <div className="test-inline-navigation-head">
                    <h3 className="test-inline-navigation-title">Navigasi Soal</h3>
                    <p className="test-inline-navigation-note">
                      Klik nomor soal. Kuning berarti ragu-ragu.
                    </p>
                  </div>
                  <div
                    className="test-question-strip test-question-strip-inline"
                    role="tablist"
                    aria-label={isUtbkMode ? 'Navigasi soal subtes aktif' : 'Navigasi soal'}
                  >
                    {orderedQuestions.map((question, index) => {
                      const savedValue = savedAnswers[String(question.id)] || savedAnswers[question.id];
                      const isMarkedForReview = Boolean(
                        reviewFlags[String(question.id)] || reviewFlags[question.id]
                      );

                      return (
                        <button
                          key={question.id}
                          type="button"
                          onClick={() => goToQuestion(question.id)}
                          className={[
                            'test-nav-chip',
                            'test-nav-chip-button',
                            Number(question.id) === Number(currentQuestion?.id)
                              ? 'test-nav-chip-current'
                              : savedValue
                              ? 'test-nav-chip-done'
                              : 'test-nav-chip-empty',
                            isMarkedForReview ? 'test-nav-chip-review' : '',
                          ].filter(Boolean).join(' ')}
                          aria-label={`Soal ${index + 1}${isMarkedForReview ? ', ditandai ragu-ragu' : ''}`}
                          title={isMarkedForReview ? `Soal ${index + 1} ditandai ragu-ragu` : `Soal ${index + 1}`}
                        >
                          {index + 1}
                          {isMarkedForReview && <span className="test-nav-chip-flag" aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </div>
                  <div className="test-nav-legend">
                    <p><span className="test-nav-legend-dot test-nav-legend-dot-current" />Soal aktif</p>
                    <p><span className="test-nav-legend-dot test-nav-legend-dot-done" />Sudah dijawab</p>
                    <p><span className="test-nav-legend-dot test-nav-legend-dot-review" />Ragu-ragu</p>
                    <p><span className="test-nav-legend-dot test-nav-legend-dot-empty" />Belum dijawab</p>
                  </div>
                </div>

                <div className="test-question-head">
                  <div className="test-question-heading">
                    <span className="test-question-number">Soal {questionTitleNumber}</span>
                    <h2 className="test-question-title">
                      Fokuskan jawabanmu di soal ini dulu
                    </h2>
                    <p className="test-question-section-label">
                      {currentQuestion.section_name || 'Bagian umum'}
                    </p>
                  </div>
                </div>
                {(currentQuestion.question_text || currentQuestion.question_image_url) && (
                  <div className={`test-question-media test-question-media-${currentQuestionImageLayout}`}>
                    {currentQuestion.question_text && (
                      <div className="test-question-text-block">
                        <LatexContent
                          content={currentQuestion.question_text}
                          className="test-question-text"
                        />
                      </div>
                    )}
                    {currentQuestion.question_image_url && (
                      <div className="test-question-image-frame">
                        <img
                          src={currentQuestion.question_image_url}
                          alt={`Soal ${currentQuestionIndex + 1}`}
                          className="test-question-image"
                          loading="lazy"
                        />
                      </div>
                    )}
                  </div>
                )}

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
                    <div className="test-option-copy">
                      <p className="test-option-letter">{option.letter}.</p>
                      {option.text && (
                        <LatexContent
                          content={option.text}
                          className="test-option-text"
                        />
                      )}
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

                <div className="test-action-row">
                  <div className="test-action-buttons">
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

                    <button
                      type="button"
                      onClick={() => toggleReviewFlag(currentQuestion.id)}
                      disabled={!hasCurrentAnswerSelected}
                      title={hasCurrentAnswerSelected ? undefined : 'Pilih jawaban dulu untuk mengaktifkan ragu-ragu'}
                      className={`btn btn-outline test-action-button ${
                        isCurrentQuestionMarkedForReview ? 'test-action-button-review-active' : ''
                      }`}
                    >
                      {isCurrentQuestionMarkedForReview ? 'Batalkan Ragu-ragu' : 'Tandai Ragu-ragu'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setReportModalOpen(true)}
                      className="btn btn-outline test-action-button test-action-button-report"
                    >
                      Laporkan Soal
                    </button>
                  </div>

                  {isUtbkMode && (
                    <div className="test-action-helper">
                      {isCurrentSaved ? 'Jawaban aktif sudah tersimpan otomatis.' : 'Jawaban akan tersimpan otomatis saat dipilih.'}
                      {!hasCurrentAnswerSelected ? ' Pilih salah satu opsi dulu untuk membuka tombol ragu-ragu.' : ''}
                      {!hasMultipleActiveQuestions ? ' Subtes ini hanya memiliki 1 soal aktif.' : ''}
                    </div>
                  )}

                  <div className="test-action-buttons test-action-buttons-end">
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
                      nextSection ? (
                        <button
                          type="button"
                          onClick={handleAdvanceSection}
                          disabled={isAdvancingSection || isSubmitting}
                          className="btn btn-primary test-action-button disabled:opacity-50"
                        >
                          {isAdvancingSection ? 'Membuka test berikutnya...' : 'Lanjut ke test berikutnya →'}
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
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {!isCompactViewport && (
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
            </div>
          )}
        </div>
      </div>

      {currentQuestion && (
        <QuestionReportModal
          isOpen={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          onSubmitted={(message) => setReportFeedback(message)}
          assessmentType="tryout"
          targetType="question"
          originContext="tryout_active"
          packageId={numericPackageId}
          questionId={currentQuestion.id}
          attemptId={attemptId}
          sectionLabel={currentQuestion.section_name || attemptState.activeSectionName || 'Tryout aktif'}
          questionNumber={questionTitleNumber}
          questionText={currentQuestion.question_text || ''}
          questionImageUrl={currentQuestion.question_image_url || ''}
        />
      )}
    </div>
  );
}
