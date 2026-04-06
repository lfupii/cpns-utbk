import React, { useEffect, useMemo, useState } from 'react';
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
  const [questionSaving, setQuestionSaving] = useState(false);
  const [importingQuestions, setImportingQuestions] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [packageForm, setPackageForm] = useState(null);
  const [questionForm, setQuestionForm] = useState(createEmptyQuestionForm());
  const [showQuestionEditor, setShowQuestionEditor] = useState(false);
  const [expandedQuestionId, setExpandedQuestionId] = useState(null);
  const [questionQuery, setQuestionQuery] = useState('');
  const [importRows, setImportRows] = useState([]);
  const [importFileName, setImportFileName] = useState('');

  const selectedPackage = useMemo(
    () => packages.find((pkg) => Number(pkg.id) === Number(selectedPackageId)) || null,
    [packages, selectedPackageId]
  );
  const packageSections = selectedPackage?.workflow?.sections || [];
  const defaultSectionCode = packageSections[0]?.code || '';

  const filteredQuestions = useMemo(() => {
    const needle = questionQuery.trim().toLowerCase();
    if (!needle) {
      return questions;
    }

    return questions.filter((question) => {
      const haystack = [
        question.question_text,
        question.section_name,
      ].join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }, [questionQuery, questions]);

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

    const [questionsResponse, packagesResponse] = await Promise.all([
      apiClient.get(`/admin/questions?package_id=${packageId}`),
      apiClient.get('/admin/packages'),
    ]);

    setQuestions(questionsResponse.data.data || []);
    setPackages(packagesResponse.data.data || []);
  };

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
    setQuestionForm(createEmptyQuestionForm(defaultSectionCode));
    setSuccess('');
    setError('');
    setShowQuestionEditor(true);
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
      const payloadRows = createImportPayload(parsedRows, defaultSectionCode);
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

  return (
    <AccountShell
      title="Panel Admin"
      subtitle="Kelola paket, soal, gambar, dan import bank soal dari satu workspace yang lebih ringkas."
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
            <section className="account-card admin-sidebar admin-sticky-card">
              <div className="admin-section-header admin-section-header-compact">
                <div>
                  <h2>Paket Aktif</h2>
                  <p className="text-muted">Pilih paket yang ingin dikelola.</p>
                </div>
                <span className="account-package-tag admin-meta-pill">{packages.length} paket</span>
              </div>
              <div className="admin-package-switcher">
                {packages.map((pkg) => (
                  <button
                    key={pkg.id}
                    type="button"
                    className={`admin-package-switch ${Number(selectedPackageId) === Number(pkg.id) ? 'admin-package-switch-active' : ''}`}
                    onClick={() => {
                      setSelectedPackageId(Number(pkg.id));
                      resetQuestionForm();
                      setExpandedQuestionId(null);
                    }}
                  >
                    <strong>{pkg.name}</strong>
                    <span>Rp{Number(pkg.price).toLocaleString('id-ID')}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="account-card admin-main-card admin-panel-card">
              <div className="admin-section-header admin-section-header-compact">
                <div>
                  <h2>Pengaturan Paket</h2>
                  <p className="text-muted">Harga, akses, dan mekanisme ujian.</p>
                </div>
                {selectedPackage && (
                  <span className="account-package-tag admin-meta-pill">
                    {selectedPackage.test_mode === 'utbk_sectioned' ? 'UTBK Bertahap' : 'CPNS CAT'}
                  </span>
                )}
              </div>
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

          <div className={`admin-grid admin-grid-questions ${showQuestionEditor ? '' : 'admin-grid-questions-collapsed'}`}>
            <section className="account-card admin-main-card admin-panel-card admin-list-card">
              <div className="admin-section-header admin-list-toolbar">
                <div>
                  <h2>Bank Soal</h2>
                  <p className="text-muted">
                    {selectedPackage ? `${selectedPackage.name} • ${filteredQuestions.length}/${questions.length} soal tampil` : 'Pilih paket terlebih dahulu'}
                  </p>
                </div>
                <div className="admin-list-toolbar-actions">
                  <input
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
                    <input type="file" accept=".csv,text/csv" onChange={handleImportFileChange} hidden />
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
                <div className="admin-question-table">
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
                      <div key={question.id} className={`admin-question-row-wrap ${isExpanded ? 'admin-question-row-wrap-expanded' : ''}`}>
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
              <section className="account-card admin-main-card admin-panel-card admin-editor-card">
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
                            type="text"
                            value={option.text}
                            onChange={(event) => handleOptionFieldChange(index, 'text', event.target.value)}
                            placeholder={`Isi opsi ${option.letter}`}
                          />
                        </div>

                        <div className="form-group">
                          <label>URL Gambar Opsi {option.letter}</label>
                          <input
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
        </div>
      )}
    </AccountShell>
  );
}
