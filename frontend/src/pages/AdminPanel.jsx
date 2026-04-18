import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AccountShell from '../components/AccountShell';
import apiClient from '../api';

const CSV_HEADERS = [
  'section_code',
  'difficulty',
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
  difficulty: 'easy',
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

const createOption = (index, text = '', isCorrect = false, imageUrl = '') => ({
  letter: String.fromCharCode(65 + index),
  text,
  image_url: imageUrl,
  is_correct: isCorrect,
});

const createEmptyQuestionForm = (sectionCode = '') => ({
  question_id: null,
  question_text: '',
  question_image_url: '',
  question_image_layout: 'top',
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

const QUESTION_IMAGE_LAYOUT_OPTIONS = [
  { value: 'top', label: 'Atas' },
  { value: 'bottom', label: 'Bawah' },
  { value: 'left', label: 'Kiri' },
  { value: 'right', label: 'Kanan' },
];

const TEST_MODE_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'cpns_cat', label: 'CPNS CAT' },
  { value: 'utbk_sectioned', label: 'UTBK Bertahap' },
];

const createEmptyLearningQuestion = (order = 1) => ({
  id: null,
  question_text: '',
  question_image_url: '',
  difficulty: 'medium',
  question_order: order,
  options: createDefaultOptionSet(),
});

function buildOptionImageEditorState(options) {
  return (options || []).reduce((accumulator, option, index) => {
    if (option?.image_url) {
      accumulator[index] = true;
    }
    return accumulator;
  }, {});
}

function computeMiniTestDurationSeconds(section, questionCount) {
  const totalQuestions = Math.max(0, Number(questionCount || 0));
  const durationMinutes = Math.max(0, Number(section?.duration_minutes || 0));
  const targetQuestionCount = Math.max(0, Number(section?.target_question_count || 0));

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

function createEmptyMaterialPage(pageNumber) {
  return {
    title: `Halaman ${pageNumber}`,
    points: [''],
    closing: '',
    content_html: '',
  };
}

function createEmptyMaterialTopic(topicNumber, firstPageNumber = 1) {
  return {
    title: `Topik ${topicNumber}`,
    pages: firstPageNumber ? [createEmptyMaterialPage(firstPageNumber)] : [],
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
      difficulty: String(row.difficulty || 'medium').trim() || 'medium',
      question_type: 'single_choice',
      section_code: String(row.section_code || defaultSectionCode || '').trim(),
      options,
    };
  });
}

function truncateText(value, length = 110) {
  const normalized = String(value || '').trim();
  if (normalized.length <= length) {
    return normalized;
  }

  return `${normalized.slice(0, length).trim()}...`;
}

function formatDifficultyLabel(value) {
  if (value === 'easy') {
    return 'Mudah';
  }

  if (value === 'hard') {
    return 'Sulit';
  }

  return 'Sedang';
}

function getLearningQuestionRowKey(question, index) {
  if (Number(question?.id || 0) > 0) {
    return `learning-${question.id}`;
  }

  return `learning-draft-${index}`;
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
  const [packageCreating, setPackageCreating] = useState(false);
  const [packageDeleting, setPackageDeleting] = useState(false);
  const [packageTypeSaving, setPackageTypeSaving] = useState(false);
  const [packageTypeDeleting, setPackageTypeDeleting] = useState(false);
  const [questionSaving, setQuestionSaving] = useState(false);
  const [importingQuestions, setImportingQuestions] = useState(false);
  const [workflowSaving, setWorkflowSaving] = useState(false);
  const [mediaUploading, setMediaUploading] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [packageForm, setPackageForm] = useState(null);
  const [packageTypeForm, setPackageTypeForm] = useState({ category_id: 0, name: '', description: '' });
  const [questionForm, setQuestionForm] = useState(createEmptyQuestionForm());
  const [showQuestionEditor, setShowQuestionEditor] = useState(false);
  const [expandedQuestionId, setExpandedQuestionId] = useState(null);
  const [questionQuery, setQuestionQuery] = useState('');
  const [questionSectionFilter, setQuestionSectionFilter] = useState('');
  const [importRows, setImportRows] = useState([]);
  const [importFileName, setImportFileName] = useState('');
  const [showQuestionImageTools, setShowQuestionImageTools] = useState(false);
  const [openOptionImageEditors, setOpenOptionImageEditors] = useState({});
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
  const [showLearningQuestionImageTools, setShowLearningQuestionImageTools] = useState(false);
  const [openLearningOptionImageEditors, setOpenLearningOptionImageEditors] = useState({});
  const [expandedLearningQuestionKey, setExpandedLearningQuestionKey] = useState('');
  const [adminView, setAdminView] = useState('dashboard');
  const [savingWorkspaceDraft, setSavingWorkspaceDraft] = useState(false);
  const [publishingWorkspaceDraft, setPublishingWorkspaceDraft] = useState(false);
  const [packagesExpanded, setPackagesExpanded] = useState(false);
  const [materialsExpanded, setMaterialsExpanded] = useState(true);
  const [editingSectionActionsCode, setEditingSectionActionsCode] = useState('');
  const [expandedMaterialSections, setExpandedMaterialSections] = useState({});
  const [activeMaterialTopicIndex, setActiveMaterialTopicIndex] = useState(null);
  const routeSearchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const requestedAdminView = routeSearchParams.get('view') || '';
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
  const activeLearningQuestion = useMemo(
    () => learningQuestionsForm[activeLearningQuestionIndex] || null,
    [activeLearningQuestionIndex, learningQuestionsForm]
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
  const syncLearningQuestionPanels = useCallback((question) => {
    setShowLearningQuestionImageTools(Boolean(question?.question_image_url));
    setOpenLearningOptionImageEditors(buildOptionImageEditorState(question?.options || []));
  }, []);
  const selectLearningQuestion = useCallback((questionIndex) => {
    const nextQuestion = learningQuestionsForm[questionIndex] || null;
    setActiveLearningQuestionIndex(questionIndex);
    syncLearningQuestionPanels(nextQuestion);
  }, [learningQuestionsForm, syncLearningQuestionPanels]);

  const fetchAdminQuestions = useCallback(async (packageId) => {
    const response = await apiClient.get(`/admin/questions?package_id=${packageId}&workspace=${adminWorkspace}&_=${Date.now()}`);
    return response.data.data || [];
  }, [adminWorkspace]);

  const fetchLearningContent = useCallback(async (packageId) => {
    const response = await apiClient.get(`/admin/learning-content?package_id=${packageId}&workspace=${adminWorkspace}&_=${Date.now()}`);
    return response.data.data?.sections || [];
  }, [adminWorkspace]);

  const fetchPackageTypes = useCallback(async () => {
    const response = await apiClient.get('/admin/package-types');
    return response.data.data || [];
  }, []);

  const sectionStats = useMemo(() => {
    const counts = questions.reduce((accumulator, question) => {
      const code = String(question.section_code || 'general');
      return {
        ...accumulator,
        [code]: (accumulator[code] || 0) + 1,
      };
    }, {});

    const mappedSections = packageSections.map((section) => ({
      code: String(section.code),
      name: section.name,
      sessionName: section.session_name || '',
      count: counts[String(section.code)] || 0,
    }));

    const knownCodes = new Set(mappedSections.map((section) => section.code));
    const uncategorizedSections = Object.entries(counts)
      .filter(([code]) => !knownCodes.has(code))
      .map(([code, count]) => ({
        code,
        name: questions.find((question) => String(question.section_code || 'general') === code)?.section_name || 'Bagian umum',
        sessionName: '',
        count,
      }));

    return [...mappedSections, ...uncategorizedSections];
  }, [packageSections, questions]);

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
  const questionImagePanelVisible = showQuestionImageTools || Boolean(questionForm.question_image_url);
  const learningQuestionImagePanelVisible = showLearningQuestionImageTools || Boolean(activeLearningQuestion?.question_image_url);
  const miniTestDurationSeconds = useMemo(
    () => computeMiniTestDurationSeconds(activeLearningSection, learningQuestionsForm.length),
    [activeLearningSection, learningQuestionsForm.length]
  );
  const miniTestDurationMinutesLabel = useMemo(() => {
    const totalMinutes = Math.max(1, Math.ceil(miniTestDurationSeconds / 60));
    return `${totalMinutes} menit`;
  }, [miniTestDurationSeconds]);

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const [packagesResponse, typesResponse] = await Promise.all([
          apiClient.get(`/admin/packages?workspace=${adminWorkspace}`),
          fetchPackageTypes(),
        ]);
        const nextPackages = packagesResponse.data.data || [];
        setPackages(nextPackages);
        setPackageTypes(typesResponse || []);
        if (nextPackages.length > 0) {
          const requestedPackage = nextPackages.find((pkg) => Number(pkg.id) === requestedPackageId);
          setSelectedPackageId(Number((requestedPackage || nextPackages[0]).id));
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Gagal memuat data admin');
      } finally {
        setLoadingPackages(false);
      }
    };

    fetchPackages();
  }, [adminWorkspace, fetchPackageTypes, requestedPackageId]);

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
    });
  }, [selectedPackage]);

  const refreshAdminData = async (packageId = selectedPackageId) => {
    if (!packageId) {
      return;
    }

    const [questionsResponse, packagesResponse, learningResponse, typesResponse] = await Promise.all([
      fetchAdminQuestions(packageId),
      apiClient.get(`/admin/packages?workspace=${adminWorkspace}`),
      fetchLearningContent(packageId),
      fetchPackageTypes(),
    ]);

    const nextQuestions = questionsResponse || [];
    const nextPackages = packagesResponse.data.data || [];
    const nextLearningContent = learningResponse || [];

    setQuestions(nextQuestions);
    setPackages(nextPackages);
    setPackageTypes(typesResponse || []);
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
      packageTypes: typesResponse || [],
    };
  };

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

    navigate(`/admin?${query.toString()}`);
  };

  const handleSaveWorkspaceDraft = async () => {
    if (!selectedPackageId) {
      return;
    }

    setSavingWorkspaceDraft(true);
    setError('');
    setSuccess('');

    try {
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
      question_text: question.question_text || '',
      question_image_url: question.question_image_url || '',
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
        is_correct: Boolean(Number(option.is_correct)),
      })),
    }));

    setLearningQuestionsForm(normalizedQuestions);
    setActiveLearningQuestionIndex(0);
    syncLearningQuestionPanels(normalizedQuestions[0] || null);
    setExpandedLearningQuestionKey('');
  }, [activeLearningSection, syncLearningQuestionPanels]);

  useEffect(() => {
    setQuestionForm((current) => {
      if (current.question_id) {
        return current;
      }

      return createEmptyQuestionForm(defaultSectionCode);
    });
  }, [defaultSectionCode]);

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
  }, [activeLearningSection?.code]);

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
  }, [activeLearningSection?.material]);

  useEffect(() => {
    if (['dashboard', 'paket', 'materi', 'soal'].includes(requestedAdminView)) {
      setAdminView(requestedAdminView);
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
    setQuestionForm(createEmptyQuestionForm(preferredSectionCode));
    setShowQuestionEditor(false);
    setShowQuestionImageTools(false);
    setOpenOptionImageEditors({});
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

  const handlePackageTypeChange = (event) => {
    const { name, value } = event.target;
    setPackageTypeForm((current) => ({
      ...current,
      [name]: name === 'category_id' ? Number(value) : value,
    }));
  };

  const handlePackageSave = async (event) => {
    event.preventDefault();
    if (!packageForm) return;

    setPackageSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiClient.put('/admin/packages', {
        ...packageForm,
        workspace: adminWorkspace,
      });
      const response = await apiClient.get(`/admin/packages?workspace=${adminWorkspace}`);
      const nextPackages = response.data.data || [];
      setPackages(nextPackages);
      setSuccess(isDraftWorkspace ? 'Draft paket berhasil diperbarui.' : 'Paket berhasil diperbarui.');
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
      const packagesResponse = await apiClient.get('/admin/packages?workspace=published');
      const nextPackages = packagesResponse.data.data || [];
      setPackages(nextPackages);
      if (createdPackageId > 0) {
        setSelectedPackageId(createdPackageId);
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

  const resetPackageTypeForm = () => {
    setPackageTypeForm({ category_id: 0, name: '', description: '' });
  };

  const handlePackageTypeSubmit = async (event) => {
    event.preventDefault();
    setPackageTypeSaving(true);
    setError('');
    setSuccess('');

    try {
      if (packageTypeForm.category_id > 0) {
        await apiClient.put('/admin/package-types', packageTypeForm);
        setSuccess('Tipe paket berhasil diperbarui.');
      } else {
        await apiClient.post('/admin/package-types', {
          name: packageTypeForm.name,
          description: packageTypeForm.description,
        });
        setSuccess('Tipe paket berhasil ditambahkan.');
      }

      const nextTypes = await fetchPackageTypes();
      setPackageTypes(nextTypes);
      resetPackageTypeForm();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan tipe paket');
    } finally {
      setPackageTypeSaving(false);
    }
  };

  const handlePackageTypeEdit = (type) => {
    setPackageTypeForm({
      category_id: Number(type.id),
      name: type.name || '',
      description: type.description || '',
    });
    setAdminView('paket');
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
      if (Number(packageTypeForm.category_id) === Number(type.id)) {
        resetPackageTypeForm();
      }
      setSuccess(`Tipe paket "${type.name}" berhasil dihapus.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menghapus tipe paket');
    } finally {
      setPackageTypeDeleting(false);
    }
  };

  const handleDeletePackage = async () => {
    if (!selectedPackage) {
      return;
    }

    if (isDraftWorkspace) {
      setError('Penghapusan paket dilakukan dari tab Published terlebih dahulu.');
      return;
    }

    const confirmed = window.confirm(`Hapus paket "${selectedPackage.name}"? Semua materi, soal, dan riwayat terkait akan ikut terhapus.`);
    if (!confirmed) {
      return;
    }

    setPackageDeleting(true);
    setError('');
    setSuccess('');

    try {
      await apiClient.delete(`/admin/packages?id=${selectedPackage.id}`);
      const packagesResponse = await apiClient.get('/admin/packages?workspace=published');
      const nextPackages = packagesResponse.data.data || [];
      setPackages(nextPackages);
      setSelectedPackageId(nextPackages[0] ? Number(nextPackages[0].id) : null);
      resetQuestionForm();
      setExpandedQuestionId(null);
      setLearningEditorMode('');
      setSuccess(`Paket "${selectedPackage.name}" berhasil dihapus.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menghapus paket');
    } finally {
      setPackageDeleting(false);
    }
  };

  const handleQuestionChange = (event) => {
    const { name, value } = event.target;
    setQuestionForm((current) => ({
      ...current,
      [name]: value,
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

  const toggleOptionImageEditor = (index) => {
    setOpenOptionImageEditors((current) => ({
      ...current,
      [index]: !current[index],
    }));
  };

  const clearQuestionImage = () => {
    setQuestionForm((current) => ({
      ...current,
      question_image_url: '',
      question_image_layout: 'top',
    }));
  };

  const clearOptionImage = (index) => {
    setQuestionForm((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) => (
        optionIndex === index ? { ...option, image_url: '' } : option
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
        options: [...current.options, createOption(current.options.length)],
      };
    });
  };

  const removeOption = (index) => {
    if (questionForm.options.length <= 2) return;

    setOpenOptionImageEditors((current) => Object.entries(current).reduce((nextState, [key, value]) => {
      const numericKey = Number(key);
      if (numericKey === index) {
        return nextState;
      }

      nextState[numericKey > index ? numericKey - 1 : numericKey] = value;
      return nextState;
    }, {}));

    setQuestionForm((current) => {
      const nextOptions = current.options
        .filter((_, optionIndex) => optionIndex !== index)
        .map((option, optionIndex) => ({
          ...option,
          letter: String.fromCharCode(65 + optionIndex),
        }));

      if (!nextOptions.some((option) => option.is_correct)) {
        nextOptions[0].is_correct = true;
      }

      return {
        ...current,
        options: nextOptions,
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
          is_correct: option.is_correct,
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

  const uploadAdminMedia = async (file, context, uploadKey) => {
    if (!file) {
      return null;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('context', context);

    setMediaUploading((current) => ({
      ...current,
      [uploadKey]: true,
    }));

    try {
      const response = await apiClient.post('/admin/media-upload', formData);
      return response.data?.data?.url || '';
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengupload gambar');
      return null;
    } finally {
      setMediaUploading((current) => ({
        ...current,
        [uploadKey]: false,
      }));
    }
  };

  const handleQuestionImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const uploadedUrl = await uploadAdminMedia(file, 'tryout-question', 'tryout-question');
    if (uploadedUrl) {
      setQuestionForm((current) => ({
        ...current,
        question_image_url: uploadedUrl,
      }));
      setShowQuestionImageTools(true);
    }

    event.target.value = '';
  };

  const handleQuestionOptionImageUpload = async (index, event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const uploadedUrl = await uploadAdminMedia(file, 'tryout-option', `tryout-option-${index}`);
    if (uploadedUrl) {
      handleOptionFieldChange(index, 'image_url', uploadedUrl);
      setOpenOptionImageEditors((current) => ({
        ...current,
        [index]: true,
      }));
    }

    event.target.value = '';
  };

  const handleLearningQuestionImageUpload = async (questionIndex, event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const uploadedUrl = await uploadAdminMedia(file, 'mini-test-question', `learning-question-${questionIndex}`);
    if (uploadedUrl) {
      updateLearningQuestion(questionIndex, 'question_image_url', uploadedUrl);
      if (questionIndex === activeLearningQuestionIndex) {
        setShowLearningQuestionImageTools(true);
      }
    }

    event.target.value = '';
  };

  const handleLearningOptionImageUpload = async (questionIndex, optionIndex, event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const uploadedUrl = await uploadAdminMedia(file, 'mini-test-option', `learning-option-${questionIndex}-${optionIndex}`);
    if (uploadedUrl) {
      updateLearningQuestionOption(questionIndex, optionIndex, 'image_url', uploadedUrl);
      if (questionIndex === activeLearningQuestionIndex) {
        setOpenLearningOptionImageEditors((current) => ({
          ...current,
          [optionIndex]: true,
        }));
      }
    }

    event.target.value = '';
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

  const toggleLearningOptionImageEditor = (optionIndex) => {
    setOpenLearningOptionImageEditors((current) => ({
      ...current,
      [optionIndex]: !current[optionIndex],
    }));
  };

  const clearLearningQuestionImage = (questionIndex) => {
    updateLearningQuestion(questionIndex, 'question_image_url', '');
    if (questionIndex === activeLearningQuestionIndex) {
      setShowLearningQuestionImageTools(false);
    }
  };

  const clearLearningOptionImage = (questionIndex, optionIndex) => {
    updateLearningQuestionOption(questionIndex, optionIndex, 'image_url', '');
    if (questionIndex === activeLearningQuestionIndex) {
      setOpenLearningOptionImageEditors((current) => ({
        ...current,
        [optionIndex]: false,
      }));
    }
  };

  const setLearningQuestionCorrectOption = (questionIndex, optionIndex) => {
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

  const addLearningQuestionOption = (questionIndex) => {
    setLearningQuestionsForm((current) => current.map((question, index) => {
      if (index !== questionIndex || question.options.length >= 5) {
        return question;
      }

      return {
        ...question,
        options: [...question.options, createOption(question.options.length)],
      };
    }));
  };

  const removeLearningQuestionOption = (questionIndex, optionIndex) => {
    const targetQuestion = learningQuestionsForm[questionIndex];
    if (!targetQuestion || targetQuestion.options.length <= 2) {
      return;
    }

    setLearningQuestionsForm((current) => current.map((question, index) => {
      if (index !== questionIndex) {
        return question;
      }

      const nextOptions = question.options
        .filter((_, currentOptionIndex) => currentOptionIndex !== optionIndex)
        .map((option, currentOptionIndex) => ({
          ...option,
          letter: String.fromCharCode(65 + currentOptionIndex),
        }));

      if (!nextOptions.some((option) => option.is_correct) && nextOptions[0]) {
        nextOptions[0].is_correct = true;
      }

      return {
        ...question,
        options: nextOptions,
      };
    }));

    if (questionIndex === activeLearningQuestionIndex) {
      setOpenLearningOptionImageEditors((current) => Object.entries(current).reduce((nextState, [key, value]) => {
        const numericKey = Number(key);
        if (numericKey === optionIndex) {
          return nextState;
        }

        nextState[numericKey > optionIndex ? numericKey - 1 : numericKey] = value;
        return nextState;
      }, {}));
    }
  };

  const addLearningQuestion = () => {
    const nextQuestionIndex = learningQuestionsForm.length;
    setLearningQuestionsForm((current) => [...current, createEmptyLearningQuestion(current.length + 1)]);
    setActiveLearningQuestionIndex(nextQuestionIndex);
    setShowLearningQuestionImageTools(false);
    setOpenLearningOptionImageEditors({});
  };

  const removeLearningQuestion = (questionIndex) => {
    if (learningQuestionsForm.length <= 1) {
      return;
    }

    const nextQuestions = learningQuestionsForm.filter((_, index) => index !== questionIndex);
    const nextActiveIndex = Math.min(
      activeLearningQuestionIndex > questionIndex ? activeLearningQuestionIndex - 1 : activeLearningQuestionIndex,
      nextQuestions.length - 1
    );

    setLearningQuestionsForm(nextQuestions);
    setActiveLearningQuestionIndex(nextActiveIndex);
    syncLearningQuestionPanels(nextQuestions[nextActiveIndex] || null);
    setExpandedLearningQuestionKey('');
  };

  const handleLearningQuestionsSave = async () => {
    if (!selectedPackageId || !activeLearningSection) return;

    setLearningQuestionsSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiClient.put('/admin/learning-section-questions', {
        package_id: Number(selectedPackageId),
        section_code: activeLearningSection.code,
        workspace: adminWorkspace,
        questions: learningQuestionsForm.map((question, index) => ({
          ...question,
          question_order: index + 1,
        })),
      });
      await refreshAdminData(Number(selectedPackageId));
      setSuccess(isDraftWorkspace ? 'Soal mini test draft berhasil disimpan.' : 'Soal mini test subtest berhasil disimpan.');
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan soal mini test subtest');
    } finally {
      setLearningQuestionsSaving(false);
    }
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

  const openDashboardView = () => {
    setAdminView('dashboard');
    setLearningEditorMode('');
    setEditingSectionActionsCode('');
  };

  const openPackageView = () => {
    setAdminView('paket');
    setLearningEditorMode('');
    setEditingSectionActionsCode('');
  };

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

  const openMaterialTopicEditor = (sectionCode, topicIndex = 0) => {
    if (!selectedPackageId || !sectionCode) {
      return;
    }

    const resolvedTopic = topicIndex === 'new' ? 'new' : Math.max(0, Number(topicIndex) || 0);
    navigate(`/admin/learning-material/${selectedPackageId}/${sectionCode}?topic=${resolvedTopic}&workspace=${adminWorkspace}`);
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
    const nextDuration = window.prompt('Durasi acuan subtest dalam menit untuk mini test', section.duration_minutes ?? '');
    if (nextDuration === null) {
      return;
    }

    const nextTargetCount = window.prompt('Target jumlah soal subtest sebagai acuan timer mini test', section.target_question_count ?? '');
    if (nextTargetCount === null) {
      return;
    }

    const normalizedDuration = String(nextDuration).trim() === '' ? null : Number(nextDuration);
    const normalizedTargetCount = String(nextTargetCount).trim() === '' ? null : Number(nextTargetCount);

    if (normalizedDuration !== null && (!Number.isFinite(normalizedDuration) || normalizedDuration < 0)) {
      setError('Durasi mini test tidak valid.');
      return;
    }

    if (normalizedTargetCount !== null && (!Number.isFinite(normalizedTargetCount) || normalizedTargetCount < 0)) {
      setError('Target jumlah soal mini test tidak valid.');
      return;
    }

    const nextSections = packageSections.map((item) => (
      item.code === section.code
        ? {
            ...item,
            duration_minutes: normalizedDuration,
            target_question_count: normalizedTargetCount === null ? null : Math.floor(normalizedTargetCount),
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

          <div className="account-card admin-message-card">
            <div className="admin-list-toolbar">
              <div>
                <h3>Workspace Admin</h3>
                <p className="text-muted">
                  {isDraftWorkspace
                    ? 'Mode Draft aktif. Semua perubahan paket, materi, mini test, dan tryout disimpan ke draft sampai Anda publish.'
                    : 'Mode Published aktif. Tampilan ini menunjukkan data live yang sedang dilihat oleh user.'}
                </p>
              </div>
              <div className="admin-list-toolbar-actions">
                <button
                  type="button"
                  className={adminWorkspace === 'published' ? 'btn btn-primary' : 'btn btn-outline'}
                  onClick={() => handleWorkspaceChange('published')}
                >
                  Published
                </button>
                <button
                  type="button"
                  className={adminWorkspace === 'draft' ? 'btn btn-primary' : 'btn btn-outline'}
                  onClick={() => handleWorkspaceChange('draft')}
                >
                  Draft
                </button>
                {isDraftWorkspace && (
                  <>
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
                  </>
                )}
              </div>
            </div>
          </div>

          <section className="learning-workspace admin-user-workspace">
            <aside className="learning-sidebar admin-user-sidebar">
              <div className="learning-sidebar-card admin-user-sidebar-card admin-package-settings-card">
                <p className="learning-sidebar-label">Pengaturan paket</p>
                <button
                  type="button"
                  className={adminView === 'paket' ? 'learning-sidebar-link learning-sidebar-link-active' : 'learning-sidebar-link'}
                  onClick={openPackageView}
                >
                  Kelola Paket
                </button>
              </div>

              <div className="learning-sidebar-card admin-user-sidebar-card">
                <p className="learning-sidebar-label">Jenis paket</p>
                <button
                  type="button"
                  className="learning-sidebar-toggle"
                  onClick={() => setPackagesExpanded((current) => !current)}
                  aria-expanded={packagesExpanded}
                >
                  <span>
                    <strong>{selectedPackage?.name || 'Pilih paket'}</strong>
                    <small>{selectedPackage?.category_name || `${packages.length} paket tersedia`}</small>
                  </span>
                  <span>{packagesExpanded ? '▴' : '▾'}</span>
                </button>

                {packagesExpanded && (
                  <div className="learning-sidebar-list">
                    {packages.map((pkg) => (
                      <button
                        key={pkg.id}
                        type="button"
                        className={Number(selectedPackageId) === Number(pkg.id) ? 'learning-sidebar-item learning-sidebar-item-active' : 'learning-sidebar-item'}
                        onClick={() => {
                          setSelectedPackageId(Number(pkg.id));
                          resetQuestionForm();
                          setExpandedQuestionId(null);
                          setLearningEditorMode('');
                          setEditingSectionActionsCode('');
                          setAdminView('dashboard');
                        }}
                      >
                        <strong>{pkg.name}</strong>
                        <small>{pkg.category_name || `${pkg.workflow?.sections?.length || 0} subtes`}</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>

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
                      const materialStatus = normalizeMaterialStatus(section.material?.status);

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
                              {topics.map((topic, index) => (
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
                              ))}
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
                  Bank Soal
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

              {adminView === 'paket' && packageForm && (
                <article className="learning-material admin-package-view-shell">
                  <div className="learning-material-header">
                    <div>
                      <span className="account-package-tag">Pengaturan paket</span>
                      <h2>{selectedPackage?.name || 'Paket aktif'}</h2>
                      <p>Harga, durasi akses, batas attempt, dan mekanisme ujian dikelola dari sini.</p>
                    </div>
                  </div>

                  <div className="learning-page admin-package-form-page">
                    <form className="admin-package-form" onSubmit={handlePackageSave}>
                      <div className="account-form-grid">
                        <div className="form-group">
                          <label>Tipe Paket</label>
                          <select name="category_id" value={packageForm.category_id} onChange={handlePackageChange}>
                            {packageTypes.map((type) => (
                              <option key={type.id} value={type.id}>
                                {type.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Nama Paket</label>
                          <input name="name" value={packageForm.name} onChange={handlePackageChange} />
                        </div>
                        <div className="form-group">
                          <label>Mode Ujian</label>
                          <select name="test_mode" value={packageForm.test_mode} onChange={handlePackageChange}>
                            {TEST_MODE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Harga</label>
                          <input type="number" min="1000" name="price" value={packageForm.price} onChange={handlePackageChange} />
                        </div>
                        <div className="form-group">
                          <label>Durasi Akses (hari)</label>
                          <input type="number" min="1" name="duration_days" value={packageForm.duration_days} onChange={handlePackageChange} />
                        </div>
                        <div className="form-group">
                          <label>Batas Attempt</label>
                          <input type="number" min="1" name="max_attempts" value={packageForm.max_attempts} onChange={handlePackageChange} />
                        </div>
                        <div className="form-group">
                          <label>Waktu Ujian (menit)</label>
                          <input
                            type="number"
                            min="1"
                            name="time_limit"
                            value={packageForm.time_limit}
                            onChange={handlePackageChange}
                            disabled={selectedPackage?.test_mode === 'cpns_cat' || selectedPackage?.test_mode === 'utbk_sectioned'}
                          />
                        </div>
                        <div className="form-group form-group-full">
                          <label>Deskripsi</label>
                          <textarea name="description" rows="3" value={packageForm.description} onChange={handlePackageChange} />
                        </div>
                        {selectedPackage?.workflow && (
                          <div className="form-group form-group-full">
                            <label>Mekanisme Ujian</label>
                            <textarea
                              name="workflow_overview"
                              rows="4"
                              value={[
                                `${selectedPackage.workflow.label} • ${selectedPackage.workflow.total_duration_minutes} menit`,
                                selectedPackage.workflow.allow_random_navigation
                                  ? 'Navigasi soal bebas.'
                                  : 'Navigasi soal dikunci mengikuti subtes aktif.',
                                ...packageSections.map((section) => (
                                  `${section.order}. ${section.name}${section.duration_minutes ? ` - ${section.duration_minutes} menit` : ''}`
                                )),
                              ].join('\n')}
                              disabled
                            />
                          </div>
                        )}
                        <div className="form-group form-group-full">
                          <label>Ringkasan Struktur</label>
                          <textarea
                            rows="5"
                            value={[
                              `Mode: ${TEST_MODE_OPTIONS.find((option) => option.value === packageForm.test_mode)?.label || packageForm.test_mode}`,
                              `Tipe paket: ${packageTypes.find((type) => Number(type.id) === Number(packageForm.category_id))?.name || '-'}`,
                              ...packageSections.map((section) => (
                                `${section.order}. ${section.name}${section.session_name ? ` • ${section.session_name}` : ''}${section.target_question_count ? ` • ${section.target_question_count} soal` : ''}${section.duration_minutes ? ` • ${section.duration_minutes} menit` : ''}`
                              )),
                            ].join('\n')}
                            disabled
                          />
                        </div>
                      </div>

                      <div className="account-form-actions">
                        {!isDraftWorkspace && (
                          <button type="button" className="btn btn-outline" onClick={handleCreatePackage} disabled={packageCreating}>
                            {packageCreating ? 'Membuat...' : 'Tambah Paket'}
                          </button>
                        )}
                        <button type="submit" className="btn btn-primary" disabled={packageSaving}>
                          {packageSaving ? 'Menyimpan...' : isDraftWorkspace ? 'Simpan Draft Paket' : 'Simpan Paket'}
                        </button>
                        {!isDraftWorkspace && (
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={handleDeletePackage}
                            disabled={packageDeleting || packages.length <= 1 || !selectedPackage}
                          >
                            {packageDeleting ? 'Menghapus...' : 'Hapus Paket'}
                          </button>
                        )}
                      </div>
                    </form>
                  </div>

                  <div className="learning-page admin-package-form-page">
                    <div className="admin-section-header admin-list-toolbar">
                      <div>
                        <h3>Tipe Paket</h3>
                        <p className="text-muted">Kelola kategori paket agar ke depan bisa ada CPNS/UTBK standard, premium, atau varian lain.</p>
                      </div>
                    </div>

                    <form className="admin-package-form" onSubmit={handlePackageTypeSubmit}>
                      <div className="account-form-grid">
                        <div className="form-group">
                          <label>Nama Tipe Paket</label>
                          <input name="name" value={packageTypeForm.name} onChange={handlePackageTypeChange} placeholder="Contoh: UTBK Premium" />
                        </div>
                        <div className="form-group form-group-full">
                          <label>Deskripsi</label>
                          <textarea name="description" rows="3" value={packageTypeForm.description} onChange={handlePackageTypeChange} placeholder="Keterangan singkat tipe paket" />
                        </div>
                      </div>

                      <div className="account-form-actions">
                        {packageTypeForm.category_id > 0 && (
                          <button type="button" className="btn btn-outline" onClick={resetPackageTypeForm}>
                            Batal Edit
                          </button>
                        )}
                        <button type="submit" className="btn btn-primary" disabled={packageTypeSaving}>
                          {packageTypeSaving ? 'Menyimpan...' : packageTypeForm.category_id > 0 ? 'Simpan Tipe Paket' : 'Tambah Tipe Paket'}
                        </button>
                      </div>
                    </form>

                    <div className="admin-package-type-list">
                      {packageTypes.map((type) => (
                        <div key={type.id} className="admin-package-type-card">
                          <div>
                            <strong>{type.name}</strong>
                            <p>{type.description || 'Tanpa deskripsi'}</p>
                            <small>{type.package_count} paket</small>
                          </div>
                          <div className="admin-package-type-actions">
                            <button type="button" className="btn btn-outline" onClick={() => handlePackageTypeEdit(type)}>
                              Edit
                            </button>
                            <button type="button" className="btn btn-danger" onClick={() => handlePackageTypeDelete(type)} disabled={packageTypeDeleting}>
                              Hapus
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
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
                                  Timer mini test mengambil acuan dari durasi subtest dan target jumlah soal yang aktif untuk subtest ini.
                                </p>
                              </div>
                              <div className="admin-mini-test-settings-actions">
                                {isDraftWorkspace && (
                                  <button
                                    type="button"
                                    className="btn btn-outline"
                                    onClick={() => handleMiniTestTimingEdit(activeLearningSection)}
                                    disabled={workflowSaving}
                                  >
                                    {workflowSaving ? 'Menyimpan Waktu...' : 'Atur Waktu Mini Test'}
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="admin-mini-test-settings-grid">
                              <div className="admin-mini-test-settings-card">
                                <span>Durasi Acuan Subtest</span>
                                <strong>{activeLearningSection.duration_minutes ? `${activeLearningSection.duration_minutes} menit` : 'Belum diatur'}</strong>
                                <small>Dipakai sebagai dasar hitung timer mini test.</small>
                              </div>
                              <div className="admin-mini-test-settings-card">
                                <span>Target Soal Subtest</span>
                                <strong>{activeLearningSection.target_question_count || 'Belum diatur'}</strong>
                                <small>Digunakan agar timer mini test proporsional.</small>
                              </div>
                              <div className="admin-mini-test-settings-card">
                                <span>Estimasi Timer Mini Test</span>
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
                            </div>
                            <div className="admin-question-editor-actions">
                              {isDraftWorkspace && (
                                <button
                                  type="button"
                                  className="btn btn-outline"
                                  onClick={() => {
                                    const firstDraftIndex = learningQuestionsForm.findIndex((question) => !Number(question.id || 0));
                                    openMiniTestQuestionEditor(
                                      activeLearningSection.code,
                                      'new',
                                      firstDraftIndex >= 0 ? { draftIndex: firstDraftIndex } : {}
                                    );
                                  }}
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
                                <span />
                                <span>Pertanyaan</span>
                                <span>Kesulitan</span>
                                <span>Opsi</span>
                                <span>Aksi</span>
                              </div>
                              {learningQuestionsForm.map((question, questionIndex) => {
                                const rowKey = getLearningQuestionRowKey(question, questionIndex);
                                const isExpanded = expandedLearningQuestionKey === rowKey;
                                const editorTargetId = Number(question.id || 0) > 0 ? String(question.id) : 'new';
                                const editorOptions = Number(question.id || 0) > 0 ? {} : { draftIndex: questionIndex };

                                return (
                                  <div
                                    key={rowKey}
                                    className={`admin-question-row-wrap admin-question-row-wrap-modern ${isExpanded ? 'admin-question-row-wrap-expanded' : ''}`}
                                  >
                                    <div className="admin-question-row">
                                      <button
                                        type="button"
                                        className="admin-question-expand"
                                        onClick={() => setExpandedLearningQuestionKey(isExpanded ? '' : rowKey)}
                                        aria-label={isExpanded ? `Tutup detail soal ${questionIndex + 1}` : `Buka detail soal ${questionIndex + 1}`}
                                      >
                                        {isExpanded ? '−' : '+'}
                                      </button>

                                      <div className="admin-question-row-main">
                                        <strong>{truncateText(question.question_text || `Soal ${questionIndex + 1}`)}</strong>
                                        <p>
                                          {question.question_image_url ? 'Ada gambar soal' : 'Tanpa gambar soal'}
                                        </p>
                                      </div>

                                      <div className="admin-question-row-meta">
                                        <span className="account-package-tag">{formatDifficultyLabel(question.difficulty)}</span>
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
                                            <h3>{question.question_text || `Soal ${questionIndex + 1}`}</h3>
                                            <p className="text-muted">
                                              {activeLearningSection.name}
                                            </p>
                                          </div>
                                          <AdminImagePreview
                                            src={question.question_image_url}
                                            alt={`Preview mini test ${questionIndex + 1}`}
                                            className="admin-question-preview-image"
                                          />
                                        </div>

                                        <div className="admin-question-preview-actions">
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
                                            onClick={() => setExpandedLearningQuestionKey('')}
                                          >
                                            Tutup Detail
                                          </button>
                                        </div>

                                        <div className="admin-question-options-preview-grid">
                                          {(question.options || []).map((option, optionIndex) => (
                                            <div key={`learning-preview-option-${rowKey}-${option.letter}-${optionIndex}`} className="admin-option-preview-card">
                                              <div className="admin-option-preview-head">
                                                <strong>{option.letter}.</strong>
                                                {option.is_correct && (
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
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {isDraftWorkspace && (
                              <div className="account-form-actions">
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
                                  <h3>{page.title || `Halaman ${pageIndex + 1}`}</h3>
                                  {page.content_html ? (
                                    <div
                                      className="learning-rich-content"
                                      dangerouslySetInnerHTML={{ __html: page.content_html }}
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
                                  <strong>{truncateText(question.question_text || 'Soal berbasis gambar')}</strong>
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

                                  <div className="admin-question-preview-actions">
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
                                      onClick={() => setExpandedQuestionId(null)}
                                    >
                                      Tutup Detail
                                    </button>
                                  </div>

                                  <div className="admin-question-options-preview-grid">
                                    {(question.options || []).map((option) => (
                                      <div key={option.id || `${question.id}-${option.letter}`} className="admin-option-preview-card">
                                        <div className="admin-option-preview-head">
                                          <strong>{option.letter}.</strong>
                                          {Number(option.is_correct) === 1 && (
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
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </div>
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
                              <label>Kesulitan</label>
                              <select
                                name={`learning_question_difficulty_${questionIndex}`}
                                value={question.difficulty}
                                onChange={(event) => updateLearningQuestion(questionIndex, 'difficulty', event.target.value)}
                              >
                                <option value="easy">Mudah</option>
                                <option value="medium">Sedang</option>
                                <option value="hard">Sulit</option>
                              </select>
                            </div>
                          </div>
                          <div className="admin-options-editor-list">
                            {(question.options || []).map((option, optionIndex) => (
                              <div key={`learning-option-${questionIndex}-${optionIndex}`} className="admin-option-row">
                                <button
                                  type="button"
                                  className={`admin-correct-toggle ${option.is_correct ? 'admin-correct-toggle-active' : ''}`}
                                  onClick={() => setLearningQuestionCorrectOption(questionIndex, optionIndex)}
                                >
                                  {option.is_correct ? 'Benar' : 'Pilih'}
                                </button>
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
                  {filteredQuestions.map((question, index) => {
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
                            <strong>{truncateText(question.question_text || 'Soal berbasis gambar')}</strong>
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
                                    {Number(option.is_correct) === 1 && (
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
                          <button
                            type="button"
                            className={`admin-correct-toggle ${option.is_correct ? 'admin-correct-toggle-active' : ''}`}
                            onClick={() => handleCorrectOptionChange(index)}
                          >
                            {option.is_correct ? 'Benar' : 'Pilih'}
                          </button>
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
