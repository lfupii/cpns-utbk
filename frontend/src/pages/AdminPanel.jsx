import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AccountShell from '../components/AccountShell';
import LatexContent from '../components/LatexContent';
import apiClient from '../api';
import { sanitizeMaterialHtml } from '../utils/materialHtml';
import {
  downloadBulkQuestionExtractFile,
  downloadQuestionExtractFile,
  hasQuestionExtractContent,
} from '../utils/questionExtract';
import {
  formatQuestionReportAssessmentType,
  formatQuestionReportOriginLabel,
  formatQuestionReportStatusLabel,
  formatQuestionReportTargetLabel,
  truncateQuestionReportText,
} from '../utils/questionReports';

const CSV_HEADERS = [
  'section_code',
  'explanation_notes',
  'question_text',
  'question_image_url',
  'question_image_layout',
  'option_a',
  'option_a_image_url',
  'option_b',
  'option_b_image_url',
  'option_c',
  'option_c_image_url',
  'option_d',
  'option_d_image_url',
  'option_e',
  'option_e_image_url',
];

const CSV_TEMPLATE_ROW = {
  section_code: 'twk',
  explanation_notes: 'Pembahasan: Jakarta adalah ibu kota Indonesia sehingga opsi B menjadi jawaban yang benar.',
  question_text: 'Contoh soal: Ibu kota Indonesia adalah ...',
  question_image_url: 'https://contoh.com/gambar-soal.jpg',
  question_image_layout: 'top',
  option_a: 'Bandung',
  option_a_image_url: '',
  option_b: '*Jakarta',
  option_b_image_url: '',
  option_c: 'Surabaya',
  option_c_image_url: '',
  option_d: 'Medan',
  option_d_image_url: '',
  option_e: '',
  option_e_image_url: '',
};

const clampPointValue = (value, fallback = 1) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(5, Math.max(1, Math.round(numericValue)));
};

const createOption = (index, text = '', isCorrect = false, imageUrl = '', scoreWeight = index + 1) => ({
  letter: String.fromCharCode(65 + index),
  text,
  image_url: imageUrl,
  is_correct: isCorrect,
  score_weight: clampPointValue(scoreWeight, Math.min(5, index + 1)),
});

const TKP_PATTERN = /(^|[^a-z0-9])tkp([^a-z0-9]|$)|karakteristik pribadi/i;

function isTkpSection(section) {
  if (!section) {
    return false;
  }

  return TKP_PATTERN.test(`${section.code || ''} ${section.name || section.section_name || ''}`);
}

function getOptionScoreWeight(option, fallback = 1) {
  if (option?.score_weight != null) {
    return clampPointValue(option.score_weight, fallback);
  }

  const rawCorrectValue = option?.is_correct;
  if (typeof rawCorrectValue === 'boolean') {
    return rawCorrectValue ? 5 : fallback;
  }

  const numericCorrectValue = Number(rawCorrectValue);
  if (Number.isFinite(numericCorrectValue) && numericCorrectValue > 0) {
    return clampPointValue(numericCorrectValue, fallback);
  }

  return fallback;
}

function normalizeOptionsForScoringMode(options, usesPointScoring) {
  const normalizedOptions = (options || []).map((option, index) => ({
    ...option,
    letter: option.letter || String.fromCharCode(65 + index),
    score_weight: getOptionScoreWeight(option, Math.min(5, index + 1)),
    is_correct: Boolean(option.is_correct),
  }));

  if (usesPointScoring) {
    return normalizedOptions.map((option, index) => ({
      ...option,
      score_weight: getOptionScoreWeight(option, Math.min(5, index + 1)),
      is_correct: false,
    }));
  }

  const correctIndex = normalizedOptions.findIndex((option) => Boolean(option.is_correct));
  return normalizedOptions.map((option, index) => ({
    ...option,
    is_correct: correctIndex >= 0 ? index === correctIndex : index === 0,
  }));
}

const createEmptyQuestionForm = (sectionCode = '') => ({
  question_id: null,
  question_text: '',
  question_image_url: '',
  question_image_layout: 'top',
  explanation_notes: '',
  difficulty: 'medium',
  question_type: 'single_choice',
  section_code: sectionCode,
  options: [
    createOption(0),
    createOption(1),
    createOption(2),
    createOption(3),
  ],
});

const createDefaultOptionSet = () => ([
  createOption(0),
  createOption(1),
  createOption(2),
  createOption(3),
]);

const TEST_MODE_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'cpns_cat', label: 'CPNS CAT' },
  { value: 'utbk_sectioned', label: 'UTBK Bertahap' },
];

let learningQuestionClientSeed = 0;

function createLearningQuestionClientKey() {
  learningQuestionClientSeed += 1;
  return `learning-client-${learningQuestionClientSeed}`;
}

const createEmptyLearningQuestion = (order = 1) => ({
  id: null,
  client_key: createLearningQuestionClientKey(),
  status: 'draft',
  question_text: '',
  question_image_url: '',
  explanation_notes: '',
  material_topic: '',
  difficulty: 'medium',
  question_order: order,
  options: createDefaultOptionSet(),
});

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

function slugifySectionCode(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function createSectionClone(section, sections) {
  const existingCodes = new Set((sections || []).map((item) => String(item.code || '')));
  const existingNames = new Set((sections || []).map((item) => String(item.name || '')));
  const baseName = `${section?.name || 'Subtest'} Baru`;
  let name = baseName;
  let nameSuffix = 2;
  while (existingNames.has(name)) {
    name = `${baseName} ${nameSuffix}`;
    nameSuffix += 1;
  }

  const baseCode = slugifySectionCode(`${section?.code || section?.name || 'subtest'}_baru`) || 'subtest_baru';
  let code = baseCode;
  let codeSuffix = 2;
  while (existingCodes.has(code)) {
    code = `${baseCode}_${codeSuffix}`;
    codeSuffix += 1;
  }

  return {
    ...section,
    code,
    name,
    order: (sections?.length || 0) + 1,
  };
}

function getMaterialTopics(material) {
  if (Array.isArray(material?.topics) && material.topics.length > 0) {
    return material.topics;
  }

  if (Array.isArray(material?.pages) && material.pages.length > 0) {
    return material.pages.map((page, index) => ({
      title: page.title || `Topik ${index + 1}`,
      pages: [page],
    }));
  }

  return [];
}

function normalizeMaterialStatus(value) {
  return value === 'draft' ? 'draft' : 'published';
}

function getMaterialStatusLabel(status) {
  return normalizeMaterialStatus(status) === 'draft' ? 'Draft' : 'Published';
}

function buildComparablePackageSnapshot(pkg) {
  if (!pkg) {
    return null;
  }

  return JSON.stringify({
    category_id: Number(pkg.category_id || 0),
    name: String(pkg.name || ''),
    description: String(pkg.description || ''),
    price: Number(pkg.price || 0),
    duration_days: Number(pkg.duration_days || 0),
    max_attempts: Number(pkg.max_attempts || 0),
    time_limit: Number(pkg.time_limit || 0),
    test_mode: String(pkg.test_mode || 'standard'),
    is_temporarily_disabled: Number(pkg.is_temporarily_disabled || 0),
    workflow: pkg.workflow || null,
  });
}

function buildPackageUpdatePayload(pkg) {
  if (!pkg) {
    return null;
  }

  return {
    package_id: Number(pkg.id),
    category_id: Number(pkg.category_id || 0),
    name: pkg.name || '',
    description: pkg.description || '',
    price: Number(pkg.price || 0),
    duration_days: Number(pkg.duration_days || 30),
    max_attempts: Number(pkg.max_attempts || 1),
    time_limit: Number(pkg.time_limit || 90),
    test_mode: pkg.test_mode || 'standard',
    is_temporarily_disabled: Number(pkg.is_temporarily_disabled || 0),
  };
}

function buildPackageStatusMap(publishedPackages, draftPackages) {
  const publishedMap = new Map((publishedPackages || []).map((pkg) => [Number(pkg.id), pkg]));
  const draftMap = new Map((draftPackages || []).map((pkg) => [Number(pkg.id), pkg]));
  const ids = new Set([...publishedMap.keys(), ...draftMap.keys()]);

  return Array.from(ids).reduce((accumulator, id) => {
    const publishedPackage = publishedMap.get(id) || null;
    const draftPackage = draftMap.get(id) || null;
    const status = buildComparablePackageSnapshot(publishedPackage) === buildComparablePackageSnapshot(draftPackage)
      ? 'published'
      : 'draft';

    return {
      ...accumulator,
      [id]: status,
    };
  }, {});
}

function getTopicStatus(material, topicIndex) {
  const statuses = material?.topic_statuses;
  if (Array.isArray(statuses)) {
    return normalizeMaterialStatus(statuses[topicIndex]);
  }

  return normalizeMaterialStatus(material?.status);
}

function formatSubtestSidebarLabel(topicCount) {
  return `${topicCount} topik dan 1 mini test`;
}

function csvEscape(value) {
  const normalized = String(value ?? '');
  if (normalized.includes(',') || normalized.includes('"') || normalized.includes('\n')) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

function buildCsvTemplate() {
  const headerLine = CSV_HEADERS.join(',');
  const sampleLine = CSV_HEADERS.map((header) => csvEscape(CSV_TEMPLATE_ROW[header] || '')).join(',');
  return `${headerLine}\n${sampleLine}\n`;
}

function parseCsv(text) {
  const sanitized = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < sanitized.length; index += 1) {
    const char = sanitized[index];

    if (inQuotes) {
      if (char === '"') {
        if (sanitized[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      row.push(value);
      value = '';
      continue;
    }

    if (char === '\n') {
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
      continue;
    }

    if (char !== '\r') {
      value += char;
    }
  }

  if (value !== '' || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((cell) => cell.trim());
  return rows
    .slice(1)
    .filter((cells) => cells.some((cell) => String(cell || '').trim() !== ''))
    .map((cells) => headers.reduce((accumulator, header, index) => ({
      ...accumulator,
      [header]: cells[index] ?? '',
    }), {}));
}

function createImportPayload(rows, defaultSectionCode) {
  return rows.map((row, rowIndex) => {
    const options = ['a', 'b', 'c', 'd', 'e']
      .map((letter, index) => {
        const rawText = String(row[`option_${letter}`] || '').trim();
        const imageUrl = String(row[`option_${letter}_image_url`] || '').trim();

        if (!rawText && !imageUrl) {
          return null;
        }

        const isCorrect = rawText.startsWith('*');
        const text = isCorrect ? rawText.slice(1).trim() : rawText;

        return {
          letter: String.fromCharCode(65 + index),
          text,
          image_url: imageUrl,
          is_correct: isCorrect,
        };
      })
      .filter(Boolean);

    if (options.length < 2) {
      throw new Error(`Baris ${rowIndex + 2}: minimal harus ada 2 opsi jawaban.`);
    }

    const correctCount = options.filter((option) => option.is_correct).length;
    if (correctCount !== 1) {
      throw new Error(`Baris ${rowIndex + 2}: tandai tepat 1 jawaban benar dengan awalan "*".`);
    }

    const questionText = String(row.question_text || '').trim();
    const questionImageUrl = String(row.question_image_url || '').trim();
    if (!questionText && !questionImageUrl) {
      throw new Error(`Baris ${rowIndex + 2}: question_text atau question_image_url wajib diisi.`);
    }

    return {
      question_text: questionText,
      question_image_url: questionImageUrl,
      question_image_layout: String(row.question_image_layout || 'top').trim() || 'top',
      explanation_notes: String(row.explanation_notes || '').trim(),
      difficulty: String(row.difficulty || 'medium').trim() || 'medium',
      question_type: 'single_choice',
      section_code: String(row.section_code || defaultSectionCode || '').trim(),
      options,
    };
  });
}

function getLearningQuestionRowKey(question, index) {
  if (Number(question?.id || 0) > 0) {
    return `learning-${question.id}`;
  }

  if (String(question?.client_key || '').trim() !== '') {
    return `learning-draft-${question.client_key}`;
  }

  return `learning-draft-${index}`;
}

function reindexLearningQuestionCollection(questionList) {
  return (Array.isArray(questionList) ? questionList : []).map((question, index) => ({
    ...question,
    question_order: index + 1,
  }));
}

function reorderLearningQuestionCollection(questionList, draggedRowKey, targetRowKey, placement = 'before') {
  const normalizedQuestions = Array.isArray(questionList) ? [...questionList] : [];
  if (!draggedRowKey || !targetRowKey || draggedRowKey === targetRowKey) {
    return reindexLearningQuestionCollection(normalizedQuestions);
  }

  const sourceIndex = normalizedQuestions.findIndex((question, index) => getLearningQuestionRowKey(question, index) === draggedRowKey);
  if (sourceIndex === -1) {
    return reindexLearningQuestionCollection(normalizedQuestions);
  }

  const [movedQuestion] = normalizedQuestions.splice(sourceIndex, 1);
  const targetIndex = normalizedQuestions.findIndex((question, index) => getLearningQuestionRowKey(question, index) === targetRowKey);
  if (targetIndex === -1) {
    return reindexLearningQuestionCollection(questionList);
  }

  const insertIndex = placement === 'after' ? targetIndex + 1 : targetIndex;
  normalizedQuestions.splice(insertIndex, 0, movedQuestion);

  return reindexLearningQuestionCollection(normalizedQuestions);
}

function reindexTryoutQuestionCollection(questionList) {
  const nextOrderBySection = new Map();

  return (Array.isArray(questionList) ? questionList : []).map((question) => {
    const sectionKey = String(question?.section_code || 'general');
    const nextOrder = (nextOrderBySection.get(sectionKey) || 0) + 1;
    nextOrderBySection.set(sectionKey, nextOrder);

    return {
      ...question,
      question_order: nextOrder,
    };
  });
}

function reorderTryoutQuestionCollection(questionList, draggedQuestionId, targetQuestionId, placement = 'before') {
  const normalizedQuestions = Array.isArray(questionList) ? [...questionList] : [];
  const sourceId = Number(draggedQuestionId || 0);
  const destinationId = Number(targetQuestionId || 0);
  if (sourceId <= 0 || destinationId <= 0 || sourceId === destinationId) {
    return reindexTryoutQuestionCollection(normalizedQuestions);
  }

  const sourceIndex = normalizedQuestions.findIndex((question) => Number(question.id) === sourceId);
  if (sourceIndex === -1) {
    return reindexTryoutQuestionCollection(normalizedQuestions);
  }

  const [movedQuestion] = normalizedQuestions.splice(sourceIndex, 1);
  const targetIndex = normalizedQuestions.findIndex((question) => Number(question.id) === destinationId);
  if (targetIndex === -1) {
    return reindexTryoutQuestionCollection(questionList);
  }

  const insertIndex = placement === 'after' ? targetIndex + 1 : targetIndex;
  normalizedQuestions.splice(insertIndex, 0, movedQuestion);

  return reindexTryoutQuestionCollection(normalizedQuestions);
}

function AdminImagePreview({ src, alt, className = '' }) {
  if (!src) {
    return null;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`admin-media-preview ${className}`.trim()}
      loading="lazy"
    />
  );
}

function formatAdminReportTimestamp(value) {
  if (!value) {
    return '-';
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return String(value);
  }

  return parsedDate.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const [packages, setPackages] = useState([]);
  const [packageTypes, setPackageTypes] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [packageSaving, setPackageSaving] = useState(false);
  const [packageAvailabilitySaving, setPackageAvailabilitySaving] = useState(false);
  const [packageCreating, setPackageCreating] = useState(false);
  const [packageDeleting, setPackageDeleting] = useState(false);
  const [packageTypeSaving, setPackageTypeSaving] = useState(false);
  const [packageTypeDeleting, setPackageTypeDeleting] = useState(false);
  const [questionSaving, setQuestionSaving] = useState(false);
  const [importingQuestions, setImportingQuestions] = useState(false);
  const [workflowSaving, setWorkflowSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [packageForm, setPackageForm] = useState(null);
  const [questionForm, setQuestionForm] = useState(createEmptyQuestionForm());
  const [showQuestionEditor, setShowQuestionEditor] = useState(false);
  const [expandedQuestionId, setExpandedQuestionId] = useState(null);
  const [questionQuery, setQuestionQuery] = useState('');
  const [questionSectionFilter, setQuestionSectionFilter] = useState('');
  const [importRows, setImportRows] = useState([]);
  const [importFileName, setImportFileName] = useState('');
  const [learningContent, setLearningContent] = useState([]);
  const [loadingLearningContent, setLoadingLearningContent] = useState(false);
  const [learningSectionCode, setLearningSectionCode] = useState('');
  const [learningEditorMode, setLearningEditorMode] = useState('');
  const [learningQuestionsForm, setLearningQuestionsForm] = useState([
    createEmptyLearningQuestion(1),
    createEmptyLearningQuestion(2),
    createEmptyLearningQuestion(3),
    createEmptyLearningQuestion(4),
    createEmptyLearningQuestion(5),
  ]);
  const [learningQuestionsSaving, setLearningQuestionsSaving] = useState(false);
  const [activeLearningQuestionIndex, setActiveLearningQuestionIndex] = useState(0);
  const [expandedLearningQuestionKey, setExpandedLearningQuestionKey] = useState('');
  const [questionOrderSaving, setQuestionOrderSaving] = useState(false);
  const [reports, setReports] = useState([]);
  const [reportSummary, setReportSummary] = useState({ all: 0, open: 0, reviewed: 0, resolved: 0 });
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportStatusFilter, setReportStatusFilter] = useState('open');
  const [reportStatusSavingId, setReportStatusSavingId] = useState(0);
  const [adminView, setAdminView] = useState('dashboard');
  const [savingWorkspaceDraft, setSavingWorkspaceDraft] = useState(false);
  const [publishingWorkspaceDraft, setPublishingWorkspaceDraft] = useState(false);
  const [selectedPackageTypeFilterId, setSelectedPackageTypeFilterId] = useState(0);
  const [packageStatusMap, setPackageStatusMap] = useState({});
  const [materialsExpanded, setMaterialsExpanded] = useState(true);
  const [editingSectionActionsCode, setEditingSectionActionsCode] = useState('');
  const [expandedMaterialSections, setExpandedMaterialSections] = useState({});
  const [activeMaterialTopicIndex, setActiveMaterialTopicIndex] = useState(null);
  const routeSearchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const requestedAdminView = routeSearchParams.get('view') || '';
  const requestedPackageTypeId = Number(routeSearchParams.get('type') || 0);
  const requestedPackageId = Number(routeSearchParams.get('package') || 0);
  const requestedPreviewId = Number(routeSearchParams.get('preview') || 0);
  const requestedLearningSectionCode = routeSearchParams.get('section') || '';
  const requestedLearningMode = routeSearchParams.get('mode') || '';
  const requestedMiniPreviewId = Number(routeSearchParams.get('mini_preview') || 0);
  const adminWorkspace = routeSearchParams.get('workspace') === 'draft' ? 'draft' : 'published';
  const isDraftWorkspace = adminWorkspace === 'draft';

  const selectedPackage = useMemo(
    () => packages.find((pkg) => Number(pkg.id) === Number(selectedPackageId)) || null,
    [packages, selectedPackageId]
  );
  const packageSections = useMemo(
    () => selectedPackage?.workflow?.sections || [],
    [selectedPackage]
  );
  const isPackageTemporarilyDisabled = useMemo(
    () => Boolean(Number(packageForm?.is_temporarily_disabled ?? selectedPackage?.is_temporarily_disabled ?? 0)),
    [packageForm?.is_temporarily_disabled, selectedPackage?.is_temporarily_disabled]
  );
  const selectedPackageTypeName = useMemo(
    () => packageTypes.find((type) => Number(type.id) === Number(packageForm?.category_id || selectedPackage?.category_id || 0))?.name || '-',
    [packageForm?.category_id, packageTypes, selectedPackage?.category_id]
  );
  const selectedPackageTypeRecord = useMemo(
    () => packageTypes.find((type) => Number(type.id) === Number(selectedPackageTypeFilterId || selectedPackage?.category_id || packageForm?.category_id || 0)) || null,
    [packageForm?.category_id, packageTypes, selectedPackage?.category_id, selectedPackageTypeFilterId]
  );
  const selectedPackageModeLabel = useMemo(
    () => TEST_MODE_OPTIONS.find((option) => option.value === (packageForm?.test_mode || selectedPackage?.test_mode || 'standard'))?.label
      || packageForm?.test_mode
      || selectedPackage?.test_mode
      || 'Standard',
    [packageForm?.test_mode, selectedPackage?.test_mode]
  );
  const packageTypeCounts = useMemo(() => packages.reduce((accumulator, pkg) => ({
    ...accumulator,
    [Number(pkg.category_id || 0)]: (accumulator[Number(pkg.category_id || 0)] || 0) + 1,
  }), {}), [packages]);
  const packagesByType = useMemo(() => packages.reduce((accumulator, pkg) => {
    const categoryId = Number(pkg.category_id || 0);
    return {
      ...accumulator,
      [categoryId]: [...(accumulator[categoryId] || []), pkg],
    };
  }, {}), [packages]);
  const filteredPackages = useMemo(() => {
    if (selectedPackageTypeFilterId <= 0) {
      return packages;
    }

    return packages.filter((pkg) => Number(pkg.category_id || 0) === Number(selectedPackageTypeFilterId));
  }, [packages, selectedPackageTypeFilterId]);
  const selectedPackageWorkspaceStatus = useMemo(
    () => normalizeMaterialStatus(packageStatusMap[Number(selectedPackageId)] || 'published'),
    [packageStatusMap, selectedPackageId]
  );
  const selectedPackageWorkspaceNote = useMemo(() => {
    if (selectedPackageWorkspaceStatus === 'draft') {
      return isDraftWorkspace
        ? 'Draft paket ini punya perubahan terbaru yang belum dipublish ke user.'
        : 'Versi live ini masih tertinggal dari draft terbaru.';
    }

    return isDraftWorkspace
      ? 'Draft paket ini sudah sinkron dengan versi published.'
      : 'Versi live ini sudah sinkron dengan draft terbaru.';
  }, [isDraftWorkspace, selectedPackageWorkspaceStatus]);
  const defaultSectionCode = packageSections[0]?.code || '';
  const preferredSectionCode = useMemo(() => {
    const validCodes = new Set(packageSections.map((section) => String(section.code)));
    if (questionSectionFilter && validCodes.has(questionSectionFilter)) {
      return questionSectionFilter;
    }

    return defaultSectionCode;
  }, [defaultSectionCode, packageSections, questionSectionFilter]);
  const activeLearningSection = useMemo(
    () => learningContent.find((section) => section.code === learningSectionCode) || learningContent[0] || null,
    [learningContent, learningSectionCode]
  );
  const activeLearningWorkflowSection = useMemo(
    () => packageSections.find((section) => String(section.code) === String(activeLearningSection?.code || '')) || null,
    [activeLearningSection?.code, packageSections]
  );
  const activeQuestionSection = useMemo(
    () => packageSections.find((section) => String(section.code) === String(questionForm.section_code || '')) || null,
    [packageSections, questionForm.section_code]
  );
  const usesQuestionPointScoring = isTkpSection(activeQuestionSection);
  const usesLearningPointScoring = isTkpSection(activeLearningWorkflowSection || activeLearningSection);
  const activeMaterialTopics = useMemo(
    () => (activeLearningSection ? getMaterialTopics(activeLearningSection.material) : []),
    [activeLearningSection]
  );
  const activeMaterialTopic = useMemo(
    () => (
      activeMaterialTopicIndex === null
        ? null
        : activeMaterialTopics[activeMaterialTopicIndex] || null
    ),
    [activeMaterialTopicIndex, activeMaterialTopics]
  );
  const selectedPackageSummary = useMemo(() => ({
    sectionCount: packageSections.length,
    materialPageCount: learningContent.reduce((total, section) => total + getMaterialTopics(section.material).length, 0),
    questionCount: questions.length,
  }), [learningContent, packageSections.length, questions.length]);
  const completedMaterialSections = useMemo(
    () => learningContent.filter((section) => getMaterialTopics(section.material).length > 0).length,
    [learningContent]
  );
  const completedQuizSections = useMemo(
    () => learningContent.filter((section) => (section.questions?.length || 0) > 0).length,
    [learningContent]
  );
  const adminCoveragePercent = useMemo(() => {
    if (packageSections.length === 0) {
      return 0;
    }

    return Math.round(((completedMaterialSections + completedQuizSections) / (packageSections.length * 2)) * 100);
  }, [completedMaterialSections, completedQuizSections, packageSections.length]);
  const fetchAdminQuestions = useCallback(async (packageId) => {
    const response = await apiClient.get(`/admin/questions?package_id=${packageId}&workspace=${adminWorkspace}&_=${Date.now()}`);
    return reindexTryoutQuestionCollection(response.data.data || []);
  }, [adminWorkspace]);

  const fetchLearningContent = useCallback(async (packageId) => {
    const response = await apiClient.get(`/admin/learning-content?package_id=${packageId}&workspace=${adminWorkspace}&_=${Date.now()}`);
    return response.data.data?.sections || [];
  }, [adminWorkspace]);

  const loadAdminReports = useCallback(async (packageId = selectedPackageId, status = reportStatusFilter) => {
    setLoadingReports(true);

    try {
      const query = new URLSearchParams({
        status: status || 'open',
        limit: '120',
      });
      if (Number(packageId) > 0) {
        query.set('package_id', String(Number(packageId)));
      }

      const response = await apiClient.get(`/reports/admin-list?${query.toString()}`);
      const payload = response.data?.data || {};
      setReports(Array.isArray(payload.items) ? payload.items : []);
      setReportSummary(payload.summary || { all: 0, open: 0, reviewed: 0, resolved: 0 });
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat laporan soal.');
    } finally {
      setLoadingReports(false);
    }
  }, [reportStatusFilter, selectedPackageId]);

  const fetchPackageTypes = useCallback(async () => {
    const response = await apiClient.get('/admin/package-types');
    return response.data.data || [];
  }, []);

  const loadPackageWorkspaceData = useCallback(async () => {
    const [publishedResponse, draftResponse, typesResponse] = await Promise.all([
      apiClient.get('/admin/packages?workspace=published'),
      apiClient.get('/admin/packages?workspace=draft'),
      fetchPackageTypes(),
    ]);

    const publishedPackages = publishedResponse.data.data || [];
    const draftPackages = draftResponse.data.data || [];
    const nextPackages = adminWorkspace === 'draft' ? draftPackages : publishedPackages;

    setPackages(nextPackages);
    setPackageTypes(typesResponse || []);
    setPackageStatusMap(buildPackageStatusMap(publishedPackages, draftPackages));

    return {
      packages: nextPackages,
      packageTypes: typesResponse || [],
      publishedPackages,
      draftPackages,
    };
  }, [adminWorkspace, fetchPackageTypes]);

  const sectionStats = useMemo(() => {
    const counts = questions.reduce((accumulator, question) => {
      const code = String(question.section_code || 'general');
      const status = normalizeMaterialStatus(question.status);
      return {
        ...accumulator,
        [code]: {
          count: (accumulator[code]?.count || 0) + 1,
          draftCount: (accumulator[code]?.draftCount || 0) + (status === 'draft' ? 1 : 0),
        },
      };
    }, {});

    const mappedSections = packageSections.map((section) => ({
      code: String(section.code),
      name: section.name,
      sessionName: section.session_name || '',
      count: counts[String(section.code)]?.count || 0,
      draftCount: counts[String(section.code)]?.draftCount || 0,
      status: (counts[String(section.code)]?.draftCount || 0) > 0 ? 'draft' : 'published',
    }));

    const knownCodes = new Set(mappedSections.map((section) => section.code));
    const uncategorizedSections = Object.entries(counts)
      .filter(([code]) => !knownCodes.has(code))
      .map(([code, stats]) => ({
        code,
        name: questions.find((question) => String(question.section_code || 'general') === code)?.section_name || 'Bagian umum',
        sessionName: '',
        count: stats?.count || 0,
        draftCount: stats?.draftCount || 0,
        status: (stats?.draftCount || 0) > 0 ? 'draft' : 'published',
      }));

    return [...mappedSections, ...uncategorizedSections];
  }, [packageSections, questions]);
  const draftTryoutQuestionCount = useMemo(
    () => questions.filter((question) => normalizeMaterialStatus(question.status) === 'draft').length,
    [questions]
  );
  const tryoutStatus = draftTryoutQuestionCount > 0 ? 'draft' : 'published';

  const filteredQuestions = useMemo(() => {
    const needle = questionQuery.trim().toLowerCase();
    return questions.filter((question) => {
      if (questionSectionFilter && String(question.section_code || 'general') !== questionSectionFilter) {
        return false;
      }

      if (!needle) {
        return true;
      }

      const haystack = [
        question.question_text,
        question.section_name,
      ].join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }, [questionQuery, questionSectionFilter, questions]);
  const miniTestDurationSeconds = useMemo(
    () => computeMiniTestDurationSeconds(activeLearningWorkflowSection, learningQuestionsForm.length),
    [activeLearningWorkflowSection, learningQuestionsForm.length]
  );
  const miniTestDurationMinutesLabel = useMemo(() => {
    const totalMinutes = Math.max(1, Math.ceil(miniTestDurationSeconds / 60));
    return `${totalMinutes} menit`;
  }, [miniTestDurationSeconds]);
  const learningQuestionOrderLocked = !isDraftWorkspace || learningQuestionsSaving;
  const tryoutQuestionOrderLocked = !isDraftWorkspace || questionOrderSaving;

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const { packages: nextPackages } = await loadPackageWorkspaceData();
        if (nextPackages.length > 0) {
          const requestedPackage = nextPackages.find((pkg) => Number(pkg.id) === requestedPackageId);
          setSelectedPackageId(Number((requestedPackage || nextPackages[0]).id));
          setSelectedPackageTypeFilterId(Number((requestedPackage || nextPackages[0]).category_id || 0));
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Gagal memuat data admin');
      } finally {
        setLoadingPackages(false);
      }
    };

    fetchPackages();
  }, [adminWorkspace, loadPackageWorkspaceData, requestedPackageId]);

  useEffect(() => {
    if (!selectedPackage) {
      setPackageForm(null);
      return;
    }

    setPackageForm({
      package_id: Number(selectedPackage.id),
      category_id: Number(selectedPackage.category_id || 0),
      name: selectedPackage.name || '',
      description: selectedPackage.description || '',
      price: Number(selectedPackage.price || 0),
      duration_days: Number(selectedPackage.duration_days || 30),
      max_attempts: Number(selectedPackage.max_attempts || 1),
      time_limit: Number(selectedPackage.time_limit || 90),
      test_mode: selectedPackage.test_mode || 'standard',
      is_temporarily_disabled: Number(selectedPackage.is_temporarily_disabled || 0),
    });
  }, [selectedPackage]);

  useEffect(() => {
    if (!packages.length) {
      setSelectedPackageTypeFilterId(0);
      return;
    }

    setSelectedPackageTypeFilterId((current) => {
      const normalizedCurrent = Number(current || 0);
      if (normalizedCurrent > 0 && packages.some((pkg) => Number(pkg.category_id || 0) === normalizedCurrent)) {
        return normalizedCurrent;
      }

      const selectedCategoryId = Number(selectedPackage?.category_id || 0);
      if (selectedCategoryId > 0 && packages.some((pkg) => Number(pkg.category_id || 0) === selectedCategoryId)) {
        return selectedCategoryId;
      }

      return Number(packages[0]?.category_id || 0);
    });
  }, [packages, selectedPackage]);

  useEffect(() => {
    if (!filteredPackages.length) {
      if (packages.length === 0) {
        setSelectedPackageId(null);
      }
      return;
    }

    if (!filteredPackages.some((pkg) => Number(pkg.id) === Number(selectedPackageId))) {
      setSelectedPackageId(Number(filteredPackages[0].id));
    }
  }, [filteredPackages, packages.length, selectedPackageId]);

  const refreshAdminData = async (packageId = selectedPackageId) => {
    if (!packageId) {
      return;
    }

    const [questionsResponse, packageWorkspaceData, learningResponse] = await Promise.all([
      fetchAdminQuestions(packageId),
      loadPackageWorkspaceData(),
      fetchLearningContent(packageId),
    ]);

    const nextQuestions = questionsResponse || [];
    const nextPackages = packageWorkspaceData?.packages || [];
    const nextLearningContent = learningResponse || [];

    setQuestions(nextQuestions);
    setLearningContent(nextLearningContent);
    setLearningSectionCode((current) => (
      nextLearningContent.some((section) => section.code === current)
        ? current
        : nextLearningContent[0]?.code || ''
    ));

    return {
      questions: nextQuestions,
      packages: nextPackages,
      learningContent: nextLearningContent,
      packageTypes: packageWorkspaceData?.packageTypes || [],
    };
  };

  const persistLearningQuestions = async (
    nextQuestions,
    successMessage = isDraftWorkspace ? 'Soal mini test draft berhasil disimpan.' : 'Soal mini test subtest berhasil disimpan.'
  ) => {
    if (!selectedPackageId || !activeLearningSection) {
      return false;
    }

    setLearningQuestionsSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiClient.put('/admin/learning-section-questions', {
        package_id: Number(selectedPackageId),
        section_code: activeLearningSection.code,
        workspace: adminWorkspace,
        questions: reindexLearningQuestionCollection(nextQuestions).map((question, index) => ({
          ...question,
          question_order: index + 1,
          options: (question.options || []).map((option, optionIndex) => ({
            ...option,
            is_correct: usesLearningPointScoring
              ? getOptionScoreWeight(option, Math.min(5, optionIndex + 1))
              : option.is_correct,
            score_weight: usesLearningPointScoring
              ? getOptionScoreWeight(option, Math.min(5, optionIndex + 1))
              : (option.is_correct ? 5 : 0),
          })),
        })),
      });
      await refreshAdminData(Number(selectedPackageId));
      setSuccess(successMessage);
      return true;
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan soal mini test subtest');
      await refreshAdminData(Number(selectedPackageId));
      return false;
    } finally {
      setLearningQuestionsSaving(false);
    }
  };

  const persistTryoutQuestionOrder = async (nextQuestions, movedQuestionId) => {
    if (!selectedPackageId || Number(movedQuestionId || 0) <= 0) {
      return false;
    }

    const movedQuestion = nextQuestions.find((question) => Number(question.id) === Number(movedQuestionId));
    if (!movedQuestion) {
      return false;
    }

    const movedSection = packageSections.find((section) => String(section.code) === String(movedQuestion.section_code));
    const usesPointScoring = isTkpSection(movedSection || movedQuestion);

    setQuestionOrderSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiClient.put('/admin/questions', {
        question_id: Number(movedQuestion.id),
        package_id: Number(selectedPackageId),
        workspace: adminWorkspace,
        question_text: movedQuestion.question_text || '',
        question_image_url: movedQuestion.question_image_url || '',
        question_image_layout: movedQuestion.question_image_layout || 'top',
        explanation_notes: movedQuestion.explanation_notes || '',
        difficulty: movedQuestion.difficulty || 'medium',
        question_type: movedQuestion.question_type || 'single_choice',
        section_code: movedQuestion.section_code || '',
        question_order: Number(movedQuestion.question_order || 1),
        options: (movedQuestion.options || []).map((option, optionIndex) => ({
          letter: option.letter || String.fromCharCode(65 + optionIndex),
          text: option.text || '',
          image_url: option.image_url || '',
          is_correct: usesPointScoring
            ? getOptionScoreWeight(option, Math.min(5, optionIndex + 1))
            : Boolean(option.is_correct),
          score_weight: usesPointScoring
            ? getOptionScoreWeight(option, Math.min(5, optionIndex + 1))
            : (option.is_correct ? 5 : 0),
        })),
      });

      const refreshedQuestions = await fetchAdminQuestions(Number(selectedPackageId));
      setQuestions(refreshedQuestions);
      setSuccess(isDraftWorkspace ? 'Urutan soal draft berhasil diperbarui.' : 'Urutan soal berhasil diperbarui.');
      return true;
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memperbarui urutan soal');
      const refreshedQuestions = await fetchAdminQuestions(Number(selectedPackageId));
      setQuestions(refreshedQuestions);
      return false;
    } finally {
      setQuestionOrderSaving(false);
    }
  };

  const handleMoveLearningQuestion = async (questionIndex, direction) => {
    if (learningQuestionOrderLocked) {
      return;
    }

    const targetIndex = questionIndex + direction;
    if (targetIndex < 0 || targetIndex >= learningQuestionsForm.length) {
      return;
    }

    const sourceQuestion = learningQuestionsForm[questionIndex];
    const targetQuestion = learningQuestionsForm[targetIndex];
    if (!sourceQuestion || !targetQuestion) {
      return;
    }

    const nextQuestions = reorderLearningQuestionCollection(
      learningQuestionsForm,
      getLearningQuestionRowKey(sourceQuestion, questionIndex),
      getLearningQuestionRowKey(targetQuestion, targetIndex),
      direction > 0 ? 'after' : 'before'
    );

    setLearningQuestionsForm(nextQuestions);
    await persistLearningQuestions(nextQuestions, 'Urutan soal mini test draft berhasil diperbarui.');
  };

  const handleMoveTryoutQuestion = async (questionId, direction) => {
    if (tryoutQuestionOrderLocked) {
      return;
    }

    const currentQuestion = questions.find((question) => Number(question.id) === Number(questionId));
    if (!currentQuestion) {
      return;
    }

    const siblingQuestions = questions.filter(
      (question) => String(question.section_code || '') === String(currentQuestion.section_code || '')
    );
    const currentSectionIndex = siblingQuestions.findIndex((question) => Number(question.id) === Number(questionId));
    const targetSectionIndex = currentSectionIndex + direction;
    if (currentSectionIndex < 0 || targetSectionIndex < 0 || targetSectionIndex >= siblingQuestions.length) {
      return;
    }

    const targetQuestion = siblingQuestions[targetSectionIndex];
    if (!targetQuestion) {
      return;
    }

    const nextQuestions = reorderTryoutQuestionCollection(
      questions,
      Number(questionId),
      Number(targetQuestion.id),
      direction > 0 ? 'after' : 'before'
    );

    setQuestions(nextQuestions);
    await persistTryoutQuestionOrder(nextQuestions, Number(questionId));
  };

  useEffect(() => {
    if (adminView !== 'laporan') {
      return;
    }

    loadAdminReports(selectedPackageId, reportStatusFilter);
  }, [adminView, loadAdminReports, reportStatusFilter, selectedPackageId]);

  const handleWorkspaceChange = (nextWorkspace) => {
    if (nextWorkspace === adminWorkspace) {
      return;
    }

    const query = new URLSearchParams(location.search);
    query.set('workspace', nextWorkspace);
    query.set('view', adminView);
    if (selectedPackageId) {
      query.set('package', String(selectedPackageId));
    }

    navigate(`/admin/workspace?${query.toString()}`);
  };

  const handleSaveWorkspaceDraft = async () => {
    if (!selectedPackageId) {
      return;
    }

    setSavingWorkspaceDraft(true);
    setError('');
    setSuccess('');

    try {
      if (isDraftWorkspace && packageForm) {
        await persistPackageForm('draft');
      }
      const response = await apiClient.post('/admin/package-drafts/save', {
        package_id: Number(selectedPackageId),
      });
      await refreshAdminData(Number(selectedPackageId));
      setSuccess(response.data?.message || 'Draft paket berhasil disimpan.');
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan draft paket');
    } finally {
      setSavingWorkspaceDraft(false);
    }
  };

  const handlePublishWorkspaceDraft = async () => {
    if (!selectedPackageId) {
      return;
    }

    const confirmed = window.confirm(`Publish seluruh draft paket "${selectedPackage?.name || ''}" ke tampilan user?`);
    if (!confirmed) {
      return;
    }

    setPublishingWorkspaceDraft(true);
    setError('');
    setSuccess('');

    try {
      if (isDraftWorkspace && packageForm) {
        await persistPackageForm('draft');
      }
      const response = await apiClient.post('/admin/package-drafts/publish', {
        package_id: Number(selectedPackageId),
      });
      await refreshAdminData(Number(selectedPackageId));
      setSuccess(response.data?.message || 'Draft paket berhasil dipublish.');
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mempublish draft paket');
    } finally {
      setPublishingWorkspaceDraft(false);
    }
  };

  useEffect(() => {
    if (!selectedPackageId) {
      setQuestions([]);
      setLearningContent([]);
      return;
    }

    const fetchQuestions = async () => {
      setLoadingQuestions(true);
      setLoadingLearningContent(true);
      setError('');
      try {
        const [nextQuestions, nextLearningContent] = await Promise.all([
          fetchAdminQuestions(selectedPackageId),
          fetchLearningContent(selectedPackageId),
        ]);
        setQuestions(nextQuestions);
        setLearningContent(nextLearningContent);
        setLearningSectionCode((current) => (
          nextLearningContent.some((section) => section.code === current)
            ? current
            : nextLearningContent[0]?.code || ''
        ));
      } catch (err) {
        setError(err.response?.data?.message || 'Gagal memuat daftar soal atau materi');
      } finally {
        setLoadingQuestions(false);
        setLoadingLearningContent(false);
      }
    };

    fetchQuestions();
  }, [fetchAdminQuestions, fetchLearningContent, selectedPackageId]);

  useEffect(() => {
    if (!activeLearningSection) {
      return;
    }

    const nextLearningQuestions = (activeLearningSection.questions || []).length > 0
      ? activeLearningSection.questions
      : [
          createEmptyLearningQuestion(1),
          createEmptyLearningQuestion(2),
          createEmptyLearningQuestion(3),
          createEmptyLearningQuestion(4),
          createEmptyLearningQuestion(5),
        ];

    const normalizedQuestions = nextLearningQuestions.map((question, index) => ({
      id: question.id || null,
      client_key: question.client_key || createLearningQuestionClientKey(),
      status: question.status || 'published',
      question_text: question.question_text || '',
      question_image_url: question.question_image_url || '',
      explanation_notes: question.explanation_notes || '',
      material_topic: question.material_topic || '',
      difficulty: question.difficulty || 'medium',
      question_order: Number(question.question_order || index + 1),
      options: (
        Array.isArray(question.options) && question.options.length > 0
          ? question.options
          : createDefaultOptionSet()
      ).map((option, optionIndex) => ({
        letter: option.letter || String.fromCharCode(65 + optionIndex),
        text: option.text || '',
        image_url: option.image_url || '',
        is_correct: Number(option.is_correct) > 0,
        score_weight: getOptionScoreWeight(option, Math.min(5, optionIndex + 1)),
      })),
    }));

    setLearningQuestionsForm(reindexLearningQuestionCollection(normalizedQuestions.map((question) => ({
      ...question,
      options: normalizeOptionsForScoringMode(question.options, usesLearningPointScoring),
    }))));
    setActiveLearningQuestionIndex(0);
    setExpandedLearningQuestionKey('');
  }, [activeLearningSection, usesLearningPointScoring]);

  useEffect(() => {
    setQuestionForm((current) => {
      if (current.question_id) {
        return current;
      }

      const defaultSection = packageSections.find((section) => String(section.code) === String(defaultSectionCode));
      const nextForm = createEmptyQuestionForm(defaultSectionCode);
      return {
        ...nextForm,
        options: normalizeOptionsForScoringMode(nextForm.options, isTkpSection(defaultSection)),
      };
    });
  }, [defaultSectionCode, packageSections]);

  useEffect(() => {
    if (!questionSectionFilter) {
      return;
    }

    const hasMatchingSection = sectionStats.some((section) => section.code === questionSectionFilter);
    if (!hasMatchingSection) {
      setQuestionSectionFilter('');
    }
  }, [questionSectionFilter, sectionStats]);

  useEffect(() => {
    if (!activeLearningSection) {
      setActiveMaterialTopicIndex(null);
      return;
    }

    const topics = getMaterialTopics(activeLearningSection.material);
    setActiveMaterialTopicIndex(topics.length > 0 ? 0 : null);
  }, [activeLearningSection]);

  useEffect(() => {
    if (!activeLearningSection) {
      return;
    }

    const topics = getMaterialTopics(activeLearningSection.material);
    setActiveMaterialTopicIndex((current) => {
      if (topics.length === 0) {
        return null;
      }

      if (current === null || current >= topics.length) {
        return 0;
      }

      return current;
    });
  }, [activeLearningSection]);

  useEffect(() => {
    if (['dashboard', 'tipe-paket', 'edit-paket', 'rincian-paket', 'materi', 'soal', 'laporan'].includes(requestedAdminView)) {
      setAdminView(requestedAdminView);
      return;
    }

    if (requestedAdminView === 'paket') {
      setAdminView('tipe-paket');
    }
  }, [requestedAdminView]);

  useEffect(() => {
    if (!requestedLearningSectionCode) {
      return;
    }

    if (learningContent.some((section) => String(section.code) === String(requestedLearningSectionCode))) {
      setLearningSectionCode(requestedLearningSectionCode);
    }
  }, [learningContent, requestedLearningSectionCode]);

  useEffect(() => {
    if (requestedAdminView !== 'materi') {
      return;
    }

    if (requestedLearningMode === 'quiz') {
      setLearningEditorMode('quiz');
    }
  }, [requestedAdminView, requestedLearningMode]);

  useEffect(() => {
    if (learningEditorMode !== 'quiz' || requestedMiniPreviewId <= 0) {
      return;
    }

    const previewIndex = learningQuestionsForm.findIndex((question) => Number(question.id) === Number(requestedMiniPreviewId));
    if (previewIndex >= 0) {
      setExpandedLearningQuestionKey(getLearningQuestionRowKey(learningQuestionsForm[previewIndex], previewIndex));
    }
  }, [learningEditorMode, learningQuestionsForm, requestedMiniPreviewId]);

  useEffect(() => {
    if (requestedPackageTypeId > 0 && packageTypes.some((type) => Number(type.id) === requestedPackageTypeId)) {
      setSelectedPackageTypeFilterId(requestedPackageTypeId);
    }
  }, [packageTypes, requestedPackageTypeId]);

  useEffect(() => {
    if (requestedPackageId > 0 && packages.some((pkg) => Number(pkg.id) === requestedPackageId)) {
      setSelectedPackageId(requestedPackageId);
    }
  }, [packages, requestedPackageId]);

  useEffect(() => {
    if (requestedPreviewId > 0 && questions.some((question) => Number(question.id) === requestedPreviewId)) {
      setExpandedQuestionId(requestedPreviewId);
    }
  }, [questions, requestedPreviewId]);

  const resetQuestionForm = () => {
    const preferredSection = packageSections.find((section) => String(section.code) === String(preferredSectionCode));
    const nextForm = createEmptyQuestionForm(preferredSectionCode);
    setQuestionForm({
      ...nextForm,
      options: normalizeOptionsForScoringMode(nextForm.options, isTkpSection(preferredSection)),
    });
    setShowQuestionEditor(false);
  };

  const handlePackageChange = (event) => {
    const { name, value } = event.target;
    setPackageForm((current) => ({
      ...current,
      [name]: ['price', 'duration_days', 'max_attempts', 'time_limit', 'category_id'].includes(name)
        ? Number(value)
        : value,
    }));
  };

  const persistPackageForm = useCallback(async (workspace = adminWorkspace) => {
    if (!packageForm) {
      return [];
    }

    await apiClient.put('/admin/packages', {
      ...packageForm,
      workspace,
    });
    const response = await apiClient.get(`/admin/packages?workspace=${workspace}`);
    const nextPackages = response.data.data || [];
    setPackages(nextPackages);
    return nextPackages;
  }, [adminWorkspace, packageForm]);

  const handlePackageSave = async (event) => {
    event.preventDefault();
    if (!packageForm) return;
    if (!isDraftWorkspace) {
      setError('Edit detail paket dilakukan dari tab Draft agar perubahan tidak langsung live ke user.');
      setSuccess('');
      return;
    }

    setPackageSaving(true);
    setError('');
    setSuccess('');

    try {
      await persistPackageForm(adminWorkspace);
      await refreshAdminData(Number(selectedPackageId));
      setSuccess('Draft paket berhasil diperbarui.');
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan paket');
    } finally {
      setPackageSaving(false);
    }
  };

  const handleCreatePackage = async () => {
    if (isDraftWorkspace) {
      setError('Pembuatan paket baru dilakukan dari tab Published terlebih dahulu.');
      return;
    }

    setPackageCreating(true);
    setError('');
    setSuccess('');

    try {
      const response = await apiClient.post('/admin/packages', {
        template_package_id: selectedPackage ? Number(selectedPackage.id) : null,
        category_id: Number(packageForm?.category_id || selectedPackage?.category_id || packageTypes[0]?.id || 0),
        test_mode: packageForm?.test_mode || selectedPackage?.test_mode || 'standard',
      });
      const createdPackageId = Number(response.data?.data?.package_id || 0);
      const { packages: nextPackages } = await loadPackageWorkspaceData();
      if (createdPackageId > 0) {
        setSelectedPackageId(createdPackageId);
        const createdPackage = nextPackages.find((pkg) => Number(pkg.id) === createdPackageId);
        setSelectedPackageTypeFilterId(Number(createdPackage?.category_id || packageForm?.category_id || selectedPackage?.category_id || 0));
      } else if (nextPackages.length > 0) {
        setSelectedPackageId(Number(nextPackages[nextPackages.length - 1].id));
      }
      setSuccess(response.data?.message || 'Paket baru berhasil dibuat.');
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal membuat paket baru');
    } finally {
      setPackageCreating(false);
    }
  };

  const handlePackageTypeEdit = async (type) => {
    const nextNameInput = window.prompt('Nama tipe paket', type.name || '');
    if (nextNameInput === null) {
      return;
    }

    const nextName = nextNameInput.trim();
    if (!nextName) {
      setError('Nama tipe paket wajib diisi.');
      setSuccess('');
      return;
    }

    const nextDescriptionInput = window.prompt('Deskripsi tipe paket (opsional)', type.description || '');
    if (nextDescriptionInput === null) {
      return;
    }

    setPackageTypeSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiClient.put('/admin/package-types', {
        category_id: Number(type.id),
        name: nextName,
        description: nextDescriptionInput.trim(),
      });
      const nextTypes = await fetchPackageTypes();
      setPackageTypes(nextTypes);
      setSuccess(`Tipe paket "${nextName}" berhasil diperbarui.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memperbarui tipe paket');
    } finally {
      setPackageTypeSaving(false);
    }
  };

  const handlePackageTypeDelete = async (type) => {
    const confirmed = window.confirm(`Hapus tipe paket "${type.name}"?`);
    if (!confirmed) {
      return;
    }

    setPackageTypeDeleting(true);
    setError('');
    setSuccess('');

    try {
      await apiClient.delete(`/admin/package-types?id=${type.id}`);
      const nextTypes = await fetchPackageTypes();
      setPackageTypes(nextTypes);
      if (Number(selectedPackageTypeFilterId) === Number(type.id)) {
        setSelectedPackageTypeFilterId(Number(nextTypes[0]?.id || 0));
      }
      setSuccess(`Tipe paket "${type.name}" berhasil dihapus.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menghapus tipe paket');
    } finally {
      setPackageTypeDeleting(false);
    }
  };

  const handleDeletePackage = async (targetPackage = selectedPackage) => {
    if (!targetPackage) {
      return;
    }

    if (isDraftWorkspace) {
      setError('Penghapusan paket dilakukan dari tab Published terlebih dahulu.');
      return;
    }

    const confirmed = window.confirm(`Hapus paket "${targetPackage.name}"? Semua materi, soal, dan riwayat terkait akan ikut terhapus.`);
    if (!confirmed) {
      return;
    }

    setPackageDeleting(true);
    setError('');
    setSuccess('');

    try {
      await apiClient.delete(`/admin/packages?id=${targetPackage.id}`);
      const { packages: nextPackages } = await loadPackageWorkspaceData();
      const deletedSelectedPackage = Number(selectedPackageId) === Number(targetPackage.id);
      if (deletedSelectedPackage) {
        setSelectedPackageId(nextPackages[0] ? Number(nextPackages[0].id) : null);
        resetQuestionForm();
        setExpandedQuestionId(null);
        setLearningEditorMode('');
      }
      setSuccess(`Paket "${targetPackage.name}" berhasil dihapus.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menghapus paket');
    } finally {
      setPackageDeleting(false);
    }
  };

  const handlePackageAvailabilityToggle = async (targetPackage = selectedPackage) => {
    const payload = targetPackage
      ? buildPackageUpdatePayload(targetPackage)
      : packageForm;
    if (!targetPackage || !payload) {
      return;
    }

    const currentDisabled = Boolean(Number(payload.is_temporarily_disabled || 0));
    const nextValue = currentDisabled ? 0 : 1;
    const confirmed = window.confirm(
      nextValue === 1
        ? `Tandai paket "${targetPackage.name}" sebagai nonaktif sementara${isDraftWorkspace ? ' di draft' : ''}?`
        : `Aktifkan lagi paket "${targetPackage.name}"${isDraftWorkspace ? ' di draft' : ''}?`
    );
    if (!confirmed) {
      return;
    }

    setPackageAvailabilitySaving(true);
    setError('');
    setSuccess('');

    try {
      await apiClient.put('/admin/packages', {
        ...payload,
        workspace: adminWorkspace,
        is_temporarily_disabled: nextValue,
      });
      await refreshAdminData(Number(selectedPackageId || targetPackage.id));
      setSuccess(
        nextValue === 1
          ? (isDraftWorkspace
            ? 'Status nonaktif sementara berhasil disimpan di draft. Publish draft untuk menerapkan ke user.'
            : 'Paket berhasil dinonaktifkan sementara.')
          : (isDraftWorkspace
            ? 'Status aktif paket berhasil disimpan di draft. Publish draft untuk menerapkan ke user.'
            : 'Paket berhasil diaktifkan kembali.')
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengubah status paket');
    } finally {
      setPackageAvailabilitySaving(false);
    }
  };

  const handleQuestionChange = (event) => {
    const { name, value } = event.target;
    setQuestionForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'section_code'
        ? {
            options: normalizeOptionsForScoringMode(
              current.options,
              isTkpSection(packageSections.find((section) => String(section.code) === String(value)))
            ),
          }
        : {}),
    }));
  };

  const handleOptionFieldChange = (index, field, value) => {
    setQuestionForm((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) => (
        optionIndex === index ? { ...option, [field]: value } : option
      )),
    }));
  };

  const handleCorrectOptionChange = (index) => {
    setQuestionForm((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) => ({
        ...option,
        is_correct: optionIndex === index,
      })),
    }));
  };

  const addOption = () => {
    setQuestionForm((current) => {
      if (current.options.length >= 5) return current;
      return {
        ...current,
        options: normalizeOptionsForScoringMode(
          [...current.options, createOption(current.options.length)],
          usesQuestionPointScoring
        ),
      };
    });
  };

  const removeOption = (index) => {
    if (questionForm.options.length <= 2) return;

    setQuestionForm((current) => {
      const nextOptions = current.options
        .filter((_, optionIndex) => optionIndex !== index)
        .map((option, optionIndex) => ({
          ...option,
          letter: String.fromCharCode(65 + optionIndex),
        }));

      if (!usesQuestionPointScoring && !nextOptions.some((option) => option.is_correct)) {
        nextOptions[0].is_correct = true;
      }

      return {
        ...current,
        options: normalizeOptionsForScoringMode(nextOptions, usesQuestionPointScoring),
      };
    });
  };

  const handleQuestionSubmit = async (event) => {
    event.preventDefault();
    if (!selectedPackageId) return;

    setQuestionSaving(true);
    setError('');
    setSuccess('');

    const payload = {
      ...questionForm,
      package_id: Number(selectedPackageId),
      workspace: adminWorkspace,
      options: questionForm.options
        .filter((option) => option.text.trim() !== '' || option.image_url.trim() !== '')
        .map((option, index) => ({
          letter: option.letter || String.fromCharCode(65 + index),
          text: option.text,
          image_url: option.image_url,
          is_correct: usesQuestionPointScoring ? getOptionScoreWeight(option, Math.min(5, index + 1)) : option.is_correct,
          score_weight: usesQuestionPointScoring ? getOptionScoreWeight(option, Math.min(5, index + 1)) : (option.is_correct ? 5 : 0),
        })),
    };

    try {
      if (questionForm.question_id) {
        await apiClient.put('/admin/questions', payload);
        setSuccess(isDraftWorkspace ? 'Soal draft berhasil diperbarui.' : 'Soal berhasil diperbarui.');
      } else {
        await apiClient.post('/admin/questions', payload);
        setSuccess(isDraftWorkspace ? 'Soal draft berhasil ditambahkan.' : 'Soal berhasil ditambahkan.');
      }

      await refreshAdminData(Number(selectedPackageId));
      resetQuestionForm();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan soal');
    } finally {
      setQuestionSaving(false);
    }
  };

  const handleQuestionEdit = (question) => {
    setExpandedQuestionId(Number(question.id));
    setSuccess('');
    setError('');
    setAdminView('soal');
  };

  const handleCreateQuestion = () => {
    if (!selectedPackageId) {
      return;
    }

    const query = new URLSearchParams();
    if (preferredSectionCode) {
      query.set('section', preferredSectionCode);
    }
    query.set('workspace', adminWorkspace);
    navigate(`/admin/question-editor/${selectedPackageId}/new?${query.toString()}`);
  };

  const openLearningEditor = (sectionCode, mode) => {
    setLearningSectionCode(sectionCode);
    setLearningEditorMode(mode);
    setExpandedLearningQuestionKey('');
    setSuccess('');
    setError('');
    setAdminView('materi');
  };

  const openMiniTestQuestionEditor = (sectionCode, questionId = 'new', options = {}) => {
    const query = new URLSearchParams();
    query.set('workspace', adminWorkspace);
    if (Number.isInteger(options.draftIndex) && options.draftIndex >= 0) {
      query.set('draft', String(options.draftIndex));
    }

    navigate(`/admin/mini-test-question-editor/${selectedPackageId}/${encodeURIComponent(sectionCode)}/${questionId}${query.toString() ? `?${query.toString()}` : ''}`);
  };

  const handleCreateMiniTestQuestion = () => {
    if (!selectedPackageId || !activeLearningSection?.code) {
      return;
    }

    const firstDraftIndex = learningQuestionsForm.findIndex((question) => !Number(question.id || 0));
    openMiniTestQuestionEditor(
      activeLearningSection.code,
      'new',
      firstDraftIndex >= 0 ? { draftIndex: firstDraftIndex } : {}
    );
  };

  const handleQuestionDelete = async (questionId) => {
    const confirmed = window.confirm('Hapus soal ini? Semua opsi jawabannya juga akan dihapus.');
    if (!confirmed) return;

    setError('');
    setSuccess('');

    try {
      await apiClient.delete(`/admin/questions?id=${questionId}&workspace=${adminWorkspace}`);
      await refreshAdminData(Number(selectedPackageId));

      if (Number(questionForm.question_id) === Number(questionId)) {
        resetQuestionForm();
      }

      if (Number(expandedQuestionId) === Number(questionId)) {
        setExpandedQuestionId(null);
      }

      setSuccess(isDraftWorkspace ? 'Soal draft berhasil dihapus.' : 'Soal berhasil dihapus.');
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menghapus soal');
    }
  };

  const updateLearningQuestion = (questionIndex, field, value) => {
    setLearningQuestionsForm((current) => current.map((question, index) => (
      index === questionIndex
        ? {
            ...question,
            [field]: field === 'question_order' ? Number(value) : value,
          }
        : question
    )));
  };

  const updateLearningQuestionOption = (questionIndex, optionIndex, field, value) => {
    setLearningQuestionsForm((current) => current.map((question, index) => (
      index === questionIndex
        ? {
            ...question,
            options: question.options.map((option, currentOptionIndex) => (
              currentOptionIndex === optionIndex ? { ...option, [field]: value } : option
            )),
          }
        : question
    )));
  };

  const setLearningQuestionCorrectOption = (questionIndex, optionIndex) => {
    if (usesLearningPointScoring) {
      return;
    }

    setLearningQuestionsForm((current) => current.map((question, index) => (
      index === questionIndex
        ? {
            ...question,
            options: question.options.map((option, currentOptionIndex) => ({
              ...option,
              is_correct: currentOptionIndex === optionIndex,
            })),
          }
        : question
    )));
  };

  const addLearningQuestion = () => {
    const nextQuestionIndex = learningQuestionsForm.length;
    setLearningQuestionsForm((current) => {
      const nextQuestion = createEmptyLearningQuestion(current.length + 1);
      return reindexLearningQuestionCollection([
        ...current,
        {
          ...nextQuestion,
          options: normalizeOptionsForScoringMode(nextQuestion.options, usesLearningPointScoring),
        },
      ]);
    });
    setActiveLearningQuestionIndex(nextQuestionIndex);
  };

  const removeLearningQuestion = (questionIndex) => {
    if (learningQuestionsForm.length <= 1) {
      return;
    }

    const nextQuestions = reindexLearningQuestionCollection(learningQuestionsForm.filter((_, index) => index !== questionIndex));
    const nextActiveIndex = Math.min(
      activeLearningQuestionIndex > questionIndex ? activeLearningQuestionIndex - 1 : activeLearningQuestionIndex,
      nextQuestions.length - 1
    );

    setLearningQuestionsForm(nextQuestions);
    setActiveLearningQuestionIndex(nextActiveIndex);
    setExpandedLearningQuestionKey('');
  };

  const handleLearningQuestionsSave = async () => {
    if (!selectedPackageId || !activeLearningSection) return;
    await persistLearningQuestions(learningQuestionsForm);
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([buildCsvTemplate()], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'template-import-soal.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsedRows = parseCsv(text);
      const payloadRows = createImportPayload(parsedRows, preferredSectionCode);
      setImportRows(payloadRows);
      setImportFileName(file.name);
      setError('');
      setSuccess(`File ${file.name} siap diimport (${payloadRows.length} soal).`);
    } catch (err) {
      setImportRows([]);
      setImportFileName('');
      setError(err.message || 'File CSV tidak valid.');
    } finally {
      event.target.value = '';
    }
  };

  const handleImportQuestions = async () => {
    if (!selectedPackageId || importRows.length === 0) {
      setError('Pilih file CSV template yang valid terlebih dahulu.');
      return;
    }

    setImportingQuestions(true);
    setError('');
    setSuccess('');

    try {
      const response = await apiClient.post('/admin/questions/import', {
        package_id: Number(selectedPackageId),
        workspace: adminWorkspace,
        rows: importRows,
      });
      await refreshAdminData(Number(selectedPackageId));
      setImportRows([]);
      setImportFileName('');
      setSuccess(response.data?.message || 'Import soal berhasil.');
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengimport soal.');
    } finally {
      setImportingQuestions(false);
    }
  };

  const handleTryoutExtractDownload = (question) => {
    try {
      downloadQuestionExtractFile(question, {
        prefix: 'extract-soal-tryout',
        sectionName: question.section_name || question.section_code || '',
      });
    } catch (error) {
      setError(error.message || 'Gagal mengunduh extract soal tryout.');
    }
  };

  const handleMiniTestExtractDownload = (question) => {
    if (!activeLearningSection) {
      return;
    }

    try {
      downloadQuestionExtractFile(question, {
        prefix: 'extract-soal-mini-test',
        sectionName: activeLearningSection.name,
      });
    } catch (error) {
      setError(error.message || 'Gagal mengunduh extract soal mini test.');
    }
  };

  const handleTryoutBulkExtractDownload = () => {
    const entries = filteredQuestions
      .filter((question) => hasQuestionExtractContent(question))
      .map((question) => ({
        question,
        metadata: {
          sectionName: question.section_name || question.section_code || '',
        },
      }));

    try {
      downloadBulkQuestionExtractFile(entries, {
        prefix: 'extract-semua-soal-tryout',
        suffix: selectedPackage?.name || 'paket-aktif',
      });
    } catch (error) {
      setError(error.message || 'Gagal mengunduh extract semua soal tryout.');
    }
  };

  const handleMiniTestBulkExtractDownload = () => {
    if (!activeLearningSection) {
      return;
    }

    const entries = learningQuestionsForm
      .filter((question) => hasQuestionExtractContent(question))
      .map((question) => ({
        question,
        metadata: {
          sectionName: activeLearningSection.name,
        },
      }));

    try {
      downloadBulkQuestionExtractFile(entries, {
        prefix: 'extract-semua-soal-mini-test',
        sectionName: activeLearningSection.name,
      });
    } catch (error) {
      setError(error.message || 'Gagal mengunduh extract semua soal mini test.');
    }
  };

  const openDashboardView = () => {
    setAdminView('dashboard');
    setLearningEditorMode('');
    setEditingSectionActionsCode('');
  };

  const navigateToPackageTypeView = useCallback((workspace = adminWorkspace) => {
    const query = new URLSearchParams(location.search);
    query.set('workspace', workspace);
    query.set('view', 'tipe-paket');
    query.delete('package');
    query.delete('type');
    query.delete('section');
    query.delete('mode');
    query.delete('preview');
    query.delete('mini_preview');
    navigate(`/admin/workspace?${query.toString()}`);
  }, [adminWorkspace, location.search, navigate]);

  const openPackageListView = useCallback((typeId, workspace = adminWorkspace) => {
    const query = new URLSearchParams(location.search);
    query.set('workspace', workspace);
    query.set('view', 'edit-paket');
    query.set('type', String(typeId));
    query.delete('package');
    query.delete('section');
    query.delete('mode');
    query.delete('preview');
    query.delete('mini_preview');
    navigate(`/admin/workspace?${query.toString()}`);
  }, [adminWorkspace, location.search, navigate]);

  const openPackageEditor = useCallback((packageId, workspace = adminWorkspace) => {
    if (!packageId) {
      return;
    }

    const query = new URLSearchParams(location.search);
    query.set('workspace', workspace);
    query.set('view', 'rincian-paket');
    const targetPackage = packages.find((pkg) => Number(pkg.id) === Number(packageId));
    if (targetPackage?.category_id) {
      query.set('type', String(targetPackage.category_id));
    }
    query.set('package', String(packageId));
    query.delete('section');
    query.delete('mode');
    query.delete('preview');
    query.delete('mini_preview');
    navigate(`/admin/workspace?${query.toString()}`);
  }, [adminWorkspace, location.search, navigate, packages]);

  const openLearningView = (sectionCode = null, mode = '', shouldExpand = true, topicIndex = null) => {
    if (sectionCode) {
      setLearningSectionCode(sectionCode);
      setQuestionSectionFilter(sectionCode);
      if (shouldExpand) {
        setExpandedMaterialSections((current) => ({
          ...current,
          [sectionCode]: true,
        }));
      }
      if (typeof topicIndex === 'number' && Number.isFinite(topicIndex)) {
        setActiveMaterialTopicIndex(Math.max(0, Math.floor(topicIndex)));
      }
    }
    setEditingSectionActionsCode('');
    setAdminView('materi');
    setLearningEditorMode(mode);
  };

  const toggleMaterialSection = (sectionCode) => {
    if (!sectionCode) {
      return;
    }

    const nextExpanded = !expandedMaterialSections[sectionCode];
    setExpandedMaterialSections((current) => ({
      ...current,
      [sectionCode]: nextExpanded,
    }));
    openLearningView(sectionCode, '', nextExpanded);
  };

  const openQuestionView = () => {
    if (activeLearningSection?.code) {
      setQuestionSectionFilter((current) => current || activeLearningSection.code);
    }
    setAdminView('soal');
    setLearningEditorMode('');
    setEditingSectionActionsCode('');
  };

  const openReportView = () => {
    setAdminView('laporan');
    setLearningEditorMode('');
    setEditingSectionActionsCode('');
  };

  const handleReportStatusUpdate = async (reportId, status) => {
    if (!reportId || !status) {
      return;
    }

    setReportStatusSavingId(Number(reportId));
    setError('');
    setSuccess('');

    try {
      const response = await apiClient.put('/reports/admin-status', {
        report_id: Number(reportId),
        status,
      });
      await loadAdminReports(selectedPackageId, reportStatusFilter);
      setSuccess(response.data?.message || 'Status laporan berhasil diperbarui.');
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memperbarui status laporan.');
    } finally {
      setReportStatusSavingId(0);
    }
  };

  const openMaterialTopicPreview = (sectionCode, topicIndex = 0) => {
    if (!sectionCode) {
      return;
    }

    openLearningView(sectionCode, '', true, topicIndex);
  };

  const updateWorkflowSections = async (nextSections, nextActiveSectionCode, successMessage) => {
    if (!selectedPackageId || !selectedPackage || !packageForm) {
      return;
    }

    setWorkflowSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiClient.put('/admin/packages', {
        ...packageForm,
        workspace: adminWorkspace,
        workflow_config: {
          ...selectedPackage.workflow,
          sections: nextSections.map((section, index) => ({
            ...section,
            order: index + 1,
          })),
        },
      });

      const refreshed = await refreshAdminData(Number(selectedPackageId));
      const resolvedCode = refreshed?.learningContent?.some((section) => section.code === nextActiveSectionCode)
        ? nextActiveSectionCode
        : refreshed?.learningContent?.[0]?.code || '';
      setLearningSectionCode(resolvedCode);
      setQuestionSectionFilter((current) => {
        if (!resolvedCode) {
          return '';
        }

        return current && refreshed?.learningContent?.some((section) => section.code === current)
          ? current
          : resolvedCode;
      });
      resetQuestionForm();
      setExpandedQuestionId(null);
      setSuccess(successMessage);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memperbarui struktur subtest');
    } finally {
      setWorkflowSaving(false);
    }
  };

  const handleAddSection = async (section) => {
    const sourceExists = packageSections.some((item) => item.code === section.code);
    const nextSection = sourceExists ? createSectionClone(section, packageSections) : section;
    const insertIndex = sourceExists
      ? packageSections.findIndex((item) => item.code === section.code)
      : packageSections.length - 1;
    const nextSections = [...packageSections];
    nextSections.splice(insertIndex + 1, 0, nextSection);
    await updateWorkflowSections(nextSections, nextSection.code, `Subtest ${nextSection.name} berhasil ditambahkan.`);
    setExpandedMaterialSections((current) => ({
      ...current,
      [nextSection.code]: true,
    }));
  };

  const handleCreateSubtest = async () => {
    const nextName = window.prompt('Nama subtest baru', '');
    if (nextName === null) {
      return;
    }

    const trimmedName = nextName.trim();
    if (!trimmedName) {
      setError('Nama subtest wajib diisi.');
      return;
    }

    const referenceSection = packageSections[packageSections.length - 1] || activeLearningSection || {
      code: 'subtest',
      name: 'Subtest',
    };
    const nextSection = createSectionClone(referenceSection, packageSections);
    const existingCodes = new Set(packageSections.map((section) => String(section.code || '')));
    const baseCode = slugifySectionCode(trimmedName) || nextSection.code || 'subtest_baru';
    let nextCode = baseCode;
    let suffix = 2;
    while (existingCodes.has(nextCode)) {
      nextCode = `${baseCode}_${suffix}`;
      suffix += 1;
    }

    nextSection.name = trimmedName;
    nextSection.code = nextCode;
    await handleAddSection(nextSection);
  };

  const handleEditSection = async (section) => {
    const nextName = window.prompt('Nama subtest', section.name || '');
    if (nextName === null) {
      return;
    }

    const trimmedName = nextName.trim();
    if (!trimmedName) {
      setError('Nama subtest tidak boleh kosong.');
      return;
    }

    const nextSessionName = window.prompt('Nama grup/sesi subtest (opsional)', section.session_name || '');
    if (nextSessionName === null) {
      return;
    }

    const nextDuration = window.prompt('Durasi subtest dalam menit (opsional)', section.duration_minutes ?? '');
    if (nextDuration === null) {
      return;
    }

    const nextTargetCount = window.prompt('Target jumlah soal subtest (opsional)', section.target_question_count ?? '');
    if (nextTargetCount === null) {
      return;
    }

    const normalizedDuration = String(nextDuration).trim() === '' ? null : Number(nextDuration);
    const normalizedTargetCount = String(nextTargetCount).trim() === '' ? null : Number(nextTargetCount);

    if (normalizedDuration !== null && (!Number.isFinite(normalizedDuration) || normalizedDuration < 0)) {
      setError('Durasi subtest tidak valid.');
      return;
    }

    if (normalizedTargetCount !== null && (!Number.isFinite(normalizedTargetCount) || normalizedTargetCount < 0)) {
      setError('Target jumlah soal tidak valid.');
      return;
    }

    const nextSections = packageSections.map((item) => (
      item.code === section.code
        ? {
            ...item,
            name: trimmedName,
            session_name: nextSessionName.trim() || null,
            duration_minutes: normalizedDuration,
            target_question_count: normalizedTargetCount === null ? null : Math.floor(normalizedTargetCount),
          }
        : item
    ));

    await updateWorkflowSections(nextSections, section.code, `Subtest ${trimmedName} berhasil diperbarui.`);
  };

  const handleMiniTestTimingEdit = async (section) => {
    const currentDuration = section.mini_test_duration_minutes ?? section.duration_minutes ?? '';
    const nextDuration = window.prompt('Durasi mini test dalam menit', currentDuration);
    if (nextDuration === null) {
      return;
    }

    const normalizedDuration = String(nextDuration).trim() === '' ? null : Number(nextDuration);

    if (normalizedDuration !== null && (!Number.isFinite(normalizedDuration) || normalizedDuration < 0)) {
      setError('Durasi mini test tidak valid.');
      return;
    }

    const nextSections = packageSections.map((item) => (
      item.code === section.code
        ? {
            ...item,
            mini_test_duration_minutes: normalizedDuration,
          }
        : item
    ));

    await updateWorkflowSections(nextSections, section.code, `Waktu mini test ${section.name} berhasil diperbarui.`);
  };

  const handleDeleteSection = async (section) => {
    if (packageSections.length <= 1) {
      setError('Minimal harus ada 1 subtest.');
      return;
    }

    const confirmed = window.confirm(`Hapus subtest "${section.name}"? Materi, mini test, dan soal pada subtest ini juga akan ikut terhapus.`);
    if (!confirmed) {
      return;
    }

    const currentIndex = packageSections.findIndex((item) => item.code === section.code);
    const nextSections = packageSections.filter((item) => item.code !== section.code);
    const fallbackSection = nextSections[Math.max(0, currentIndex - 1)] || nextSections[0];
    await updateWorkflowSections(
      nextSections,
      fallbackSection?.code || '',
      `Subtest ${section.name} berhasil dihapus.`
    );
  };

  const updateSectionMaterialTopics = async (section, nextTopics, successMessage) => {
    if (!selectedPackageId || !section?.code) {
      return;
    }

    setWorkflowSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiClient.put('/admin/learning-material', {
        package_id: Number(selectedPackageId),
        section_code: section.code,
        title: section.material?.title || section.name,
        workspace: adminWorkspace,
        topics: nextTopics,
      });

      await refreshAdminData(Number(selectedPackageId));
      setLearningSectionCode(section.code);
      setExpandedMaterialSections((current) => ({
        ...current,
        [section.code]: true,
      }));
      setSuccess(successMessage);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memperbarui topik materi subtest');
    } finally {
      setWorkflowSaving(false);
    }
  };

  const handleAddSectionChildPage = (section) => {
    const nextTitle = window.prompt(`Nama topik baru untuk ${section.name}`, '');
    if (nextTitle === null) {
      return;
    }

    const trimmedTitle = nextTitle.trim();
    if (!trimmedTitle) {
      setError('Nama topik wajib diisi.');
      return;
    }

    const currentTopics = getMaterialTopics(section.material);
    const nextTopics = [
      ...currentTopics,
      {
        title: trimmedTitle,
        pages: [],
      },
    ];

    updateSectionMaterialTopics(
      section,
      nextTopics,
      `Topik ${trimmedTitle} berhasil ditambahkan.`
    ).then(() => {
      setLearningSectionCode(section.code);
      setActiveMaterialTopicIndex(nextTopics.length - 1);
      setAdminView('materi');
    });
  };

  const handleRenameSectionChildPage = async (section, topicIndex) => {
    const currentTopics = getMaterialTopics(section.material);
    const currentTopic = currentTopics[topicIndex];
    if (!currentTopic) {
      return;
    }

    const nextTitle = window.prompt(
      `Ubah nama topik untuk ${section.name}`,
      currentTopic.title || `Topik ${topicIndex + 1}`
    );
    if (nextTitle === null) {
      return;
    }

    const trimmedTitle = nextTitle.trim();
    if (!trimmedTitle) {
      setError('Nama topik tidak boleh kosong.');
      return;
    }

    const nextTopics = currentTopics.map((topic, index) => (
      index === topicIndex ? { ...topic, title: trimmedTitle } : topic
    ));

    await updateSectionMaterialTopics(
      section,
      nextTopics,
      `Nama topik ${section.name} berhasil diperbarui.`
    );
  };

  const handleRemoveSectionChildPage = async (section, topicIndex) => {
    const currentTopics = getMaterialTopics(section.material);
    if (currentTopics.length <= 1) {
      setError('Minimal harus ada 1 topik materi di setiap subtest.');
      return;
    }

    const topic = currentTopics[topicIndex];
    const confirmed = window.confirm(
      `Hapus topik "${topic?.title || `Topik ${topicIndex + 1}`}" dari ${section.name}?`
    );
    if (!confirmed) {
      return;
    }

    const nextTopics = currentTopics.filter((_, index) => index !== topicIndex);

    await updateSectionMaterialTopics(
      section,
      nextTopics,
      `Topik ${topic?.title || `Topik ${topicIndex + 1}`} berhasil dihapus dari ${section.name}.`
    );
  };

  return (
    <AccountShell
      shellClassName="account-shell-learning admin-workspace-shell"
      title="Panel Admin"
      subtitle="Kelola paket, soal, gambar, dan import bank soal dari satu workspace yang lebih ringkas."
      navContent={(
        <div className="admin-workspace-topnav admin-workspace-topnav-link-row" aria-label="Navigasi workspace admin">
          <button
            type="button"
            className={`admin-workspace-topnav-link ${adminWorkspace === 'published' ? 'admin-workspace-topnav-link-active' : ''}`}
            onClick={() => handleWorkspaceChange('published')}
            aria-pressed={adminWorkspace === 'published'}
          >
            Published
          </button>
          <button
            type="button"
            className={`admin-workspace-topnav-link ${adminWorkspace === 'draft' ? 'admin-workspace-topnav-link-active' : ''}`}
            onClick={() => handleWorkspaceChange('draft')}
            aria-pressed={adminWorkspace === 'draft'}
          >
            Draft
          </button>
        </div>
      )}
    >
      {loadingPackages ? (
        <div className="account-card">
          <p>Memuat panel admin...</p>
        </div>
      ) : (
        <div className="admin-layout admin-workspace-layout">
          {(error || success) && (
            <div className="account-card admin-message-card">
              {error && <div className="alert">{error}</div>}
              {success && <div className="account-success">{success}</div>}
            </div>
          )}

          <div className="account-card admin-message-card admin-workspace-switcher-card">
            <div className="admin-workspace-switcher-layout">
              <div className="admin-workspace-switcher-copy">
                <span className={`admin-workspace-mode-pill admin-workspace-mode-pill-${adminWorkspace}`}>
                  {isDraftWorkspace ? 'Draft Workspace' : 'Published Workspace'}
                </span>
                <h3>{isDraftWorkspace ? 'Draft Paket Aktif' : 'Published Paket Aktif'}</h3>
                <p className="text-muted">
                  {isDraftWorkspace
                    ? 'Gunakan area ini untuk menyimpan perubahan keseluruhan paket sebagai draft sebelum dipublish ke user.'
                    : 'Area ini menampilkan isi paket yang sedang live. Untuk mengedit, pindah ke tab Draft di navigasi atas.'}
                </p>
              </div>

              {isDraftWorkspace && (
                <div className="admin-workspace-publish-actions">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={handleSaveWorkspaceDraft}
                    disabled={savingWorkspaceDraft || !selectedPackageId}
                  >
                    {savingWorkspaceDraft ? 'Menyimpan Draft...' : 'Simpan Draft'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handlePublishWorkspaceDraft}
                    disabled={publishingWorkspaceDraft || !selectedPackageId}
                  >
                    {publishingWorkspaceDraft ? 'Publish Draft...' : 'Publish Draft'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <section className="learning-workspace admin-user-workspace">
            <aside className="learning-sidebar admin-user-sidebar">
              <div className="learning-sidebar-card admin-user-sidebar-card admin-package-settings-card">
                <p className="learning-sidebar-label">Pengaturan paket</p>
                <button
                  type="button"
                  className={['tipe-paket', 'edit-paket', 'rincian-paket'].includes(adminView) ? 'learning-sidebar-link learning-sidebar-link-active' : 'learning-sidebar-link'}
                  onClick={() => navigateToPackageTypeView(adminWorkspace)}
                >
                  Kelola Jenis Paket
                </button>
              </div>

              {!['tipe-paket', 'edit-paket', 'rincian-paket'].includes(adminView) && (
                <div className="learning-sidebar-card admin-user-sidebar-card">
                  <p className="learning-sidebar-label">Jenis Paket</p>
                  <div className="learning-sidebar-list">
                    {packageTypes.map((type) => {
                      const typeId = Number(type.id);
                      const isActiveType = typeId === Number(selectedPackageTypeFilterId);
                      return (
                        <button
                          key={type.id}
                          type="button"
                          className={isActiveType ? 'learning-sidebar-item learning-sidebar-item-active' : 'learning-sidebar-item'}
                          onClick={() => {
                            setSelectedPackageTypeFilterId(typeId);
                            const firstPackage = packages.find((pkg) => Number(pkg.category_id || 0) === typeId);
                            if (firstPackage) {
                              setSelectedPackageId(Number(firstPackage.id));
                            }
                            resetQuestionForm();
                            setExpandedQuestionId(null);
                            setLearningEditorMode('');
                            setEditingSectionActionsCode('');
                          }}
                        >
                          <strong>{type.name}</strong>
                          <small>{packageTypeCounts[typeId] || 0} paket</small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!['tipe-paket', 'edit-paket', 'rincian-paket'].includes(adminView) && (
                <div className="learning-sidebar-card admin-user-sidebar-card">
                  <p className="learning-sidebar-label">Daftar Paket</p>
                  <div className="learning-sidebar-list">
                    {filteredPackages.map((pkg) => {
                      const packageStatus = normalizeMaterialStatus(packageStatusMap[Number(pkg.id)] || 'published');
                      return (
                        <button
                          key={pkg.id}
                          type="button"
                          className={[
                            'learning-sidebar-item',
                            'admin-sidebar-package-item',
                            Number(selectedPackageId) === Number(pkg.id) ? 'learning-sidebar-item-active' : '',
                          ].filter(Boolean).join(' ')}
                          onClick={() => {
                            setSelectedPackageId(Number(pkg.id));
                            setSelectedPackageTypeFilterId(Number(pkg.category_id || 0));
                            resetQuestionForm();
                            setExpandedQuestionId(null);
                            setLearningEditorMode('');
                            setEditingSectionActionsCode('');
                          }}
                        >
                          <span className="admin-sidebar-link-copy">
                            <strong>{pkg.name}</strong>
                            <small>{pkg.workflow?.sections?.length || 0} subtest • {TEST_MODE_OPTIONS.find((option) => option.value === pkg.test_mode)?.label || pkg.test_mode || 'Standard'}</small>
                          </span>
                          <small className={`admin-inline-status admin-inline-status-${packageStatus}`}>
                            {getMaterialStatusLabel(packageStatus)}
                          </small>
                        </button>
                      );
                    })}
                    {filteredPackages.length === 0 && (
                      <div className="learning-sidebar-item">
                        <strong>Belum ada paket</strong>
                        <small>Pilih jenis paket lain atau tambahkan paket baru dari workspace published.</small>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="learning-sidebar-card admin-user-sidebar-card">
                <button
                  type="button"
                  className={adminView === 'dashboard' ? 'learning-sidebar-link learning-sidebar-link-active' : 'learning-sidebar-link'}
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
                    <small>{learningContent.length} subtest tersedia</small>
                  </span>
                  <span>{materialsExpanded ? '▴' : '▾'}</span>
                </button>

                {isDraftWorkspace && materialsExpanded && (
                  <button
                    type="button"
                    className="learning-sidebar-link admin-material-add-subtest"
                    onClick={handleCreateSubtest}
                    disabled={workflowSaving || !selectedPackageId}
                  >
                    + Tambah Subtest
                  </button>
                )}

                {materialsExpanded && (
                  <div className="learning-sidebar-list">
                    {learningContent.map((section) => {
                      const topics = getMaterialTopics(section.material);
                      const isSectionActive = section.code === activeLearningSection?.code;
                      const isMiniTestActive = isSectionActive && learningEditorMode === 'quiz';
                      const materialStatus = normalizeMaterialStatus(section.status || section.material?.status);
                      const miniTestStatus = normalizeMaterialStatus(section.mini_test_status || 'published');

                      return (
                        <div key={section.code} className="admin-section-sidebar-entry">
                          <div className="admin-section-sidebar-row">
                            <button
                              type="button"
                              className={adminView === 'materi' && isSectionActive ? 'learning-sidebar-item learning-sidebar-item-active admin-section-sidebar-item' : 'learning-sidebar-item admin-section-sidebar-item'}
                              onClick={() => toggleMaterialSection(section.code)}
                            >
                              <span className="admin-section-sidebar-item-copy">
                                <strong>{section.name}</strong>
                                <small>{formatSubtestSidebarLabel(topics.length || 0)}</small>
                                <span className={`admin-material-status-badge admin-material-status-badge-${materialStatus}`}>
                                  {getMaterialStatusLabel(materialStatus)}
                                </span>
                              </span>
                              <span className="admin-section-sidebar-caret" aria-hidden="true">
                                {expandedMaterialSections[section.code] ? '▾' : '▸'}
                              </span>
                            </button>
                          {isDraftWorkspace && (
                            <div className="admin-section-sidebar-actions">
                              <button
                                type="button"
                                className={`admin-section-action-btn admin-section-action-btn-edit ${
                                  editingSectionActionsCode === section.code ? 'admin-section-action-btn-edit-active' : ''
                                }`}
                                aria-label={`Kelola aksi subtest ${section.name}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setEditingSectionActionsCode((current) => current === section.code ? '' : section.code);
                                }}
                                disabled={workflowSaving}
                              >
                                ✎
                              </button>
                              {editingSectionActionsCode === section.code && (
                                <>
                                  <button
                                    type="button"
                                    className="admin-section-action-btn"
                                    aria-label={`Edit subtest ${section.name}`}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleEditSection(section);
                                    }}
                                    disabled={workflowSaving}
                                  >
                                    ✎
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-section-action-btn"
                                    aria-label={`Tambah topik materi untuk ${section.name}`}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleAddSectionChildPage(section);
                                    }}
                                    disabled={workflowSaving}
                                  >
                                    +
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-section-action-btn admin-section-action-btn-danger"
                                    aria-label={`Hapus subtest ${section.name}`}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleDeleteSection(section);
                                    }}
                                    disabled={workflowSaving || packageSections.length <= 1}
                                  >
                                    🗑
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                          </div>

                          {expandedMaterialSections[section.code] && (
                            <div className="admin-section-sidebar-children">
                              {topics.map((topic, index) => {
                                const topicStatus = getTopicStatus(section.material, index);
                                return (
                                <div key={`${section.code}-topic-${index}`} className="admin-section-sidebar-child-row">
                                  <button
                                    type="button"
                                    className={[
                                      'admin-section-sidebar-child',
                                      adminView === 'materi' && section.code === activeLearningSection?.code && index === activeMaterialTopicIndex
                                        ? 'admin-section-sidebar-child-active'
                                        : '',
                                    ].filter(Boolean).join(' ')}
                                    onClick={() => openMaterialTopicPreview(section.code, index)}
                                  >
                                    <span>{index + 1}</span>
                                    <strong>{topic.title || `Topik ${index + 1}`}</strong>
                                    <small className={`admin-inline-status admin-inline-status-${topicStatus}`}>
                                      {getMaterialStatusLabel(topicStatus)}
                                    </small>
                                  </button>
                                  {isDraftWorkspace && (
                                    <div className="admin-section-sidebar-child-actions">
                                      <button
                                        type="button"
                                        className="admin-section-action-btn admin-section-action-btn-inline"
                                        aria-label={`Edit nama topik ${topic.title || `Topik ${index + 1}`}`}
                                        onClick={() => handleRenameSectionChildPage(section, index)}
                                        disabled={workflowSaving}
                                      >
                                        ✎
                                      </button>
                                      <button
                                        type="button"
                                        className="admin-section-action-btn admin-section-action-btn-inline admin-section-action-btn-danger"
                                        aria-label={`Hapus topik ${topic.title || `Topik ${index + 1}`}`}
                                        onClick={() => handleRemoveSectionChildPage(section, index)}
                                        disabled={workflowSaving || topics.length <= 1}
                                      >
                                        🗑
                                      </button>
                                    </div>
                                  )}
                                </div>
                                );
                              })}
                              <div className="admin-section-sidebar-child-row admin-section-sidebar-child-row-mini-test">
                                <button
                                  type="button"
                                  className={[
                                    'admin-section-sidebar-child',
                                    'admin-section-sidebar-child-mini-test',
                                    isMiniTestActive ? 'admin-section-sidebar-child-active' : '',
                                  ].filter(Boolean).join(' ')}
                                  onClick={() => openLearningEditor(section.code, 'quiz')}
                                >
                                  <span>MT</span>
                                  <strong>Mini Test Subtest</strong>
                                  <small className={`admin-inline-status admin-inline-status-${miniTestStatus}`}>
                                    {getMaterialStatusLabel(miniTestStatus)}
                                  </small>
                                </button>
                                {isDraftWorkspace && (
                                  <div className="admin-section-sidebar-child-actions">
                                    <button
                                      type="button"
                                      className="admin-section-action-btn admin-section-action-btn-inline"
                                      aria-label={`Edit mini test ${section.name}`}
                                      onClick={() => openLearningEditor(section.code, 'quiz')}
                                      disabled={workflowSaving}
                                    >
                                      ✎
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <button
                  type="button"
                  className={adminView === 'soal' ? 'learning-sidebar-link learning-sidebar-link-active' : 'learning-sidebar-link'}
                  onClick={openQuestionView}
                >
                  <span className="admin-sidebar-link-copy">
                    <strong>Bank Soal</strong>
                    <small>
                      {draftTryoutQuestionCount > 0
                        ? `${draftTryoutQuestionCount} soal belum dipublish`
                        : `${questions.length} soal sudah sinkron`}
                    </small>
                  </span>
                  <span className={`admin-material-status-badge admin-material-status-badge-${tryoutStatus}`}>
                    {getMaterialStatusLabel(tryoutStatus)}
                  </span>
                </button>

                <button
                  type="button"
                  className={adminView === 'laporan' ? 'learning-sidebar-link learning-sidebar-link-active' : 'learning-sidebar-link'}
                  onClick={openReportView}
                >
                  <span className="admin-sidebar-link-copy">
                    <strong>Laporan Soal</strong>
                    <small>
                      {reportSummary.open > 0
                        ? `${reportSummary.open} laporan baru menunggu review`
                        : 'Pantau laporan user ke admin'}
                    </small>
                  </span>
                  <span className={`admin-material-status-badge admin-material-status-badge-${reportSummary.open > 0 ? 'draft' : 'published'}`}>
                    {reportSummary.open > 0 ? 'Baru' : 'Rapi'}
                  </span>
                </button>
              </div>
            </aside>

            <div className="learning-main-panel admin-user-main-panel">
              {adminView === 'dashboard' && (
                <section className="learning-dashboard-shell admin-user-dashboard-shell">
                  <div className="learning-dashboard-header">
                    <div>
                      <span className="account-package-tag">{selectedPackage?.category_name || 'Workspace admin'}</span>
                      <h2>{selectedPackage?.name || 'Panel Admin'}</h2>
                      <p>{selectedPackage?.description || 'Kelola materi, mini test, paket, dan bank soal dari satu workspace admin.'}</p>
                    </div>
                    <div className="learning-path-score" aria-label={`Cakupan admin ${adminCoveragePercent} persen`}>
                      <strong>{adminCoveragePercent}%</strong>
                      <span>progress</span>
                    </div>
                  </div>

                  <div className="learning-progress-track" aria-hidden="true">
                    <span style={{ width: `${adminCoveragePercent}%` }} />
                  </div>

                  <div className="learning-dashboard-focus admin-user-dashboard-focus">
                    <div className="learning-dashboard-card admin-user-dashboard-card">
                      <p className="learning-sidebar-label">Area kerja terakhir</p>
                      <h3>{activeLearningSection?.name || 'Pilih subtest'}</h3>
                      <p>
                        {activeLearningSection
                          ? `Kelola materi dan mini test untuk ${activeLearningSection.session_name || 'subtest aktif'}.`
                          : 'Pilih paket dan subtest untuk mulai mengelola konten.'}
                      </p>
                      <div className="learning-hero-actions">
                        {activeLearningSection && (
                          <button type="button" className="btn btn-primary" onClick={() => openLearningView(activeLearningSection.code)}>
                            Lanjutkan Kelola Materi
                          </button>
                        )}
                        <button type="button" className="btn btn-outline" onClick={openQuestionView}>
                          Buka Bank Soal
                        </button>
                      </div>
                    </div>

                    <div className="learning-summary-grid admin-user-summary-grid">
                      <div>
                        <span>Materi selesai</span>
                        <strong>{completedMaterialSections}/{selectedPackageSummary.sectionCount || 0}</strong>
                      </div>
                      <div>
                        <span>Mini test selesai</span>
                        <strong>{completedQuizSections}/{selectedPackageSummary.sectionCount || 0}</strong>
                      </div>
                      <div>
                        <span>Sisa tryout</span>
                        <strong>Admin</strong>
                      </div>
                    </div>
                  </div>

                  <div className="learning-path-list admin-dashboard-path-list">
                    {learningContent.map((section, index) => (
                      <article
                        key={section.code}
                        className={[
                          'learning-path-card',
                          section.code === activeLearningSection?.code ? 'learning-path-card-active' : '',
                          getMaterialTopics(section.material).length > 0 && (section.questions?.length || 0) > 0 ? 'learning-path-card-done' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        <span className="learning-path-index">{index + 1}</span>
                        <span className="learning-path-copy">
                          <strong>{section.name}</strong>
                          <small>{section.session_name || 'Subtest belajar'}</small>
                        </span>
                        <span className="learning-path-steps admin-dashboard-path-actions">
                          <button type="button" className="learning-path-step" onClick={() => openLearningView(section.code)}>
                            Materi
                          </button>
                          <button type="button" className="learning-path-step" onClick={() => openLearningEditor(section.code, 'quiz')}>
                            Mini test
                          </button>
                        </span>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {adminView === 'tipe-paket' && (
                <article className="learning-material admin-package-view-shell">
                  <div className="learning-material-header">
                    <div>
                      <span className="account-package-tag">Kelola Jenis Paket</span>
                      <h2>Daftar Tipe Paket Aktif</h2>
                      <p>
                        Pilih tipe paket yang ingin dikelola. Setelah itu admin masuk ke halaman daftar paket aktif di dalam tipe tersebut.
                      </p>
                    </div>
                  </div>

                  <div className="learning-page admin-package-form-page">
                    <div className="admin-package-type-list">
                      {packageTypes.map((type) => {
                        const typeId = Number(type.id);
                        const isActiveType = typeId === Number(selectedPackageTypeFilterId);

                        return (
                          <div
                            key={type.id}
                            className={isActiveType ? 'admin-package-type-card admin-package-type-card-active' : 'admin-package-type-card'}
                          >
                            <div>
                              <strong>{type.name}</strong>
                              <p>{type.description || 'Tanpa deskripsi'}</p>
                              <small>{packageTypeCounts[typeId] || 0} paket aktif</small>
                            </div>
                            <div className="admin-package-type-actions">
                              <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() => openPackageListView(typeId, adminWorkspace)}
                              >
                                Edit Paket
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger"
                                onClick={() => handlePackageTypeDelete(type)}
                                disabled={packageTypeDeleting}
                              >
                                {packageTypeDeleting ? 'Menghapus...' : 'Hapus'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </article>
              )}

              {adminView === 'edit-paket' && (
                <article className="learning-material admin-package-view-shell">
                  <div className="learning-material-header">
                    <div>
                      <span className="account-package-tag">Daftar Paket Aktif</span>
                      <h2>{selectedPackageTypeRecord?.name || 'Pilih Tipe Paket'}</h2>
                      <p>
                        {isDraftWorkspace
                          ? 'Pilih paket yang ingin diedit rinciannya dari daftar ini.'
                          : 'Review daftar paket live dalam tipe paket ini, lalu buka detail paket yang ingin dilihat.'}
                      </p>
                    </div>
                    <div className="learning-hero-actions">
                      <button type="button" className="btn btn-outline" onClick={() => navigateToPackageTypeView(adminWorkspace)}>
                        Kembali ke Tipe Paket
                      </button>
                    </div>
                  </div>

                  <div className="learning-page admin-package-form-page">
                    <div className="admin-section-header admin-list-toolbar">
                      <div>
                        <h3>Daftar Paket Aktif</h3>
                        <p className="text-muted">
                          Paket seperti &quot;CPNS Intensif Copy&quot; ditampilkan di dalam halaman ini, bukan lagi di luar.
                        </p>
                      </div>
                    </div>

                    <div className="admin-package-type-package-list">
                      {filteredPackages.length > 0 ? filteredPackages.map((pkg) => {
                        const packageStatus = normalizeMaterialStatus(packageStatusMap[Number(pkg.id)] || 'published');
                        const isActivePackage = Number(pkg.id) === Number(selectedPackage?.id || 0);
                        const packageTemporarilyDisabled = Boolean(Number(pkg.is_temporarily_disabled || 0));

                        return (
                          <div
                            key={pkg.id}
                            className={isActivePackage ? 'admin-package-type-package-item admin-package-type-package-item-active' : 'admin-package-type-package-item'}
                          >
                            <div className="admin-package-type-package-copy">
                              <strong>{pkg.name}</strong>
                              <p>{pkg.workflow?.sections?.length || 0} subtest • {TEST_MODE_OPTIONS.find((option) => option.value === pkg.test_mode)?.label || pkg.test_mode || 'Standard'}</p>
                              <div className="admin-inline-status-row">
                                <span className={`admin-inline-status admin-inline-status-${packageStatus}`}>
                                  {getMaterialStatusLabel(packageStatus)}
                                </span>
                                <span className="admin-inline-status-note">
                                  {packageStatus === 'draft' ? 'Ada perubahan paket yang belum dipublish.' : 'Paket sudah sinkron dengan versi live.'}
                                </span>
                              </div>
                            </div>
                            <div className="admin-package-type-actions">
                              <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() => openPackageEditor(Number(pkg.id), adminWorkspace)}
                              >
                                {isDraftWorkspace ? 'Edit Rincian Paket' : 'Lihat Rincian Paket'}
                              </button>
                              <button
                                type="button"
                                className={packageTemporarilyDisabled ? 'btn btn-outline' : 'btn btn-danger'}
                                onClick={() => handlePackageAvailabilityToggle(pkg)}
                                disabled={packageAvailabilitySaving}
                              >
                                {packageAvailabilitySaving
                                  ? 'Memproses...'
                                  : packageTemporarilyDisabled
                                    ? 'Aktifkan Lagi Paket'
                                    : 'Nonaktifkan Sementara'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger"
                                onClick={() => handleDeletePackage(pkg)}
                                disabled={packageDeleting || packages.length <= 1}
                              >
                                {packageDeleting ? 'Menghapus...' : 'Hapus Paket'}
                              </button>
                            </div>
                          </div>
                        );
                      }) : (
                        <div className="admin-package-type-package-item admin-package-type-package-item-empty">
                          <div className="admin-package-type-package-copy">
                            <strong>Belum ada paket</strong>
                            <p>Belum ada paket aktif di tipe ini.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              )}

              {adminView === 'rincian-paket' && (
                <article className="learning-material admin-package-view-shell">
                  <div className="learning-material-header">
                    <div>
                      <span className="account-package-tag">Rincian Paket</span>
                      <h2>{selectedPackage?.name || 'Paket aktif'}</h2>
                      <p>
                        {isDraftWorkspace
                          ? 'Halaman ini berisi rincian paket lengkap yang bisa diubah penuh oleh admin.'
                          : 'Halaman ini menampilkan rincian lengkap paket live untuk review.'}
                      </p>
                    </div>
                    <div className="learning-hero-actions">
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => openPackageListView(selectedPackageTypeFilterId || selectedPackage?.category_id || 0, adminWorkspace)}
                      >
                        Kembali ke Daftar Paket
                      </button>
                    </div>
                  </div>

                  {packageForm ? (
                    <>
                      <div className="learning-page admin-package-form-page admin-package-overview-shell">
                        <div className="admin-package-hero">
                          <div className="admin-package-hero-main">
                            <div className="admin-package-hero-copy">
                              <span className={`admin-workspace-mode-pill admin-workspace-mode-pill-${adminWorkspace}`}>
                                {isDraftWorkspace ? 'Paket Terpilih di Draft' : 'Paket Terpilih di Published'}
                              </span>
                              <h3>{selectedPackage?.name || 'Paket aktif'}</h3>
                              <p>
                                {isDraftWorkspace
                                  ? 'Bagian ini untuk mengubah rincian penuh paket yang Anda pilih.'
                                  : 'Bagian ini menampilkan detail penuh paket live yang Anda pilih.'}
                              </p>
                            </div>

                            <div className="admin-package-status-list">
                              <div className="admin-package-status-item">
                                <span>Status user</span>
                                <strong>{isPackageTemporarilyDisabled ? 'Nonaktif sementara / maintenance' : 'Aktif untuk user'}</strong>
                              </div>
                              <div className="admin-package-status-item">
                                <span>Mode edit</span>
                                <strong>{isDraftWorkspace ? 'Aman untuk revisi' : 'Review versi live'}</strong>
                              </div>
                              <div className="admin-package-status-item">
                                <span>Tipe paket</span>
                                <strong>{selectedPackageTypeName}</strong>
                              </div>
                              <div className="admin-package-status-item">
                                <span>Mode ujian</span>
                                <strong>{selectedPackageModeLabel}</strong>
                              </div>
                            </div>
                          </div>

                          <div className="admin-package-summary-grid">
                            <div className="admin-package-summary-card">
                              <span>Harga</span>
                              <strong>Rp {Number(packageForm.price || 0).toLocaleString('id-ID')}</strong>
                            </div>
                            <div className="admin-package-summary-card">
                              <span>Durasi akses</span>
                              <strong>{packageForm.duration_days} hari</strong>
                            </div>
                            <div className="admin-package-summary-card">
                              <span>Batas attempt</span>
                              <strong>{packageForm.max_attempts}x</strong>
                            </div>
                            <div className="admin-package-summary-card">
                              <span>Subtest aktif</span>
                              <strong>{packageSections.length}</strong>
                            </div>
                          </div>
                          <div className="admin-inline-status-row">
                            <span className={`admin-material-status-badge admin-material-status-badge-${selectedPackageWorkspaceStatus}`}>
                              {getMaterialStatusLabel(selectedPackageWorkspaceStatus)}
                            </span>
                            <span className="admin-inline-status-note">{selectedPackageWorkspaceNote}</span>
                          </div>
                        </div>
                      </div>

                      <div className="learning-page admin-package-form-page">
                        <div className="admin-section-header admin-list-toolbar">
                          <div>
                            <h3>Rincian Paket Lengkap</h3>
                            <p className="text-muted">
                              {isDraftWorkspace
                                ? 'Ubah nama, harga, durasi akses, setting inti, dan status paket dari sini.'
                                : 'Versi published hanya untuk review. Pindah ke Draft kalau ingin mengubah detail paket.'}
                            </p>
                          </div>
                        </div>

                        <form className="admin-package-form" onSubmit={handlePackageSave}>
                          <div className="account-form-grid">
                            <div className="form-group">
                              <label>Tipe Paket</label>
                              <select
                                name="category_id"
                                value={packageForm.category_id}
                                onChange={handlePackageChange}
                                disabled={!isDraftWorkspace}
                              >
                                {packageTypes.map((type) => (
                                  <option key={type.id} value={type.id}>
                                    {type.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="form-group">
                              <label>Nama Paket</label>
                              <input name="name" value={packageForm.name} onChange={handlePackageChange} disabled={!isDraftWorkspace} />
                            </div>
                            <div className="form-group">
                              <label>Mode Ujian</label>
                              <select
                                name="test_mode"
                                value={packageForm.test_mode}
                                onChange={handlePackageChange}
                                disabled={!isDraftWorkspace}
                              >
                                {TEST_MODE_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="form-group">
                              <label>Harga</label>
                              <input type="number" min="1000" name="price" value={packageForm.price} onChange={handlePackageChange} disabled={!isDraftWorkspace} />
                            </div>
                            <div className="form-group">
                              <label>Durasi Akses (hari)</label>
                              <input type="number" min="1" name="duration_days" value={packageForm.duration_days} onChange={handlePackageChange} disabled={!isDraftWorkspace} />
                            </div>
                            <div className="form-group">
                              <label>Batas Attempt</label>
                              <input type="number" min="1" name="max_attempts" value={packageForm.max_attempts} onChange={handlePackageChange} disabled={!isDraftWorkspace} />
                            </div>
                            <div className="form-group">
                              <label>Waktu Ujian (menit)</label>
                              <input
                                type="number"
                                min="1"
                                name="time_limit"
                                value={packageForm.time_limit}
                                onChange={handlePackageChange}
                                disabled={!isDraftWorkspace || packageForm.test_mode === 'cpns_cat' || packageForm.test_mode === 'utbk_sectioned'}
                              />
                            </div>
                            <div className="form-group form-group-full">
                              <label>Deskripsi</label>
                              <textarea name="description" rows="3" value={packageForm.description} onChange={handlePackageChange} disabled={!isDraftWorkspace} />
                            </div>
                          </div>

                          <div className="admin-package-readonly-grid">
                            {selectedPackage?.workflow && (
                              <div className="admin-package-readonly-card">
                                <span>Mekanisme Ujian</span>
                                <strong>{selectedPackage.workflow.label}</strong>
                                <p>
                                  {selectedPackage.workflow.allow_random_navigation
                                    ? 'Navigasi soal bebas antar bagian.'
                                    : 'Navigasi soal mengikuti subtest aktif.'}
                                </p>
                                <small>Total durasi {selectedPackage.workflow.total_duration_minutes} menit</small>
                              </div>
                            )}
                            <div className="admin-package-readonly-card">
                              <span>Struktur Paket</span>
                              <strong>{packageSections.length} subtest aktif</strong>
                              <p>
                                {packageSections.length > 0
                                  ? packageSections.map((section) => section.name).join(' • ')
                                  : 'Belum ada subtest aktif pada paket ini.'}
                              </p>
                              <small>{selectedPackageTypeName} • {selectedPackageModeLabel}</small>
                            </div>
                          </div>

                          <div className="account-form-actions">
                            {isDraftWorkspace ? (
                              <>
                                <button type="submit" className="btn btn-primary" disabled={packageSaving}>
                                  {packageSaving ? 'Menyimpan...' : 'Simpan Draft Paket'}
                                </button>
                              </>
                            ) : null}
                          </div>
                        </form>
                      </div>
                    </>
                  ) : (
                    <div className="learning-page admin-package-form-page">
                      <div className="admin-section-header admin-list-toolbar">
                        <div>
                          <h3>Belum Ada Paket Terpilih</h3>
                          <p className="text-muted">
                            Pilih salah satu paket dari daftar paket untuk membuka rincian edit lengkapnya.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              )}

              {adminView === 'materi' && (
                <article className="learning-material admin-material-view-shell">
                  <div className="learning-material-header">
                    <div>
                      <span className="account-package-tag">
                        {activeLearningSection?.session_name || selectedPackage?.category_name || 'Subtest'}
                      </span>
                      <h2>{activeLearningSection?.name || 'Pilih subtest'}</h2>
                      <p>
                        {activeLearningSection
                          ? learningEditorMode === 'quiz'
                            ? `Kelola mini test ${activeLearningSection.name} dengan editor yang fokus seperti bank soal tryout.`
                            : `Kelola materi dan mini test untuk ${activeLearningSection.name} tanpa bercampur dengan subtest lain.`
                          : 'Pilih subtest dari sidebar kiri untuk mulai mengelola materi.'}
                      </p>
                    </div>
                    {activeLearningSection && (
                      <div className="learning-hero-actions">
                        {isDraftWorkspace && activeMaterialTopic && learningEditorMode !== 'quiz' && (
                          <Link
                            to={`/admin/learning-material/${selectedPackageId}/${activeLearningSection.code}?topic=${activeMaterialTopicIndex || 0}&workspace=${adminWorkspace}`}
                            className="btn btn-primary"
                          >
                            Edit Topik Materi
                          </Link>
                        )}
                        {isDraftWorkspace ? (
                          <button type="button" className="btn btn-outline" onClick={() => openLearningEditor(activeLearningSection.code, learningEditorMode === 'quiz' ? '' : 'quiz')}>
                            {learningEditorMode === 'quiz' ? 'Kembali ke Materi' : 'Edit Mini Test'}
                          </button>
                        ) : (
                          <span className="text-muted">Published hanya untuk review.</span>
                        )}
                      </div>
                    )}
                  </div>

                  {activeLearningSection ? (
                    <>
                      <div className="learning-summary-grid admin-user-summary-grid">
                        <div>
                          <span>Topik materi</span>
                          <strong>{getMaterialTopics(activeLearningSection.material).length || 0}</strong>
                        </div>
                        <div>
                          <span>Mini test</span>
                          <strong>{learningEditorMode === 'quiz' ? learningQuestionsForm.length : activeLearningSection.questions?.length || 0}</strong>
                        </div>
                        <div>
                          <span>Kode subtest</span>
                          <strong>{activeLearningSection.code}</strong>
                        </div>
                      </div>
                      {learningEditorMode === 'quiz' ? (
                        <div className="admin-learning-editor-shell admin-learning-quiz-shell">
                          <section className="admin-mini-test-settings">
                            <div className="admin-mini-test-settings-head">
                              <div className="admin-mini-test-settings-copy">
                                <span className="admin-preview-eyebrow">Setting Waktu Mini Test</span>
                                <h3>{activeLearningSection.name}</h3>
                                <p className="text-muted">
                                  Isi langsung berapa menit durasi mini test untuk subtest ini. Timer user akan mengikuti angka ini saat mini test dimulai.
                                </p>
                              </div>
                              <div className="admin-mini-test-settings-actions">
                                {isDraftWorkspace && (
                                  <button
                                    type="button"
                                    className="btn btn-outline"
                                    onClick={() => handleMiniTestTimingEdit(activeLearningWorkflowSection || activeLearningSection)}
                                    disabled={workflowSaving}
                                  >
                                    {workflowSaving ? 'Menyimpan Waktu...' : 'Atur Waktu Mini Test'}
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="admin-mini-test-settings-grid">
                              <div className="admin-mini-test-settings-card">
                                <span>Durasi Mini Test</span>
                                <strong>{activeLearningWorkflowSection?.mini_test_duration_minutes ? `${activeLearningWorkflowSection.mini_test_duration_minutes} menit` : 'Belum diatur'}</strong>
                                <small>Dipakai langsung sebagai timer saat user mengerjakan mini test.</small>
                              </div>
                              <div className="admin-mini-test-settings-card">
                                <span>Durasi Subtest</span>
                                <strong>{activeLearningWorkflowSection?.duration_minutes ? `${activeLearningWorkflowSection.duration_minutes} menit` : 'Belum diatur'}</strong>
                                <small>Durasi workflow subtest. Tetap terpisah dari timer mini test.</small>
                              </div>
                              <div className="admin-mini-test-settings-card">
                                <span>Timer Mini Test Aktif</span>
                                <strong>{miniTestDurationMinutesLabel}</strong>
                                <small>{`${learningQuestionsForm.length} soal mini test aktif di editor ini.`}</small>
                              </div>
                            </div>
                          </section>

                          <div className="admin-question-editor-hero">
                            <div>
                              <span className="admin-preview-eyebrow">{activeLearningSection.name}</span>
                              <h3>Editor Mini Test</h3>
                              <p className="text-muted">
                                Daftar mini test sekarang mengikuti pola bank soal tryout: preview tetap di row yang dibuka, lalu edit detailnya pindah ke halaman khusus.
                              </p>
                              <p className="text-muted">
                                {isDraftWorkspace
                                  ? 'Gunakan tombol panah di kiri nomor soal untuk menaikkan atau menurunkan urutannya.'
                                  : 'Urutan mini test ditampilkan sesuai draft terbaru. Pindah urutan dilakukan dari workspace draft.'}
                              </p>
                            </div>
                            <div className="admin-question-editor-actions">
                              <button
                                type="button"
                                className="btn btn-outline"
                                onClick={handleMiniTestBulkExtractDownload}
                                disabled={!learningQuestionsForm.some((question) => hasQuestionExtractContent(question))}
                              >
                                Download Semua Extract
                              </button>
                              {isDraftWorkspace && (
                                <button
                                  type="button"
                                  className="btn btn-outline"
                                  onClick={handleCreateMiniTestQuestion}
                                >
                                  Tambah Soal
                                </button>
                              )}
                              <button type="button" className="btn btn-outline" onClick={() => setLearningEditorMode('')}>
                                Tutup Editor
                              </button>
                            </div>
                          </div>

                          <section className="account-card admin-panel-card admin-list-card admin-test-bank-shell">
                            <div className="admin-section-header admin-list-toolbar">
                              <div>
                                <h3>Daftar Soal Mini Test</h3>
                                <p className="text-muted">
                                  Buka detail soal dari row yang sama, lalu lanjutkan edit lengkapnya di halaman baru.
                                </p>
                              </div>
                            </div>

                            <div className="admin-question-table admin-question-table-modern">
                              <div className="admin-question-table-head">
                                <span>#</span>
                                <span>Pertanyaan</span>
                                <span>Kategori</span>
                                <span>Opsi</span>
                                <span>Aksi</span>
                              </div>
                              {learningQuestionsForm.map((question, questionIndex) => {
                                const rowKey = getLearningQuestionRowKey(question, questionIndex);
                                const isExpanded = expandedLearningQuestionKey === rowKey;
                                const editorTargetId = Number(question.id || 0) > 0 ? String(question.id) : 'new';
                                const editorOptions = Number(question.id || 0) > 0 ? {} : { draftIndex: questionIndex };
                                const learningQuestionStatus = normalizeMaterialStatus(question.status);
                                const canMoveLearningUp = questionIndex > 0;
                                const canMoveLearningDown = questionIndex < learningQuestionsForm.length - 1;

                                return (
                                  <div
                                    key={rowKey}
                                    className={[
                                      'admin-question-row-wrap',
                                      'admin-question-row-wrap-modern',
                                      isExpanded ? 'admin-question-row-wrap-expanded' : '',
                                    ].filter(Boolean).join(' ')}
                                  >
                                    <div className="admin-question-row">
                                      <div className="admin-question-order-controls">
                                        <button
                                          type="button"
                                          className="admin-question-order-move"
                                          onClick={() => handleMoveLearningQuestion(questionIndex, -1)}
                                          disabled={learningQuestionOrderLocked || !canMoveLearningUp}
                                          aria-label={`Naikkan urutan soal mini test ${Number(question.question_order || questionIndex + 1)}`}
                                        >
                                          ↑
                                        </button>
                                        <div className="admin-question-order-index">
                                          {Number(question.question_order || questionIndex + 1)}
                                        </div>
                                        <button
                                          type="button"
                                          className="admin-question-order-move"
                                          onClick={() => handleMoveLearningQuestion(questionIndex, 1)}
                                          disabled={learningQuestionOrderLocked || !canMoveLearningDown}
                                          aria-label={`Turunkan urutan soal mini test ${Number(question.question_order || questionIndex + 1)}`}
                                        >
                                          ↓
                                        </button>
                                      </div>

                                      <div className="admin-question-row-main">
                                        <LatexContent
                                          content={question.question_text}
                                          placeholder={`Soal ${questionIndex + 1}`}
                                          className="admin-question-row-snippet"
                                        />
                                        <p>
                                          {question.question_image_url ? 'Ada gambar soal' : 'Tanpa gambar soal'}
                                        </p>
                                      </div>

                                      <div className="admin-question-row-meta">
                                        <span className="account-package-tag">{question.material_topic || 'Belum pilih topik'}</span>
                                        <span className={`admin-material-status-badge admin-material-status-badge-${learningQuestionStatus}`}>
                                          {getMaterialStatusLabel(learningQuestionStatus)}
                                        </span>
                                      </div>

                                      <div className="admin-question-row-count">
                                        {(question.options || []).filter((option) => option.text || option.image_url).length || (question.options || []).length} opsi
                                      </div>

                                      <div className="admin-question-row-actions">
                                        <button
                                          type="button"
                                          className="btn btn-outline"
                                          onClick={() => setExpandedLearningQuestionKey(isExpanded ? '' : rowKey)}
                                        >
                                          {isExpanded ? 'Aktif' : 'Lihat'}
                                        </button>
                                        {isDraftWorkspace && (
                                          <button
                                            type="button"
                                            className="btn btn-danger"
                                            onClick={() => removeLearningQuestion(questionIndex)}
                                            disabled={learningQuestionsForm.length <= 1}
                                          >
                                            Hapus
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {isExpanded && (
                                      <div className="admin-question-row-detail">
                                        <div className="admin-question-row-detail-main">
                                          <div>
                                            <LatexContent
                                              content={question.question_text}
                                              placeholder={`Soal ${questionIndex + 1}`}
                                              className="admin-question-rich-title"
                                            />
                                            <p className="text-muted">
                                              {question.material_topic
                                                ? `Soal No. ${Number(question.question_order || questionIndex + 1)} • ${activeLearningSection.name} • ${question.material_topic}`
                                                : `Soal No. ${Number(question.question_order || questionIndex + 1)} • ${activeLearningSection.name}`}
                                            </p>
                                          </div>
                                          <AdminImagePreview
                                            src={question.question_image_url}
                                            alt={`Preview mini test ${questionIndex + 1}`}
                                            className="admin-question-preview-image"
                                          />
                                        </div>

                                        <div className="admin-question-preview-actions">
                                          <button
                                            type="button"
                                            className="btn btn-outline"
                                            onClick={() => handleMiniTestExtractDownload(question)}
                                          >
                                            Download Soal Ini
                                          </button>
                                          {isDraftWorkspace && (
                                            <button
                                              type="button"
                                              className="btn btn-primary"
                                              onClick={() => openMiniTestQuestionEditor(activeLearningSection.code, editorTargetId, editorOptions)}
                                            >
                                              Edit Soal
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            className="btn btn-outline"
                                            onClick={() => {
                                              setExpandedLearningQuestionKey('');
                                            }}
                                          >
                                            Tutup Detail
                                          </button>
                                        </div>

                                        <div className="admin-question-options-preview-grid">
                                          {(question.options || []).map((option, optionIndex) => (
                                            <div key={`learning-preview-option-${rowKey}-${option.letter}-${optionIndex}`} className="admin-option-preview-card">
                                              <div className="admin-option-preview-head">
                                                <strong>{option.letter}.</strong>
                                                {usesLearningPointScoring ? (
                                                  <span className="admin-correct-badge">{getOptionScoreWeight(option)} poin</span>
                                                ) : option.is_correct && (
                                                  <span className="admin-correct-badge">Jawaban Benar</span>
                                                )}
                                              </div>
                                              <LatexContent
                                                content={option.text}
                                                placeholder="Opsi berbasis gambar"
                                                className="admin-option-preview-text"
                                              />
                                              <AdminImagePreview
                                                src={option.image_url}
                                                alt={`Opsi ${option.letter}`}
                                                className="admin-option-preview-image"
                                              />
                                            </div>
                                          ))}
                                        </div>
                                        {question.explanation_notes && (
                                          <div className="admin-inline-note">
                                            <strong>Pembahasan mini test</strong>
                                            <LatexContent
                                              content={question.explanation_notes}
                                              className="admin-rich-note-text"
                                            />
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {isDraftWorkspace && (
                              <div className="account-form-actions admin-question-list-footer-actions">
                                <button
                                  type="button"
                                  className="btn btn-outline"
                                  onClick={handleCreateMiniTestQuestion}
                                >
                                  Tambah Soal
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  onClick={handleLearningQuestionsSave}
                                  disabled={learningQuestionsSaving}
                                >
                                  {learningQuestionsSaving ? 'Menyimpan Mini Test...' : 'Simpan Mini Test'}
                                </button>
                              </div>
                            )}
                          </section>
                        </div>
                      ) : (
                        <div className="learning-page-list">
                          {activeMaterialTopic ? (
                            <>
                              <section className="learning-page">
                                <span>Topik materi aktif</span>
                                <h3>{activeMaterialTopic.title || `Topik ${Number(activeMaterialTopicIndex) + 1}`}</h3>
                                <div className="admin-inline-status-row">
                                  <span className={`admin-material-status-badge admin-material-status-badge-${getTopicStatus(activeLearningSection.material, activeMaterialTopicIndex || 0)}`}>
                                    {getMaterialStatusLabel(getTopicStatus(activeLearningSection.material, activeMaterialTopicIndex || 0))}
                                  </span>
                                </div>
                                <p>
                                  {(activeMaterialTopic.pages || []).length > 0
                                    ? `${(activeMaterialTopic.pages || []).length} halaman siap ditinjau.`
                                    : 'Topik ini masih kosong. Jika ingin mulai mengisi materi, klik Edit Topik Materi.'}
                                </p>
                              </section>

                              {(activeMaterialTopic.pages || []).map((page, pageIndex) => (
                                <section
                                  key={`${activeLearningSection.code}-preview-page-${pageIndex}`}
                                  className="learning-page learning-page-document"
                                >
                                  <span>{`Halaman ${pageIndex + 1}`}</span>
                                  {page.content_html ? (
                                    <div
                                      className="learning-rich-content"
                                      dangerouslySetInnerHTML={{ __html: sanitizeMaterialHtml(page.content_html) }}
                                    />
                                  ) : (
                                    <>
                                      {(page.points || []).length > 0 && (
                                        <ul>
                                          {(page.points || []).map((point, pointIndex) => (
                                            <li key={`${activeLearningSection.code}-point-${pageIndex}-${pointIndex}`}>{point}</li>
                                          ))}
                                        </ul>
                                      )}
                                      {page.closing && <p>{page.closing}</p>}
                                    </>
                                  )}
                                </section>
                              ))}
                            </>
                          ) : (
                            <section className="learning-page">
                              <span>Materi aktif</span>
                              <h3>{activeLearningSection.material?.title || activeLearningSection.name}</h3>
                              <p>Subtest ini belum punya topik materi. Tambahkan topik baru dari sidebar kiri.</p>
                            </section>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="learning-page-list">
                      <section className="learning-page">
                        <span>Materi aktif</span>
                        <h3>Belum ada subtest dipilih</h3>
                        <p>Pilih subtest dari sidebar kiri agar detail materinya tampil di sini.</p>
                      </section>
                    </div>
                  )}
                </article>
              )}

              {adminView === 'soal' && (
                <div className="admin-grid admin-grid-questions admin-grid-questions-collapsed">
                  <section className="account-card admin-main-card admin-panel-card admin-list-card admin-test-bank-shell">
                    <div className="admin-section-header admin-list-toolbar">
                      <div>
                        <h2>Bank Soal</h2>
                        <p className="text-muted">
                          {selectedPackage ? `${selectedPackage.name} • ${filteredQuestions.length}/${questions.length} soal tampil` : 'Pilih paket terlebih dahulu'}
                        </p>
                        <p className="text-muted">
                          {isDraftWorkspace
                            ? 'Gunakan tombol panah di kiri nomor soal untuk memindahkan urutan dalam subtes yang sama.'
                            : 'Nomor soal mengikuti urutan live. Ubah urutan dari workspace draft jika perlu.'}
                        </p>
                        {selectedPackage && (
                          <div className="admin-inline-status-row">
                            <span className={`admin-material-status-badge admin-material-status-badge-${tryoutStatus}`}>
                              {getMaterialStatusLabel(tryoutStatus)}
                            </span>
                            <span className="admin-inline-status-note">
                              {draftTryoutQuestionCount > 0
                                ? `${draftTryoutQuestionCount} soal punya update terbaru yang belum dipublish.`
                                : 'Semua soal tryout sudah sinkron dengan versi published.'}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="admin-list-toolbar-actions">
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={handleTryoutBulkExtractDownload}
                          disabled={filteredQuestions.filter((question) => hasQuestionExtractContent(question)).length === 0}
                        >
                          Download Semua Extract
                        </button>
                        <select
                          name="question_section_filter"
                          value={questionSectionFilter}
                          onChange={(event) => setQuestionSectionFilter(event.target.value)}
                          className="admin-search-input admin-section-filter"
                        >
                          <option value="">Semua subtes</option>
                          {sectionStats.map((section) => (
                            <option key={section.code} value={section.code}>
                              {section.sessionName ? `${section.sessionName} • ` : ''}
                              {section.name} ({section.count})
                            </option>
                          ))}
                        </select>
                        <input
                          name="question_search"
                          type="search"
                          value={questionQuery}
                          onChange={(event) => setQuestionQuery(event.target.value)}
                          placeholder="Cari soal atau section"
                          className="admin-search-input"
                        />
                        {isDraftWorkspace && (
                          <button type="button" className="btn btn-primary" onClick={handleCreateQuestion}>
                            Tambah Soal
                          </button>
                        )}
                      </div>
                    </div>

                    {sectionStats.length > 0 && (
                      <div className="admin-section-summary">
                        <button
                          type="button"
                          className={`admin-section-summary-chip ${questionSectionFilter === '' ? 'admin-section-summary-chip-active' : ''}`}
                          onClick={() => setQuestionSectionFilter('')}
                        >
                          <span>Semua Subtes</span>
                          <div className="admin-section-summary-chip-footer">
                            <strong>{questions.length}</strong>
                            <small className={`admin-inline-status admin-inline-status-${tryoutStatus}`}>
                              {getMaterialStatusLabel(tryoutStatus)}
                            </small>
                          </div>
                        </button>
                        {sectionStats.map((section) => (
                          <button
                            key={section.code}
                            type="button"
                            className={`admin-section-summary-chip ${questionSectionFilter === section.code ? 'admin-section-summary-chip-active' : ''}`}
                            onClick={() => setQuestionSectionFilter(section.code)}
                          >
                            <span>{section.name}</span>
                            <div className="admin-section-summary-chip-footer">
                              <strong>{section.count}</strong>
                              <small className={`admin-inline-status admin-inline-status-${section.status}`}>
                                {section.draftCount > 0 ? `${section.draftCount} draft` : 'Published'}
                              </small>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {isDraftWorkspace && (
                    <div className="admin-import-card">
                      <div>
                        <h3>Import Pertanyaan CSV / Excel</h3>
                        <p className="text-muted">
                          Download template, edit di Excel/Google Sheets, lalu upload kembali sebagai CSV. Soal tryout akan diacak per subtes saat attempt dimulai, jadi template tidak lagi memakai urutan soal. Tandai jawaban benar dengan awalan <strong>*</strong>, misalnya <strong>*Jakarta</strong>.
                        </p>
                      </div>
                      <div className="admin-import-actions">
                        <button type="button" className="btn btn-outline" onClick={handleDownloadTemplate}>
                          Unduh Template
                        </button>
                        <label className="btn btn-outline admin-file-button">
                          Pilih File CSV
                          <input name="question_import_file" type="file" accept=".csv,text/csv" onChange={handleImportFileChange} hidden />
                        </label>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={handleImportQuestions}
                          disabled={importingQuestions || importRows.length === 0}
                        >
                          {importingQuestions ? 'Mengimport...' : `Import ${importRows.length || ''} Soal`.trim()}
                        </button>
                      </div>
                      {(importFileName || importRows.length > 0) && (
                        <p className="admin-import-note">
                          File siap: <strong>{importFileName || 'Template diproses'}</strong> • {importRows.length} soal terdeteksi.
                        </p>
                      )}
                    </div>
                    )}

                    {loadingQuestions ? (
                      <p>Memuat soal...</p>
                    ) : filteredQuestions.length === 0 ? (
                      <div className="admin-empty-state">
                        <p className="text-muted">Belum ada soal yang cocok untuk ditampilkan.</p>
                        {isDraftWorkspace && (
                          <button type="button" className="btn btn-outline" onClick={handleCreateQuestion}>
                            Tambah Soal
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="admin-question-table admin-question-table-modern">
                        <div className="admin-question-table-head">
                          <span>#</span>
                          <span>Pertanyaan</span>
                          <span>Section</span>
                          <span>Opsi</span>
                          <span>Aksi</span>
                        </div>
                        {filteredQuestions.map((question) => {
                          const isExpanded = Number(expandedQuestionId) === Number(question.id);
                          const tryoutQuestionStatus = normalizeMaterialStatus(question.status);
                          const sectionSiblingQuestions = questions.filter(
                            (item) => String(item.section_code || '') === String(question.section_code || '')
                          );
                          const sectionSiblingIndex = sectionSiblingQuestions.findIndex(
                            (item) => Number(item.id) === Number(question.id)
                          );
                          const canMoveTryoutUp = sectionSiblingIndex > 0;
                          const canMoveTryoutDown = sectionSiblingIndex >= 0 && sectionSiblingIndex < sectionSiblingQuestions.length - 1;
                          return (
                            <div
                              key={question.id}
                              className={[
                                'admin-question-row-wrap',
                                'admin-question-row-wrap-modern',
                                isExpanded ? 'admin-question-row-wrap-expanded' : '',
                              ].filter(Boolean).join(' ')}
                            >
                              <div className="admin-question-row">
                                <div className="admin-question-order-controls">
                                  <button
                                    type="button"
                                    className="admin-question-order-move"
                                    onClick={() => handleMoveTryoutQuestion(question.id, -1)}
                                    disabled={tryoutQuestionOrderLocked || !canMoveTryoutUp}
                                    aria-label={`Naikkan urutan soal ${Number(question.question_order || 1)}`}
                                  >
                                    ↑
                                  </button>
                                  <div className="admin-question-order-index">
                                    {Number(question.question_order || 1)}
                                  </div>
                                  <button
                                    type="button"
                                    className="admin-question-order-move"
                                    onClick={() => handleMoveTryoutQuestion(question.id, 1)}
                                    disabled={tryoutQuestionOrderLocked || !canMoveTryoutDown}
                                    aria-label={`Turunkan urutan soal ${Number(question.question_order || 1)}`}
                                  >
                                    ↓
                                  </button>
                                </div>

                                <div className="admin-question-row-main">
                                  <LatexContent
                                    content={question.question_text}
                                    placeholder="Soal berbasis gambar"
                                    className="admin-question-row-snippet"
                                  />
                                  <p>
                                    {question.question_image_url ? 'Ada gambar soal' : 'Tanpa gambar soal'}
                                  </p>
                                </div>

                                <div className="admin-question-row-meta">
                                  <span className="account-package-tag">{question.section_name || 'Bagian umum'}</span>
                                  <span className={`admin-material-status-badge admin-material-status-badge-${tryoutQuestionStatus}`}>
                                    {getMaterialStatusLabel(tryoutQuestionStatus)}
                                  </span>
                                </div>

                                <div className="admin-question-row-count">
                                  {(question.options || []).length} opsi
                                </div>

                                <div className="admin-question-row-actions">
                                  <button type="button" className="btn btn-outline" onClick={() => handleQuestionEdit(question)}>
                                    {isDraftWorkspace ? (isExpanded ? 'Aktif' : 'Edit') : 'Lihat'}
                                  </button>
                                  {isDraftWorkspace && (
                                    <button type="button" className="btn btn-danger" onClick={() => handleQuestionDelete(question.id)}>
                                      Hapus
                                    </button>
                                  )}
                                </div>
                              </div>

                              {isExpanded && (
                                <div className="admin-question-row-detail">
                                  <div className="admin-question-row-detail-main">
                                    <div>
                                      <LatexContent
                                        content={question.question_text}
                                        placeholder="Soal berbasis gambar"
                                        className="admin-question-rich-title"
                                      />
                                      <p className="text-muted">
                                        Soal No. {Number(question.question_order || 1)} • {question.section_name || 'Bagian umum'}
                                      </p>
                                    </div>
                                    <AdminImagePreview
                                      src={question.question_image_url}
                                      alt={`Preview soal ${question.id}`}
                                      className="admin-question-preview-image"
                                    />
                                  </div>

                                  <div className="admin-question-preview-actions">
                                    <button
                                      type="button"
                                      className="btn btn-outline"
                                      onClick={() => handleTryoutExtractDownload(question)}
                                    >
                                      Download Soal Ini
                                    </button>
                                    {isDraftWorkspace && (
                                      <Link
                                        className="btn btn-primary"
                                        to={`/admin/question-editor/${selectedPackageId}/${question.id}?workspace=${adminWorkspace}`}
                                      >
                                        Edit Soal
                                      </Link>
                                    )}
                                    <button
                                      type="button"
                                      className="btn btn-outline"
                                      onClick={() => {
                                        setExpandedQuestionId(null);
                                      }}
                                    >
                                      Tutup Detail
                                    </button>
                                  </div>

                                  <div className="admin-question-options-preview-grid">
                                    {(question.options || []).map((option) => (
                                      <div key={option.id || `${question.id}-${option.letter}`} className="admin-option-preview-card">
                                        <div className="admin-option-preview-head">
                                          <strong>{option.letter}.</strong>
                                          {isTkpSection({ code: question.section_code, name: question.section_name }) ? (
                                            <span className="admin-correct-badge">{getOptionScoreWeight(option)} poin</span>
                                          ) : Number(option.is_correct) > 0 && (
                                            <span className="admin-correct-badge">Jawaban Benar</span>
                                          )}
                                        </div>
                                        <LatexContent
                                          content={option.text}
                                          placeholder="Opsi berbasis gambar"
                                          className="admin-option-preview-text"
                                        />
                                        <AdminImagePreview
                                          src={option.image_url}
                                          alt={`Opsi ${option.letter}`}
                                          className="admin-option-preview-image"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                  {question.explanation_notes && (
                                    <div className="admin-inline-note">
                                      <strong>Pembahasan soal</strong>
                                      <LatexContent
                                        content={question.explanation_notes}
                                        className="admin-rich-note-text"
                                      />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {isDraftWorkspace && filteredQuestions.length > 0 && !loadingQuestions && (
                      <div className="account-form-actions admin-question-list-footer-actions">
                        <button type="button" className="btn btn-outline" onClick={handleCreateQuestion}>
                          Tambah Soal
                        </button>
                      </div>
                    )}
                  </section>
                </div>
              )}

              {adminView === 'laporan' && (
                <section className="account-card admin-main-card admin-panel-card admin-report-shell">
                  <div className="admin-section-header admin-list-toolbar">
                    <div>
                      <h2>Laporan Soal User</h2>
                      <p className="text-muted">
                        {selectedPackage
                          ? `Filter paket aktif: ${selectedPackage.name}`
                          : 'Menampilkan laporan dari semua paket yang masuk ke admin.'}
                      </p>
                    </div>
                    <div className="admin-list-toolbar-actions">
                      <select
                        name="report_status_filter"
                        value={reportStatusFilter}
                        onChange={(event) => setReportStatusFilter(event.target.value)}
                        className="admin-search-input admin-section-filter"
                      >
                        <option value="open">Laporan Baru</option>
                        <option value="reviewed">Sudah Ditinjau</option>
                        <option value="resolved">Sudah Selesai</option>
                        <option value="all">Semua Status</option>
                      </select>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => loadAdminReports(selectedPackageId, reportStatusFilter)}
                        disabled={loadingReports}
                      >
                        {loadingReports ? 'Memuat...' : 'Refresh Laporan'}
                      </button>
                    </div>
                  </div>

                  <div className="admin-report-summary-grid">
                    {[
                      { key: 'all', label: 'Total', value: reportSummary.all },
                      { key: 'open', label: 'Baru', value: reportSummary.open },
                      { key: 'reviewed', label: 'Ditinjau', value: reportSummary.reviewed },
                      { key: 'resolved', label: 'Selesai', value: reportSummary.resolved },
                    ].map((item) => (
                      <article key={item.key} className="admin-report-summary-card">
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                        <small>{item.key === 'all' ? 'Semua laporan paket terpilih' : `Status ${item.label.toLowerCase()}`}</small>
                      </article>
                    ))}
                  </div>

                  {loadingReports ? (
                    <p>Memuat laporan soal...</p>
                  ) : reports.length === 0 ? (
                    <div className="admin-empty-state">
                      <p className="text-muted">Belum ada laporan yang cocok dengan filter ini.</p>
                    </div>
                  ) : (
                    <div className="admin-report-list">
                      {reports.map((report) => (
                        <article key={report.id} className="admin-report-card">
                          <div className="admin-report-card-head">
                            <div className="admin-report-badge-row">
                              <span className={`admin-report-status admin-report-status-${report.status}`}>
                                {formatQuestionReportStatusLabel(report.status)}
                              </span>
                              <span className="account-package-tag">{formatQuestionReportAssessmentType(report.assessment_type)}</span>
                              <span className="account-package-tag">{formatQuestionReportTargetLabel(report.target_type)}</span>
                              <span className="account-package-tag">{formatQuestionReportOriginLabel(report.origin_context)}</span>
                            </div>
                            <div className="admin-report-meta">
                              <strong>{report.reporter?.full_name || 'User'}</strong>
                              <span>{report.reporter?.email || '-'}</span>
                              <small>{formatAdminReportTimestamp(report.created_at)}</small>
                            </div>
                          </div>

                          <div className="admin-report-context">
                            <h3>
                              {report.section_label || report.package_name || 'Paket aktif'}
                              {report.question_number > 0 ? ` • Soal ${report.question_number}` : ''}
                            </h3>
                            <p>{report.package_name || 'Paket tanpa nama'} • {report.category_name || 'Kategori umum'}</p>
                            <small>{truncateQuestionReportText(report.current_question_text || report.reported_content_snapshot, 140) || 'Soal berbasis gambar atau konten kosong.'}</small>
                          </div>

                          <div className="admin-inline-note admin-report-snapshot">
                            <strong>
                              {report.target_type === 'explanation'
                                ? 'Snapshot pembahasan saat dilaporkan'
                                : 'Snapshot soal saat dilaporkan'}
                            </strong>
                            <LatexContent
                              content={report.reported_content_snapshot || report.current_question_text}
                              placeholder="Konten snapshot kosong, kemungkinan soal berbasis gambar."
                              className="admin-rich-note-text"
                            />
                            {report.current_question_image_url && (
                              <AdminImagePreview
                                src={report.current_question_image_url}
                                alt={`Lampiran konteks soal ${report.id}`}
                                className="admin-report-image"
                              />
                            )}
                          </div>

                          {report.target_type === 'explanation' && report.current_explanation_notes && (
                            <div className="admin-inline-note">
                              <strong>Pembahasan aktif sekarang</strong>
                              <LatexContent
                                content={report.current_explanation_notes}
                                className="admin-rich-note-text"
                              />
                            </div>
                          )}

                          <div className="admin-inline-note admin-report-user-note">
                            <strong>Catatan user</strong>
                            <p className="admin-rich-note-text">
                              {report.message || 'User hanya mengirim lampiran gambar tanpa catatan teks.'}
                            </p>
                            {report.image_url && (
                              <div className="admin-report-attachment">
                                <a href={report.image_url} target="_blank" rel="noreferrer" className="btn btn-outline">
                                  Buka Lampiran
                                </a>
                                <AdminImagePreview
                                  src={report.image_url}
                                  alt={`Lampiran laporan ${report.id}`}
                                  className="admin-report-image"
                                />
                              </div>
                            )}
                          </div>

                          <div className="admin-report-actions">
                            {report.status !== 'open' && (
                              <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() => handleReportStatusUpdate(report.id, 'open')}
                                disabled={reportStatusSavingId === Number(report.id)}
                              >
                                {reportStatusSavingId === Number(report.id) ? 'Menyimpan...' : 'Buka Lagi'}
                              </button>
                            )}
                            {report.status !== 'reviewed' && (
                              <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() => handleReportStatusUpdate(report.id, 'reviewed')}
                                disabled={reportStatusSavingId === Number(report.id)}
                              >
                                {reportStatusSavingId === Number(report.id) ? 'Menyimpan...' : 'Tandai Ditinjau'}
                              </button>
                            )}
                            {report.status !== 'resolved' && (
                              <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => handleReportStatusUpdate(report.id, 'resolved')}
                                disabled={reportStatusSavingId === Number(report.id)}
                              >
                                {reportStatusSavingId === Number(report.id) ? 'Menyimpan...' : 'Tandai Selesai'}
                              </button>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>
          </section>

          {false && adminView === 'materi' && (
          <section className="account-card admin-main-card admin-panel-card admin-learning-card admin-learning-crud-shell">
            <div className="admin-section-header admin-list-toolbar">
              <div>
                <h2>Materi & Mini Test Subtest</h2>
                <p className="text-muted">Edit materi ruang belajar dan 5 soal mini test per subtest.</p>
              </div>
              <div className="admin-list-toolbar-actions">
                <select
                  name="learning_section_filter"
                  value={learningSectionCode}
                  onChange={(event) => setLearningSectionCode(event.target.value)}
                  className="admin-search-input admin-section-filter"
                >
                  {learningContent.map((section) => (
                    <option key={section.code} value={section.code}>
                      {section.session_name ? `${section.session_name} • ` : ''}
                      {section.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loadingLearningContent ? (
              <p>Memuat materi subtest...</p>
            ) : activeLearningSection ? (
              <>
                <div className="admin-learning-overview-grid admin-learning-overview-grid-modern">
                  {learningContent.map((section) => {
                    const pageCount = section.material?.pages?.length || 0;
                    const questionCount = section.questions?.length || 0;
                    const isActive = section.code === activeLearningSection.code;
                    const materialStatus = normalizeMaterialStatus(section.material?.status);

                    return (
                      <article
                        key={section.code}
                        className={`admin-learning-overview-card admin-learning-overview-card-modern ${isActive ? 'admin-learning-overview-card-active' : ''}`}
                      >
                        <span className="account-package-tag">{section.session_name || 'Subtest'}</span>
                        <h3>{section.name}</h3>
                        <span className={`admin-material-status-badge admin-material-status-badge-${materialStatus}`}>
                          {getMaterialStatusLabel(materialStatus)}
                        </span>
                        <p>{section.material?.title || 'Materi belum diberi judul'}</p>
                        <div className="admin-learning-overview-stats">
                          <span>{pageCount} topik materi</span>
                          <span>{questionCount} soal mini test</span>
                        </div>
                        <div className="admin-learning-overview-actions">
                          <Link
                            to={`/admin/learning-material/${selectedPackageId}/${section.code}?topic=0`}
                            className="btn btn-primary"
                          >
                            Edit Materi
                          </Link>
                          <button type="button" className="btn btn-outline" onClick={() => openLearningEditor(section.code, 'quiz')}>
                            Edit Mini Test
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {learningEditorMode === 'quiz' && (
                  <div className="admin-learning-editor-shell admin-learning-quiz-shell">
                    <div className="admin-section-header admin-section-header-compact">
                      <div>
                        <span className="account-package-tag">{activeLearningSection.name}</span>
                        <h3>Editor Mini Test</h3>
                        <p className="text-muted">Disarankan 5 soal singkat untuk milestone subtest.</p>
                      </div>
                      <div className="admin-list-toolbar-actions">
                        <button type="button" className="btn btn-outline" onClick={addLearningQuestion}>
                          Tambah Soal
                        </button>
                        <button type="button" className="btn btn-outline" onClick={() => setLearningEditorMode('')}>
                          Tutup Editor
                        </button>
                      </div>
                    </div>

                    <div className="admin-learning-question-list">
                      {learningQuestionsForm.map((question, questionIndex) => (
                        <div key={`learning-question-${questionIndex}`} className="admin-learning-page-card admin-learning-question-card-modern">
                          <div className="admin-option-editor-head">
                            <strong>Soal {questionIndex + 1}</strong>
                            <button
                              type="button"
                              className="btn btn-outline admin-option-delete"
                              onClick={() => removeLearningQuestion(questionIndex)}
                              disabled={learningQuestionsForm.length <= 1}
                            >
                              Hapus
                            </button>
                          </div>
                          <div className="form-group">
                            <label>Pertanyaan</label>
                            <textarea
                              name={`learning_question_text_${questionIndex}`}
                              rows="3"
                              value={question.question_text}
                              onChange={(event) => updateLearningQuestion(questionIndex, 'question_text', event.target.value)}
                            />
                          </div>
                          <div className="account-form-grid">
                            <div className="form-group">
                              <label>Kategori Topik Materi</label>
                              <select
                                name={`learning_question_material_topic_${questionIndex}`}
                                value={question.material_topic || ''}
                                onChange={(event) => updateLearningQuestion(questionIndex, 'material_topic', event.target.value)}
                              >
                                <option value="">Pilih topik materi</option>
                                {activeMaterialTopics.map((topic, topicIndex) => {
                                  const topicTitle = String(topic?.title || `Topik ${topicIndex + 1}`).trim();
                                  return (
                                    <option key={`legacy-learning-topic-${questionIndex}-${topicTitle}`} value={topicTitle}>
                                      {topicTitle}
                                    </option>
                                  );
                                })}
                              </select>
                              <small className="text-muted">Dipakai untuk menandai soal mini test ini masuk ke topik materi yang mana.</small>
                            </div>
                          </div>
                          <div className="admin-options-editor-list">
                            {(question.options || []).map((option, optionIndex) => (
                              <div key={`learning-option-${questionIndex}-${optionIndex}`} className="admin-option-row">
                                {usesLearningPointScoring ? (
                                  <label className="admin-point-control">
                                    <span>Poin</span>
                                    <select
                                      value={getOptionScoreWeight(option, Math.min(5, optionIndex + 1))}
                                      onChange={(event) => updateLearningQuestionOption(questionIndex, optionIndex, 'score_weight', Number(event.target.value))}
                                    >
                                      {[1, 2, 3, 4, 5].map((point) => (
                                        <option key={point} value={point}>
                                          {point}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                ) : (
                                  <button
                                    type="button"
                                    className={`admin-correct-toggle ${option.is_correct ? 'admin-correct-toggle-active' : ''}`}
                                    onClick={() => setLearningQuestionCorrectOption(questionIndex, optionIndex)}
                                  >
                                    {option.is_correct ? 'Benar' : 'Pilih'}
                                  </button>
                                )}
                                <strong>{option.letter}</strong>
                                <input
                                  name={`learning_option_text_${questionIndex}_${optionIndex}`}
                                  value={option.text}
                                  onChange={(event) => updateLearningQuestionOption(questionIndex, optionIndex, 'text', event.target.value)}
                                  placeholder={`Opsi ${option.letter}`}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleLearningQuestionsSave}
                      disabled={learningQuestionsSaving}
                    >
                      {learningQuestionsSaving ? 'Menyimpan Mini Test...' : 'Simpan Mini Test'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted">Pilih paket untuk mengelola materi dan mini test.</p>
            )}
          </section>
          )}

          {false && adminView === 'soal' && (
          <div className={`admin-grid admin-grid-questions ${showQuestionEditor ? '' : 'admin-grid-questions-collapsed'}`}>
            <section className="account-card admin-main-card admin-panel-card admin-list-card admin-test-bank-shell">
              <div className="admin-section-header admin-list-toolbar">
                <div>
                  <h2>Bank Soal</h2>
                  <p className="text-muted">
                    {selectedPackage ? `${selectedPackage.name} • ${filteredQuestions.length}/${questions.length} soal tampil` : 'Pilih paket terlebih dahulu'}
                  </p>
                </div>
                <div className="admin-list-toolbar-actions">
                  <select
                    name="question_section_filter"
                    value={questionSectionFilter}
                    onChange={(event) => setQuestionSectionFilter(event.target.value)}
                    className="admin-search-input admin-section-filter"
                  >
                    <option value="">Semua subtes</option>
                    {sectionStats.map((section) => (
                      <option key={section.code} value={section.code}>
                        {section.sessionName ? `${section.sessionName} • ` : ''}
                        {section.name} ({section.count})
                      </option>
                    ))}
                  </select>
                  <input
                    name="question_search"
                    type="search"
                    value={questionQuery}
                    onChange={(event) => setQuestionQuery(event.target.value)}
                    placeholder="Cari soal atau section"
                    className="admin-search-input"
                  />
                  <button type="button" className="btn btn-primary" onClick={handleCreateQuestion}>
                    Tambah Soal
                  </button>
                </div>
              </div>

              {sectionStats.length > 0 && (
                <div className="admin-section-summary">
                  <button
                    type="button"
                    className={`admin-section-summary-chip ${questionSectionFilter === '' ? 'admin-section-summary-chip-active' : ''}`}
                    onClick={() => setQuestionSectionFilter('')}
                  >
                    <span>Semua Subtes</span>
                    <strong>{questions.length}</strong>
                  </button>
                  {sectionStats.map((section) => (
                    <button
                      key={section.code}
                      type="button"
                      className={`admin-section-summary-chip ${questionSectionFilter === section.code ? 'admin-section-summary-chip-active' : ''}`}
                      onClick={() => setQuestionSectionFilter(section.code)}
                    >
                      <span>{section.name}</span>
                      <strong>{section.count}</strong>
                    </button>
                  ))}
                </div>
              )}

              <div className="admin-import-card">
                <div>
                  <h3>Import Pertanyaan CSV / Excel</h3>
                  <p className="text-muted">
                    Download template, edit di Excel/Google Sheets, lalu upload kembali sebagai CSV. Tandai jawaban benar dengan awalan <strong>*</strong>, misalnya <strong>*Jakarta</strong>.
                  </p>
                </div>
                <div className="admin-import-actions">
                  <button type="button" className="btn btn-outline" onClick={handleDownloadTemplate}>
                    Unduh Template
                  </button>
                  <label className="btn btn-outline admin-file-button">
                    Pilih File CSV
                    <input name="question_import_file" type="file" accept=".csv,text/csv" onChange={handleImportFileChange} hidden />
                  </label>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleImportQuestions}
                    disabled={importingQuestions || importRows.length === 0}
                  >
                    {importingQuestions ? 'Mengimport...' : `Import ${importRows.length || ''} Soal`.trim()}
                  </button>
                </div>
                {(importFileName || importRows.length > 0) && (
                  <p className="admin-import-note">
                    File siap: <strong>{importFileName || 'Template diproses'}</strong> • {importRows.length} soal terdeteksi.
                  </p>
                )}
              </div>

              {loadingQuestions ? (
                <p>Memuat soal...</p>
              ) : filteredQuestions.length === 0 ? (
                <div className="admin-empty-state">
                  <p className="text-muted">Belum ada soal yang cocok untuk ditampilkan.</p>
                  <button type="button" className="btn btn-outline" onClick={handleCreateQuestion}>
                    Tambah Soal
                  </button>
                </div>
              ) : (
                <div className="admin-question-table admin-question-table-modern">
                  <div className="admin-question-table-head">
                    <span />
                    <span>Pertanyaan</span>
                    <span>Section</span>
                    <span>Opsi</span>
                    <span>Aksi</span>
                  </div>
                  {filteredQuestions.map((question) => {
                    const isExpanded = Number(expandedQuestionId) === Number(question.id);
                    return (
                      <div key={question.id} className={`admin-question-row-wrap admin-question-row-wrap-modern ${isExpanded ? 'admin-question-row-wrap-expanded' : ''}`}>
                        <div className="admin-question-row">
                          <button
                            type="button"
                            className="admin-question-expand"
                            onClick={() => setExpandedQuestionId(isExpanded ? null : Number(question.id))}
                            aria-label={isExpanded ? 'Tutup detail soal' : 'Buka detail soal'}
                          >
                            {isExpanded ? '−' : '+'}
                          </button>

                          <div className="admin-question-row-main">
                            <span className="account-package-tag admin-question-order-tag">
                              Soal No. {Number(question.question_order || 1)}
                            </span>
                            <LatexContent
                              content={question.question_text}
                              placeholder="Soal berbasis gambar"
                              className="admin-question-row-snippet"
                            />
                            <p>
                              {question.question_image_url ? 'Ada gambar soal' : 'Tanpa gambar soal'}
                            </p>
                          </div>

                          <div className="admin-question-row-meta">
                            <span className="account-package-tag">{question.section_name || 'Bagian umum'}</span>
                          </div>

                          <div className="admin-question-row-count">
                            {(question.options || []).length} opsi
                          </div>

                          <div className="admin-question-row-actions">
                            <button type="button" className="btn btn-outline" onClick={() => handleQuestionEdit(question)}>
                              Edit
                            </button>
                            <button type="button" className="btn btn-danger" onClick={() => handleQuestionDelete(question.id)}>
                              Hapus
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="admin-question-row-detail">
                            <div className="admin-question-row-detail-main">
                              <div>
                                <h3>{question.question_text || 'Soal berbasis gambar'}</h3>
                                <p className="text-muted">
                                  {question.section_name || 'Bagian umum'}
                                </p>
                              </div>
                              <AdminImagePreview
                                src={question.question_image_url}
                                alt={`Preview soal ${question.id}`}
                                className="admin-question-preview-image"
                              />
                            </div>

                              <div className="admin-question-options-preview-grid">
                                {(question.options || []).map((option) => (
                                  <div key={option.id || `${question.id}-${option.letter}`} className="admin-option-preview-card">
                                    <div className="admin-option-preview-head">
                                      <strong>{option.letter}.</strong>
                                    {isTkpSection({ code: question.section_code, name: question.section_name }) ? (
                                      <span className="admin-correct-badge">{getOptionScoreWeight(option)} poin</span>
                                    ) : Number(option.is_correct) > 0 && (
                                      <span className="admin-correct-badge">Jawaban Benar</span>
                                    )}
                                  </div>
                                  <p>{option.text || 'Opsi berbasis gambar'}</p>
                                    <AdminImagePreview
                                      src={option.image_url}
                                      alt={`Opsi ${option.letter}`}
                                      className="admin-option-preview-image"
                                    />
                                  </div>
                                ))}
                              </div>
                              {question.explanation_notes && (
                                <div className="admin-inline-note">
                                  <strong>Pembahasan soal</strong>
                                  <p className="whitespace-pre-line">{question.explanation_notes}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                  })}
                </div>
              )}
            </section>

            {showQuestionEditor && (
              <section className="account-card admin-main-card admin-panel-card admin-editor-card admin-test-editor-shell">
                <div className="admin-section-header admin-editor-header">
                  <div>
                    <h2>{questionForm.question_id ? 'Edit Soal' : 'Tambah Soal Baru'}</h2>
                    <p className="text-muted">Teks, gambar, pilihan jawaban, dan kunci jawaban dikelola di sini.</p>
                  </div>
                  <button type="button" className="btn btn-outline" onClick={resetQuestionForm}>
                    Tutup Editor
                  </button>
                </div>

                <form onSubmit={handleQuestionSubmit} className="admin-question-form">
                  <div className="form-group">
                    <label>Pertanyaan</label>
                    <textarea
                      name="question_text"
                      rows="4"
                      value={questionForm.question_text}
                      onChange={handleQuestionChange}
                      placeholder="Tulis soal di sini"
                  />
                </div>

                  <div className="form-group">
                    <label>URL Gambar Soal</label>
                    <input
                      type="url"
                      name="question_image_url"
                      value={questionForm.question_image_url}
                      onChange={handleQuestionChange}
                      placeholder="https://..."
                    />
                    <AdminImagePreview
                      src={questionForm.question_image_url}
                      alt="Preview gambar soal"
                      className="admin-editor-preview-image"
                    />
                  </div>

                  <div className="account-form-grid">
                    <div className="form-group">
                      <label>Bagian / Subtes</label>
                      <select
                        name="section_code"
                        value={questionForm.section_code}
                        onChange={handleQuestionChange}
                        required
                      >
                        {packageSections.map((section) => (
                          <option key={section.code} value={section.code}>
                            {section.session_name ? `${section.session_name} • ` : ''}
                            {section.name}
                          </option>
                        ))}
                      </select>
                    </div>

                  </div>

                  <div className="admin-options-header">
                    <h3>Opsi Jawaban</h3>
                    <button type="button" className="btn btn-outline" onClick={addOption} disabled={questionForm.options.length >= 5}>
                      Tambah Opsi
                    </button>
                  </div>

                  <div className="admin-options-editor-list">
                    {questionForm.options.map((option, index) => (
                      <div key={`${option.letter}-${index}`} className="admin-option-editor-card">
                        <div className="admin-option-editor-head">
                          {usesQuestionPointScoring ? (
                            <label className="admin-point-control">
                              <span>Poin</span>
                              <select
                                value={getOptionScoreWeight(option, Math.min(5, index + 1))}
                                onChange={(event) => handleOptionFieldChange(index, 'score_weight', Number(event.target.value))}
                              >
                                {[1, 2, 3, 4, 5].map((point) => (
                                  <option key={point} value={point}>
                                    {point}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ) : (
                            <button
                              type="button"
                              className={`admin-correct-toggle ${option.is_correct ? 'admin-correct-toggle-active' : ''}`}
                              onClick={() => handleCorrectOptionChange(index)}
                            >
                              {option.is_correct ? 'Benar' : 'Pilih'}
                            </button>
                          )}
                          <span className="admin-option-letter">{option.letter}</span>
                          <button
                            type="button"
                            className="btn btn-outline admin-option-delete"
                            onClick={() => removeOption(index)}
                            disabled={questionForm.options.length <= 2}
                          >
                            Hapus
                          </button>
                        </div>

                        <div className="form-group">
                          <label>Teks Opsi {option.letter}</label>
                          <input
                            name={`option_text_${option.letter}_${index}`}
                            type="text"
                            value={option.text}
                            onChange={(event) => handleOptionFieldChange(index, 'text', event.target.value)}
                            placeholder={`Isi opsi ${option.letter}`}
                          />
                        </div>

                        <div className="form-group">
                          <label>URL Gambar Opsi {option.letter}</label>
                          <input
                            name={`option_image_url_${option.letter}_${index}`}
                            type="url"
                            value={option.image_url}
                            onChange={(event) => handleOptionFieldChange(index, 'image_url', event.target.value)}
                            placeholder="https://..."
                          />
                          <AdminImagePreview
                            src={option.image_url}
                            alt={`Preview opsi ${option.letter}`}
                            className="admin-editor-preview-image admin-editor-preview-image-small"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="account-form-actions">
                    <button type="submit" className="btn btn-primary" disabled={questionSaving}>
                      {questionSaving ? 'Menyimpan...' : questionForm.question_id ? 'Update Soal' : 'Tambah Soal'}
                    </button>
                    {questionForm.question_id && (
                      <button type="button" className="btn btn-outline" onClick={handleCreateQuestion}>
                        Ganti Jadi Soal Baru
                      </button>
                    )}
                  </div>
                </form>
              </section>
            )}
          </div>
          )}
        </div>
      )}
    </AccountShell>
  );
}
