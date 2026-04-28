import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AccountShell from '../components/AccountShell';
import FloatingTestDock, { useFloatingTestDock } from '../components/FloatingTestDock';
import apiClient from '../api';
import { useAuth } from '../AuthContext';
import { sanitizeMaterialHtml } from '../utils/materialHtml';
import { isMaterialPdfVisualHtml } from '../utils/materialPagination';

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatScore(result) {
  if (!result) {
    return '';
  }

  const score = Number(result.score ?? 0);
  const correct = Number(result.correct_answers ?? 0);
  const total = Number(result.total_questions ?? 0);

  return `${score.toLocaleString('id-ID')} - ${correct}/${total} benar`;
}

function getSectionTopics(section) {
  if (Array.isArray(section?.material?.topics) && section.material.topics.length > 0) {
    return section.material.topics;
  }

  if (Array.isArray(section?.pages) && section.pages.length > 0) {
    return section.pages.map((page, index) => ({
      title: page.title || `Topik ${index + 1}`,
      pages: [page],
      total_page_count: 1,
      visible_page_count: 1,
      locked_page_count: 0,
    }));
  }

  return [];
}

function formatActiveTopicLabel(section) {
  const activeTopicCount = getSectionTopics(section).length;

  if (activeTopicCount <= 0) {
    return '0 topik dan 1 mini test';
  }

  return `${activeTopicCount} topik dan 1 mini test`;
}

function computeMiniTestDurationSeconds(section, questionCount) {
  const totalQuestions = Math.max(0, Number(questionCount || 0));
  const miniTestDurationMinutes = Math.max(0, Number(section?.mini_test_duration_minutes || 0));
  const durationMinutes = Math.max(0, Number(section?.duration_minutes || 0));
  const targetQuestionCount = Math.max(0, Number(section?.target_question_count || 0));

  if (miniTestDurationMinutes > 0) {
    return Math.max(1, Math.round(miniTestDurationMinutes * 60));
  }

  if (durationMinutes > 0 && targetQuestionCount > 0 && totalQuestions > 0) {
    const estimatedSeconds = Math.round((durationMinutes * 60 * totalQuestions) / targetQuestionCount);
    return Math.max(180, estimatedSeconds);
  }

  if (durationMinutes > 0) {
    return Math.max(180, Math.round(durationMinutes * 60));
  }

  return Math.max(300, totalQuestions * 90);
}

function formatDurationMinutesLabel(seconds) {
  const normalizedSeconds = Math.max(0, Number(seconds || 0));
  if (normalizedSeconds <= 0) {
    return 'Belum diatur';
  }

  const totalMinutes = Math.max(1, Math.ceil(normalizedSeconds / 60));
  return `${totalMinutes} menit`;
}

function findInitialMiniTestQuestionId(questions, answers) {
  const nextQuestions = Array.isArray(questions) ? questions : [];
  const nextAnswers = answers || {};
  const firstUnansweredQuestion = nextQuestions.find((question) => !nextAnswers[question.id] && !nextAnswers[String(question.id)]);
  return Number(firstUnansweredQuestion?.id || nextQuestions[0]?.id || 0) || null;
}

export default function Learning() {
  const { packageId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const numericPackageId = Number(packageId);
  const previewMode = String(searchParams.get('preview') || '').trim().toLowerCase();
  const previewSectionCode = String(searchParams.get('section') || '').trim();
  const previewTopicParam = Number(searchParams.get('topic') || 0);
  const previewTopicIndex = Number.isFinite(previewTopicParam) ? Math.max(0, Math.floor(previewTopicParam)) : 0;
  const isDraftPreview = previewMode === 'draft' && previewSectionCode !== '';
  const [learning, setLearning] = useState(null);
  const [activeSectionCode, setActiveSectionCode] = useState('');
  const [sectionTests, setSectionTests] = useState({});
  const [activePackages, setActivePackages] = useState([]);
  const [contentView, setContentView] = useState('dashboard');
  const [activeTopicIndex, setActiveTopicIndex] = useState(0);
  const [packagesExpanded, setPackagesExpanded] = useState(false);
  const [materialsExpanded, setMaterialsExpanded] = useState(true);
  const [expandedMaterialSections, setExpandedMaterialSections] = useState({});
  const [activeSectionView, setActiveSectionView] = useState('material');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const sectionTestSavingRef = useRef({});
  const sectionTestPendingSaveRef = useRef({});
  const {
    navigationRef: floatingNavigationRef,
    shouldShowDock: shouldShowFloatingDock,
    timerRef: floatingTimerRef,
  } = useFloatingTestDock(!loading && activeSectionView === 'mini-test' && Boolean(activeSectionCode));

  const fetchLearning = useCallback(async () => {
    if (!Number.isInteger(numericPackageId) || numericPackageId <= 0) {
      setError('Link paket tidak valid. Silakan pilih ulang paket yang tersedia.');
      setLoading(false);
      return;
    }

    try {
      const query = new URLSearchParams({
        package_id: String(numericPackageId),
      });
      if (isDraftPreview) {
        query.set('preview', 'draft');
        query.set('section_code', previewSectionCode);
      }
      const response = await apiClient.get(`/learning/package?${query.toString()}`);
      const payload = response.data.data;
      setLearning(payload);
      const requestedSectionCode = isDraftPreview && payload.sections?.some((section) => section.code === previewSectionCode)
        ? previewSectionCode
        : payload.sections?.[0]?.code || '';
      setActiveSectionCode(requestedSectionCode);
      setActiveTopicIndex(isDraftPreview ? previewTopicIndex : 0);
      if (isDraftPreview && requestedSectionCode) {
        setContentView('materi');
        setActiveSectionView('material');
        setMaterialsExpanded(true);
        setExpandedMaterialSections({
          [requestedSectionCode]: true,
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat ruang belajar');
    } finally {
      setLoading(false);
    }
  }, [isDraftPreview, numericPackageId, previewSectionCode, previewTopicIndex]);

  useEffect(() => {
    fetchLearning();
  }, [fetchLearning]);

  useEffect(() => {
    setContentView('dashboard');
    setPackagesExpanded(false);
    setMaterialsExpanded(true);
    setExpandedMaterialSections({});
    setActiveTopicIndex(0);
  }, [numericPackageId]);

  useEffect(() => {
    if (!isAuthenticated) {
      setActivePackages([]);
      return;
    }

    let ignore = false;

    const fetchActivePackages = async () => {
      try {
        const response = await apiClient.get('/auth/active-packages');
        if (!ignore) {
          setActivePackages(response.data.data || []);
        }
      } catch (err) {
        if (!ignore) {
          setActivePackages([]);
        }
      }
    };

    fetchActivePackages();

    return () => {
      ignore = true;
    };
  }, [isAuthenticated]);

  const sections = useMemo(() => learning?.sections || [], [learning]);
  const activeSection = useMemo(
    () => sections.find((section) => section.code === activeSectionCode) || sections[0] || null,
    [activeSectionCode, sections]
  );
  const activeSectionTopics = useMemo(
    () => getSectionTopics(activeSection),
    [activeSection]
  );
  const activeTopic = useMemo(
    () => activeSectionTopics[activeTopicIndex] || activeSectionTopics[0] || null,
    [activeSectionTopics, activeTopicIndex]
  );
  useEffect(() => {
    if (activeSectionTopics.length === 0) {
      return;
    }

    if (activeTopicIndex > activeSectionTopics.length - 1) {
      setActiveTopicIndex(0);
    }
  }, [activeSectionTopics, activeTopicIndex]);
  const hasAccess = Boolean(learning?.has_access);
  const viewerIsAuthenticated = Boolean(learning?.is_authenticated ?? isAuthenticated);
  const previewInfo = learning?.preview || {};
  const isActiveDraftPreview = previewInfo.mode === 'draft' && previewInfo.section_code;
  const summary = learning?.summary || {};
  const packageData = learning?.package || null;
  const isPackageTemporarilyDisabled = Boolean(Number(packageData?.is_temporarily_disabled || 0));
  const packageUnderMaintenance = isPackageTemporarilyDisabled && !learning?.admin_bypass;
  const currentSectionTest = useMemo(
    () => (activeSection ? sectionTests[activeSection.code] || EMPTY_OBJECT : EMPTY_OBJECT),
    [activeSection, sectionTests]
  );
  const currentSectionQuestions = useMemo(
    () => currentSectionTest.questions || EMPTY_ARRAY,
    [currentSectionTest.questions]
  );
  const currentSectionSavedAnswers = useMemo(
    () => currentSectionTest.savedAnswers || EMPTY_OBJECT,
    [currentSectionTest.savedAnswers]
  );
  const currentSectionDraftAnswers = useMemo(
    () => currentSectionTest.draftAnswers || EMPTY_OBJECT,
    [currentSectionTest.draftAnswers]
  );
  const currentSectionReviewFlags = useMemo(
    () => currentSectionTest.reviewFlags || EMPTY_OBJECT,
    [currentSectionTest.reviewFlags]
  );
  const currentSectionQuestion = useMemo(() => {
    if (!currentSectionQuestions.length) {
      return null;
    }

    const currentQuestionId = Number(currentSectionTest.currentQuestionId || 0);
    return currentSectionQuestions.find((question) => Number(question.id) === currentQuestionId) || currentSectionQuestions[0] || null;
  }, [currentSectionQuestions, currentSectionTest.currentQuestionId]);
  const currentSectionQuestionIndex = useMemo(
    () => currentSectionQuestions.findIndex((question) => Number(question.id) === Number(currentSectionQuestion?.id)),
    [currentSectionQuestion, currentSectionQuestions]
  );
  const currentSectionQuestionImageLayout = useMemo(() => {
    const layout = String(currentSectionQuestion?.question_image_layout || 'top').toLowerCase();
    return ['top', 'bottom', 'left', 'right'].includes(layout) ? layout : 'top';
  }, [currentSectionQuestion]);
  const activeSectionTopicTitles = useMemo(
    () => getSectionTopics(activeSection)
      .map((topic) => String(topic?.title || '').trim())
      .filter(Boolean),
    [activeSection]
  );
  const activeSectionMiniTestQuestionCount = useMemo(() => {
    const loadedQuestionCount = Array.isArray(currentSectionTest.questions) ? currentSectionTest.questions.length : 0;
    if (loadedQuestionCount > 0) {
      return loadedQuestionCount;
    }

    return Math.max(0, Number(activeSection?.mini_test_question_count || 0));
  }, [activeSection?.mini_test_question_count, currentSectionTest.questions]);
  const activeSectionMiniTestDurationSeconds = useMemo(() => {
    const activeDuration = Number(currentSectionTest.totalDurationSeconds || 0);
    if (activeDuration > 0) {
      return activeDuration;
    }

    if (activeSectionMiniTestQuestionCount <= 0 && Number(activeSection?.duration_minutes || 0) <= 0) {
      return 0;
    }

    return computeMiniTestDurationSeconds(activeSection, activeSectionMiniTestQuestionCount);
  }, [activeSection, activeSectionMiniTestQuestionCount, currentSectionTest.totalDurationSeconds]);
  const activeSectionMiniTestDurationLabel = useMemo(
    () => formatDurationMinutesLabel(activeSectionMiniTestDurationSeconds),
    [activeSectionMiniTestDurationSeconds]
  );
  const latestSectionMiniTestResult = useMemo(
    () => currentSectionTest.result || activeSection?.progress?.subtest_test_result || null,
    [activeSection?.progress?.subtest_test_result, currentSectionTest.result]
  );
  const currentSectionAnsweredCount = useMemo(
    () => currentSectionQuestions.filter((question) => {
      const draftValue = currentSectionDraftAnswers[question.id] || currentSectionDraftAnswers[String(question.id)];
      const savedValue = currentSectionSavedAnswers[question.id] || currentSectionSavedAnswers[String(question.id)];
      return Boolean(draftValue || savedValue);
    }).length,
    [currentSectionDraftAnswers, currentSectionQuestions, currentSectionSavedAnswers]
  );
  const currentSectionAllAnswered = useMemo(
    () => currentSectionQuestions.length > 0 && currentSectionQuestions.every((question) => {
      const draftValue = currentSectionDraftAnswers[question.id] || currentSectionDraftAnswers[String(question.id)];
      const savedValue = currentSectionSavedAnswers[question.id] || currentSectionSavedAnswers[String(question.id)];
      return Boolean(draftValue || savedValue);
    }),
    [currentSectionDraftAnswers, currentSectionQuestions, currentSectionSavedAnswers]
  );
  const previousSectionQuestionId = currentSectionQuestionIndex > 0 ? currentSectionQuestions[currentSectionQuestionIndex - 1]?.id : null;
  const nextSectionQuestionId = currentSectionQuestionIndex >= 0 ? currentSectionQuestions[currentSectionQuestionIndex + 1]?.id : null;
  const hasOngoingSectionAttempt = Boolean(currentSectionTest.attemptId && !currentSectionTest.result);
  const isCurrentQuestionMarkedForReview = useMemo(
    () => Boolean(
      currentSectionReviewFlags[String(currentSectionQuestion?.id)] || currentSectionReviewFlags[currentSectionQuestion?.id]
    ),
    [currentSectionQuestion?.id, currentSectionReviewFlags]
  );
  const currentSectionCurrentAnswerValue = useMemo(
    () => Number(
      currentSectionDraftAnswers[currentSectionQuestion?.id]
      || currentSectionDraftAnswers[String(currentSectionQuestion?.id)]
      || currentSectionSavedAnswers[currentSectionQuestion?.id]
      || currentSectionSavedAnswers[String(currentSectionQuestion?.id)]
      || 0
    ),
    [currentSectionDraftAnswers, currentSectionQuestion?.id, currentSectionSavedAnswers]
  );
  const hasCurrentSectionAnswerSelected = currentSectionCurrentAnswerValue > 0;
  const floatingDockItems = useMemo(() => (
    currentSectionQuestions.map((question, index) => {
      const answeredValue = currentSectionDraftAnswers[question.id]
        || currentSectionDraftAnswers[String(question.id)]
        || currentSectionSavedAnswers[question.id]
        || currentSectionSavedAnswers[String(question.id)];
      const isMarkedForReview = Boolean(
        currentSectionReviewFlags[String(question.id)] || currentSectionReviewFlags[question.id]
      );

      return {
        id: question.id,
        label: index + 1,
        status: Number(question.id) === Number(currentSectionQuestion?.id)
          ? 'current'
          : answeredValue
          ? 'done'
          : 'empty',
        review: isMarkedForReview,
        ariaLabel: `Soal ${index + 1}${isMarkedForReview ? ', ditandai ragu-ragu' : ''}`,
        title: isMarkedForReview ? `Soal ${index + 1} ditandai ragu-ragu` : `Soal ${index + 1}`,
      };
    })
  ), [
    currentSectionDraftAnswers,
    currentSectionQuestion?.id,
    currentSectionQuestions,
    currentSectionReviewFlags,
    currentSectionSavedAnswers,
  ]);
  const floatingDockStats = useMemo(() => ([
    {
      label: 'Sisa waktu',
      value: formatTime(currentSectionTest.remainingSeconds),
      tone: Number(currentSectionTest.remainingSeconds || 0) < 60 ? 'danger' : 'success',
    },
    {
      label: 'Terjawab',
      value: `${currentSectionAnsweredCount}/${currentSectionQuestions.length}`,
    },
    {
      label: 'Soal aktif',
      value: `${Math.max(1, currentSectionQuestionIndex + 1)}/${Math.max(currentSectionQuestions.length, 1)}`,
    },
  ]), [
    currentSectionAnsweredCount,
    currentSectionQuestionIndex,
    currentSectionQuestions.length,
    currentSectionTest.remainingSeconds,
  ]);
  const completedTryout = Number(summary.completed_attempts || 0) > 0;
  const materialDoneCount = sections.filter((section) => section.progress.material_read).length;
  const subtestDoneCount = sections.filter((section) => section.progress.subtest_test_completed).length;
  const totalMilestoneSteps = Math.max(1, sections.length * 2 + 1);
  const completedMilestoneSteps = materialDoneCount + subtestDoneCount + (completedTryout ? 1 : 0);
  const milestonePercent = Math.round((completedMilestoneSteps / totalMilestoneSteps) * 100);
  const currentPackageOption = useMemo(() => {
    const matchedPackage = activePackages.find((pkg) => Number(pkg.package_id) === numericPackageId);
    if (matchedPackage) {
      return matchedPackage;
    }

    return {
      access_id: `current-${numericPackageId}`,
      package_id: numericPackageId,
      package_name: packageData?.name || 'Paket belajar',
      category_name: packageData?.category_name || 'Paket',
      description: packageData?.description || '',
      remaining_attempts: summary.remaining_attempts ?? 'Admin',
      is_unused: false,
      can_start_test: Boolean(summary.can_start_tryout),
    };
  }, [activePackages, numericPackageId, packageData, summary.remaining_attempts, summary.can_start_tryout]);
  const packageOptions = useMemo(() => {
    if (activePackages.length > 0) {
      return activePackages;
    }

    return currentPackageOption ? [currentPackageOption] : [];
  }, [activePackages, currentPackageOption]);
  const sectionLookup = useMemo(
    () => new Map(sections.map((section) => [section.code, section])),
    [sections]
  );
  const lastReadSection = useMemo(() => {
    const scoredSections = sections
      .map((section) => {
        const timestamps = [
          section.progress.material_read_at,
          section.progress.subtest_test_completed_at,
        ].filter(Boolean).map((value) => new Date(value).getTime());

        return {
          section,
          latestTimestamp: timestamps.length ? Math.max(...timestamps) : 0,
        };
      })
      .filter((item) => item.latestTimestamp > 0)
      .sort((left, right) => right.latestTimestamp - left.latestTimestamp);

    return scoredSections[0]?.section || null;
  }, [sections]);
  const nextLearningSection = useMemo(
    () => sections.find((section) => !section.progress.material_read) || sections[0] || null,
    [sections]
  );
  const resumeSection = lastReadSection || nextLearningSection || activeSection || null;

  const jumpToSectionMaterial = (sectionCode, topicIndex = 0) => {
    setContentView('materi');
    setActiveSectionView('material');
    setActiveSectionCode(sectionCode);
    setActiveTopicIndex(topicIndex);
    setMaterialsExpanded(true);
    setExpandedMaterialSections((current) => ({
      ...current,
      [sectionCode]: true,
    }));
  };

  const toggleMaterialSection = (sectionCode) => {
    setContentView('materi');
    setActiveSectionView('material');
    setActiveSectionCode(sectionCode);
    setActiveTopicIndex(0);
    setMaterialsExpanded(true);
    setExpandedMaterialSections((current) => ({
      ...current,
      [sectionCode]: !current[sectionCode],
    }));
  };

  const openSectionTestView = (sectionCode) => {
    if (!sectionCode) {
      return;
    }

    setContentView('materi');
    setActiveSectionView('mini-test');
    setActiveSectionCode(sectionCode);
    setMaterialsExpanded(true);
    setExpandedMaterialSections((current) => ({
      ...current,
      [sectionCode]: true,
    }));
  };

  const updateSectionProgress = (sectionCode, progressPatch) => {
    setLearning((current) => {
      if (!current) return current;

      return {
        ...current,
        sections: current.sections.map((section) => (
          section.code === sectionCode
            ? {
                ...section,
                progress: {
                  ...section.progress,
                  ...progressPatch,
                },
              }
            : section
        )),
      };
    });
  };

  const markMaterialRead = async (sectionCode) => {
    setActionLoading(`material-${sectionCode}`);
    setError('');
    setSuccessMessage('');

    try {
      await apiClient.post('/learning/progress', {
        package_id: numericPackageId,
        section_code: sectionCode,
        milestone_type: 'material_read',
      });
      updateSectionProgress(sectionCode, {
        material_read: true,
        material_read_at: new Date().toISOString(),
      });
      setSuccessMessage('Materi subtest berhasil ditandai selesai.');
      fetchLearning();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menandai materi selesai');
    } finally {
      setActionLoading('');
    }
  };

  const loadSectionTest = useCallback(async (sectionCode, { restart = false } = {}) => {
    setSectionTests((current) => ({
      ...current,
      [sectionCode]: {
        ...(current[sectionCode] || {}),
        loading: true,
        open: true,
        error: '',
        saveMessage: '',
      },
    }));
    setError('');
    setSuccessMessage('');

    try {
      const response = await apiClient.post('/learning/section-test/start', {
        package_id: numericPackageId,
        section_code: sectionCode,
        restart,
      });
      const payload = response.data.data || {};
      const questions = payload.questions || [];
      const savedAnswers = payload.saved_answers || {};
      const reviewFlags = payload.review_flags || {};
      const result = payload.result || null;
      const sectionMeta = payload.section || sectionLookup.get(sectionCode) || null;
      const durationSeconds = Number(payload.attempt?.state?.total_duration_seconds || computeMiniTestDurationSeconds(sectionMeta, questions.length));
      const remainingSeconds = Number(payload.attempt?.state?.remaining_seconds || durationSeconds);

      if (payload.result_ready && result) {
        updateSectionProgress(sectionCode, {
          subtest_test_completed: true,
          subtest_test_completed_at: new Date().toISOString(),
          subtest_test_result: result,
        });
        setSuccessMessage(payload.auto_submitted ? 'Waktu mini test habis dan hasil diproses otomatis.' : '');
      }

      sectionTestPendingSaveRef.current[sectionCode] = null;
      sectionTestSavingRef.current[sectionCode] = false;

      setSectionTests((current) => {
        const existingState = current[sectionCode] || {};
        const nextDraftAnswers = restart ? savedAnswers : { ...savedAnswers };
        const nextCurrentQuestionId = questions.some((question) => Number(question.id) === Number(existingState.currentQuestionId))
          ? Number(existingState.currentQuestionId)
          : findInitialMiniTestQuestionId(questions, nextDraftAnswers);

        return {
          ...(current || {}),
          [sectionCode]: {
            ...existingState,
            attemptId: Number(payload.attempt_id || payload.attempt?.id || 0) || null,
            loading: false,
            open: !payload.result_ready,
            questions,
            savedAnswers,
            draftAnswers: nextDraftAnswers,
            reviewFlags,
            currentQuestionId: nextCurrentQuestionId,
            totalDurationSeconds: durationSeconds,
            remainingSeconds,
            result,
            autoSubmitting: false,
            error: '',
            saveMessage: '',
          },
        };
      });
    } catch (err) {
      setSectionTests((current) => ({
        ...current,
        [sectionCode]: {
          ...(current[sectionCode] || {}),
          loading: false,
          open: true,
          error: err.response?.data?.message || 'Gagal memuat test subtest',
          saveMessage: '',
        },
      }));
    }
  }, [numericPackageId, sectionLookup]);

  const closeSectionTest = (sectionCode) => {
    if (!sectionCode) {
      return;
    }

    setSectionTests((current) => ({
      ...current,
      [sectionCode]: {
        ...(current[sectionCode] || {}),
        open: false,
        loading: false,
        autoSubmitting: false,
        error: '',
        saveMessage: '',
      },
    }));
  };

  const saveSectionTestAnswer = useCallback(async (sectionCode, questionId, optionId, nextQuestionId = null) => {
    const testState = sectionTests[sectionCode] || {};
    const attemptId = Number(testState.attemptId || 0);
    if (!attemptId || !questionId || !optionId) {
      return;
    }

    if (sectionTestSavingRef.current[sectionCode]) {
      sectionTestPendingSaveRef.current[sectionCode] = {
        questionId: Number(questionId),
        optionId: Number(optionId),
        nextQuestionId: nextQuestionId ? Number(nextQuestionId) : null,
      };
      return;
    }

    sectionTestSavingRef.current[sectionCode] = true;

    setSectionTests((current) => ({
      ...current,
      [sectionCode]: {
        ...(current[sectionCode] || {}),
        error: '',
        saveMessage: '',
      },
    }));

    try {
      await apiClient.post('/learning/section-test/save-answer', {
        attempt_id: attemptId,
        question_id: questionId,
        option_id: optionId,
      });

      setSectionTests((current) => ({
        ...current,
        [sectionCode]: {
          ...(current[sectionCode] || {}),
          savedAnswers: {
            ...(current[sectionCode]?.savedAnswers || {}),
            [questionId]: Number(optionId),
          },
          draftAnswers: {
            ...(current[sectionCode]?.draftAnswers || {}),
            [questionId]: Number(optionId),
          },
          currentQuestionId: nextQuestionId ? Number(nextQuestionId) : current[sectionCode]?.currentQuestionId,
          error: '',
          saveMessage: 'Jawaban tersimpan.',
        },
      }));
    } catch (err) {
      const payload = err.response?.data?.data;
      if (payload?.attempt_completed) {
        const result = payload.result || null;
        if (result) {
          updateSectionProgress(sectionCode, {
            subtest_test_completed: true,
            subtest_test_completed_at: new Date().toISOString(),
            subtest_test_result: result,
          });
        }
        setSectionTests((current) => ({
          ...current,
          [sectionCode]: {
            ...(current[sectionCode] || {}),
            result,
            open: false,
            loading: false,
            autoSubmitting: false,
            error: '',
            saveMessage: '',
          },
        }));
        setSuccessMessage('Waktu mini test habis dan hasil diproses otomatis.');
        return;
      }

      setSectionTests((current) => ({
        ...current,
        [sectionCode]: {
          ...(current[sectionCode] || {}),
          error: err.response?.data?.message || 'Gagal menyimpan jawaban mini test',
          saveMessage: '',
        },
      }));
    } finally {
      sectionTestSavingRef.current[sectionCode] = false;

      const pendingSave = sectionTestPendingSaveRef.current[sectionCode];
      sectionTestPendingSaveRef.current[sectionCode] = null;

      if (
        pendingSave
        && (
          pendingSave.questionId !== Number(questionId)
          || pendingSave.optionId !== Number(optionId)
          || pendingSave.nextQuestionId !== (nextQuestionId ? Number(nextQuestionId) : null)
        )
      ) {
        await saveSectionTestAnswer(
          sectionCode,
          pendingSave.questionId,
          pendingSave.optionId,
          pendingSave.nextQuestionId
        );
      }
    }
  }, [sectionTests]);

  const setSectionAnswer = useCallback((sectionCode, questionId, optionId) => {
    setSectionTests((current) => ({
      ...current,
      [sectionCode]: {
        ...(current[sectionCode] || {}),
        draftAnswers: {
          ...(current[sectionCode]?.draftAnswers || {}),
          [questionId]: Number(optionId),
        },
        result: null,
        error: '',
        saveMessage: '',
      },
    }));

    saveSectionTestAnswer(sectionCode, questionId, optionId);
  }, [saveSectionTestAnswer]);

  const goToSectionQuestion = useCallback((sectionCode, questionId) => {
    if (!sectionCode || !questionId) {
      return;
    }

    const testState = sectionTests[sectionCode] || {};
    const questions = testState.questions || [];
    const currentQuestion = questions.find((question) => Number(question.id) === Number(testState.currentQuestionId));

    if (currentQuestion) {
      const currentSavedAnswerValue = Number(testState.savedAnswers?.[String(currentQuestion.id)] || testState.savedAnswers?.[currentQuestion.id] || 0);
      const currentDraftAnswerValue = Number(testState.draftAnswers?.[String(currentQuestion.id)] || testState.draftAnswers?.[currentQuestion.id] || 0);
      const hasUnsavedCurrentAnswer = currentDraftAnswerValue > 0 && currentDraftAnswerValue !== currentSavedAnswerValue;

      if (hasUnsavedCurrentAnswer) {
        saveSectionTestAnswer(sectionCode, currentQuestion.id, currentDraftAnswerValue);
      }
    }

    setSectionTests((current) => ({
      ...current,
      [sectionCode]: {
        ...(current[sectionCode] || {}),
        currentQuestionId: Number(questionId),
        saveMessage: '',
      },
    }));
  }, [saveSectionTestAnswer, sectionTests]);

  const handleSectionRelativeNavigation = (sectionCode, direction) => {
    const testState = sectionTests[sectionCode] || {};
    const questions = testState.questions || [];
    const currentIndex = questions.findIndex((question) => Number(question.id) === Number(testState.currentQuestionId));
    const targetQuestion = questions[currentIndex + direction] || null;
    if (!targetQuestion) {
      return;
    }

    goToSectionQuestion(sectionCode, targetQuestion.id);
  };

  const toggleSectionReviewFlag = useCallback(async (sectionCode, questionId) => {
    const testState = sectionTests[sectionCode] || {};
    const attemptId = Number(testState.attemptId || 0);
    if (!attemptId || !questionId) {
      return;
    }

    const questionKey = String(questionId);
    const currentDraftAnswerValue = Number(testState.draftAnswers?.[questionKey] || testState.draftAnswers?.[questionId] || 0);
    const currentSavedAnswerValue = Number(testState.savedAnswers?.[questionKey] || testState.savedAnswers?.[questionId] || 0);

    if (currentDraftAnswerValue <= 0 && currentSavedAnswerValue <= 0) {
      setSectionTests((current) => ({
        ...current,
        [sectionCode]: {
          ...(current[sectionCode] || {}),
          error: 'Pilih jawaban dulu sebelum menandai ragu-ragu.',
          saveMessage: '',
        },
      }));
      return;
    }

    if (currentDraftAnswerValue > 0 && currentDraftAnswerValue !== currentSavedAnswerValue) {
      await saveSectionTestAnswer(sectionCode, questionId, currentDraftAnswerValue);
    }

    const nextMarkedReview = !(testState.reviewFlags?.[questionKey] || testState.reviewFlags?.[questionId]);

    setSectionTests((current) => ({
      ...current,
      [sectionCode]: {
        ...(current[sectionCode] || {}),
        reviewFlags: (() => {
          const nextFlags = { ...(current[sectionCode]?.reviewFlags || {}) };
          if (nextMarkedReview) {
            nextFlags[questionKey] = true;
          } else {
            delete nextFlags[questionKey];
          }
          return nextFlags;
        })(),
        error: '',
        saveMessage: '',
      },
    }));

    try {
      await apiClient.post('/learning/section-test/review-flag', {
        attempt_id: attemptId,
        question_id: questionId,
        is_marked_review: nextMarkedReview,
      });
    } catch (err) {
      const payload = err.response?.data?.data;
      if (payload?.attempt_completed) {
        const result = payload.result || null;
        if (result) {
          updateSectionProgress(sectionCode, {
            subtest_test_completed: true,
            subtest_test_completed_at: new Date().toISOString(),
            subtest_test_result: result,
          });
        }
        setSectionTests((current) => ({
          ...current,
          [sectionCode]: {
            ...(current[sectionCode] || {}),
            result,
            open: false,
            loading: false,
            autoSubmitting: false,
            error: '',
            saveMessage: '',
          },
        }));
        setSuccessMessage('Waktu mini test habis dan hasil diproses otomatis.');
        return;
      }

      setSectionTests((current) => ({
        ...current,
        [sectionCode]: {
          ...(current[sectionCode] || {}),
          reviewFlags: (() => {
            const revertedFlags = { ...(current[sectionCode]?.reviewFlags || {}) };
            if (nextMarkedReview) {
              delete revertedFlags[questionKey];
            } else {
              revertedFlags[questionKey] = true;
            }
            return revertedFlags;
          })(),
          error: err.response?.data?.message || 'Gagal menyimpan status ragu-ragu mini test',
          saveMessage: '',
        },
      }));
    }
  }, [saveSectionTestAnswer, sectionTests]);

  const submitSectionTest = useCallback(async (sectionCode, { allowPartial = false, confirmManual = false, autoSubmit = false } = {}) => {
    const testState = sectionTests[sectionCode] || {};
    const questions = testState.questions || [];
    const attemptId = Number(testState.attemptId || 0);
    const answers = Object.entries(testState.draftAnswers || {})
      .filter(([questionId, optionId]) => Number(testState.savedAnswers?.[questionId] || 0) !== Number(optionId || 0))
      .map(([questionId, optionId]) => ({
        question_id: Number(questionId),
        option_id: Number(optionId),
      }));

    if (questions.length === 0) {
      setSectionTests((current) => ({
        ...current,
        [sectionCode]: {
          ...(current[sectionCode] || {}),
          error: 'Soal mini test untuk subtest ini belum tersedia.',
        },
      }));
      return;
    }

    if (!attemptId) {
      setSectionTests((current) => ({
        ...current,
        [sectionCode]: {
          ...(current[sectionCode] || {}),
          error: 'Attempt mini test belum siap. Coba mulai ulang mini test ini.',
        },
      }));
      return;
    }

    const answeredCount = questions.filter((question) => {
      const draftValue = testState.draftAnswers?.[String(question.id)] || testState.draftAnswers?.[question.id];
      const savedValue = testState.savedAnswers?.[String(question.id)] || testState.savedAnswers?.[question.id];
      return Boolean(draftValue || savedValue);
    }).length;

    const pendingReviewNumbers = questions.reduce((numbers, question, index) => {
      if (testState.reviewFlags?.[String(question.id)] || testState.reviewFlags?.[question.id]) {
        numbers.push(index + 1);
      }
      return numbers;
    }, []);

    if (!allowPartial && answeredCount === 0) {
      setSectionTests((current) => ({
        ...current,
        [sectionCode]: {
          ...(current[sectionCode] || {}),
          error: 'Pilih minimal satu jawaban sebelum submit mini test.',
        },
      }));
      return;
    }

    if (!autoSubmit && answeredCount !== questions.length) {
      setSectionTests((current) => ({
        ...current,
        [sectionCode]: {
          ...(current[sectionCode] || {}),
          error: 'Jawab semua soal dulu sebelum submit mini test.',
          saveMessage: '',
        },
      }));
      return;
    }

    if (!autoSubmit && pendingReviewNumbers.length > 0) {
      setSectionTests((current) => ({
        ...current,
        [sectionCode]: {
          ...(current[sectionCode] || {}),
          error: `Matikan status ragu-ragu pada soal nomor ${pendingReviewNumbers.join(', ')} sebelum submit mini test.`,
          saveMessage: '',
        },
      }));
      return;
    }

    if (confirmManual) {
      const confirmed = window.confirm('Yakin ingin menyelesaikan mini test sekarang? Nilai akan langsung diproses.');
      if (!confirmed) {
        return;
      }
    }

    setActionLoading(`test-${sectionCode}`);
    setError('');
    setSuccessMessage('');

    try {
      const response = await apiClient.post('/learning/section-test/submit', {
        attempt_id: attemptId,
        answers,
        auto_submit: autoSubmit,
      });
      const result = response.data.data || null;
      setSectionTests((current) => ({
        ...current,
        [sectionCode]: {
          ...(current[sectionCode] || {}),
          result,
          open: false,
          loading: false,
          autoSubmitting: false,
          error: '',
          saveMessage: '',
          savedAnswers: {
            ...(current[sectionCode]?.draftAnswers || {}),
          },
        },
      }));
      updateSectionProgress(sectionCode, {
        subtest_test_completed: true,
        subtest_test_completed_at: new Date().toISOString(),
        subtest_test_result: result,
      });
      setSuccessMessage('Mini test subtest selesai dan masuk ke milestone.');
      fetchLearning();
    } catch (err) {
      setSectionTests((current) => ({
        ...current,
        [sectionCode]: {
          ...(current[sectionCode] || {}),
          autoSubmitting: false,
          error: err.response?.data?.message || 'Gagal menyimpan mini test subtest',
          saveMessage: '',
        },
      }));
    } finally {
      setActionLoading('');
    }
  }, [fetchLearning, sectionTests]);

  const openTryoutView = () => {
    setContentView('tryout');
  };

  const openDashboardView = () => {
    setContentView('dashboard');
  };

  useEffect(() => {
    if (activeSectionView !== 'mini-test' || !hasAccess || !activeSection?.code) {
      return undefined;
    }

    const testState = sectionTests[activeSection.code];
    if (
      !testState?.open
      || testState.loading
      || testState.result
      || Number(testState.remainingSeconds || 0) <= 0
      || (testState.questions || []).length === 0
    ) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setSectionTests((current) => {
        const currentState = current[activeSection.code];
        if (
          !currentState
          || currentState.loading
          || currentState.result
          || Number(currentState.remainingSeconds || 0) <= 0
        ) {
          return current;
        }

        return {
          ...current,
          [activeSection.code]: {
            ...currentState,
            remainingSeconds: Math.max(0, Number(currentState.remainingSeconds || 0) - 1),
          },
        };
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeSection?.code, activeSectionView, hasAccess, sectionTests]);

  useEffect(() => {
    if (activeSectionView !== 'mini-test' || !hasAccess || !activeSection?.code) {
      return;
    }

    const testState = sectionTests[activeSection.code];
    if (
      !testState?.open
      || testState.loading
      || testState.result
      || testState.autoSubmitting
      || (testState.questions || []).length === 0
      || Number(testState.remainingSeconds || 0) > 0
      || actionLoading === `test-${activeSection.code}`
    ) {
      return;
    }

    setSectionTests((current) => ({
      ...current,
      [activeSection.code]: {
        ...(current[activeSection.code] || {}),
        autoSubmitting: true,
      },
    }));

    submitSectionTest(activeSection.code, { allowPartial: true, autoSubmit: true });
  }, [actionLoading, activeSection?.code, activeSectionView, hasAccess, sectionTests, submitSectionTest]);

  if (loading) {
    return (
      <AccountShell title="Ruang Belajar" subtitle="Memuat paket belajar dan progresmu.">
        <div className="account-card">
          <p>Memuat ruang belajar...</p>
        </div>
      </AccountShell>
    );
  }

  if (!learning || !packageData) {
    return (
      <AccountShell title="Ruang Belajar" subtitle="Paket belum bisa dibuka.">
        <div className="account-card">
          <div className="alert">{error || 'Paket tidak ditemukan'}</div>
          <button type="button" className="btn btn-outline" onClick={() => navigate('/#paket')}>
            Pilih Paket Lagi
          </button>
        </div>
      </AccountShell>
    );
  }

  if (packageUnderMaintenance) {
    return (
      <AccountShell
        shellClassName="account-shell-learning"
        title={`Ruang Belajar ${packageData.name}`}
        subtitle="Paket sedang nonaktif sementara."
      >
        <div className="account-card">
          <div className="alert">
            Mohon maaf, paket ini nonaktif sementara dan sedang maintenance.
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Silakan cek kembali beberapa saat lagi. Selama maintenance berlangsung, materi dan aktivasi paket ini sedang kami tutup sementara.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/#paket')}>
              Kembali ke Paket
            </button>
            <button type="button" className="btn btn-outline" onClick={() => navigate('/')}>
              Kembali ke Home
            </button>
          </div>
        </div>
      </AccountShell>
    );
  }

  return (
    <AccountShell
      shellClassName="account-shell-learning"
      title={`Ruang Belajar ${packageData.name}`}
      subtitle="Baca materi per subtest, kerjakan mini test, lalu lanjut ke tryout keseluruhan saat paket aktif."
    >
      {error && <div className="alert">{error}</div>}
      {successMessage && <div className="account-success learning-flash">{successMessage}</div>}

      {isActiveDraftPreview && (
        <div className="learning-preview-notice">
          <strong>Preview draft admin aktif.</strong>
          <span>
            Anda sedang melihat draft materi untuk subtest {previewInfo.section_code}. Tampilan ini memakai konten draft yang belum dipublish ke peserta.
          </span>
        </div>
      )}

      {!hasAccess && (
        <div className="learning-lock-notice">
          <strong>Mode preview aktif.</strong>
          <span>
            {viewerIsAuthenticated
              ? 'Kamu bisa membaca halaman awal dari setiap subtest. Beli paket untuk membuka seluruh materi, mencatat milestone, mini test subtest, dan tryout keseluruhan.'
              : 'Kamu bisa membaca halaman awal dari setiap subtest. Login untuk melihat opsi akses penuh dan melanjutkan ke seluruh materi.'}
          </span>
        </div>
      )}
      <section className="learning-workspace">
        <aside className="learning-sidebar">
          <div className="learning-sidebar-card">
            <p className="learning-sidebar-label">Jenis paket</p>
            <button
              type="button"
              className="learning-sidebar-toggle"
              onClick={() => setPackagesExpanded((current) => !current)}
              aria-expanded={packagesExpanded}
            >
              <span>
                <strong>{currentPackageOption.package_name}</strong>
                <small>{currentPackageOption.category_name}</small>
              </span>
              <span>{packagesExpanded ? '▴' : '▾'}</span>
            </button>

            {packagesExpanded && (
              <div className="learning-sidebar-list">
                {packageOptions.map((pkg) => (
                  <button
                    type="button"
                    key={pkg.access_id || pkg.package_id}
                    className={Number(pkg.package_id) === numericPackageId ? 'learning-sidebar-item learning-sidebar-item-active' : 'learning-sidebar-item'}
                    onClick={() => navigate(`/learning/${pkg.package_id}`)}
                  >
                    <strong>{pkg.package_name}</strong>
                    <small>{pkg.category_name}</small>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="learning-sidebar-card">
            <button
              type="button"
              className={contentView === 'dashboard' ? 'learning-sidebar-link learning-sidebar-link-active' : 'learning-sidebar-link'}
              onClick={openDashboardView}
            >
              Dashboard
            </button>

            <button
              type="button"
              className="learning-sidebar-toggle learning-sidebar-toggle-secondary"
              onClick={() => setMaterialsExpanded((current) => !current)}
              aria-expanded={materialsExpanded}
            >
              <span>
                <strong>Materi</strong>
                <small>{sections.length} subtest tersedia</small>
              </span>
              <span>{materialsExpanded ? '▴' : '▾'}</span>
            </button>

            {materialsExpanded && (
              <div className="learning-sidebar-list">
                {sections.map((section) => {
                  const topics = getSectionTopics(section);
                  const isTopicActive = contentView === 'materi' && activeSectionView === 'material' && section.code === activeSection?.code;
                  const isMiniTestActive = contentView === 'materi' && activeSectionView === 'mini-test' && section.code === activeSection?.code;

                  return (
                    <div key={section.code} className="admin-section-sidebar-entry">
                      <button
                        type="button"
                        className={isTopicActive || isMiniTestActive ? 'learning-sidebar-item learning-sidebar-item-active admin-section-sidebar-item' : 'learning-sidebar-item admin-section-sidebar-item'}
                        onClick={() => toggleMaterialSection(section.code)}
                      >
                        <span className="admin-section-sidebar-item-copy">
                          <strong>{section.name}</strong>
                          <small>{formatActiveTopicLabel(section)}</small>
                        </span>
                        <span className="admin-section-sidebar-caret" aria-hidden="true">
                          {expandedMaterialSections[section.code] ? '▾' : '▸'}
                        </span>
                      </button>

                      {expandedMaterialSections[section.code] && (
                        <div className="admin-section-sidebar-children">
                          {topics.map((topic, topicIndex) => (
                            <button
                              key={`${section.code}-topic-${topicIndex}`}
                              type="button"
                              className={contentView === 'materi' && activeSectionView === 'material' && section.code === activeSection?.code && topicIndex === activeTopicIndex ? 'admin-section-sidebar-child admin-section-sidebar-child-active' : 'admin-section-sidebar-child'}
                              onClick={() => jumpToSectionMaterial(section.code, topicIndex)}
                            >
                              <span>{topicIndex + 1}</span>
                              <strong>{topic.title || `Topik ${topicIndex + 1}`}</strong>
                            </button>
                          ))}
                          <button
                            type="button"
                            className={isMiniTestActive ? 'admin-section-sidebar-child admin-section-sidebar-child-mini-test admin-section-sidebar-child-active' : 'admin-section-sidebar-child admin-section-sidebar-child-mini-test'}
                            onClick={() => openSectionTestView(section.code)}
                          >
                            <span>MT</span>
                            <strong>Mini Test Subtest</strong>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              className={contentView === 'tryout' ? 'learning-sidebar-link learning-sidebar-link-active' : 'learning-sidebar-link'}
              onClick={openTryoutView}
            >
              Tryout
            </button>
          </div>
        </aside>

        <div className="learning-main-panel">
          {contentView === 'dashboard' && (
            <section className="learning-dashboard-shell">
              <div className="learning-dashboard-header">
                <div>
                  <span className="account-package-tag">{packageData.category_name}</span>
                  <h2>{packageData.name}</h2>
                  <p>{packageData.description}</p>
                </div>
                <div className="learning-path-score" aria-label={`Progress belajar ${milestonePercent} persen`}>
                  <strong>{milestonePercent}%</strong>
                  <span>progress</span>
                </div>
              </div>

              <div className="learning-progress-track" aria-hidden="true">
                <span style={{ width: `${milestonePercent}%` }} />
              </div>

              <div className="learning-dashboard-focus">
                <div className="learning-dashboard-card">
                  <p className="learning-sidebar-label">Riwayat baca terakhir</p>
                  <h3>{resumeSection?.name || 'Mulai dari materi pertama'}</h3>
                  <p>
                    {resumeSection
                      ? `Terakhir aktif di ${resumeSection.session_name || 'subtest utama'}.`
                      : 'Belum ada materi yang dibuka. Mulai dari subtest pertama.'}
                  </p>
                  <div className="learning-hero-actions">
                    {resumeSection && (
                      <button type="button" className="btn btn-primary" onClick={() => jumpToSectionMaterial(resumeSection.code)}>
                        Lanjutkan Membaca Materi
                      </button>
                    )}
                    <button type="button" className="btn btn-outline" onClick={openTryoutView}>
                      Buka Menu Tryout
                    </button>
                  </div>
                </div>

                <div className="learning-summary-grid">
                  <div>
                    <span>Materi selesai</span>
                    <strong>{materialDoneCount}/{sections.length}</strong>
                  </div>
                  <div>
                    <span>Mini test selesai</span>
                    <strong>{subtestDoneCount}/{sections.length}</strong>
                  </div>
                  <div>
                    <span>Sisa tryout</span>
                    <strong>{summary.remaining_attempts ?? 'Admin'}</strong>
                  </div>
                </div>
              </div>

              <div className="learning-path-list">
                {sections.map((section, index) => {
                  const materialDone = Boolean(section.progress.material_read);
                  const subtestDone = Boolean(section.progress.subtest_test_completed);
                  const sectionDone = materialDone && subtestDone;

                  return (
                    <button
                      type="button"
                      key={section.code}
                      className={[
                        'learning-path-card',
                        sectionDone ? 'learning-path-card-done' : '',
                        section.code === resumeSection?.code ? 'learning-path-card-active' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => jumpToSectionMaterial(section.code)}
                    >
                      <span className="learning-path-index">{index + 1}</span>
                      <span className="learning-path-copy">
                        <strong>{section.name}</strong>
                        <small>{section.session_name || 'Subtest belajar'}</small>
                      </span>
                      <span className="learning-path-steps">
                        <span className={materialDone ? 'learning-path-step learning-path-step-done' : 'learning-path-step'}>
                          Materi
                        </span>
                        <span className={subtestDone ? 'learning-path-step learning-path-step-done' : 'learning-path-step'}>
                          Mini test
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {contentView === 'materi' && activeSection && (
            <article className="learning-material">
              <div className="learning-material-header">
                <div>
                  <span className="account-package-tag">
                    {activeSection.session_name || packageData.category_name}
                  </span>
                  <h2>{activeSection.name}</h2>
                  <p>
                    {activeSectionView === 'mini-test'
                      ? 'Kerjakan mini test subtest ini setelah membaca topik-topik yang tersedia.'
                      : hasAccess
                      ? 'Materi penuh terbuka. Ikuti urutan topik lalu halaman seperti alur belajar di admin.'
                      : `Preview ${activeSection.visible_page_count} dari ${activeSection.total_page_count} halaman materi.`}
                  </p>
                </div>
                {(activeSectionView === 'mini-test'
                  ? activeSection.progress.subtest_test_completed
                  : activeSection.progress.material_read) && (
                  <span className="account-status-pill account-status-fresh">
                    {activeSectionView === 'mini-test' ? 'Mini test selesai' : 'Materi selesai'}
                  </span>
                )}
              </div>

              {activeSectionView === 'material' && activeSectionTopics.length > 0 && (
                <div className="learning-topic-list">
                  {activeSectionTopics.map((topic, topicIndex) => (
                    <button
                      key={`${activeSection.code}-topic-tab-${topicIndex}`}
                      type="button"
                      className={topicIndex === activeTopicIndex ? 'learning-topic-button learning-topic-button-active' : 'learning-topic-button'}
                      onClick={() => setActiveTopicIndex(topicIndex)}
                    >
                      <strong>{topic.title || `Topik ${topicIndex + 1}`}</strong>
                      <small>{topic.visible_page_count || topic.pages?.length || 0} halaman terbuka</small>
                    </button>
                  ))}
                </div>
              )}

              {activeSectionView === 'material' && activeTopic ? (
                <div className="learning-page-list">
                  {(activeTopic.pages || []).map((page, index) => (
                    <section
                      key={`${activeTopic.title || 'topic'}-${index}`}
                      className={page.content_html && isMaterialPdfVisualHtml(page.content_html)
                        ? 'learning-page learning-page-document learning-page-document-pdf-visual'
                        : 'learning-page learning-page-document'}
                    >
                      <div className="learning-page-document-header">
                        <span className="learning-page-document-label">Halaman {index + 1}</span>
                        <div className="learning-page-brand" aria-hidden="true">
                          <img className="learning-page-brand-logo" src="/ujiin-logo.png" alt="Ujiin" />
                        </div>
                      </div>
                      <div className="learning-page-document-body learning-rich-content">
                        {page.content_html ? (
                          <div
                            dangerouslySetInnerHTML={{ __html: sanitizeMaterialHtml(page.content_html) }}
                          />
                        ) : (
                          <>
                            <ul>
                              {(page.points || []).map((point) => (
                                <li key={point}>{point}</li>
                              ))}
                            </ul>
                            <p>{page.closing}</p>
                          </>
                        )}
                      </div>
                    </section>
                  ))}
                </div>
              ) : activeSectionView === 'material' ? (
                <div className="learning-page-list">
                  <section className="learning-page">
                    <span>Materi</span>
                    <h3>Topik belum tersedia</h3>
                    <p>Topik materi untuk subtest ini masih disiapkan.</p>
                  </section>
                </div>
              ) : null}

              {activeSectionView === 'material' && !hasAccess && activeSection.locked_page_count > 0 && (
                <div className="learning-locked-pages">
                  <strong>{activeSection.locked_page_count} halaman lanjutan terkunci.</strong>
                  <p>
                    {viewerIsAuthenticated
                      ? 'Beli paket untuk membuka pembahasan penuh dan milestone belajar.'
                      : 'Login untuk melihat akses penuh dan membuka pembahasan materi setelah paket aktif.'}
                  </p>
                  <Link to={viewerIsAuthenticated ? `/payment/${numericPackageId}` : '/login'} className="btn btn-primary">
                    {viewerIsAuthenticated ? 'Beli Paket' : 'Login untuk Lanjut'}
                  </Link>
                </div>
              )}

              {hasAccess && activeSectionView === 'material' && (
                <div className="learning-section-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={activeSection.progress.material_read || actionLoading === `material-${activeSection.code}`}
                    onClick={() => markMaterialRead(activeSection.code)}
                  >
                    {activeSection.progress.material_read ? 'Materi Sudah Selesai' : 'Tandai Materi Selesai'}
                  </button>
                </div>
              )}

              {activeSectionView === 'mini-test' && !hasAccess && (
                <div className="learning-locked-pages">
                  <strong>Mini test subtest terkunci.</strong>
                  <p>
                    {viewerIsAuthenticated
                      ? 'Aktifkan paket untuk membuka mini test subtest dan menyimpan milestone belajar.'
                      : 'Login untuk melihat akses penuh dan membuka mini test subtest.'}
                  </p>
                  <Link to={viewerIsAuthenticated ? `/payment/${numericPackageId}` : '/login'} className="btn btn-primary">
                    {viewerIsAuthenticated ? 'Beli Paket' : 'Login untuk Lanjut'}
                  </Link>
                </div>
              )}

              {hasAccess && activeSectionView === 'mini-test' && currentSectionTest.open && (
                <div className="learning-subtest-box">
                  {currentSectionTest.loading ? (
                    <p>Memuat mini test...</p>
                  ) : currentSectionTest.error ? (
                    <div className="test-feedback test-feedback-error">{currentSectionTest.error}</div>
                  ) : currentSectionQuestions.length === 0 ? (
                    <p className="text-muted">Soal mini test untuk subtest ini belum tersedia.</p>
                  ) : !currentSectionQuestion ? (
                    <p className="text-muted">Soal mini test belum siap ditampilkan.</p>
                  ) : (
                    <>
                      {currentSectionTest.saveMessage && (
                        <div className="test-feedback test-feedback-success">{currentSectionTest.saveMessage}</div>
                      )}

                      <section className="test-hero">
                        <div className="test-hero-copy">
                          <p className="test-hero-kicker">Mini Test Subtest</p>
                          <h1 className="test-hero-title">{activeSection.name}</h1>
                          <p className="test-hero-description">
                            Flow mini test sekarang mengikuti tryout: jawaban tersimpan otomatis, soal bisa ditandai ragu-ragu, dan hasil diproses saat kamu selesaikan atau waktu habis.
                          </p>
                          <div className="test-hero-pills" aria-label="Ringkasan mini test subtest">
                            <span>{packageData.name}</span>
                            <span>{currentSectionQuestions.length} soal</span>
                            <span>{activeSection.session_name || 'Subtest aktif'}</span>
                          </div>
                        </div>

                        <div className="test-hero-stats">
                          <div className="test-hero-stat-card">
                            <span>Terjawab</span>
                            <strong>{currentSectionAnsweredCount} / {currentSectionQuestions.length}</strong>
                            <small>Progress mini test subtest aktif</small>
                          </div>
                          <div ref={floatingTimerRef} className="test-hero-stat-card">
                            <span>Sisa waktu</span>
                            <strong>{formatTime(currentSectionTest.remainingSeconds)}</strong>
                            <small>{currentSectionTest.result ? 'Timer berhenti setelah hasil tersimpan' : 'Waktu akan berjalan selama mini test dibuka'}</small>
                          </div>
                          <div className="test-hero-stat-card">
                            <span>Status</span>
                            <strong>{currentSectionTest.result ? 'Selesai' : 'Sedang dikerjakan'}</strong>
                            <small>
                              {currentSectionAllAnswered
                                ? 'Semua soal sudah terisi.'
                                : `${currentSectionQuestions.length - currentSectionAnsweredCount} soal masih kosong.`}
                            </small>
                          </div>
                        </div>
                      </section>

                      {currentSectionTest.result && (
                        <div className="test-feedback test-feedback-success">
                          Hasil mini test: <strong>{formatScore(currentSectionTest.result)}</strong>
                        </div>
                      )}

                      {currentSectionTest.result && (
                        <div className="learning-section-actions">
                          <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => closeSectionTest(activeSection.code)}
                          >
                            Kembali ke Menu Mini Test
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => loadSectionTest(activeSection.code, { restart: true })}
                          >
                            Ulangi Mini Test
                          </button>
                        </div>
                      )}

                      <FloatingTestDock
                        ariaLabel="Navigasi cepat mini test subtest"
                        items={floatingDockItems}
                        note="Timer dan nomor soal tetap bisa diakses saat kamu scroll."
                        onSelectItem={(questionId) => goToSectionQuestion(activeSection.code, questionId)}
                        stats={floatingDockStats}
                        title="Akses cepat"
                        visible={currentSectionTest.open && shouldShowFloatingDock}
                      />

                      <div className="test-layout-grid">
                        <div className="test-main-column">
                          <div className="card test-question-card">
                            <div className="test-question-stage">
                              <div ref={floatingNavigationRef} className="test-inline-navigation">
                                <div className="test-inline-navigation-head">
                                  <h3 className="test-inline-navigation-title">Navigasi Soal</h3>
                                  <p className="test-inline-navigation-note">
                                    Klik nomor soal. Kuning berarti ragu-ragu.
                                  </p>
                                </div>
                                <div className="test-question-strip test-question-strip-inline" role="tablist" aria-label="Navigasi mini test subtest">
                                  {currentSectionQuestions.map((question, index) => {
                                    const answeredValue = currentSectionDraftAnswers[question.id]
                                      || currentSectionDraftAnswers[String(question.id)]
                                      || currentSectionSavedAnswers[question.id]
                                      || currentSectionSavedAnswers[String(question.id)];
                                    const isMarkedForReview = Boolean(
                                      currentSectionReviewFlags[String(question.id)] || currentSectionReviewFlags[question.id]
                                    );

                                    return (
                                      <button
                                        key={question.id}
                                        type="button"
                                        onClick={() => goToSectionQuestion(activeSection.code, question.id)}
                                        className={[
                                          'test-nav-chip',
                                          'test-nav-chip-button',
                                          Number(question.id) === Number(currentSectionQuestion.id)
                                            ? 'test-nav-chip-current'
                                            : answeredValue
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
                                  <span className="test-question-number">Soal {Math.max(1, currentSectionQuestionIndex + 1)}</span>
                                  <h2 className="test-question-title">Fokuskan jawabanmu di soal ini dulu</h2>
                                  <p className="test-question-section-label">{activeSection.name}</p>
                                </div>
                              </div>

                              {(currentSectionQuestion.question_text || currentSectionQuestion.question_image_url) && (
                                <div className={`test-question-media test-question-media-${currentSectionQuestionImageLayout}`}>
                                  {currentSectionQuestion.question_text && (
                                    <div className="test-question-text-block">
                                      <p className="test-question-text">{currentSectionQuestion.question_text}</p>
                                    </div>
                                  )}
                                  {currentSectionQuestion.question_image_url && (
                                    <div className="test-question-image-frame">
                                      <img
                                        src={currentSectionQuestion.question_image_url}
                                        alt={`Mini test soal ${currentSectionQuestionIndex + 1}`}
                                        className="test-question-image"
                                        loading="lazy"
                                      />
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="space-y-3 mb-8">
                                {currentSectionQuestion.options?.map((option) => (
                                  <label
                                    key={option.id}
                                    className={`test-option ${Number(currentSectionDraftAnswers[currentSectionQuestion.id] || currentSectionDraftAnswers[String(currentSectionQuestion.id)] || currentSectionSavedAnswers[currentSectionQuestion.id] || currentSectionSavedAnswers[String(currentSectionQuestion.id)] || 0) === Number(option.id) ? 'test-option-active' : ''}`}
                                  >
                                    <input
                                      type="radio"
                                      name={`section-${activeSection.code}-question-${currentSectionQuestion.id}`}
                                      checked={Number(currentSectionDraftAnswers[currentSectionQuestion.id] || currentSectionDraftAnswers[String(currentSectionQuestion.id)] || currentSectionSavedAnswers[currentSectionQuestion.id] || currentSectionSavedAnswers[String(currentSectionQuestion.id)] || 0) === Number(option.id)}
                                      onChange={() => setSectionAnswer(activeSection.code, currentSectionQuestion.id, option.id)}
                                      disabled={Boolean(currentSectionTest.result)}
                                      className="mt-1 w-5 h-5 accent-blue-600"
                                    />
                                    <div className="test-option-copy">
                                      <p className="test-option-letter">{option.letter}.</p>
                                      {option.text && <p className="test-option-text">{option.text}</p>}
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
                                  <button
                                    type="button"
                                    onClick={() => handleSectionRelativeNavigation(activeSection.code, -1)}
                                    disabled={!previousSectionQuestionId}
                                    className="btn btn-outline test-action-button disabled:opacity-50"
                                  >
                                    ← Sebelumnya
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleSectionRelativeNavigation(activeSection.code, 1)}
                                    disabled={!nextSectionQuestionId}
                                    className="btn btn-outline test-action-button disabled:opacity-50"
                                  >
                                    Selanjutnya →
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => toggleSectionReviewFlag(activeSection.code, currentSectionQuestion.id)}
                                    disabled={Boolean(currentSectionTest.result) || !hasCurrentSectionAnswerSelected}
                                    title={hasCurrentSectionAnswerSelected ? undefined : 'Pilih jawaban dulu untuk mengaktifkan ragu-ragu'}
                                    className={`btn btn-outline test-action-button ${
                                      isCurrentQuestionMarkedForReview ? 'test-action-button-review-active' : ''
                                    }`}
                                  >
                                    {isCurrentQuestionMarkedForReview ? 'Batalkan Ragu-ragu' : 'Tandai Ragu-ragu'}
                                  </button>
                                </div>

                                <div className="test-action-helper">
                                  {currentSectionTest.result
                                    ? 'Hasil terakhir sudah tersimpan. Kamu bisa kembali ke menu mini test atau ulangi dari awal.'
                                    : currentSectionAllAnswered
                                    ? 'Semua jawaban sudah terisi dan terus tersimpan otomatis.'
                                    : 'Jawaban tersimpan otomatis saat dipilih. Tombol submit akan muncul setelah semua soal terjawab. Jika waktu habis, jawaban yang sudah masuk akan langsung diproses.'}
                                  {!currentSectionTest.result && !hasCurrentSectionAnswerSelected ? ' Pilih salah satu opsi dulu untuk membuka tombol ragu-ragu.' : ''}
                                </div>

                                <div className="test-action-buttons test-action-buttons-end">
                                  {(currentSectionAllAnswered || currentSectionTest.result) && (
                                    <button
                                      type="button"
                                      className="btn btn-primary test-action-button disabled:opacity-50"
                                      disabled={actionLoading === `test-${activeSection.code}` || currentSectionQuestions.length === 0}
                                      onClick={() => (
                                        currentSectionTest.result
                                          ? loadSectionTest(activeSection.code, { restart: true })
                                          : submitSectionTest(activeSection.code, { confirmManual: true })
                                      )}
                                    >
                                      {actionLoading === `test-${activeSection.code}`
                                        ? 'Memproses...'
                                        : currentSectionTest.result
                                        ? 'Ulangi Mini Test'
                                        : activeSection.progress.subtest_test_completed
                                        ? 'Submit Ulang Mini Test'
                                        : 'Submit Mini Test'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="test-sidebar-column">
                          <div className="test-sidebar-metrics">
                            <div className="test-header-stat">
                              <p className="test-header-stat-label">Terjawab</p>
                              <p className="test-header-stat-value">{currentSectionAnsweredCount} / {currentSectionQuestions.length}</p>
                            </div>
                            <div className="test-header-stat">
                              <p className="test-header-stat-label">Sisa Waktu</p>
                              <p className={`test-header-stat-value ${Number(currentSectionTest.remainingSeconds || 0) < 60 ? 'test-header-stat-value-danger' : 'test-header-stat-value-success'}`}>
                                {formatTime(currentSectionTest.remainingSeconds)}
                              </p>
                            </div>
                            <div className="test-header-stat">
                              <p className="test-header-stat-label">Soal Aktif</p>
                              <p className="test-header-stat-value">{Math.max(1, currentSectionQuestionIndex + 1)} / {currentSectionQuestions.length}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {hasAccess && activeSectionView === 'mini-test' && !currentSectionTest.open && (
                <div className="learning-subtest-box">
                  <section className="test-hero">
                    <div className="test-hero-copy">
                      <p className="test-hero-kicker">Preview Mini Test</p>
                      <h1 className="test-hero-title">{activeSection.name}</h1>
                      <p className="test-hero-description">
                        {hasOngoingSectionAttempt
                          ? 'Mini test ini masih berjalan. Buka lagi untuk melanjutkan dari jawaban dan waktu terakhir.'
                          : 'Cek dulu ringkasannya. Timer baru berjalan setelah kamu menekan tombol mulai.'}
                      </p>
                      <div className="test-hero-pills" aria-label="Ringkasan preview mini test subtest">
                        <span>{packageData.name}</span>
                        <span>{activeSection.session_name || 'Subtest aktif'}</span>
                        <span>{activeSectionMiniTestQuestionCount} soal</span>
                        <span>{activeSectionMiniTestDurationLabel}</span>
                      </div>
                    </div>

                    <div className="test-hero-stats">
                      <div className="test-hero-stat-card">
                        <span>Judul mini test</span>
                        <strong>{activeSection.name}</strong>
                        <small>{activeSection.session_name || 'Subtest belajar aktif'}</small>
                      </div>
                      <div className="test-hero-stat-card">
                        <span>Durasi</span>
                        <strong>{activeSectionMiniTestDurationLabel}</strong>
                        <small>
                          {activeSectionMiniTestQuestionCount > 0
                            ? `${activeSectionMiniTestQuestionCount} soal akan dikerjakan dalam satu sesi.`
                            : 'Durasi akan dipakai saat soal mini test tersedia.'}
                        </small>
                      </div>
                      <div className="test-hero-stat-card">
                        <span>Status</span>
                        <strong>{hasOngoingSectionAttempt ? 'Sedang berjalan' : activeSection.progress.subtest_test_completed ? 'Pernah selesai' : 'Belum dimulai'}</strong>
                        <small>
                          {hasOngoingSectionAttempt
                            ? 'Jawaban dan timer akan dilanjutkan dari attempt yang masih aktif.'
                            : activeSection.progress.subtest_test_completed
                            ? 'Kamu bisa mulai lagi untuk mengulang mini test ini.'
                            : 'Belum ada timer yang berjalan sebelum tombol mulai ditekan.'}
                        </small>
                      </div>
                    </div>
                  </section>

                  <div className="learning-mini-test-preview-topics">
                    <p className="learning-sidebar-label">Topik mini test</p>
                    {activeSectionTopicTitles.length > 0 ? (
                      <div className="learning-mini-test-topic-chips">
                        {activeSectionTopicTitles.map((topicTitle) => (
                          <span key={`${activeSection.code}-${topicTitle}`} className="learning-mini-test-topic-chip">
                            {topicTitle}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted">Topik untuk mini test ini masih disiapkan.</p>
                    )}
                  </div>

                  {activeSectionMiniTestQuestionCount <= 0 && (
                    <div className="test-feedback test-feedback-error">
                      Soal mini test untuk subtest ini belum tersedia.
                    </div>
                  )}

                  {latestSectionMiniTestResult && (
                    <div className="test-feedback test-feedback-success">
                      Hasil terakhir mini test: <strong>{formatScore(latestSectionMiniTestResult)}</strong>
                    </div>
                  )}

                  <div className="learning-section-actions">
                    {latestSectionMiniTestResult && (
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => navigate(`/learning/${numericPackageId}/review/${encodeURIComponent(activeSection.code)}`)}
                      >
                        Lihat Pembahasan Soal
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={activeSectionMiniTestQuestionCount <= 0}
                      onClick={() => loadSectionTest(activeSection.code, { restart: Boolean(latestSectionMiniTestResult && !hasOngoingSectionAttempt) })}
                    >
                      {hasOngoingSectionAttempt ? 'Lanjutkan Mini Test' : latestSectionMiniTestResult ? 'Ulangi Mini Test' : 'Mulai Mini Test'}
                    </button>
                  </div>
                </div>
              )}
            </article>
          )}

          {contentView === 'tryout' && (
            <section className="learning-tryout-panel">
              <div>
                <span className="account-package-tag">Tryout keseluruhan</span>
                <h2>{packageData.name}</h2>
                <p>
                  Tryout ini memakai alur test yang sudah ada: seluruh materi paket dikerjakan sebagai simulasi penuh.
                </p>
              </div>

              <div className="account-package-stats learning-tryout-stats">
                <div>
                  <span>Soal</span>
                  <strong>{packageData.question_count}</strong>
                </div>
                <div>
                  <span>Waktu</span>
                  <strong>{packageData.time_limit} menit</strong>
                </div>
                <div>
                  <span>Sisa percobaan</span>
                  <strong>{summary.remaining_attempts ?? 'Admin'}</strong>
                </div>
              </div>

              <div className="learning-tryout-actions">
                {hasAccess ? (
                  summary.can_start_tryout ? (
                    <Link to={`/test/${numericPackageId}`} className="btn btn-primary">
                      Mulai Tryout
                    </Link>
                  ) : (
                    <button type="button" className="btn btn-outline" disabled>
                      Percobaan Habis
                    </button>
                  )
                ) : (
                  <Link to={viewerIsAuthenticated ? `/payment/${numericPackageId}` : '/login'} className="btn btn-primary">
                    {viewerIsAuthenticated ? 'Aktifkan Paket untuk Tryout' : 'Login untuk Buka Tryout'}
                  </Link>
                )}
                <button type="button" className="btn btn-outline" onClick={openDashboardView}>
                  Kembali ke Dashboard
                </button>
              </div>
            </section>
          )}
        </div>
      </section>
    </AccountShell>
  );
}
