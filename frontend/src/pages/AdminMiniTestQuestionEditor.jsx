import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AccountShell from '../components/AccountShell';
import apiClient from '../api';
import { downloadQuestionExtractFile, hasQuestionExtractContent } from '../utils/questionExtract';

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

  return TKP_PATTERN.test(`${section.code || ''} ${section.name || ''}`);
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

const createEmptyLearningQuestion = (order = 1) => ({
  id: null,
  question_text: '',
  question_image_url: '',
  explanation_notes: '',
  material_topic: '',
  difficulty: 'medium',
  question_order: order,
  options: [
    createOption(0),
    createOption(1),
    createOption(2),
    createOption(3),
  ],
});

function buildOptionImageEditorState(options) {
  return (options || []).reduce((accumulator, option, index) => {
    if (option?.image_url) {
      accumulator[index] = true;
    }
    return accumulator;
  }, {});
}

function truncateText(value, length = 180) {
  const normalized = String(value || '').trim();
  if (normalized.length <= length) {
    return normalized;
  }

  return `${normalized.slice(0, length).trim()}...`;
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

function questionToForm(question, fallbackOrder = 1) {
  const options = Array.isArray(question?.options) && question.options.length > 0
    ? question.options.map((option, index) => ({
        letter: option.letter || String.fromCharCode(65 + index),
        text: option.text || '',
        image_url: option.image_url || '',
        is_correct: Number(option.is_correct) > 0,
        score_weight: getOptionScoreWeight(option, Math.min(5, index + 1)),
      }))
    : [
        createOption(0),
        createOption(1),
        createOption(2),
        createOption(3),
      ];

  return {
    id: Number(question?.id || 0) || null,
    question_text: question?.question_text || '',
    question_image_url: question?.question_image_url || '',
    explanation_notes: question?.explanation_notes || '',
    material_topic: question?.material_topic || '',
    difficulty: question?.difficulty || 'medium',
    question_order: Number(question?.question_order || fallbackOrder),
    options,
  };
}

export default function AdminMiniTestQuestionEditor() {
  const { packageId, sectionCode, questionId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [sections, setSections] = useState([]);
  const [sectionQuestions, setSectionQuestions] = useState([]);
  const [questionForm, setQuestionForm] = useState(createEmptyLearningQuestion());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mediaUploading, setMediaUploading] = useState({});
  const [showQuestionImageTools, setShowQuestionImageTools] = useState(false);
  const [openOptionImageEditors, setOpenOptionImageEditors] = useState({});

  const numericPackageId = Number(packageId || 0);
  const numericQuestionId = Number(questionId || 0);
  const isCreating = questionId === 'new';
  const draftIndex = Number(searchParams.get('draft') || -1);
  const createdFlag = searchParams.get('created') || '';
  const workspace = searchParams.get('workspace') === 'draft' ? 'draft' : 'published';
  const isDraftWorkspace = workspace === 'draft';
  const activeSection = useMemo(
    () => sections.find((section) => String(section.code) === String(sectionCode)) || null,
    [sectionCode, sections]
  );
  const usesPointScoring = isTkpSection(activeSection);
  const selectedQuestion = useMemo(
    () => sectionQuestions.find((question) => Number(question.id) === numericQuestionId) || null,
    [numericQuestionId, sectionQuestions]
  );
  const materialTopicOptions = useMemo(() => {
    const topicTitles = getMaterialTopics(activeSection?.material)
      .map((topic, index) => String(topic?.title || `Topik ${index + 1}`).trim())
      .filter(Boolean);
    const uniqueTopicTitles = topicTitles.filter((title, index) => topicTitles.indexOf(title) === index);

    if (questionForm.material_topic && !uniqueTopicTitles.includes(questionForm.material_topic)) {
      return [questionForm.material_topic, ...uniqueTopicTitles];
    }

    return uniqueTopicTitles;
  }, [activeSection?.material, questionForm.material_topic]);
  const questionImagePanelVisible = showQuestionImageTools || Boolean(questionForm.question_image_url);
  const backToMiniTestHref = `/admin?view=materi&package=${numericPackageId}&section=${encodeURIComponent(sectionCode || '')}&mode=quiz&workspace=${workspace}${questionForm.id ? `&mini_preview=${questionForm.id}` : ''}`;
  const extractQuestionSource = useMemo(() => ({
    ...questionForm,
    section_name: activeSection?.name || '',
    options: questionForm.options,
  }), [activeSection?.name, questionForm]);
  const canExtractQuestion = useMemo(
    () => hasQuestionExtractContent(extractQuestionSource),
    [extractQuestionSource]
  );

  const fetchEditorData = useCallback(async () => {
    if (!Number.isInteger(numericPackageId) || numericPackageId <= 0 || !sectionCode) {
      setError('Editor mini test tidak valid.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const learningResponse = await apiClient.get(`/admin/learning-content?package_id=${numericPackageId}&workspace=${workspace}&_=${Date.now()}`);
      const nextSections = learningResponse.data.data?.sections || [];
      const nextSection = nextSections.find((section) => String(section.code) === String(sectionCode));

      setSections(nextSections);
      setSectionQuestions(nextSection?.questions || []);

      if (!nextSection) {
        setError('Subtest mini test yang ingin diedit tidak ditemukan.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat editor mini test');
    } finally {
      setLoading(false);
    }
  }, [numericPackageId, sectionCode, workspace]);

  useEffect(() => {
    fetchEditorData();
  }, [fetchEditorData]);

  useEffect(() => {
    if (createdFlag === '1') {
      setSuccess('Soal mini test baru berhasil dibuat. Kamu bisa lanjut edit detailnya di halaman ini.');
    }
  }, [createdFlag]);

  useEffect(() => {
    if (loading || !activeSection) {
      return;
    }

    if (isCreating) {
      const draftQuestion = draftIndex >= 0 ? sectionQuestions[draftIndex] || null : null;
      const fallbackOrder = draftIndex >= 0 ? draftIndex + 1 : sectionQuestions.length + 1;
      const rawNextForm = draftQuestion ? questionToForm(draftQuestion, fallbackOrder) : createEmptyLearningQuestion(fallbackOrder);
      const nextForm = {
        ...rawNextForm,
        options: normalizeOptionsForScoringMode(rawNextForm.options, usesPointScoring),
      };
      setQuestionForm(nextForm);
      setShowQuestionImageTools(Boolean(nextForm.question_image_url));
      setOpenOptionImageEditors(buildOptionImageEditorState(nextForm.options));
      return;
    }

    if (!selectedQuestion) {
      setError('Soal mini test yang ingin diedit tidak ditemukan.');
      return;
    }

    const rawNextForm = questionToForm(selectedQuestion, selectedQuestion.question_order || 1);
    const nextForm = {
      ...rawNextForm,
      options: normalizeOptionsForScoringMode(rawNextForm.options, usesPointScoring),
    };
    setQuestionForm(nextForm);
    setShowQuestionImageTools(Boolean(nextForm.question_image_url));
    setOpenOptionImageEditors(buildOptionImageEditorState(nextForm.options));
  }, [activeSection, draftIndex, isCreating, loading, sectionQuestions, selectedQuestion, usesPointScoring]);

  const handleExtractDownload = () => {
    if (!canExtractQuestion) {
      return;
    }

    try {
      downloadQuestionExtractFile(extractQuestionSource, {
        prefix: 'extract-soal-mini-test',
        sectionName: activeSection?.name || '',
      });
    } catch (error) {
      setError(error.message || 'Gagal mengunduh extract soal mini test.');
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

  const handleCorrectOptionChange = (index) => {
    setQuestionForm((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) => ({
        ...option,
        is_correct: optionIndex === index,
      })),
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

  const addOption = () => {
    setQuestionForm((current) => {
      if (current.options.length >= 5) {
        return current;
      }

      return {
        ...current,
        options: normalizeOptionsForScoringMode(
          [...current.options, createOption(current.options.length)],
          usesPointScoring
        ),
      };
    });
  };

  const removeOption = (index) => {
    if (questionForm.options.length <= 2) {
      return;
    }

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

      if (!usesPointScoring && !nextOptions.some((option) => option.is_correct) && nextOptions[0]) {
        nextOptions[0].is_correct = true;
      }

      return {
        ...current,
        options: normalizeOptionsForScoringMode(nextOptions, usesPointScoring),
      };
    });
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

    const uploadedUrl = await uploadAdminMedia(file, 'mini-test-question', 'mini-test-question');
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

    const uploadedUrl = await uploadAdminMedia(file, 'mini-test-option', `mini-test-option-${index}`);
    if (uploadedUrl) {
      setQuestionForm((current) => ({
        ...current,
        options: current.options.map((option, optionIndex) => (
          optionIndex === index ? { ...option, image_url: uploadedUrl } : option
        )),
      }));
      setOpenOptionImageEditors((current) => ({
        ...current,
        [index]: true,
      }));
    }

    event.target.value = '';
  };

  const handleQuestionSubmit = async (event) => {
    event.preventDefault();
    if (!numericPackageId || !activeSection) {
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    const normalizedFormQuestion = {
      ...questionForm,
      options: questionForm.options.map((option, index) => ({
        letter: option.letter || String.fromCharCode(65 + index),
        text: option.text,
        image_url: option.image_url,
        is_correct: usesPointScoring ? getOptionScoreWeight(option, Math.min(5, index + 1)) : option.is_correct,
        score_weight: usesPointScoring ? getOptionScoreWeight(option, Math.min(5, index + 1)) : (option.is_correct ? 5 : 0),
      })),
    };

    const nextQuestions = sectionQuestions.map((question, index) => ({
      ...questionToForm(question, index + 1),
      question_order: index + 1,
    }));

    let targetIndex = nextQuestions.findIndex((question) => Number(question.id) === Number(questionForm.id));
    if (targetIndex >= 0) {
      nextQuestions[targetIndex] = {
        ...normalizedFormQuestion,
        question_order: targetIndex + 1,
      };
    } else if (draftIndex >= 0 && draftIndex < nextQuestions.length) {
      targetIndex = draftIndex;
      nextQuestions[targetIndex] = {
        ...normalizedFormQuestion,
        question_order: targetIndex + 1,
      };
    } else {
      targetIndex = nextQuestions.length;
      nextQuestions.push({
        ...normalizedFormQuestion,
        question_order: targetIndex + 1,
      });
    }

    try {
      const response = await apiClient.put('/admin/learning-section-questions', {
        package_id: numericPackageId,
        section_code: activeSection.code,
        workspace,
        questions: nextQuestions.map((question, index) => ({
          ...question,
          question_order: index + 1,
        })),
      });
      const savedQuestions = response.data?.data?.questions || [];
      setSectionQuestions(savedQuestions);

      if (isCreating) {
        const createdQuestion = savedQuestions[targetIndex] || null;
        if (createdQuestion?.id) {
          navigate(`/admin/mini-test-question-editor/${numericPackageId}/${activeSection.code}/${createdQuestion.id}?created=1&workspace=${workspace}`, { replace: true });
          return;
        }
      }

      const updatedQuestion = savedQuestions.find((question) => Number(question.id) === Number(questionForm.id)) || savedQuestions[targetIndex] || null;
      if (updatedQuestion) {
        setQuestionForm(questionToForm(updatedQuestion, updatedQuestion.question_order || targetIndex + 1));
      }
      setSuccess(isDraftWorkspace ? 'Soal mini test draft berhasil disimpan.' : 'Soal mini test berhasil disimpan.');
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan soal mini test');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccountShell
      title={isCreating ? 'Tambah Soal Mini Test' : 'Edit Soal Mini Test'}
      subtitle="Halaman ini khusus untuk mengelola satu soal mini test aktif agar daftar di admin tetap rapi dan fokus."
      shellClassName="admin-workspace-shell"
    >
      <div className="admin-layout admin-question-editor-page">
        <section className="account-card admin-main-card admin-panel-card admin-test-editor-shell">
          <div className="admin-question-editor-hero">
            <div>
              <span className="admin-preview-eyebrow">{activeSection?.name || 'Mini test subtest'}</span>
              <h2>{isCreating ? 'Susun soal mini test baru' : truncateText(questionForm.question_text || 'Soal mini test aktif', 120)}</h2>
              <p className="text-muted">
                Edit satu soal mini test dari halaman khusus agar daftar soal di panel admin tetap ringkas seperti bank soal tryout.
              </p>
              {!isDraftWorkspace && <p className="text-muted">Mode Published hanya untuk review. Edit dilakukan dari tab Draft.</p>}
            </div>
            <div className="admin-question-editor-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleExtractDownload}
                disabled={!canExtractQuestion}
              >
                Download Extract
              </button>
              <Link className="btn btn-outline" to={backToMiniTestHref}>
                Kembali ke Mini Test
              </Link>
            </div>
          </div>

          {!isCreating && selectedQuestion && (
            <section className="admin-question-preview-shell">
              <div className="admin-question-preview-head">
                <div>
                  <span className="admin-preview-eyebrow">Preview aktif</span>
                  <h3>{truncateText(selectedQuestion.question_text || 'Soal berbasis gambar')}</h3>
                  <p className="text-muted">
                    {activeSection?.name || 'Subtest aktif'} • {(selectedQuestion.options || []).length} opsi
                  </p>
                </div>
              </div>

              <div className="admin-question-row-detail">
                <div className="admin-question-row-detail-main">
                  <div>
                    <h3>{selectedQuestion.question_text || 'Soal berbasis gambar'}</h3>
                    <p className="text-muted">
                      {selectedQuestion.material_topic
                        ? `${selectedQuestion.material_topic} • ${selectedQuestion.question_image_url ? 'Ada gambar soal' : 'Tanpa gambar soal'}`
                        : selectedQuestion.question_image_url
                        ? 'Ada gambar soal'
                        : 'Tanpa gambar soal'}
                    </p>
                  </div>
                  <AdminImagePreview
                    src={selectedQuestion.question_image_url}
                    alt={`Preview mini test ${selectedQuestion.id}`}
                    className="admin-question-preview-image"
                  />
                </div>

                <div className="admin-question-options-preview-grid">
                  {(selectedQuestion.options || []).map((option) => (
                    <div key={option.id || `${selectedQuestion.id}-${option.letter}`} className="admin-option-preview-card">
                      <div className="admin-option-preview-head">
                        <strong>{option.letter}.</strong>
                        {usesPointScoring ? (
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
              </div>
            </section>
          )}

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="account-success">{success}</div>}

          {loading ? (
            <p>Memuat editor mini test...</p>
          ) : (
            <form onSubmit={handleQuestionSubmit} className="admin-question-form admin-question-form-modern">
              <div className="admin-learning-page-card admin-learning-question-card-modern admin-test-editor-question-card">
                <div className="admin-option-editor-head">
                  <strong>{questionForm.id ? 'Form Edit Soal' : 'Form Soal Baru'}</strong>
                  <button
                    type="button"
                    className="btn btn-outline admin-option-delete"
                    onClick={() => setShowQuestionImageTools((current) => !current)}
                  >
                    {questionImagePanelVisible ? 'Tutup Gambar Soal' : 'Tambah Gambar Soal'}
                  </button>
                </div>

                <div className="form-group">
                  <label>Pertanyaan</label>
                  <textarea
                    name="question_text"
                    rows="4"
                    value={questionForm.question_text}
                    onChange={handleQuestionChange}
                    placeholder="Tulis soal mini test di sini"
                  />
                </div>

                <div className="account-form-grid">
                  <div className="form-group">
                    <label>Kategori Topik Materi</label>
                    <select
                      name="material_topic"
                      value={questionForm.material_topic}
                      onChange={handleQuestionChange}
                    >
                      <option value="">Pilih topik materi</option>
                      {materialTopicOptions.map((topicTitle) => (
                        <option key={topicTitle} value={topicTitle}>
                          {topicTitle}
                        </option>
                      ))}
                    </select>
                    <small className="text-muted">
                      Dropdown ini mengambil topik materi aktif dari subtest {activeSection?.name || 'ini'} agar admin bisa menandai soal mini test masuk ke topik mana.
                    </small>
                  </div>
                  <div className="form-group">
                    <label>Catatan Pembahasan</label>
                    <textarea
                      name="explanation_notes"
                      rows="4"
                      value={questionForm.explanation_notes}
                      onChange={handleQuestionChange}
                      placeholder="Tulis pembahasan jawaban yang nanti akan dilihat user setelah mini test selesai"
                    />
                    <small className="text-muted">
                      Catatan ini akan tampil di halaman pembahasan mini test setelah user menyelesaikan soal.
                    </small>
                  </div>
                </div>

                {questionImagePanelVisible && (
                  <div className="admin-question-image-tools">
                    <div className="form-group">
                      <label>URL Gambar Soal</label>
                      <input
                        type="url"
                        name="question_image_url"
                        value={questionForm.question_image_url}
                        onChange={handleQuestionChange}
                        placeholder="https://..."
                      />
                    </div>

                    <div className="admin-option-inline-actions">
                      <label className="btn btn-outline admin-option-inline-button admin-file-button">
                        {mediaUploading['mini-test-question'] ? 'Mengupload...' : 'Upload dari Komputer'}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          onChange={handleQuestionImageUpload}
                          hidden
                        />
                      </label>
                    </div>

                    <div className="admin-question-image-preview-shell">
                      <div className="admin-question-media-preview admin-question-media-preview-top">
                        {questionForm.question_text && (
                          <div className="admin-question-media-copy-preview">
                            <span>Preview pertanyaan</span>
                            <p>{questionForm.question_text}</p>
                          </div>
                        )}
                        <AdminImagePreview
                          src={questionForm.question_image_url}
                          alt="Preview gambar mini test"
                          className="admin-question-media-image-preview"
                        />
                      </div>
                      {questionForm.question_image_url && (
                        <button type="button" className="btn btn-outline admin-inline-secondary-action" onClick={clearQuestionImage}>
                          Hapus Gambar Soal
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="admin-options-header">
                  <h3>Opsi Jawaban</h3>
                  <button type="button" className="btn btn-outline" onClick={addOption} disabled={questionForm.options.length >= 5}>
                    Tambah Opsi
                  </button>
                </div>

                <div className="admin-options-editor-list admin-options-editor-list-modern">
                  {questionForm.options.map((option, index) => {
                    const isOptionImageEditorVisible = openOptionImageEditors[index] || Boolean(option.image_url);

                    return (
                      <div key={`${option.letter}-mini-test-${index}`} className="admin-option-editor-card admin-option-editor-card-inline">
                        <div className="admin-option-row admin-option-row-rich">
                          {usesPointScoring ? (
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
                          <div className="admin-option-input-stack">
                            <input
                              name={`mini_test_option_text_${option.letter}_${index}`}
                              type="text"
                              value={option.text}
                              onChange={(event) => handleOptionFieldChange(index, 'text', event.target.value)}
                              placeholder={`Isi opsi ${option.letter}`}
                            />
                            {isOptionImageEditorVisible && (
                              <div className="admin-option-image-tools">
                                <input
                                  name={`mini_test_option_image_${option.letter}_${index}`}
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
                            )}
                          </div>
                          <div className="admin-option-inline-actions">
                            <label className="btn btn-outline admin-option-inline-button admin-file-button">
                              {mediaUploading[`mini-test-option-${index}`] ? 'Mengupload...' : 'Upload Gambar'}
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/gif"
                                onChange={(event) => handleQuestionOptionImageUpload(index, event)}
                                hidden
                              />
                            </label>
                            <button
                              type="button"
                              className="btn btn-outline admin-option-inline-button"
                              onClick={() => toggleOptionImageEditor(index)}
                            >
                              {isOptionImageEditorVisible ? 'Tutup Gambar' : 'Tambah Gambar'}
                            </button>
                            {option.image_url && (
                              <button
                                type="button"
                                className="btn btn-outline admin-option-inline-button"
                                onClick={() => clearOptionImage(index)}
                              >
                                Hapus Gambar
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-outline admin-option-delete"
                              onClick={() => removeOption(index)}
                              disabled={questionForm.options.length <= 2}
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="account-form-actions">
                <button type="submit" className="btn btn-primary" disabled={saving || !isDraftWorkspace}>
                  {saving ? 'Menyimpan...' : !isDraftWorkspace ? 'Published Terkunci' : questionForm.id ? 'Update Soal' : 'Tambah Soal'}
                </button>
                {!questionForm.id && (
                  <Link className="btn btn-outline" to={backToMiniTestHref}>
                    Batal
                  </Link>
                )}
              </div>
            </form>
          )}
        </section>
      </div>
    </AccountShell>
  );
}
