import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AccountShell from '../components/AccountShell';
import apiClient from '../api';

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

const QUESTION_IMAGE_LAYOUT_OPTIONS = [
  { value: 'top', label: 'Atas' },
  { value: 'bottom', label: 'Bawah' },
  { value: 'left', label: 'Kiri' },
  { value: 'right', label: 'Kanan' },
];

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

function truncateText(value, length = 180) {
  const normalized = String(value || '').trim();
  if (normalized.length <= length) {
    return normalized;
  }

  return `${normalized.slice(0, length).trim()}...`;
}

function questionToForm(question, fallbackSectionCode = '') {
  const options = Array.isArray(question?.options) && question.options.length > 0
    ? question.options.map((option, index) => ({
        letter: option.letter || String.fromCharCode(65 + index),
        text: option.text || '',
        image_url: option.image_url || '',
        is_correct: Boolean(Number(option.is_correct)),
      }))
    : [
        createOption(0),
        createOption(1),
        createOption(2),
        createOption(3),
      ];

  return {
    question_id: Number(question?.id || 0) || null,
    question_text: question?.question_text || '',
    question_image_url: question?.question_image_url || '',
    question_image_layout: question?.question_image_layout || 'top',
    difficulty: question?.difficulty || 'medium',
    question_type: question?.question_type || 'single_choice',
    section_code: question?.section_code || fallbackSectionCode,
    options,
  };
}

export default function AdminQuestionEditor() {
  const { packageId, questionId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [packages, setPackages] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [questionForm, setQuestionForm] = useState(createEmptyQuestionForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mediaUploading, setMediaUploading] = useState({});
  const [showQuestionImageTools, setShowQuestionImageTools] = useState(false);
  const [openOptionImageEditors, setOpenOptionImageEditors] = useState({});

  const numericPackageId = Number(packageId);
  const isCreating = questionId === 'new';
  const numericQuestionId = Number(questionId || 0);
  const requestedSectionCode = searchParams.get('section') || '';
  const createdFlag = searchParams.get('created') || '';
  const selectedPackage = useMemo(
    () => packages.find((pkg) => Number(pkg.id) === numericPackageId) || null,
    [numericPackageId, packages]
  );
  const packageSections = useMemo(
    () => selectedPackage?.workflow?.sections || [],
    [selectedPackage]
  );
  const defaultSectionCode = useMemo(() => {
    if (packageSections.some((section) => String(section.code) === requestedSectionCode)) {
      return requestedSectionCode;
    }

    return packageSections[0]?.code || '';
  }, [packageSections, requestedSectionCode]);
  const selectedQuestion = useMemo(
    () => questions.find((question) => Number(question.id) === numericQuestionId) || null,
    [numericQuestionId, questions]
  );
  const questionImagePanelVisible = showQuestionImageTools || Boolean(questionForm.question_image_url);
  const backToBankSoalHref = `/admin?view=soal&package=${numericPackageId}${questionForm.question_id ? `&preview=${questionForm.question_id}` : ''}`;

  const fetchEditorData = useCallback(async () => {
    if (!Number.isInteger(numericPackageId) || numericPackageId <= 0) {
      setError('Paket soal tidak valid.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [packagesResponse, questionsResponse] = await Promise.all([
        apiClient.get('/admin/packages'),
        apiClient.get(`/admin/questions?package_id=${numericPackageId}&_=${Date.now()}`),
      ]);

      setPackages(packagesResponse.data.data || []);
      setQuestions(questionsResponse.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat editor soal');
    } finally {
      setLoading(false);
    }
  }, [numericPackageId]);

  useEffect(() => {
    fetchEditorData();
  }, [fetchEditorData]);

  useEffect(() => {
    if (createdFlag === '1') {
      setSuccess('Soal baru berhasil dibuat. Kamu bisa lanjut edit detailnya di halaman ini.');
    }
  }, [createdFlag]);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (isCreating) {
      setQuestionForm(createEmptyQuestionForm(defaultSectionCode));
      setShowQuestionImageTools(false);
      setOpenOptionImageEditors({});
      return;
    }

    if (!selectedQuestion) {
      setError('Soal yang ingin diedit tidak ditemukan.');
      return;
    }

    setQuestionForm(questionToForm(selectedQuestion, defaultSectionCode));
    setShowQuestionImageTools(Boolean(selectedQuestion.question_image_url));
    setOpenOptionImageEditors((selectedQuestion.options || []).reduce((accumulator, option, index) => {
      if (option.image_url) {
        accumulator[index] = true;
      }
      return accumulator;
    }, {}));
  }, [defaultSectionCode, isCreating, loading, selectedQuestion]);

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
      if (current.options.length >= 5) {
        return current;
      }

      return {
        ...current,
        options: [...current.options, createOption(current.options.length)],
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

      if (!nextOptions.some((option) => option.is_correct) && nextOptions[0]) {
        nextOptions[0].is_correct = true;
      }

      return {
        ...current,
        options: nextOptions,
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

    const uploadedUrl = await uploadAdminMedia(file, 'tryout-question', 'tryout-question');
    if (uploadedUrl) {
      setQuestionForm((current) => ({
        ...current,
        question_image_url: uploadedUrl,
      }));
      setShowQuestionImageTools(true);
    }
  };

  const handleQuestionOptionImageUpload = async (index, event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const uploadedUrl = await uploadAdminMedia(file, 'tryout-option', `tryout-option-${index}`);
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
  };

  const handleQuestionSubmit = async (event) => {
    event.preventDefault();
    if (!numericPackageId) {
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    const payload = {
      ...questionForm,
      package_id: numericPackageId,
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
        await fetchEditorData();
      } else {
        const response = await apiClient.post('/admin/questions', payload);
        const createdQuestionId = Number(response.data?.data?.question_id || 0);
        if (createdQuestionId > 0) {
          navigate(`/admin/question-editor/${numericPackageId}/${createdQuestionId}?created=1`, { replace: true });
          return;
        }
        setSuccess('Soal berhasil ditambahkan.');
        await fetchEditorData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan soal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccountShell
      title={isCreating ? 'Tambah Soal Baru' : 'Edit Soal'}
      subtitle="Halaman ini khusus untuk mengelola satu soal aktif agar tampilan bank soal tetap rapi dan fokus."
      shellClassName="admin-workspace-shell"
    >
      <div className="admin-layout admin-question-editor-page">
        <section className="account-card admin-main-card admin-panel-card admin-test-editor-shell">
          <div className="admin-question-editor-hero">
            <div>
              <span className="admin-preview-eyebrow">{selectedPackage?.name || 'Bank soal'}</span>
              <h2>{isCreating ? 'Susun soal baru' : truncateText(questionForm.question_text || 'Soal aktif', 120)}</h2>
              <p className="text-muted">
                {isCreating
                  ? 'Isi pertanyaan, gambar, dan opsi jawaban di editor ini.'
                  : 'Preview ringkas soal aktif ditampilkan di bawah, lalu kamu bisa langsung edit detailnya.'}
              </p>
            </div>
            <div className="admin-question-editor-actions">
              <Link className="btn btn-outline" to={backToBankSoalHref}>
                Kembali ke Bank Soal
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
                    {selectedQuestion.section_name || 'Bagian umum'} • {(selectedQuestion.options || []).length} opsi
                  </p>
                </div>
              </div>

              <div className="admin-question-row-detail">
                <div className="admin-question-row-detail-main">
                  <div>
                    <h3>{selectedQuestion.question_text || 'Soal berbasis gambar'}</h3>
                    <p className="text-muted">
                      {selectedQuestion.question_image_url ? 'Ada gambar soal' : 'Tanpa gambar soal'}
                    </p>
                  </div>
                  <AdminImagePreview
                    src={selectedQuestion.question_image_url}
                    alt={`Preview soal ${selectedQuestion.id}`}
                    className="admin-question-preview-image"
                  />
                </div>

                <div className="admin-question-options-preview-grid">
                  {(selectedQuestion.options || []).map((option) => (
                    <div key={option.id || `${selectedQuestion.id}-${option.letter}`} className="admin-option-preview-card">
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
            </section>
          )}

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="account-success">{success}</div>}

          {loading ? (
            <p>Memuat editor soal...</p>
          ) : (
            <form onSubmit={handleQuestionSubmit} className="admin-question-form admin-question-form-modern">
              <div className="admin-learning-page-card admin-learning-question-card-modern admin-test-editor-question-card">
                <div className="admin-option-editor-head">
                  <strong>{questionForm.question_id ? 'Form Edit Soal' : 'Form Soal Baru'}</strong>
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
                    placeholder="Tulis soal di sini"
                  />
                </div>

                <div className="account-form-grid">
                  <div className="form-group">
                    <label>Kesulitan</label>
                    <select
                      name="difficulty"
                      value={questionForm.difficulty}
                      onChange={handleQuestionChange}
                    >
                      <option value="easy">Mudah</option>
                      <option value="medium">Sedang</option>
                      <option value="hard">Sulit</option>
                    </select>
                  </div>
                </div>

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
                        {mediaUploading['tryout-question'] ? 'Mengupload...' : 'Upload dari Komputer'}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          onChange={handleQuestionImageUpload}
                          hidden
                        />
                      </label>
                    </div>

                    <div className="form-group">
                      <label>Posisi Gambar Soal</label>
                      <div className="admin-layout-toggle-group">
                        {QUESTION_IMAGE_LAYOUT_OPTIONS.map((layoutOption) => (
                          <button
                            key={layoutOption.value}
                            type="button"
                            className={`admin-layout-toggle ${questionForm.question_image_layout === layoutOption.value ? 'admin-layout-toggle-active' : ''}`}
                            onClick={() => setQuestionForm((current) => ({
                              ...current,
                              question_image_layout: layoutOption.value,
                            }))}
                          >
                            {layoutOption.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="admin-question-image-preview-shell">
                      <div className={`admin-question-media-preview admin-question-media-preview-${questionForm.question_image_layout || 'top'}`}>
                        {questionForm.question_text && (
                          <div className="admin-question-media-copy-preview">
                            <span>Preview pertanyaan</span>
                            <p>{questionForm.question_text}</p>
                          </div>
                        )}
                        <AdminImagePreview
                          src={questionForm.question_image_url}
                          alt="Preview gambar soal"
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
                      <div key={`${option.letter}-main-${index}`} className="admin-option-editor-card admin-option-editor-card-inline">
                        <div className="admin-option-row admin-option-row-rich">
                          <button
                            type="button"
                            className={`admin-correct-toggle ${option.is_correct ? 'admin-correct-toggle-active' : ''}`}
                            onClick={() => handleCorrectOptionChange(index)}
                          >
                            {option.is_correct ? 'Benar' : 'Pilih'}
                          </button>
                          <span className="admin-option-letter">{option.letter}</span>
                          <div className="admin-option-input-stack">
                            <input
                              name={`option_text_main_${option.letter}_${index}`}
                              type="text"
                              value={option.text}
                              onChange={(event) => handleOptionFieldChange(index, 'text', event.target.value)}
                              placeholder={`Isi opsi ${option.letter}`}
                            />
                            {isOptionImageEditorVisible && (
                              <div className="admin-option-image-tools">
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
                            )}
                          </div>
                          <div className="admin-option-inline-actions">
                            <label className="btn btn-outline admin-option-inline-button admin-file-button">
                              {mediaUploading[`tryout-option-${index}`] ? 'Mengupload...' : 'Upload Gambar'}
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
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Menyimpan...' : questionForm.question_id ? 'Update Soal' : 'Tambah Soal'}
                </button>
                {!questionForm.question_id && (
                  <Link className="btn btn-outline" to={backToBankSoalHref}>
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
