import React, { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AccountShell from '../components/AccountShell';
import BrandLogo from '../components/BrandLogo';
import FloatingTestDock, { useFloatingTestDock } from '../components/FloatingTestDock';
import LatexContent from '../components/LatexContent';
import ProfileDropdown from '../components/ProfileDropdown';
import QuestionReportModal from '../components/QuestionReportModal';
import apiClient from '../api';
import { useAuth } from '../AuthContext';
import {
  clearActiveMiniTestSession,
  getActiveMiniTestSession,
  persistActiveMiniTestSession,
} from '../utils/activeAssessmentSession';
import { sanitizeMaterialHtml } from '../utils/materialHtml';
import { isMaterialPdfVisualHtml } from '../utils/materialPagination';

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};
const CALENDAR_WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const DASHBOARD_TOPIC_ACCENTS = ['blue', 'green', 'pink', 'cyan'];
const LEARNING_VIEW_DASHBOARD = 'dashboard';
const LEARNING_VIEW_MATERIAL = 'material';
const LEARNING_VIEW_TRYOUT = 'tryout';

function LearningIcon({ name }) {
  switch (name) {
    case 'dashboard':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.6" />
          <rect x="14" y="3" width="7" height="5" rx="1.6" />
          <rect x="14" y="12" width="7" height="9" rx="1.6" />
          <rect x="3" y="14" width="7" height="7" rx="1.6" />
        </svg>
      );
    case 'book':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v15.5a.5.5 0 0 1-.8.4A6.8 6.8 0 0 0 15 18.5H6.5A2.5 2.5 0 0 1 4 16V6.5Z" />
          <path d="M12 6v12" />
          <path d="M12 8.2c1.1-.8 2.3-1.2 3.8-1.2H20" />
        </svg>
      );
    case 'target':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v3" />
          <path d="m19 5-2 2" />
          <path d="m22 12-3 0" />
        </svg>
      );
    case 'history':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" />
          <path d="M3 3v5h5" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case 'review':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H11l-4.5 4v-4H7.5A2.5 2.5 0 0 1 5 12.5v-6Z" />
          <path d="M9 8h6" />
          <path d="M9 11h4" />
        </svg>
      );
    case 'package':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
          <path d="m4 7.5 8 4.5 8-4.5" />
          <path d="M12 12v9" />
        </svg>
      );
    case 'profile':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20a8 8 0 0 1 16 0" />
        </svg>
      );
    case 'search':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case 'bell':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.5 19a2.5 2.5 0 0 0 5 0" />
          <path d="M6 16.5h12l-1.3-1.7a4.5 4.5 0 0 1-.9-2.7V10a3.8 3.8 0 1 0-7.6 0v2.1a4.5 4.5 0 0 1-.9 2.7L6 16.5Z" />
        </svg>
      );
    case 'play':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M8.5 6.8c0-1 .95-1.62 1.8-1.17l8 4.2a1.33 1.33 0 0 1 0 2.36l-8 4.2c-.85.45-1.8-.16-1.8-1.17V6.8Z" />
        </svg>
      );
    case 'arrow-left':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18 9 12l6-6" />
        </svg>
      );
    case 'arrow-right':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 18 6-6-6-6" />
        </svg>
      );
    case 'spark':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 3 1.55 4.45L18 9l-4.45 1.55L12 15l-1.55-4.45L6 9l4.45-1.55L12 3Z" />
          <path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
        </svg>
      );
    case 'trophy':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 4h8v3a4 4 0 0 1-8 0V4Z" />
          <path d="M6 6H4a2 2 0 0 0 2 4h1" />
          <path d="M18 6h2a2 2 0 0 1-2 4h-1" />
          <path d="M12 11v4" />
          <path d="M9 21h6" />
          <path d="M10 15h4v6h-4z" />
        </svg>
      );
    default:
      return null;
  }
}

function formatMonthLabel(date) {
  try {
    const monthLabel = new Intl.DateTimeFormat('id-ID', {
      month: 'long',
      year: 'numeric',
    }).format(date);
    return monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  } catch (error) {
    return '';
  }
}

function toDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function buildCalendarDays(baseDate, activityKeys) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const todayKey = toDateKey(baseDate);
  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPreviousMonth = new Date(year, month, 0).getDate();
  const calendarDays = [];

  for (let index = 0; index < 42; index += 1) {
    const dayNumber = index - firstDayIndex + 1;
    const inCurrentMonth = dayNumber > 0 && dayNumber <= daysInMonth;
    const cellDate = inCurrentMonth
      ? new Date(year, month, dayNumber)
      : dayNumber <= 0
      ? new Date(year, month - 1, daysInPreviousMonth + dayNumber)
      : new Date(year, month + 1, dayNumber - daysInMonth);
    const dayKey = toDateKey(cellDate);

    calendarDays.push({
      key: dayKey,
      label: cellDate.getDate(),
      inCurrentMonth,
      isToday: dayKey === todayKey,
      hasActivity: activityKeys.has(dayKey),
    });
  }

  return calendarDays;
}

function getFirstName(value) {
  const normalizedName = String(value || '').trim();
  return normalizedName.split(/\s+/)[0] || 'Pejuang';
}

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

  if (result.scoring_type === 'point') {
    const maxScore = Number(result.max_score ?? 0);
    return `${score.toLocaleString('id-ID')} poin${maxScore > 0 ? ` dari ${maxScore.toLocaleString('id-ID')}` : ''}`;
  }

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

function normalizeLearningView(value) {
  const normalizedValue = String(value || '').trim().toLowerCase();
  if (normalizedValue === LEARNING_VIEW_MATERIAL) {
    return LEARNING_VIEW_MATERIAL;
  }
  if (normalizedValue === LEARNING_VIEW_TRYOUT) {
    return LEARNING_VIEW_TRYOUT;
  }
  return LEARNING_VIEW_DASHBOARD;
}

function parseLearningTopicIndex(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function toContentView(view) {
  if (view === LEARNING_VIEW_MATERIAL) {
    return 'materi';
  }

  if (view === LEARNING_VIEW_TRYOUT) {
    return 'tryout';
  }

  return 'dashboard';
}

function buildMiniTestPath(packageId, sectionCode) {
  return `/learning/${Number(packageId)}/mini-test/${encodeURIComponent(String(sectionCode || '').trim())}`;
}

function TryoutStartModal({
  isOpen,
  onClose,
  onConfirm,
  actionLabel,
  packageName,
  questionCount,
  durationMinutes,
  hasOngoingAttempt,
}) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const safeQuestionCount = Math.max(0, Number(questionCount || 0));
  const safeDurationMinutes = Math.max(0, Number(durationMinutes || 0));

  return (
    <div className="tryout-start-modal-overlay" role="presentation" onClick={() => onClose?.()}>
      <div
        className="tryout-start-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tryout-start-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="tryout-start-modal-head">
          <div>
            <span className="tryout-start-modal-eyebrow">Tryout Utama</span>
            <h3 id="tryout-start-modal-title">Siap masuk ke sesi tryout?</h3>
            <p>
              {hasOngoingAttempt
                ? 'Sesi tryout aktif akan dilanjutkan dari progres dan waktu terakhir.'
                : 'Timer akan mulai begitu halaman soal terbuka, jadi pastikan kamu sudah siap fokus.'}
            </p>
          </div>
          <button
            type="button"
            className="tryout-start-modal-close"
            onClick={() => onClose?.()}
            aria-label="Tutup popup mulai tryout"
          >
            ×
          </button>
        </div>

        <div className="tryout-start-modal-warning">
          Setelah masuk ke halaman soal, kamu tidak bisa kembali santai ke menu tryout sebelum sesi selesai.
          Jika keluar dari halaman, sistem akan mengembalikanmu ke tryout aktif yang sama.
        </div>

        <div className="tryout-start-modal-grid">
          <div className="tryout-start-modal-card">
            <span>Paket</span>
            <strong>{packageName || 'Tryout aktif'}</strong>
            <small>Sesi penuh untuk seluruh subtest.</small>
          </div>
          <div className="tryout-start-modal-card">
            <span>Jumlah soal</span>
            <strong>{safeQuestionCount.toLocaleString('id-ID')} soal</strong>
            <small>Semua soal dikerjakan dalam satu attempt.</small>
          </div>
          <div className="tryout-start-modal-card">
            <span>Waktu</span>
            <strong>{safeDurationMinutes.toLocaleString('id-ID')} menit</strong>
            <small>Gunakan waktumu dengan ritme yang stabil.</small>
          </div>
        </div>

        <div className="tryout-start-modal-actions">
          <button type="button" className="btn btn-outline" onClick={() => onClose?.()}>
            Batal
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onConfirm?.()}>
            {actionLabel || 'Masuk Tryout'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Learning() {
  const { packageId, miniTestSectionCode } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isAdmin, logout, user } = useAuth();
  const numericPackageId = Number(packageId);
  const routeMiniTestSectionCode = String(miniTestSectionCode || '').trim();
  const isDedicatedMiniTestRoute = routeMiniTestSectionCode !== '';
  const previewMode = String(searchParams.get('preview') || '').trim().toLowerCase();
  const previewSectionCode = String(searchParams.get('section') || '').trim();
  const previewTopicIndex = parseLearningTopicIndex(searchParams.get('topic'));
  const isDraftPreview = previewMode === 'draft' && previewSectionCode !== '';
  const requestedLearningView = normalizeLearningView(
    searchParams.get('view') || (!isDraftPreview && searchParams.get('section') ? LEARNING_VIEW_MATERIAL : LEARNING_VIEW_DASHBOARD)
  );
  const requestedMaterialSectionCode = isDraftPreview || isDedicatedMiniTestRoute
    ? ''
    : String(searchParams.get('section') || '').trim();
  const requestedMaterialTopicIndex = isDraftPreview || isDedicatedMiniTestRoute
    ? 0
    : parseLearningTopicIndex(searchParams.get('topic'));
  const initialRequestedSectionCode = isDraftPreview
    ? previewSectionCode
    : isDedicatedMiniTestRoute
    ? routeMiniTestSectionCode
    : requestedMaterialSectionCode;
  const initialContentView = isDraftPreview || isDedicatedMiniTestRoute
    ? isDedicatedMiniTestRoute
      ? 'tryout'
      : 'materi'
    : toContentView(requestedLearningView);
  const initialSectionView = isDedicatedMiniTestRoute ? 'mini-test' : 'material';
  const initialTopicIndex = isDraftPreview
    ? previewTopicIndex
    : requestedLearningView === LEARNING_VIEW_MATERIAL
    ? requestedMaterialTopicIndex
    : 0;
  const [learning, setLearning] = useState(null);
  const [activeSectionCode, setActiveSectionCode] = useState(initialRequestedSectionCode);
  const [sectionTests, setSectionTests] = useState({});
  const [contentView, setContentView] = useState(initialContentView);
  const [activeTopicIndex, setActiveTopicIndex] = useState(initialTopicIndex);
  const [activeSectionView, setActiveSectionView] = useState(initialSectionView);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [miniTestReportFeedback, setMiniTestReportFeedback] = useState('');
  const [miniTestReportModalOpen, setMiniTestReportModalOpen] = useState(false);
  const [tryoutStartModalOpen, setTryoutStartModalOpen] = useState(false);
  const [learningSearch, setLearningSearch] = useState('');
  const sectionTestSavingRef = useRef({});
  const sectionTestPendingSaveRef = useRef({});
  const materialViewRef = useRef(null);
  const autoResumeMiniTestRef = useRef(false);
  const pendingMaterialScrollBehaviorRef = useRef('auto');
  const lastMaterialViewportKeyRef = useRef('');
  const deferredLearningSearch = useDeferredValue(learningSearch.trim().toLowerCase());
  const displayName = user?.full_name || localStorage.getItem('fullName') || 'Pejuang UTBK';
  const greetingName = getFirstName(displayName);
  const viewerRoleLabel = isAdmin ? 'Admin' : 'Siswa';
  const {
    isCompactViewport,
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
      const availableSections = Array.isArray(payload.sections) ? payload.sections : [];
      const requestedSectionCandidate = isDraftPreview
        ? previewSectionCode
        : isDedicatedMiniTestRoute
        ? routeMiniTestSectionCode
        : requestedMaterialSectionCode;
      const resolvedSectionCode = requestedSectionCandidate && availableSections.some((section) => section.code === requestedSectionCandidate)
        ? requestedSectionCandidate
        : availableSections[0]?.code || '';
      const resolvedSection = availableSections.find((section) => section.code === resolvedSectionCode) || null;
      const maxResolvedTopicIndex = Math.max(0, getSectionTopics(resolvedSection).length - 1);

      setActiveSectionCode(resolvedSectionCode);

      if (isDraftPreview) {
        setContentView('materi');
        setActiveSectionView('material');
        setActiveTopicIndex(Math.min(previewTopicIndex, maxResolvedTopicIndex));
      } else if (isDedicatedMiniTestRoute) {
        setContentView('tryout');
        setActiveSectionView('mini-test');
        setActiveTopicIndex(0);
      } else {
        setContentView(toContentView(requestedLearningView));
        setActiveSectionView('material');
        setActiveTopicIndex(
          requestedLearningView === LEARNING_VIEW_MATERIAL
            ? Math.min(requestedMaterialTopicIndex, maxResolvedTopicIndex)
            : 0
        );
      }

    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat ruang belajar');
    } finally {
      setLoading(false);
    }
  }, [
    isDedicatedMiniTestRoute,
    isDraftPreview,
    numericPackageId,
    previewSectionCode,
    previewTopicIndex,
    requestedLearningView,
    requestedMaterialSectionCode,
    requestedMaterialTopicIndex,
    routeMiniTestSectionCode,
  ]);

  useEffect(() => {
    fetchLearning();
  }, [fetchLearning]);

  useEffect(() => {
    setContentView(initialContentView);
    setActiveSectionView(initialSectionView);
    setActiveTopicIndex(initialTopicIndex);
    setActiveSectionCode(initialRequestedSectionCode);
    pendingMaterialScrollBehaviorRef.current = 'auto';
    lastMaterialViewportKeyRef.current = '';
    autoResumeMiniTestRef.current = false;
  }, [
    initialContentView,
    initialRequestedSectionCode,
    initialSectionView,
    initialTopicIndex,
    numericPackageId,
  ]);

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
    if (loading || isDraftPreview) {
      return;
    }

    const requestedMaterialSection = sections.find((section) => section.code === requestedMaterialSectionCode) || activeSection || null;
    const maxRequestedTopicIndex = Math.max(0, getSectionTopics(requestedMaterialSection).length - 1);
    const clampedRequestedMaterialTopicIndex = Math.min(requestedMaterialTopicIndex, maxRequestedTopicIndex);

    if (isDedicatedMiniTestRoute) {
      if (contentView !== 'tryout') {
        setContentView('tryout');
      }
      if (activeSectionView !== 'mini-test') {
        setActiveSectionView('mini-test');
      }
      if (
        routeMiniTestSectionCode
        && sections.some((section) => section.code === routeMiniTestSectionCode)
        && routeMiniTestSectionCode !== activeSectionCode
      ) {
        setActiveSectionCode(routeMiniTestSectionCode);
      }
      return;
    }

    if (requestedLearningView === LEARNING_VIEW_TRYOUT) {
      if (contentView !== 'tryout') {
        setContentView('tryout');
      }
      if (activeSectionView !== 'material') {
        setActiveSectionView('material');
      }
      return;
    }

    if (requestedLearningView === LEARNING_VIEW_MATERIAL) {
      if (contentView !== 'materi') {
        setContentView('materi');
      }
      if (activeSectionView !== 'material') {
        setActiveSectionView('material');
      }
      if (
        requestedMaterialSectionCode
        && sections.some((section) => section.code === requestedMaterialSectionCode)
        && requestedMaterialSectionCode !== activeSectionCode
      ) {
        setActiveSectionCode(requestedMaterialSectionCode);
      }
      if (clampedRequestedMaterialTopicIndex !== activeTopicIndex) {
        setActiveTopicIndex(clampedRequestedMaterialTopicIndex);
      }
      return;
    }

    if (contentView !== 'dashboard') {
      setContentView('dashboard');
    }
    if (activeSectionView !== 'material') {
      setActiveSectionView('material');
    }
  }, [
    activeSectionCode,
    activeSectionView,
    activeTopicIndex,
    contentView,
    isDedicatedMiniTestRoute,
    isDraftPreview,
    loading,
    activeSection,
    requestedLearningView,
    requestedMaterialSectionCode,
    requestedMaterialTopicIndex,
    routeMiniTestSectionCode,
    sections,
  ]);
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
  const floatingTimerStat = useMemo(() => ({
    label: 'Sisa waktu',
    value: formatTime(currentSectionTest.remainingSeconds),
    tone: Number(currentSectionTest.remainingSeconds || 0) < 60 ? 'danger' : 'success',
  }), [currentSectionTest.remainingSeconds]);
  const ongoingTryoutAttempts = Math.max(0, Number(summary.ongoing_attempts || 0));
  const hasOngoingTryoutAttempt = ongoingTryoutAttempts > 0;
  const notificationCount = ongoingTryoutAttempts + (hasOngoingSectionAttempt ? 1 : 0);
  const hasPreviousTopic = activeSectionView === 'material' && activeTopicIndex > 0;
  const hasNextTopic = activeSectionView === 'material' && activeTopicIndex < activeSectionTopics.length - 1;
  const isLastTopic = activeSectionView === 'material' && activeSectionTopics.length > 0 && activeTopicIndex === activeSectionTopics.length - 1;
  const shouldShowFocusLayout = isCompactViewport && contentView !== 'dashboard';
  const mobileFocusTitle = activeSectionView === 'mini-test'
    ? 'Mini Test Subtest'
    : contentView === 'tryout'
    ? 'Menu Tryout'
    : activeTopic?.title || activeSection?.name || 'Materi Subtest';
  const mobileFocusSubtitle = activeSectionView === 'mini-test'
    ? activeSection?.name || activeSection?.session_name || 'Subtest aktif'
    : contentView === 'tryout'
    ? packageData?.name || 'Tryout keseluruhan'
    : activeSection?.name || activeSection?.session_name || 'Ruang belajar';
  const completedTryout = Number(summary.completed_attempts || 0) > 0;
  const materialDoneCount = sections.filter((section) => section.progress.material_read).length;
  const subtestDoneCount = sections.filter((section) => section.progress.subtest_test_completed).length;
  const totalMilestoneSteps = Math.max(1, sections.length * 2 + 1);
  const completedMilestoneSteps = materialDoneCount + subtestDoneCount + (completedTryout ? 1 : 0);
  const milestonePercent = Math.round((completedMilestoneSteps / totalMilestoneSteps) * 100);
  const packageCategoryLabel = packageData?.category_name || packageData?.name || 'Belajar';
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
  const totalTopicCount = useMemo(
    () => sections.reduce((total, section) => total + Math.max(0, Number(section.total_topic_count || getSectionTopics(section).length || 0)), 0),
    [sections]
  );
  const completedTopicCount = useMemo(
    () => sections.reduce((total, section) => {
      if (!section.progress.material_read) {
        return total;
      }

      return total + Math.max(0, Number(section.total_topic_count || getSectionTopics(section).length || 0));
    }, 0),
    [sections]
  );
  const activeLearningCount = resumeSection && !resumeSection.progress.material_read ? 1 : 0;
  const pendingSectionCount = Math.max(0, sections.length - materialDoneCount - activeLearningCount);
  const totalEstimatedStudyMinutes = useMemo(
    () => sections.reduce((total, section) => {
      const materialMinutes = Math.max(0, Number(section.duration_minutes || 0));
      const miniTestMinutes = Math.max(
        0,
        Math.ceil(computeMiniTestDurationSeconds(section, Number(section.mini_test_question_count || 0)) / 60)
      );

      return total + materialMinutes + miniTestMinutes;
    }, 0),
    [sections]
  );
  const completedEstimatedStudyMinutes = useMemo(
    () => sections.reduce((total, section) => {
      const materialMinutes = Math.max(0, Number(section.duration_minutes || 0));
      const miniTestMinutes = Math.max(
        0,
        Math.ceil(computeMiniTestDurationSeconds(section, Number(section.mini_test_question_count || 0)) / 60)
      );

      return total
        + (section.progress.material_read ? materialMinutes : 0)
        + (section.progress.subtest_test_completed ? miniTestMinutes : 0);
    }, 0),
    [sections]
  );
  const estimatedStudyProgressPercent = totalEstimatedStudyMinutes > 0
    ? Math.round((completedEstimatedStudyMinutes / totalEstimatedStudyMinutes) * 100)
    : milestonePercent;
  const filteredDashboardTopics = useMemo(() => {
    const indexedTopics = activeSectionTopics.map((topic, topicIndex) => ({
      topic,
      topicIndex,
    }));

    if (!deferredLearningSearch) {
      return indexedTopics;
    }

    return indexedTopics.filter(({ topic }) => {
      const normalizedTitle = String(topic?.title || '').trim().toLowerCase();
      const matchedPage = (topic.pages || []).some((page) => String(page?.title || '').trim().toLowerCase().includes(deferredLearningSearch));
      return normalizedTitle.includes(deferredLearningSearch) || matchedPage;
    });
  }, [activeSectionTopics, deferredLearningSearch]);
  const calendarBaseDate = useMemo(() => new Date(), []);
  const learningActivityKeys = useMemo(
    () => new Set(
      sections
        .flatMap((section) => [section.progress.material_read_at, section.progress.subtest_test_completed_at])
        .map((value) => toDateKey(value))
        .filter(Boolean)
    ),
    [sections]
  );
  const calendarDays = useMemo(
    () => buildCalendarDays(calendarBaseDate, learningActivityKeys),
    [calendarBaseDate, learningActivityKeys]
  );
  const calendarMonthLabel = useMemo(
    () => formatMonthLabel(calendarBaseDate),
    [calendarBaseDate]
  );
  const latestCompletedReviewSection = useMemo(() => {
    const completedSections = sections
      .filter((section) => section.progress.subtest_test_completed)
      .sort((left, right) => {
        const leftTime = new Date(left.progress.subtest_test_completed_at || 0).getTime();
        const rightTime = new Date(right.progress.subtest_test_completed_at || 0).getTime();
        return rightTime - leftTime;
      });

    return completedSections[0] || null;
  }, [sections]);
  const desktopSearchEnabled = contentView === 'dashboard';
  const desktopSearchPlaceholder = desktopSearchEnabled
    ? 'Cari materi, mini test, atau topik...'
    : 'Pencarian cepat tersedia di dashboard';
  const normalizedPackageLabel = `${packageData?.name || ''} ${packageData?.category_name || ''}`.toLowerCase();
  const isCpnsLearningPackage = ['cpns', 'skd', 'asn', 'pppk'].some((keyword) => normalizedPackageLabel.includes(keyword));
  const dashboardMascotSrc = '/mascots/ujiin-study-checklist.png';
  const sidebarMascotSrc = isCpnsLearningPackage
    ? '/mascots/ujiin-cpns-clipboard.png'
    : '/mascots/ujiin-study-checklist.png';
  const supportCardBadge = viewerIsAuthenticated ? 'Teman Belajar' : 'Preview Belajar';
  const supportCardTitle = viewerIsAuthenticated
    ? 'Biar ritme belajarmu tetap rapi dan ringan.'
    : 'Login untuk simpan progres dan buka seluruh materi.';
  const supportCardDescription = viewerIsAuthenticated
    ? 'Lanjutkan materi sedikit demi sedikit, lalu masuk ke mini test saat checklist harianmu mulai penuh.'
    : 'Kamu sudah bisa lihat cuplikan materi. Login dulu supaya dashboard, milestone, dan mini test ikut aktif.';
  const supportCardActionLabel = viewerIsAuthenticated ? 'Lihat Paket Aktif' : 'Login Sekarang';

  const syncLearningUrl = useCallback(({ view, sectionCode = '', topicIndex = 0 } = {}) => {
    if (isDraftPreview || numericPackageId <= 0) {
      return;
    }

    const nextView = normalizeLearningView(view);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('view', nextView);

    if (sectionCode) {
      nextParams.set('section', sectionCode);
      nextParams.set('topic', String(Math.max(0, Math.floor(Number(topicIndex || 0)) || 0)));
    } else {
      nextParams.delete('section');
      nextParams.delete('topic');
    }

    const nextSearch = nextParams.toString();
    navigate(
      {
        pathname: `/learning/${numericPackageId}`,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true }
    );
  }, [isDraftPreview, navigate, numericPackageId, searchParams]);

  const scrollToMaterialTop = useCallback((behavior = 'auto') => {
    if (typeof window === 'undefined') {
      return;
    }

    const scrollTarget = materialViewRef.current;
    if (scrollTarget?.scrollIntoView) {
      scrollTarget.scrollIntoView({
        behavior,
        block: 'start',
      });
      return;
    }

    window.scrollTo({
      top: 0,
      behavior,
    });
  }, []);

  useLayoutEffect(() => {
    if (loading || (contentView !== 'materi' && activeSectionView !== 'mini-test')) {
      return;
    }

    const nextViewportKey = activeSectionView === 'mini-test'
      ? `mini-test:${activeSectionCode}`
      : `material:${activeSectionCode}:${activeTopicIndex}`;

    if (!nextViewportKey || nextViewportKey === lastMaterialViewportKeyRef.current) {
      return;
    }

    lastMaterialViewportKeyRef.current = nextViewportKey;
    scrollToMaterialTop(pendingMaterialScrollBehaviorRef.current);
    pendingMaterialScrollBehaviorRef.current = 'auto';
  }, [activeSectionCode, activeSectionView, activeTopicIndex, contentView, loading, scrollToMaterialTop]);

  useEffect(() => {
    if (contentView !== 'materi' && activeSectionView !== 'mini-test') {
      lastMaterialViewportKeyRef.current = '';
    }
  }, [activeSectionView, contentView]);

  const jumpToSectionMaterial = useCallback((sectionCode, topicIndex = 0) => {
    if (!sectionCode) {
      return;
    }

    const safeTopicIndex = Math.max(0, Math.floor(Number(topicIndex || 0)) || 0);
    pendingMaterialScrollBehaviorRef.current = 'auto';
    setContentView('materi');
    setActiveSectionView('material');
    setActiveSectionCode(sectionCode);
    setActiveTopicIndex(safeTopicIndex);
    syncLearningUrl({
      view: LEARNING_VIEW_MATERIAL,
      sectionCode,
      topicIndex: safeTopicIndex,
    });
  }, [syncLearningUrl]);

  const selectTryoutSubtest = useCallback((sectionCode) => {
    if (!sectionCode) {
      return;
    }

    pendingMaterialScrollBehaviorRef.current = 'auto';
    setContentView('tryout');
    setActiveSectionView('material');
    setActiveSectionCode(sectionCode);
    syncLearningUrl({
      view: LEARNING_VIEW_TRYOUT,
      sectionCode,
      topicIndex: activeTopicIndex,
    });
  }, [activeTopicIndex, syncLearningUrl]);

  const openSectionTestView = useCallback((sectionCode) => {
    if (!sectionCode) {
      return;
    }

    pendingMaterialScrollBehaviorRef.current = 'auto';
    setContentView('tryout');
    setActiveSectionView('mini-test');
    setActiveSectionCode(sectionCode);
    if (!isDraftPreview && location.pathname !== buildMiniTestPath(numericPackageId, sectionCode)) {
      navigate(buildMiniTestPath(numericPackageId, sectionCode));
    }
  }, [isDraftPreview, location.pathname, navigate, numericPackageId]);

  const handleMaterialTopicNavigation = useCallback((direction) => {
    if (activeSectionTopics.length <= 0) {
      return;
    }

    const nextTopicIndex = Math.max(0, Math.min(activeSectionTopics.length - 1, activeTopicIndex + direction));
    if (nextTopicIndex === activeTopicIndex) {
      return;
    }

    jumpToSectionMaterial(activeSection?.code || '', nextTopicIndex);
  }, [activeSection?.code, activeSectionTopics.length, activeTopicIndex, jumpToSectionMaterial]);

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
      const resumedAttemptId = Number(payload.attempt_id || payload.attempt?.id || 0) || null;

      if (payload.result_ready && result) {
        clearActiveMiniTestSession();
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
            attemptId: resumedAttemptId,
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

      if (!payload.result_ready && resumedAttemptId) {
        persistActiveMiniTestSession({
          packageId: numericPackageId,
          sectionCode,
          attemptId: resumedAttemptId,
        });
      }
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
        clearActiveMiniTestSession();
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
        clearActiveMiniTestSession();
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
      clearActiveMiniTestSession();
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
    pendingMaterialScrollBehaviorRef.current = 'auto';
    setContentView('tryout');
    setActiveSectionView('material');
    syncLearningUrl({
      view: LEARNING_VIEW_TRYOUT,
      sectionCode: activeSection?.code || requestedMaterialSectionCode,
      topicIndex: activeTopicIndex,
    });
  };

  const handleTryoutPrimaryConfirm = useCallback(() => {
    setTryoutStartModalOpen(false);
    navigate(`/test/${numericPackageId}`, { replace: true });
  }, [navigate, numericPackageId]);

  const openDashboardView = () => {
    pendingMaterialScrollBehaviorRef.current = 'auto';
    setContentView('dashboard');
    setActiveSectionView('material');
    syncLearningUrl({
      view: LEARNING_VIEW_DASHBOARD,
      sectionCode: activeSection?.code || requestedMaterialSectionCode,
      topicIndex: activeTopicIndex,
    });
  };

  const desktopPageSubtitle = contentView === 'dashboard'
    ? 'Lanjutkan persiapanmu hari ini.'
    : activeSectionView === 'mini-test'
    ? `Latihan singkat ${activeSection?.session_name || activeSection?.name || 'subtest aktif'} sekarang dibuka dari menu tryout.`
    : contentView === 'tryout'
    ? 'Pilih mini test per subtest atau masuk ke tryout keseluruhan setelah ritme belajarmu siap.'
    : activeTopic?.title || activeSection?.session_name || 'Baca materi per topik dan lanjutkan progresmu.';
  const sidebarPrimaryItems = [
    {
      key: 'dashboard',
      label: 'Dashboard',
      hint: 'Ringkasan progres paket',
      icon: 'dashboard',
      active: contentView === 'dashboard',
      onClick: openDashboardView,
      disabled: false,
    },
    {
      key: 'belajar',
      label: 'Belajar',
      hint: activeSection?.session_name || 'Buka materi aktif',
      icon: 'book',
      active: contentView === 'materi',
      onClick: () => {
        if (resumeSection?.code) {
          jumpToSectionMaterial(resumeSection.code);
        }
      },
      disabled: !resumeSection?.code,
    },
    {
      key: 'tryout',
      label: 'Tryout',
      hint: summary.can_start_tryout ? 'Siap dikerjakan' : 'Selesaikan tahap belajar dulu',
      icon: 'target',
      active: contentView === 'tryout',
      onClick: openTryoutView,
      disabled: false,
    },
    {
      key: 'history',
      label: 'Riwayat',
      hint: 'Cek hasil tryout dan mini test',
      icon: 'history',
      active: false,
      onClick: () => navigate('/test-history'),
      disabled: false,
    },
    {
      key: 'review',
      label: 'Pembahasan',
      hint: latestCompletedReviewSection ? latestCompletedReviewSection.name : 'Belum ada mini test selesai',
      icon: 'review',
      active: false,
      onClick: () => {
        if (latestCompletedReviewSection) {
          navigate(`/learning/${numericPackageId}/review/${latestCompletedReviewSection.code}`);
        }
      },
      disabled: !latestCompletedReviewSection,
    },
    {
      key: 'package',
      label: 'Paket Aktif',
      hint: packageData?.name || 'Kelola paketmu',
      icon: 'package',
      active: false,
      onClick: () => navigate('/active-packages'),
      disabled: false,
    },
    {
      key: 'profile',
      label: 'Profil',
      hint: 'Atur akun dan preferensi',
      icon: 'profile',
      active: false,
      onClick: () => navigate('/profile'),
      disabled: false,
    },
  ];
  const dashboardRecommendationItems = [
    resumeSection && {
      key: 'resume-material',
      icon: 'book',
      title: resumeSection.name || 'Lanjutkan materi',
      meta: `${resumeSection.session_name || formatActiveTopicLabel(resumeSection)} • ${getSectionTopics(resumeSection).length} topik`,
      actionLabel: 'Belajar',
      onClick: () => jumpToSectionMaterial(resumeSection.code),
    },
    resumeSection?.progress?.material_read && !resumeSection?.progress?.subtest_test_completed && {
      key: 'section-mini-test',
      icon: 'review',
      title: `Mini Test ${resumeSection.name}`,
      meta: `${Math.max(0, Number(resumeSection.mini_test_question_count || 0))} soal • ${formatDurationMinutesLabel(computeMiniTestDurationSeconds(resumeSection, Number(resumeSection.mini_test_question_count || 0)))}`,
      actionLabel: 'Kerjakan',
      onClick: () => selectTryoutSubtest(resumeSection.code),
    },
    summary.can_start_tryout && {
      key: 'package-tryout',
      icon: 'target',
      title: 'Tryout Paket',
      meta: summary.remaining_attempts == null ? 'Akses admin tanpa batas attempt.' : `${summary.remaining_attempts} kesempatan tersisa`,
      actionLabel: 'Masuk',
      onClick: openTryoutView,
    },
  ].filter(Boolean);
  const dashboardAchievementItems = [
    {
      key: 'materials',
      icon: 'spark',
      value: `${materialDoneCount}/${sections.length || 0}`,
      label: 'Materi selesai',
    },
    {
      key: 'mini-tests',
      icon: 'trophy',
      value: `${subtestDoneCount}/${sections.length || 0}`,
      label: 'Mini test tuntas',
    },
    {
      key: 'tryouts',
      icon: 'target',
      value: String(Number(summary.completed_attempts || 0)),
      label: 'Tryout selesai',
    },
  ];
  const tryoutPrimaryStatusLabel = hasAccess
    ? summary.can_start_tryout
      ? hasOngoingTryoutAttempt
        ? 'Sedang berjalan'
        : completedTryout
        ? 'Siap diulang'
        : 'Siap dimulai'
      : 'Percobaan habis'
    : viewerIsAuthenticated
    ? 'Paket belum aktif'
    : 'Login diperlukan';
  const tryoutAttemptSummaryLabel = summary.remaining_attempts == null
    ? 'Akses admin'
    : `${summary.remaining_attempts} kesempatan tersisa`;
  const tryoutPrimaryActionLabel = hasAccess
    ? summary.can_start_tryout
      ? hasOngoingTryoutAttempt
        ? 'Lanjutkan Tryout Utama'
        : completedTryout
        ? 'Ulangi Tryout Utama'
        : 'Mulai Tryout Utama'
      : 'Percobaan Habis'
    : viewerIsAuthenticated
    ? 'Aktifkan Paket untuk Tryout'
    : 'Login untuk Buka Tryout';
  const tryoutPrimaryDescription = hasAccess
    ? 'Kerjakan simulasi penuh seluruh paket dalam satu sesi supaya opsi tryout utamanya langsung kelihatan jelas.'
    : viewerIsAuthenticated
    ? 'Aktifkan paket dulu untuk membuka simulasi penuh dan menyimpan hasil tryout utama.'
    : 'Login dulu untuk membuka simulasi penuh dan menyimpan hasil tryout utama.';
  const selectedMiniTestActionLabel = hasAccess
    ? activeSection?.name
      ? `Masuk Mini Test ${activeSection.name}`
      : 'Pilih Subtest Dulu'
    : viewerIsAuthenticated
    ? 'Aktifkan Paket untuk Mini Test'
    : 'Login untuk Buka Mini Test';
  const miniTestWorkspace = activeSectionView === 'mini-test' && activeSection ? (
    <>
      {!hasAccess && (
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

      {hasAccess && currentSectionTest.open && (
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
              {miniTestReportFeedback && (
                <div className="test-feedback test-feedback-success">{miniTestReportFeedback}</div>
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
                    Kembali ke Ringkasan Mini Test
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
                ariaLabel="Timer mini test mengambang"
                stat={floatingTimerStat}
                visible={currentSectionTest.open && shouldShowFloatingDock}
              />

              <div className="test-layout-grid">
                <div className="test-main-column">
                  <div className="card test-question-card">
                    <div className="test-question-stage">
                      <div className="test-inline-navigation">
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
                              <LatexContent
                                content={currentSectionQuestion.question_text}
                                className="test-question-text"
                              />
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

                          <button
                            type="button"
                            onClick={() => setMiniTestReportModalOpen(true)}
                            disabled={Boolean(currentSectionTest.result)}
                            className="btn btn-outline test-action-button test-action-button-report"
                          >
                            Laporkan Soal
                          </button>
                        </div>

                        <div className="test-action-helper">
                          {currentSectionTest.result
                            ? 'Hasil terakhir sudah tersimpan. Kamu bisa kembali ke ringkasan mini test atau ulangi dari awal.'
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

                {!isCompactViewport && (
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
                )}

                {currentSectionQuestion && (
                  <QuestionReportModal
                    isOpen={miniTestReportModalOpen}
                    onClose={() => setMiniTestReportModalOpen(false)}
                    onSubmitted={(message) => setMiniTestReportFeedback(message)}
                    assessmentType="mini_test"
                    targetType="question"
                    originContext="mini_test_active"
                    packageId={numericPackageId}
                    questionId={currentSectionQuestion.id}
                    sectionTestAttemptId={currentSectionTest.attemptId}
                    sectionCode={activeSection.code}
                    sectionLabel={activeSection.name || activeSection.session_name || 'Mini test aktif'}
                    questionNumber={Math.max(1, currentSectionQuestionIndex + 1)}
                    questionText={currentSectionQuestion.question_text || ''}
                    questionImageUrl={currentSectionQuestion.question_image_url || ''}
                  />
                )}
              </div>
            </>
          )}
        </div>
      )}

      {hasAccess && !currentSectionTest.open && (
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
    </>
  ) : null;

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

  useEffect(() => {
    if (loading || autoResumeMiniTestRef.current) {
      return;
    }

    const activeMiniTestSession = getActiveMiniTestSession();
    if (
      !activeMiniTestSession
      || Number(activeMiniTestSession.packageId || 0) !== numericPackageId
      || !sections.some((section) => section.code === activeMiniTestSession.sectionCode)
    ) {
      return;
    }

    const resumedSection = sections.find((section) => section.code === activeMiniTestSession.sectionCode);
    if (resumedSection?.progress?.subtest_test_completed) {
      clearActiveMiniTestSession();
      autoResumeMiniTestRef.current = true;
      return;
    }

    autoResumeMiniTestRef.current = true;
    if (
      !isDedicatedMiniTestRoute
      || routeMiniTestSectionCode !== activeMiniTestSession.sectionCode
    ) {
      navigate(buildMiniTestPath(numericPackageId, activeMiniTestSession.sectionCode), { replace: true });
      return;
    }

    openSectionTestView(activeMiniTestSession.sectionCode);
    loadSectionTest(activeMiniTestSession.sectionCode);
  }, [
    isDedicatedMiniTestRoute,
    loading,
    loadSectionTest,
    navigate,
    numericPackageId,
    openSectionTestView,
    routeMiniTestSectionCode,
    sections,
  ]);

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
      shellClassName={`account-shell-learning${shouldShowFocusLayout ? ' account-shell-learning-focus' : ''}`}
      title={`Ruang Belajar ${packageData.name}`}
      subtitle="Baca materi per subtest, buka mini test dari menu tryout, lalu lanjut ke tryout keseluruhan saat paket aktif."
      hideNavbar={!isCompactViewport}
      hidePageHeader
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
      <section className={`learning-workspace${shouldShowFocusLayout ? ' learning-workspace-focus' : ''}`}>
        {!shouldShowFocusLayout && (
          <aside className="learning-sidebar learning-sidebar-desktop">
            <div className="learning-sidebar-card learning-sidebar-brand-card">
              <div className="learning-sidebar-brand-row">
                <BrandLogo />
                <button
                  type="button"
                  className="learning-sidebar-home-button"
                  onClick={() => navigate('/')}
                  aria-label="Kembali ke landing page"
                >
                  <LearningIcon name="arrow-left" />
                </button>
              </div>
              <div className="learning-sidebar-brand-copy">
                <strong>Ruang Belajar</strong>
                <small>{packageData.name}</small>
              </div>
            </div>

            <div className="learning-sidebar-card learning-sidebar-menu-card">
              <span className="learning-sidebar-label">Navigasi</span>
              <div className="learning-sidebar-primary-nav">
                {sidebarPrimaryItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={[
                      'learning-sidebar-link',
                      'learning-sidebar-link-rich',
                      item.active ? 'learning-sidebar-link-active' : '',
                      item.disabled ? 'learning-sidebar-link-disabled' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={item.onClick}
                    disabled={item.disabled}
                  >
                    <span className="learning-sidebar-link-icon" aria-hidden="true">
                      <LearningIcon name={item.icon} />
                    </span>
                    <span className="admin-sidebar-link-copy">
                      <strong>{item.label}</strong>
                      <small>{item.hint}</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="learning-sidebar-card learning-sidebar-support-card">
              <span className="learning-sidebar-support-badge">{supportCardBadge}</span>
              <strong>{supportCardTitle}</strong>
              <p>
                {supportCardDescription}
              </p>
              <div className="learning-sidebar-support-visual" aria-hidden="true">
                <img src={sidebarMascotSrc} alt="" />
              </div>
              <button
                type="button"
                className="learning-sidebar-support-button"
                onClick={() => navigate(viewerIsAuthenticated ? '/active-packages' : '/login')}
              >
                {supportCardActionLabel}
              </button>
            </div>
          </aside>
        )}

        <div className={`learning-main-panel${shouldShowFocusLayout ? ' learning-main-panel-focus' : ''}`}>
          {!isCompactViewport && (
            <header className="learning-desktop-topbar">
              <div className="learning-desktop-topbar-copy">
                {contentView === 'dashboard' ? (
                  <h1>
                    Belajar <span>{packageCategoryLabel}</span>
                  </h1>
                ) : (
                  <h1>
                    {activeSectionView === 'mini-test'
                      ? `Mini Test ${activeSection?.session_name || activeSection?.name || ''}`
                      : contentView === 'tryout'
                      ? 'Menu Tryout'
                      : activeSection?.name || 'Materi Subtest'}
                  </h1>
                )}
                <p>{desktopPageSubtitle}</p>
              </div>

              <div className="learning-desktop-topbar-actions">
                <label className="learning-desktop-search">
                  <span className="learning-desktop-search-icon" aria-hidden="true">
                    <LearningIcon name="search" />
                  </span>
                  <input
                    type="search"
                    value={learningSearch}
                    onChange={(event) => setLearningSearch(event.target.value)}
                    placeholder={desktopSearchPlaceholder}
                    disabled={!desktopSearchEnabled}
                    aria-label={desktopSearchEnabled ? 'Cari materi belajar' : 'Pencarian hanya aktif di dashboard'}
                  />
                </label>

                <button
                  type="button"
                  className="learning-desktop-notification"
                  onClick={openDashboardView}
                  aria-label="Notifikasi belajar"
                >
                  <LearningIcon name="bell" />
                  {notificationCount > 0 && <span>{notificationCount}</span>}
                </button>

                <div className="learning-desktop-profile-block">
                  <ProfileDropdown displayName={displayName} onLogout={logout} isAdmin={isAdmin} />
                  <small>{viewerRoleLabel}</small>
                </div>
              </div>
            </header>
          )}

          {shouldShowFocusLayout && (
            <div className="learning-mobile-focus-bar">
              <button
                type="button"
                className="learning-mobile-focus-back"
                onClick={openDashboardView}
              >
                <span aria-hidden="true">←</span>
                <span>Kembali ke Dashboard</span>
              </button>
              <div className="learning-mobile-focus-copy">
                <strong>{mobileFocusTitle}</strong>
                <small>{mobileFocusSubtitle}</small>
              </div>
            </div>
          )}

          {contentView === 'dashboard' && (
            <section className={`learning-dashboard-shell${isCompactViewport ? ' learning-dashboard-shell-app' : ''}`}>
              {isCompactViewport ? (
                <>
                  <div className="learning-mobile-app-head">
                    <div>
                      <h1>
                        Belajar <span>{packageCategoryLabel}</span>
                      </h1>
                      <p>Lanjutkan persiapanmu hari ini</p>
                    </div>
                    <button type="button" className="learning-mobile-notification" aria-label="Notifikasi">
                      <span aria-hidden="true">!</span>
                    </button>
                  </div>

                  <div className="learning-mobile-target-card">
                    <div
                      className="learning-mobile-progress-ring"
                      style={{ '--learning-mobile-progress': `${milestonePercent * 3.6}deg` }}
                      aria-label={`Progress belajar ${milestonePercent} persen`}
                    >
                      <strong>{milestonePercent}%</strong>
                    </div>
                    <div className="learning-mobile-target-copy">
                      <h2>Target {packageCategoryLabel}</h2>
                      <p>Konsisten belajar setiap hari dan tuntaskan milestone paketmu.</p>
                      <button type="button" onClick={openTryoutView}>
                        Lihat Detail <span aria-hidden="true">›</span>
                      </button>
                    </div>
                    <div className="learning-mobile-target-brand" aria-hidden="true">
                      <img src="/ujiin-logo-light.png" alt="" />
                    </div>
                  </div>

                  <div className="learning-mobile-resume-card">
                    <div className="learning-mobile-resume-copy">
                      <span>Lanjutkan Materi Terakhir</span>
                      <h2>{resumeSection?.name || 'Mulai dari materi pertama'}</h2>
                      <p>{resumeSection?.session_name || formatActiveTopicLabel(resumeSection)}</p>
                      <div className="learning-mobile-resume-track" aria-hidden="true">
                        <span style={{ width: `${resumeSection?.progress?.material_read ? 70 : 36}%` }} />
                      </div>
                      <small>
                        {resumeSection?.progress?.material_read
                          ? 'Mini test subtest siap dikerjakan'
                          : 'Materi masih perlu dilanjutkan'}
                      </small>
                    </div>
                    {resumeSection && (
                      <button type="button" onClick={() => jumpToSectionMaterial(resumeSection.code)}>
                        <span aria-hidden="true">▶</span>
                        Lanjutkan
                      </button>
                    )}
                    <div className="learning-mobile-resume-visual" aria-hidden="true">
                      √x
                    </div>
                  </div>

                  <div className="learning-mobile-section-tabs" aria-label="Daftar subtest">
                    {sections.map((section, index) => (
                      <button
                        type="button"
                        key={section.code}
                        className={section.code === activeSection?.code ? 'learning-mobile-section-tab learning-mobile-section-tab-active' : 'learning-mobile-section-tab'}
                        onClick={() => {
                          setActiveSectionCode(section.code);
                          setActiveTopicIndex(0);
                        }}
                      >
                        {section.session_name || section.name || `Subtest ${index + 1}`}
                      </button>
                    ))}
                  </div>

                  <div className="learning-mobile-list-head">
                    <h2>Daftar Materi</h2>
                    <button
                      type="button"
                      onClick={() => {
                        if (activeSection) {
                          jumpToSectionMaterial(activeSection.code, 0);
                        }
                      }}
                    >
                      Lihat Semua <span aria-hidden="true">›</span>
                    </button>
                  </div>

                  <div className="learning-mobile-material-list">
                    {activeSectionTopics.map((topic, topicIndex) => {
                      const pageCount = Number(topic.visible_page_count || topic.pages?.length || topic.total_page_count || 0);
                      const totalPageCount = Math.max(pageCount, Number(topic.total_page_count || 0));
                      const topicPercent = activeSection?.progress?.material_read ? 100 : 0;
                      const accentClass = ['blue', 'green', 'pink'][topicIndex % 3];

                      return (
                        <button
                          type="button"
                          key={`${activeSection?.code || 'section'}-topic-${topicIndex}`}
                          className={`learning-mobile-material-card learning-mobile-material-card-${accentClass}`}
                          onClick={() => activeSection && jumpToSectionMaterial(activeSection.code, topicIndex)}
                        >
                          <span className="learning-mobile-material-icon" aria-hidden="true" />
                          <span className="learning-mobile-material-copy">
                            <strong>{topic.title || `Topik ${topicIndex + 1}`}</strong>
                            <small>
                              {pageCount || 1} halaman materi
                              {totalPageCount > pageCount ? ` • ${totalPageCount - pageCount} terkunci` : ''}
                            </small>
                            <span className="learning-mobile-material-progress">
                              <span>
                                <span style={{ width: `${topicPercent}%` }} />
                              </span>
                              <small>{topicPercent}% selesai</small>
                            </span>
                          </span>
                          <span className="learning-mobile-material-action">
                            <span aria-hidden="true">▯</span>
                            Belajar
                          </span>
                        </button>
                      );
                    })}
                    {activeSectionTopics.length === 0 && (
                      <div className="learning-mobile-material-empty">
                        Materi untuk subtest ini belum tersedia.
                      </div>
                    )}
                  </div>

                  <nav className="learning-mobile-bottom-nav" aria-label="Navigasi belajar">
                    <Link to="/">
                      <span aria-hidden="true">⌂</span>
                      Home
                    </Link>
                    <button type="button" className="learning-mobile-bottom-nav-active" onClick={openDashboardView}>
                      <span aria-hidden="true">▰</span>
                      Belajar
                    </button>
                    <button type="button" onClick={openTryoutView}>
                      <span aria-hidden="true">☷</span>
                      Tryout
                    </button>
                    <Link to="/test-history">
                      <span aria-hidden="true">↺</span>
                      Riwayat
                    </Link>
                    <Link to="/profile">
                      <span aria-hidden="true">○</span>
                      Profil
                    </Link>
                  </nav>
                </>
              ) : (
                <section className="learning-studio-dashboard">
                  <div className="learning-studio-grid">
                    <div className="learning-studio-primary">
                      <div className="learning-studio-top-row">
                        <article className="learning-studio-card learning-studio-progress-card">
                          <div
                            className="learning-studio-progress-ring"
                            style={{ '--learning-dashboard-progress': `${milestonePercent * 3.6}deg` }}
                            aria-label={`Progress belajar ${milestonePercent} persen`}
                          >
                            <strong>{milestonePercent}%</strong>
                          </div>

                          <div className="learning-studio-progress-copy">
                            <div>
                              <h2>Progress Paket</h2>
                              <p>{packageData.name}</p>
                            </div>

                            <div className="learning-studio-progress-stats">
                              <div>
                                <span>Total subtest</span>
                                <strong>{sections.length}</strong>
                              </div>
                              <div>
                                <span>Total topik</span>
                                <strong>{totalTopicCount}</strong>
                              </div>
                              <div>
                                <span>Selesai dibaca</span>
                                <strong>{completedTopicCount}</strong>
                              </div>
                              <div>
                                <span>Belum tuntas</span>
                                <strong>{pendingSectionCount}</strong>
                              </div>
                            </div>

                            {activeSection && (
                              <button
                                type="button"
                                className="learning-studio-progress-link"
                                onClick={() => jumpToSectionMaterial(activeSection.code, 0)}
                              >
                                Lihat Detail <LearningIcon name="arrow-right" />
                              </button>
                            )}
                          </div>
                        </article>

                        <article className="learning-studio-card learning-studio-motivation-card">
                          <div className="learning-studio-motivation-copy">
                            <span className="learning-studio-kicker">Hai, {greetingName}</span>
                            <h2>Konsisten belajar adalah kunci sukses meraih impian.</h2>
                            <p>
                              Fokuskan sesi hari ini pada topik yang paling dekat dengan tryout dan lanjutkan progresmu sedikit demi sedikit.
                            </p>
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() => {
                                if (resumeSection?.code) {
                                  jumpToSectionMaterial(resumeSection.code);
                                }
                              }}
                            >
                              Lanjutkan Belajar
                            </button>
                          </div>

                          <div className="learning-studio-mascot" aria-hidden="true">
                            <div className="learning-studio-mascot-orb" />
                            <div className="learning-studio-mascot-badge">UJIIN</div>
                            <img src={dashboardMascotSrc} alt="" />
                          </div>
                        </article>
                      </div>

                      <article className="learning-studio-resume-banner">
                        <div className="learning-studio-resume-copy">
                          <span>Lanjutkan Materi Terakhir</span>
                          <h2>{resumeSection?.name || 'Mulai dari materi pertama'}</h2>
                          <p>{resumeSection?.session_name || formatActiveTopicLabel(resumeSection)}</p>
                          <div className="learning-studio-resume-track" aria-hidden="true">
                            <span
                              style={{
                                width: `${resumeSection?.progress?.subtest_test_completed ? 100 : resumeSection?.progress?.material_read ? 72 : 38}%`,
                              }}
                            />
                          </div>
                          <small>
                            {resumeSection?.progress?.subtest_test_completed
                              ? 'Subtest ini sudah tuntas, kamu bisa langsung review hasilnya.'
                              : resumeSection?.progress?.material_read
                              ? 'Materi selesai dibaca, mini test subtest siap dikerjakan.'
                              : 'Masih ada materi yang perlu kamu selesaikan terlebih dahulu.'}
                          </small>
                        </div>

                        <div className="learning-studio-resume-actions">
                          {resumeSection && (
                            <button type="button" className="learning-studio-resume-button" onClick={() => jumpToSectionMaterial(resumeSection.code)}>
                              <span aria-hidden="true">
                                <LearningIcon name="play" />
                              </span>
                              Lanjutkan Materi
                            </button>
                          )}
                        </div>
                      </article>

                      <div className="learning-studio-section-tabs" aria-label="Daftar subtest">
                        {sections.map((section, index) => (
                          <button
                            type="button"
                            key={section.code}
                            className={section.code === activeSection?.code ? 'learning-studio-section-tab learning-studio-section-tab-active' : 'learning-studio-section-tab'}
                            onClick={() => {
                              setActiveSectionCode(section.code);
                              setActiveTopicIndex(0);
                            }}
                          >
                            {section.session_name || section.name || `Subtest ${index + 1}`}
                          </button>
                        ))}
                      </div>

                      <div className="learning-studio-material-head">
                        <div>
                          <h3>{deferredLearningSearch ? 'Hasil Pencarian Topik' : 'Daftar Materi'}</h3>
                          <p>
                            {deferredLearningSearch
                              ? `${filteredDashboardTopics.length} topik cocok untuk kata kunci "${learningSearch.trim()}".`
                              : `${activeSectionTopics.length} topik siap dipelajari di ${activeSection?.name || 'subtest aktif'}.`}
                          </p>
                        </div>
                        {activeSection && (
                          <button type="button" className="learning-studio-link-button" onClick={() => jumpToSectionMaterial(activeSection.code, 0)}>
                            Lihat Semua <LearningIcon name="arrow-right" />
                          </button>
                        )}
                      </div>

                      <div className="learning-studio-material-grid">
                        {filteredDashboardTopics.map(({ topic, topicIndex }) => {
                          const pageCount = Number(topic.visible_page_count || topic.pages?.length || topic.total_page_count || 0);
                          const totalPageCount = Math.max(pageCount, Number(topic.total_page_count || 0));
                          const topicPercent = activeSection?.progress?.material_read ? 100 : 0;
                          const accentClass = DASHBOARD_TOPIC_ACCENTS[topicIndex % DASHBOARD_TOPIC_ACCENTS.length];

                          return (
                            <button
                              type="button"
                              key={`${activeSection?.code || 'section'}-desktop-topic-${topicIndex}`}
                              className={`learning-studio-topic-card learning-studio-topic-card-${accentClass}`}
                              onClick={() => activeSection && jumpToSectionMaterial(activeSection.code, topicIndex)}
                            >
                              <span className="learning-studio-topic-icon" aria-hidden="true" />
                              <span className="learning-studio-topic-copy">
                                <strong>{topic.title || `Topik ${topicIndex + 1}`}</strong>
                                <small>
                                  {pageCount || 1} halaman materi
                                  {totalPageCount > pageCount ? ` • ${totalPageCount - pageCount} terkunci` : ''}
                                </small>
                                <span className="learning-studio-topic-progress">
                                  <span>
                                    <span style={{ width: `${topicPercent}%` }} />
                                  </span>
                                  <small>{topicPercent}% selesai</small>
                                </span>
                              </span>
                              <span className="learning-studio-topic-action">Belajar</span>
                            </button>
                          );
                        })}

                        {filteredDashboardTopics.length === 0 && (
                          <div className="learning-studio-empty">
                            {deferredLearningSearch
                              ? 'Topik yang kamu cari belum ditemukan di subtest ini.'
                              : 'Materi untuk subtest ini belum tersedia.'}
                          </div>
                        )}
                      </div>
                    </div>

                    <aside className="learning-studio-secondary">
                      <article className="learning-studio-card learning-studio-target-card">
                        <div className="learning-studio-card-head">
                          <h3>Target Belajar Paket</h3>
                          <span>{learningActivityKeys.size > 0 ? `${learningActivityKeys.size} hari aktif` : 'Mulai hari ini'}</span>
                        </div>

                        <div className="learning-studio-target-body">
                          <div
                            className="learning-studio-target-ring"
                            style={{ '--learning-dashboard-progress': `${estimatedStudyProgressPercent * 3.6}deg` }}
                            aria-label={`Target belajar ${estimatedStudyProgressPercent} persen`}
                          >
                            <strong>{estimatedStudyProgressPercent}%</strong>
                          </div>

                          <div className="learning-studio-target-copy">
                            <strong>{completedEstimatedStudyMinutes} / {totalEstimatedStudyMinutes || 0} menit</strong>
                            <p>Estimasi ritme belajar dari materi dan mini test yang sudah kamu tuntaskan.</p>
                            <span>{completedMilestoneSteps} milestone sudah tercatat</span>
                          </div>
                        </div>
                      </article>

                      <article className="learning-studio-card learning-studio-calendar-card">
                        <div className="learning-studio-card-head">
                          <h3>Kalender Belajar</h3>
                          <span>{calendarMonthLabel}</span>
                        </div>

                        <div className="learning-studio-calendar-weekdays">
                          {CALENDAR_WEEKDAYS.map((label) => (
                            <span key={label}>{label}</span>
                          ))}
                        </div>

                        <div className="learning-studio-calendar-grid">
                          {calendarDays.map((day) => (
                            <div
                              key={day.key}
                              className={[
                                'learning-studio-calendar-day',
                                day.inCurrentMonth ? 'learning-studio-calendar-day-current' : '',
                                day.isToday ? 'learning-studio-calendar-day-today' : '',
                                day.hasActivity ? 'learning-studio-calendar-day-active' : '',
                              ].filter(Boolean).join(' ')}
                            >
                              <span>{day.label}</span>
                            </div>
                          ))}
                        </div>
                      </article>

                      <article className="learning-studio-card learning-studio-recommendation-card">
                        <div className="learning-studio-card-head">
                          <h3>Rekomendasi Untukmu</h3>
                          <span>{dashboardRecommendationItems.length} aksi</span>
                        </div>

                        <div className="learning-studio-recommendation-list">
                          {dashboardRecommendationItems.map((item) => (
                            <div key={item.key} className="learning-studio-recommendation-item">
                              <span className="learning-studio-recommendation-icon" aria-hidden="true">
                                <LearningIcon name={item.icon} />
                              </span>
                              <span className="learning-studio-recommendation-copy">
                                <strong>{item.title}</strong>
                                <small>{item.meta}</small>
                              </span>
                              <button type="button" onClick={item.onClick}>
                                {item.actionLabel}
                              </button>
                            </div>
                          ))}

                          {dashboardRecommendationItems.length === 0 && (
                            <div className="learning-studio-empty learning-studio-empty-compact">
                              Belum ada rekomendasi baru. Coba mulai dari dashboard atau materi pertama.
                            </div>
                          )}
                        </div>
                      </article>

                      <article className="learning-studio-card learning-studio-achievement-card">
                        <div className="learning-studio-card-head">
                          <h3>Pencapaian</h3>
                          <span>Milestone</span>
                        </div>

                        <div className="learning-studio-achievement-grid">
                          {dashboardAchievementItems.map((item) => (
                            <div key={item.key} className="learning-studio-achievement-item">
                              <span className="learning-studio-achievement-icon" aria-hidden="true">
                                <LearningIcon name={item.icon} />
                              </span>
                              <strong>{item.value}</strong>
                              <small>{item.label}</small>
                            </div>
                          ))}
                        </div>
                      </article>
                    </aside>
                  </div>
                </section>
              )}
            </section>
          )}

          {contentView === 'materi' && activeSection && (
            <article ref={materialViewRef} className="learning-material">
              <div className="learning-material-header">
                <div>
                  <span className="account-package-tag">
                    {activeSection.session_name || packageData.category_name}
                  </span>
                  <h2>{activeSection.name}</h2>
                  {!hasAccess && (
                    <p>
                      {`Preview ${activeSection.visible_page_count} dari ${activeSection.total_page_count} halaman materi.`}
                    </p>
                  )}
                </div>
                {activeSection.progress.material_read && (
                  <span className="account-status-pill account-status-fresh">
                    Materi selesai
                  </span>
                )}
              </div>

              {activeSectionView === 'material' && activeSectionTopics.length > 0 && !shouldShowFocusLayout && (
                <div className="learning-topic-list">
                  {activeSectionTopics.map((topic, topicIndex) => (
                    <button
                      key={`${activeSection.code}-topic-tab-${topicIndex}`}
                      type="button"
                      className={topicIndex === activeTopicIndex ? 'learning-topic-button learning-topic-button-active' : 'learning-topic-button'}
                      onClick={() => jumpToSectionMaterial(activeSection.code, topicIndex)}
                    >
                      <strong>{topic.title || `Topik ${topicIndex + 1}`}</strong>
                      <small>{topic.visible_page_count || topic.pages?.length || 0} halaman terbuka</small>
                    </button>
                  ))}
                </div>
              )}

              {activeSectionView === 'material' && activeTopic ? (
                <div className="learning-page-list">
                  {(activeTopic.pages || []).map((page, index) => {
                    const isPdfVisualPage = Boolean(page.content_html && isMaterialPdfVisualHtml(page.content_html));
                    const pageLabel = page.title || `Halaman ${index + 1}`;

                    return (
                      <section
                        key={`${activeTopic.title || 'topic'}-${index}`}
                        className={isPdfVisualPage ? 'learning-page learning-page-visual' : 'learning-page learning-page-content'}
                      >
                        <div className={isPdfVisualPage ? 'learning-page-head learning-page-head-visual' : 'learning-page-head'}>
                          <span className="learning-page-label">{pageLabel}</span>
                          <div className="learning-page-brand" aria-hidden="true">
                            <img className="learning-page-brand-logo" src="/ujiin-logo.png" alt="Ujiin" />
                          </div>
                        </div>
                        <div className={isPdfVisualPage ? 'learning-page-body learning-page-body-visual learning-rich-content' : 'learning-page-body learning-rich-content'}>
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
                    );
                  })}
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

              {activeSectionView === 'material' && activeSectionTopics.length > 0 && (
                <div className="learning-material-flow">
                  {hasPreviousTopic ? (
                    <button
                      type="button"
                      className="learning-material-flow-button learning-material-flow-button-secondary"
                      onClick={() => handleMaterialTopicNavigation(-1)}
                    >
                      <span className="learning-material-flow-icon" aria-hidden="true">←</span>
                      <span>Materi Sebelumnya</span>
                    </button>
                  ) : (
                    <span />
                  )}

                  {hasNextTopic ? (
                    <button
                      type="button"
                      className="learning-material-flow-button"
                      onClick={() => handleMaterialTopicNavigation(1)}
                    >
                      <span>Lanjut ke Materi Berikutnya</span>
                      <span className="learning-material-flow-icon" aria-hidden="true">→</span>
                    </button>
                  ) : isLastTopic && hasAccess ? (
                    <button
                      type="button"
                      className="learning-material-flow-button"
                      onClick={() => selectTryoutSubtest(activeSection.code)}
                    >
                      <span>Buka Mini Test {activeSection.name} di Menu Tryout</span>
                      <span className="learning-material-flow-icon" aria-hidden="true">→</span>
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              )}

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
            </article>
          )}

          {contentView === 'tryout' && (
            <section className="learning-tryout-panel">
              {activeSectionView === 'mini-test' && activeSection ? (
                <>
                  <div className="learning-tryout-actions learning-tryout-actions-inline">
                    <button type="button" className="btn btn-outline" onClick={openTryoutView}>
                      Kembali ke Menu Tryout
                    </button>
                  </div>
                  {miniTestWorkspace}
                </>
              ) : (
                <>
                  <div>
                    <span className="account-package-tag">Tryout keseluruhan</span>
                    <h2>{packageData.name}</h2>
                    <p>
                      Di menu ini kamu bisa pilih mini test per subtest dulu, lalu lanjut ke tryout penuh saat ritme belajarmu sudah siap.
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

                  <div className="learning-tryout-primary">
                    <div className="learning-tryout-subtests-head">
                      <span className="account-package-tag">Tryout utama</span>
                      <h3>Masuk ke simulasi penuh paket</h3>
                      <p>{tryoutPrimaryDescription}</p>
                    </div>

                    <div className="learning-topic-list learning-tryout-primary-list">
                      <div className="learning-topic-button learning-topic-button-active learning-tryout-primary-card">
                        <strong>{packageData.name}</strong>
                        <small>
                          {packageData.question_count} soal • {packageData.time_limit} menit
                        </small>
                        <span className="learning-section-button-progress">
                          <span className={`learning-section-chip ${hasAccess && summary.can_start_tryout ? 'learning-section-chip-done' : ''}`}>
                            {tryoutPrimaryStatusLabel}
                          </span>
                          <span className="learning-section-chip">{tryoutAttemptSummaryLabel}</span>
                          {completedTryout ? (
                            <span className="learning-section-chip learning-section-chip-done">
                              {Number(summary.completed_attempts || 0)} selesai
                            </span>
                          ) : null}
                        </span>

                        <div className="learning-tryout-primary-card-actions">
                          {hasAccess ? (
                            summary.can_start_tryout ? (
                              <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => setTryoutStartModalOpen(true)}
                              >
                                {tryoutPrimaryActionLabel}
                              </button>
                            ) : (
                              <button type="button" className="btn btn-outline" disabled>
                                {tryoutPrimaryActionLabel}
                              </button>
                            )
                          ) : (
                            <Link to={viewerIsAuthenticated ? `/payment/${numericPackageId}` : '/login'} className="btn btn-primary">
                              {tryoutPrimaryActionLabel}
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="learning-tryout-subtests">
                    <div className="learning-tryout-subtests-head">
                      <span className="account-package-tag">Mini test per subtest</span>
                      <h3>Pilih subtest untuk latihan singkat</h3>
                      <p>Pilih satu subtest dulu, lalu masuk ke preview mini test dari tombol di bawah sebelum mulai mengerjakan soal.</p>
                    </div>

                    <div className="learning-topic-list learning-tryout-subtest-list">
                      {sections.map((section) => {
                        const sectionMiniTestDuration = formatDurationMinutesLabel(
                          computeMiniTestDurationSeconds(section, Number(section.mini_test_question_count || 0))
                        );
                        const isSectionMiniTestDone = Boolean(section.progress?.subtest_test_completed);
                        const isSectionMiniTestActive = section.code === activeSection?.code;

                        return (
                          <button
                            key={`tryout-mini-test-${section.code}`}
                            type="button"
                            className={isSectionMiniTestActive ? 'learning-topic-button learning-topic-button-active' : 'learning-topic-button'}
                            onClick={() => selectTryoutSubtest(section.code)}
                            aria-pressed={isSectionMiniTestActive}
                          >
                            <strong>{section.name}</strong>
                            <small>
                              {Math.max(0, Number(section.mini_test_question_count || 0))} soal • {sectionMiniTestDuration}
                            </small>
                            <span className="learning-section-button-progress">
                              <span className={`learning-section-chip ${isSectionMiniTestDone ? 'learning-section-chip-done' : ''}`}>
                                {isSectionMiniTestDone ? 'Selesai' : 'Belum mulai'}
                              </span>
                              <span className="learning-section-chip">
                                {section.session_name || 'Subtest'}
                              </span>
                              {isSectionMiniTestActive ? (
                                <span className="learning-section-chip learning-section-chip-current">
                                  Dipilih
                                </span>
                              ) : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {activeSection?.name ? (
                      <p className="learning-tryout-selection-note">
                        Subtest terpilih: <strong>{activeSection.name}</strong>. Buka dulu preview mini testnya, lalu mulai dari sana.
                      </p>
                    ) : null}
                  </div>

                  <div className="learning-tryout-actions">
                    {hasAccess ? (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => openSectionTestView(activeSection?.code)}
                        disabled={!activeSection?.code}
                      >
                        {selectedMiniTestActionLabel}
                      </button>
                    ) : (
                      <Link to={viewerIsAuthenticated ? `/payment/${numericPackageId}` : '/login'} className="btn btn-primary">
                        {selectedMiniTestActionLabel}
                      </Link>
                    )}
                    <button type="button" className="btn btn-outline" onClick={openDashboardView}>
                      Kembali ke Dashboard
                    </button>
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      </section>
      <TryoutStartModal
        isOpen={tryoutStartModalOpen}
        onClose={() => setTryoutStartModalOpen(false)}
        onConfirm={handleTryoutPrimaryConfirm}
        actionLabel={tryoutPrimaryActionLabel}
        packageName={packageData?.name}
        questionCount={packageData?.question_count}
        durationMinutes={packageData?.time_limit}
        hasOngoingAttempt={hasOngoingTryoutAttempt}
      />
    </AccountShell>
  );
}
