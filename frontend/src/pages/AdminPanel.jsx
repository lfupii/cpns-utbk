import React, { useEffect, useMemo, useState } from 'react';
import AccountShell from '../components/AccountShell';
import apiClient from '../api';

const createOption = (index, text = '', isCorrect = false) => ({
  letter: String.fromCharCode(65 + index),
  text,
  is_correct: isCorrect,
});

const createEmptyQuestionForm = (sectionCode = '') => ({
  question_id: null,
  question_text: '',
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

export default function AdminPanel() {
  const [packages, setPackages] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [packageSaving, setPackageSaving] = useState(false);
  const [questionSaving, setQuestionSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [packageForm, setPackageForm] = useState(null);
  const [questionForm, setQuestionForm] = useState(createEmptyQuestionForm());

  const selectedPackage = useMemo(
    () => packages.find((pkg) => Number(pkg.id) === Number(selectedPackageId)) || null,
    [packages, selectedPackageId]
  );
  const packageSections = selectedPackage?.workflow?.sections || [];
  const defaultSectionCode = packageSections[0]?.code || '';

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

  useEffect(() => {
    if (!selectedPackageId) {
      setQuestions([]);
      return;
    }

    const fetchQuestions = async () => {
      setLoadingQuestions(true);
      setError('');
      try {
        const response = await apiClient.get(`/admin/questions?package_id=${selectedPackageId}`);
        setQuestions(response.data.data || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Gagal memuat daftar soal');
      } finally {
        setLoadingQuestions(false);
      }
    };

    fetchQuestions();
  }, [selectedPackageId]);

  useEffect(() => {
    setQuestionForm((current) => {
      if (current.question_id) {
        return current;
      }

      return createEmptyQuestionForm(defaultSectionCode);
    });
  }, [defaultSectionCode]);

  const resetQuestionForm = () => {
    setQuestionForm(createEmptyQuestionForm(defaultSectionCode));
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

  const handleQuestionChange = (event) => {
    const { name, value } = event.target;
    setQuestionForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleOptionTextChange = (index, value) => {
    setQuestionForm((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) =>
        optionIndex === index ? { ...option, text: value } : option
      ),
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
      options: questionForm.options.map((option, index) => ({
        letter: option.letter || String.fromCharCode(65 + index),
        text: option.text,
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

      const [questionsResponse, packagesResponse] = await Promise.all([
        apiClient.get(`/admin/questions?package_id=${selectedPackageId}`),
        apiClient.get('/admin/packages'),
      ]);

      setQuestions(questionsResponse.data.data || []);
      setPackages(packagesResponse.data.data || []);
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
      difficulty: question.difficulty || 'medium',
      question_type: question.question_type || 'single_choice',
      section_code: question.section_code || defaultSectionCode,
      question_order: Number(question.question_order || 1),
      options: (question.options || []).map((option, index) => ({
        letter: option.letter || String.fromCharCode(65 + index),
        text: option.text || '',
        is_correct: Boolean(Number(option.is_correct)),
      })),
    });
    setSuccess('');
    setError('');
  };

  const handleQuestionDelete = async (questionId) => {
    const confirmed = window.confirm('Hapus soal ini? Semua opsi jawabannya juga akan dihapus.');
    if (!confirmed) return;

    setError('');
    setSuccess('');

    try {
      await apiClient.delete(`/admin/questions?id=${questionId}`);
      const [questionsResponse, packagesResponse] = await Promise.all([
        apiClient.get(`/admin/questions?package_id=${selectedPackageId}`),
        apiClient.get('/admin/packages'),
      ]);
      setQuestions(questionsResponse.data.data || []);
      setPackages(packagesResponse.data.data || []);

      if (Number(questionForm.question_id) === Number(questionId)) {
        resetQuestionForm();
      }

      setSuccess('Soal berhasil dihapus.');
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menghapus soal');
    }
  };

  return (
    <AccountShell
      title="Panel Admin"
      subtitle="Kelola harga paket, soal, opsi jawaban, dan kunci jawaban dari satu tempat."
    >
      {loadingPackages ? (
        <div className="account-card">
          <p>Memuat panel admin...</p>
        </div>
      ) : (
        <div className="admin-layout">
          {(error || success) && (
            <div className="account-card admin-message-card">
              {error && <div className="alert">{error}</div>}
              {success && <div className="account-success">{success}</div>}
            </div>
          )}

          <div className="admin-grid">
            <section className="account-card admin-sidebar">
              <h2>Paket Aktif</h2>
              <p className="text-muted">Pilih paket yang ingin dikelola.</p>
              <div className="admin-package-switcher">
                {packages.map((pkg) => (
                  <button
                    key={pkg.id}
                    type="button"
                    className={`admin-package-switch ${Number(selectedPackageId) === Number(pkg.id) ? 'admin-package-switch-active' : ''}`}
                    onClick={() => {
                      setSelectedPackageId(Number(pkg.id));
                      resetQuestionForm();
                    }}
                  >
                    <strong>{pkg.name}</strong>
                    <span>Rp{Number(pkg.price).toLocaleString('id-ID')}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="account-card admin-main-card">
              <h2>Pengaturan Paket</h2>
              {packageForm && (
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
                    <button type="submit" className="btn btn-primary" disabled={packageSaving}>
                      {packageSaving ? 'Menyimpan...' : 'Simpan Paket'}
                    </button>
                  </div>
                </form>
              )}
            </section>
          </div>

          <div className="admin-grid admin-grid-questions">
            <section className="account-card admin-main-card">
              <div className="admin-section-header">
                <div>
                  <h2>{questionForm.question_id ? 'Edit Soal' : 'Tambah Soal Baru'}</h2>
                  <p className="text-muted">Atur teks soal, tingkat kesulitan, dan jawaban benar.</p>
                </div>
                {questionForm.question_id && (
                  <button type="button" className="btn btn-outline" onClick={resetQuestionForm}>
                    Buat Soal Baru
                  </button>
                )}
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
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Tingkat Kesulitan</label>
                  <select name="difficulty" value={questionForm.difficulty} onChange={handleQuestionChange}>
                    <option value="easy">Mudah</option>
                    <option value="medium">Sedang</option>
                    <option value="hard">Sulit</option>
                  </select>
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

                <div className="admin-options-header">
                  <h3>Opsi Jawaban</h3>
                  <button type="button" className="btn btn-outline" onClick={addOption} disabled={questionForm.options.length >= 5}>
                    Tambah Opsi
                  </button>
                </div>

                <div className="admin-options-list">
                  {questionForm.options.map((option, index) => (
                    <div key={`${option.letter}-${index}`} className="admin-option-row">
                      <button
                        type="button"
                        className={`admin-correct-toggle ${option.is_correct ? 'admin-correct-toggle-active' : ''}`}
                        onClick={() => handleCorrectOptionChange(index)}
                      >
                        {option.is_correct ? 'Benar' : 'Pilih'}
                      </button>
                      <span className="admin-option-letter">{option.letter}</span>
                      <input
                        type="text"
                        value={option.text}
                        onChange={(event) => handleOptionTextChange(index, event.target.value)}
                        placeholder={`Isi opsi ${option.letter}`}
                        required
                      />
                      <button
                        type="button"
                        className="btn btn-outline admin-option-delete"
                        onClick={() => removeOption(index)}
                        disabled={questionForm.options.length <= 2}
                      >
                        Hapus
                      </button>
                    </div>
                  ))}
                </div>

                <div className="account-form-actions">
                  <button type="submit" className="btn btn-primary" disabled={questionSaving}>
                    {questionSaving ? 'Menyimpan...' : questionForm.question_id ? 'Update Soal' : 'Tambah Soal'}
                  </button>
                </div>
              </form>
            </section>

            <section className="account-card admin-main-card">
              <div className="admin-section-header">
                <div>
                  <h2>Daftar Soal</h2>
                  <p className="text-muted">
                    {selectedPackage ? `${selectedPackage.name} • ${questions.length} soal` : 'Pilih paket terlebih dahulu'}
                  </p>
                </div>
              </div>

              {loadingQuestions ? (
                <p>Memuat soal...</p>
              ) : questions.length === 0 ? (
                <p className="text-muted">Belum ada soal untuk paket ini.</p>
              ) : (
                <div className="admin-question-list">
                  {questions.map((question, index) => (
                    <article key={question.id} className="admin-question-item">
                      <div className="admin-question-top">
                        <div>
                          <span className="account-package-tag">
                            {question.section_name || 'Bagian umum'} • Urutan {question.question_order || index + 1}
                          </span>
                          <h3>{question.question_text}</h3>
                        </div>
                        <span className="account-status-pill account-status-fresh">{question.difficulty}</span>
                      </div>

                      <div className="admin-question-options-preview">
                        {(question.options || []).map((option) => (
                          <p key={option.id || `${question.id}-${option.letter}`}>
                            <strong>{option.letter}.</strong> {option.text}
                            {Number(option.is_correct) === 1 && <span className="admin-correct-badge">Jawaban Benar</span>}
                          </p>
                        ))}
                      </div>

                      <div className="admin-question-actions">
                        <button type="button" className="btn btn-outline" onClick={() => handleQuestionEdit(question)}>
                          Edit
                        </button>
                        <button type="button" className="btn btn-danger" onClick={() => handleQuestionDelete(question.id)}>
                          Hapus
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </AccountShell>
  );
}
