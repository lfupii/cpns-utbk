import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AccountShell from '../components/AccountShell';
import apiClient from '../api';

const CSV_HEADERS = [
  'section_code',
  'question_order',
  'difficulty',
  'question_text',
  'question_image_url',
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
  question_order: '1',
  difficulty: 'easy',
  question_text: 'Contoh soal: Ibu kota Indonesia adalah ...',
  question_image_url: 'https://contoh.com/gambar-soal.jpg',
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
  difficulty: 'medium',
  question_type: 'single_choice',
  section_code: sectionCode,
  question_order: 1,
  options: [
    createOption(0),
    createOption(1),
    createOption(2),
    createOption(3),
  ],
});

const createEmptyLearningQuestion = (order = 1) => ({
  id: null,
  question_text: '',
  difficulty: 'medium',
  question_order: order,
  options: [
    createOption(0),
    createOption(1),
    createOption(2),
    createOption(3),
  ],
});

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
      difficulty: String(row.difficulty || 'medium').trim() || 'medium',
      question_type: 'single_choice',
      section_code: String(row.section_code || defaultSectionCode || '').trim(),
      question_order: Number(row.question_order || rowIndex + 1),
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
  const [packages, setPackages] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [packageSaving, setPackageSaving] = useState(false);
  const [packageCreating, setPackageCreating] = useState(false);
  const [packageDeleting, setPackageDeleting] = useState(false);
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
  const [adminView, setAdminView] = useState('dashboard');
  const [packagesExpanded, setPackagesExpanded] = useState(false);
  const [materialsExpanded, setMaterialsExpanded] = useState(true);

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
  const selectedPackageSummary = useMemo(() => ({
    sectionCount: packageSections.length,
    materialPageCount: learningContent.reduce((total, section) => total + (section.material?.pages?.length || 0), 0),
    questionCount: questions.length,
  }), [learningContent, packageSections.length, questions.length]);
  const completedMaterialSections = useMemo(
    () => learningContent.filter((section) => (section.material?.pages?.length || 0) > 0).length,
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
    const response = await apiClient.get(`/admin/questions?package_id=${packageId}&_=${Date.now()}`);
    return response.data.data || [];
  }, []);

  const fetchLearningContent = useCallback(async (packageId) => {
    const response = await apiClient.get(`/admin/learning-content?package_id=${packageId}&_=${Date.now()}`);
    return response.data.data?.sections || [];
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

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const response = await apiClient.get('/admin/packages');
        const nextPackages = response.data.data || [];
        setPackages(nextPackages);
        if (nextPackages.length > 0) {
          setSelectedPackageId(Number(nextPackages[0].id));
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Gagal memuat data admin');
      } finally {
        setLoadingPackages(false);
      }
    };

    fetchPackages();
  }, []);

  useEffect(() => {
    if (!selectedPackage) {
      setPackageForm(null);
      return;
    }

    setPackageForm({
      package_id: Number(selectedPackage.id),
      name: selectedPackage.name || '',
      description: selectedPackage.description || '',
      price: Number(selectedPackage.price || 0),
      duration_days: Number(selectedPackage.duration_days || 30),
      max_attempts: Number(selectedPackage.max_attempts || 1),
      time_limit: Number(selectedPackage.time_limit || 90),
    });
  }, [selectedPackage]);

  const refreshAdminData = async (packageId = selectedPackageId) => {
    if (!packageId) {
      return;
    }

    const [questionsResponse, packagesResponse, learningResponse] = await Promise.all([
      fetchAdminQuestions(packageId),
      apiClient.get('/admin/packages'),
      fetchLearningContent(packageId),
    ]);

    const nextQuestions = questionsResponse || [];
    const nextPackages = packagesResponse.data.data || [];
    const nextLearningContent = learningResponse || [];

    setQuestions(nextQuestions);
    setPackages(nextPackages);
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
    };
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

    setLearningQuestionsForm(nextLearningQuestions.map((question, index) => ({
      id: question.id || null,
      question_text: question.question_text || '',
      difficulty: question.difficulty || 'medium',
      question_order: Number(question.question_order || index + 1),
      options: (question.options || []).map((option, optionIndex) => ({
        letter: option.letter || String.fromCharCode(65 + optionIndex),
        text: option.text || '',
        image_url: option.image_url || '',
        is_correct: Boolean(Number(option.is_correct)),
      })),
    })));
  }, [activeLearningSection]);

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

  const resetQuestionForm = () => {
    setQuestionForm(createEmptyQuestionForm(preferredSectionCode));
    setShowQuestionEditor(false);
  };

  const handlePackageChange = (event) => {
    const { name, value } = event.target;
    setPackageForm((current) => ({
      ...current,
      [name]: ['price', 'duration_days', 'max_attempts', 'time_limit'].includes(name)
        ? Number(value)
        : value,
    }));
  };

  const handlePackageSave = async (event) => {
    event.preventDefault();
    if (!packageForm) return;

    setPackageSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiClient.put('/admin/packages', packageForm);
      const response = await apiClient.get('/admin/packages');
      const nextPackages = response.data.data || [];
      setPackages(nextPackages);
      setSuccess('Paket berhasil diperbarui.');
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan paket');
    } finally {
      setPackageSaving(false);
    }
  };

  const handleCreatePackage = async () => {
    setPackageCreating(true);
    setError('');
    setSuccess('');

    try {
      const response = await apiClient.post('/admin/packages', {
        template_package_id: selectedPackage ? Number(selectedPackage.id) : null,
      });
      const createdPackageId = Number(response.data?.data?.package_id || 0);
      const packagesResponse = await apiClient.get('/admin/packages');
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

  const handleDeletePackage = async () => {
    if (!selectedPackage) {
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
      const packagesResponse = await apiClient.get('/admin/packages');
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
      [name]: ['question_order'].includes(name) ? Number(value) : value,
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
        options: [...current.options, createOption(current.options.length)],
      };
    });
  };

  const removeOption = (index) => {
    setQuestionForm((current) => {
      if (current.options.length <= 2) return current;
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
        setSuccess('Soal berhasil diperbarui.');
      } else {
        await apiClient.post('/admin/questions', payload);
        setSuccess('Soal berhasil ditambahkan.');
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
    setQuestionForm({
      question_id: Number(question.id),
      question_text: question.question_text || '',
      question_image_url: question.question_image_url || '',
      difficulty: question.difficulty || 'medium',
      question_type: question.question_type || 'single_choice',
      section_code: question.section_code || defaultSectionCode,
      question_order: Number(question.question_order || 1),
      options: (question.options || []).map((option, index) => ({
        letter: option.letter || String.fromCharCode(65 + index),
        text: option.text || '',
        image_url: option.image_url || '',
        is_correct: Boolean(Number(option.is_correct)),
      })),
    });
    setExpandedQuestionId(Number(question.id));
    setSuccess('');
    setError('');
    setShowQuestionEditor(true);
  };

  const handleCreateQuestion = () => {
    setQuestionForm(createEmptyQuestionForm(preferredSectionCode));
    setSuccess('');
    setError('');
    setShowQuestionEditor(true);
    setAdminView('soal');
  };

  const openLearningEditor = (sectionCode, mode) => {
    setLearningSectionCode(sectionCode);
    setLearningEditorMode(mode);
    setSuccess('');
    setError('');
    setAdminView('materi');
  };

  const handleQuestionDelete = async (questionId) => {
    const confirmed = window.confirm('Hapus soal ini? Semua opsi jawabannya juga akan dihapus.');
    if (!confirmed) return;

    setError('');
    setSuccess('');

    try {
      await apiClient.delete(`/admin/questions?id=${questionId}`);
      await refreshAdminData(Number(selectedPackageId));

      if (Number(questionForm.question_id) === Number(questionId)) {
        resetQuestionForm();
      }

      if (Number(expandedQuestionId) === Number(questionId)) {
        setExpandedQuestionId(null);
      }

      setSuccess('Soal berhasil dihapus.');
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
    setLearningQuestionsForm((current) => [...current, createEmptyLearningQuestion(current.length + 1)]);
  };

  const removeLearningQuestion = (questionIndex) => {
    setLearningQuestionsForm((current) => current.length <= 1
      ? current
      : current.filter((_, index) => index !== questionIndex));
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
        questions: learningQuestionsForm,
      });
      await refreshAdminData(Number(selectedPackageId));
      setSuccess('Soal mini test subtest berhasil disimpan.');
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
  };

  const openPackageView = () => {
    setAdminView('paket');
    setLearningEditorMode('');
  };

  const openLearningView = (sectionCode = null, mode = '') => {
    if (sectionCode) {
      setLearningSectionCode(sectionCode);
      setQuestionSectionFilter(sectionCode);
    }
    setAdminView('materi');
    setLearningEditorMode(mode);
  };

  const openQuestionView = () => {
    if (activeLearningSection?.code) {
      setQuestionSectionFilter((current) => current || activeLearningSection.code);
    }
    setAdminView('soal');
    setLearningEditorMode('');
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
    const nextSection = createSectionClone(section, packageSections);
    const insertIndex = packageSections.findIndex((item) => item.code === section.code);
    const nextSections = [...packageSections];
    nextSections.splice(insertIndex + 1, 0, nextSection);
    await updateWorkflowSections(nextSections, nextSection.code, `Subtest ${nextSection.name} berhasil ditambahkan.`);
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

          <section className="learning-workspace admin-user-workspace">
            <aside className="learning-sidebar admin-user-sidebar">
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
                  className={adminView === 'paket' ? 'learning-sidebar-link learning-sidebar-link-active' : 'learning-sidebar-link'}
                  onClick={openPackageView}
                >
                  Pengaturan Paket
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

                {materialsExpanded && (
                  <div className="learning-sidebar-list">
                    {learningContent.map((section) => (
                      <div key={section.code} className="admin-section-sidebar-row">
                        <button
                          type="button"
                          className={adminView === 'materi' && section.code === activeLearningSection?.code ? 'learning-sidebar-item learning-sidebar-item-active admin-section-sidebar-item' : 'learning-sidebar-item admin-section-sidebar-item'}
                          onClick={() => openLearningView(section.code)}
                        >
                          <strong>{section.name}</strong>
                          <small>{section.material?.pages?.length || 0} halaman</small>
                        </button>
                        <div className="admin-section-sidebar-actions">
                          <button
                            type="button"
                            className="admin-section-action-btn"
                            aria-label={`Tambah subtest setelah ${section.name}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleAddSection(section);
                            }}
                            disabled={workflowSaving}
                          >
                            +
                          </button>
                          <button
                            type="button"
                            className="admin-section-action-btn"
                            aria-label={`Hapus subtest ${section.name}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteSection(section);
                            }}
                            disabled={workflowSaving || packageSections.length <= 1}
                          >
                            -
                          </button>
                        </div>
                      </div>
                    ))}
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
                          (section.material?.pages?.length || 0) > 0 && (section.questions?.length || 0) > 0 ? 'learning-path-card-done' : '',
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
                          <label>Nama Paket</label>
                          <input name="name" value={packageForm.name} onChange={handlePackageChange} />
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
                      </div>

                      <div className="account-form-actions">
                        <button type="button" className="btn btn-outline" onClick={handleCreatePackage} disabled={packageCreating}>
                          {packageCreating ? 'Membuat...' : 'Tambah Paket'}
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={packageSaving}>
                          {packageSaving ? 'Menyimpan...' : 'Simpan Paket'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={handleDeletePackage}
                          disabled={packageDeleting || packages.length <= 1 || !selectedPackage}
                        >
                          {packageDeleting ? 'Menghapus...' : 'Hapus Paket'}
                        </button>
                      </div>
                    </form>
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
                          ? `Kelola materi dan mini test untuk ${activeLearningSection.name} tanpa bercampur dengan subtest lain.`
                          : 'Pilih subtest dari sidebar kiri untuk mulai mengelola materi.'}
                      </p>
                    </div>
                    {activeLearningSection && (
                      <div className="learning-hero-actions">
                        <Link
                          to={`/admin/learning-material/${selectedPackageId}/${activeLearningSection.code}`}
                          className="btn btn-primary"
                        >
                          Edit Materi
                        </Link>
                        <button type="button" className="btn btn-outline" onClick={() => openLearningEditor(activeLearningSection.code, learningEditorMode === 'quiz' ? '' : 'quiz')}>
                          {learningEditorMode === 'quiz' ? 'Tutup Mini Test' : 'Edit Mini Test'}
                        </button>
                      </div>
                    )}
                  </div>

                  {activeLearningSection ? (
                    <>
                      <div className="learning-summary-grid admin-user-summary-grid">
                        <div>
                          <span>Halaman materi</span>
                          <strong>{activeLearningSection.material?.pages?.length || 0}</strong>
                        </div>
                        <div>
                          <span>Mini test</span>
                          <strong>{activeLearningSection.questions?.length || 0}</strong>
                        </div>
                        <div>
                          <span>Kode subtest</span>
                          <strong>{activeLearningSection.code}</strong>
                        </div>
                      </div>

                      <div className="learning-page-list">
                        <section className="learning-page">
                          <span>Materi aktif</span>
                          <h3>{activeLearningSection.material?.title || activeLearningSection.name}</h3>
                          <p>
                            {(activeLearningSection.material?.pages || []).length > 0
                              ? `${activeLearningSection.material.pages.length} halaman siap dikelola.`
                              : 'Materi belum memiliki halaman. Buka editor untuk mulai menulis materi.'}
                          </p>
                          {(activeLearningSection.material?.pages || []).length > 0 && (
                            <ul>
                              {activeLearningSection.material.pages.map((page, index) => (
                                <li key={`${activeLearningSection.code}-page-${index}`}>{page.title || `Halaman ${index + 1}`}</li>
                              ))}
                            </ul>
                          )}
                        </section>
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
                              <div key={`learning-question-inline-${questionIndex}`} className="admin-learning-page-card admin-learning-question-card-modern">
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
                                    name={`learning_question_text_main_${questionIndex}`}
                                    rows="3"
                                    value={question.question_text}
                                    onChange={(event) => updateLearningQuestion(questionIndex, 'question_text', event.target.value)}
                                  />
                                </div>
                                <div className="account-form-grid">
                                  <div className="form-group">
                                    <label>Kesulitan</label>
                                    <select
                                      name={`learning_question_difficulty_main_${questionIndex}`}
                                      value={question.difficulty}
                                      onChange={(event) => updateLearningQuestion(questionIndex, 'difficulty', event.target.value)}
                                    >
                                      <option value="easy">Mudah</option>
                                      <option value="medium">Sedang</option>
                                      <option value="hard">Sulit</option>
                                    </select>
                                  </div>
                                  <div className="form-group">
                                    <label>Urutan</label>
                                    <input
                                      name={`learning_question_order_main_${questionIndex}`}
                                      type="number"
                                      min="1"
                                      value={question.question_order}
                                      onChange={(event) => updateLearningQuestion(questionIndex, 'question_order', event.target.value)}
                                    />
                                  </div>
                                </div>
                                <div className="admin-options-editor-list">
                                  {(question.options || []).map((option, optionIndex) => (
                                    <div key={`learning-option-inline-${questionIndex}-${optionIndex}`} className="admin-option-row">
                                      <button
                                        type="button"
                                        className={`admin-correct-toggle ${option.is_correct ? 'admin-correct-toggle-active' : ''}`}
                                        onClick={() => setLearningQuestionCorrectOption(questionIndex, optionIndex)}
                                      >
                                        {option.is_correct ? 'Benar' : 'Pilih'}
                                      </button>
                                      <strong>{option.letter}</strong>
                                      <input
                                        name={`learning_option_text_main_${questionIndex}_${optionIndex}`}
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
                                    Urutan {question.question_order || index + 1}
                                    {question.question_image_url ? ' • ada gambar' : ''}
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
                                        {question.section_name || 'Bagian umum'} • Urutan {question.question_order || index + 1}
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

                          <div className="form-group">
                            <label>Urutan Soal</label>
                            <input
                              type="number"
                              min="1"
                              name="question_order"
                              value={questionForm.question_order}
                              onChange={handleQuestionChange}
                              required
                            />
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
                            <div key={`${option.letter}-main-${index}`} className="admin-option-editor-card">
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
                                  name={`option_text_main_${option.letter}_${index}`}
                                  type="text"
                                  value={option.text}
                                  onChange={(event) => handleOptionFieldChange(index, 'text', event.target.value)}
                                  placeholder={`Isi opsi ${option.letter}`}
                                />
                              </div>

                              <div className="form-group">
                                <label>URL Gambar Opsi {option.letter}</label>
                                <input
                                  name={`option_image_url_main_${option.letter}_${index}`}
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

                    return (
                      <article
                        key={section.code}
                        className={`admin-learning-overview-card admin-learning-overview-card-modern ${isActive ? 'admin-learning-overview-card-active' : ''}`}
                      >
                        <span className="account-package-tag">{section.session_name || 'Subtest'}</span>
                        <h3>{section.name}</h3>
                        <p>{section.material?.title || 'Materi belum diberi judul'}</p>
                        <div className="admin-learning-overview-stats">
                          <span>{pageCount} halaman materi</span>
                          <span>{questionCount} soal mini test</span>
                        </div>
                        <div className="admin-learning-overview-actions">
                          <Link
                            to={`/admin/learning-material/${selectedPackageId}/${section.code}`}
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
                            <div className="form-group">
                              <label>Urutan</label>
                              <input
                                name={`learning_question_order_${questionIndex}`}
                                type="number"
                                min="1"
                                value={question.question_order}
                                onChange={(event) => updateLearningQuestion(questionIndex, 'question_order', event.target.value)}
                              />
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
                              Urutan {question.question_order || index + 1}
                              {question.question_image_url ? ' • ada gambar' : ''}
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
                                  {question.section_name || 'Bagian umum'} • Urutan {question.question_order || index + 1}
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

                    <div className="form-group">
                      <label>Urutan Soal</label>
                      <input
                        type="number"
                        min="1"
                        name="question_order"
                        value={questionForm.question_order}
                        onChange={handleQuestionChange}
                        required
                      />
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
