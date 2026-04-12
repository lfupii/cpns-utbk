import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AccountShell from '../components/AccountShell';
import apiClient from '../api';
import { useAuth } from '../AuthContext';

function formatScore(result) {
  if (!result) {
    return '';
  }

  const score = Number(result.score ?? 0);
  const correct = Number(result.correct_answers ?? 0);
  const total = Number(result.total_questions ?? 0);

  return `${score.toLocaleString('id-ID')} - ${correct}/${total} benar`;
}

function sanitizeMaterialHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(html || ''), 'text/html');
  doc.querySelectorAll('script, iframe, object, embed, link, meta, style').forEach((node) => node.remove());
  doc.body.querySelectorAll('*').forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (name.startsWith('on') || value.startsWith('javascript:')) {
        node.removeAttribute(attribute.name);
      }
    });
  });
  return doc.body.innerHTML;
}

export default function Learning() {
  const { packageId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const numericPackageId = Number(packageId);
  const [learning, setLearning] = useState(null);
  const [activeTab, setActiveTab] = useState('materi');
  const [activeSectionCode, setActiveSectionCode] = useState('');
  const [sectionTests, setSectionTests] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fetchLearning = useCallback(async () => {
    if (!Number.isInteger(numericPackageId) || numericPackageId <= 0) {
      setError('Link paket tidak valid. Silakan pilih ulang paket yang tersedia.');
      setLoading(false);
      return;
    }

    try {
      const response = await apiClient.get(`/learning/package?package_id=${numericPackageId}`);
      const payload = response.data.data;
      setLearning(payload);
      setActiveSectionCode((current) => current || payload.sections?.[0]?.code || '');
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat ruang belajar');
    } finally {
      setLoading(false);
    }
  }, [numericPackageId]);

  useEffect(() => {
    fetchLearning();
  }, [fetchLearning]);

  const sections = useMemo(() => learning?.sections || [], [learning]);
  const activeSection = useMemo(
    () => sections.find((section) => section.code === activeSectionCode) || sections[0] || null,
    [activeSectionCode, sections]
  );
  const hasAccess = Boolean(learning?.has_access);
  const viewerIsAuthenticated = Boolean(learning?.is_authenticated ?? isAuthenticated);
  const summary = learning?.summary || {};
  const packageData = learning?.package || null;
  const currentSectionTest = activeSection ? sectionTests[activeSection.code] || {} : {};
  const completedTryout = Number(summary.completed_attempts || 0) > 0;
  const materialDoneCount = sections.filter((section) => section.progress.material_read).length;
  const subtestDoneCount = sections.filter((section) => section.progress.subtest_test_completed).length;
  const totalMilestoneSteps = Math.max(1, sections.length * 2 + 1);
  const completedMilestoneSteps = materialDoneCount + subtestDoneCount + (completedTryout ? 1 : 0);
  const milestonePercent = Math.round((completedMilestoneSteps / totalMilestoneSteps) * 100);

  const jumpToSectionMaterial = (sectionCode) => {
    setActiveTab('materi');
    setActiveSectionCode(sectionCode);
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

  const loadSectionTest = async (sectionCode) => {
    setSectionTests((current) => ({
      ...current,
      [sectionCode]: {
        ...(current[sectionCode] || {}),
        loading: true,
        open: true,
        error: '',
      },
    }));
    setError('');
    setSuccessMessage('');

    try {
      const response = await apiClient.get(
        `/learning/section-test?package_id=${numericPackageId}&section_code=${encodeURIComponent(sectionCode)}`
      );
      const questions = response.data.data?.questions || [];
      setSectionTests((current) => ({
        ...current,
        [sectionCode]: {
          ...(current[sectionCode] || {}),
          loading: false,
          open: true,
          questions,
          answers: current[sectionCode]?.answers || {},
          error: '',
        },
      }));
    } catch (err) {
      setSectionTests((current) => ({
        ...current,
        [sectionCode]: {
          ...(current[sectionCode] || {}),
          loading: false,
          open: true,
          error: err.response?.data?.message || 'Gagal memuat test subtest',
        },
      }));
    }
  };

  const setSectionAnswer = (sectionCode, questionId, optionId) => {
    setSectionTests((current) => ({
      ...current,
      [sectionCode]: {
        ...(current[sectionCode] || {}),
        answers: {
          ...(current[sectionCode]?.answers || {}),
          [questionId]: optionId,
        },
      },
    }));
  };

  const submitSectionTest = async (sectionCode) => {
    const testState = sectionTests[sectionCode] || {};
    const questions = testState.questions || [];
    const answers = questions
      .map((question) => ({
        question_id: question.id,
        option_id: testState.answers?.[question.id],
      }))
      .filter((answer) => answer.option_id);

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

    if (answers.length < questions.length) {
      setSectionTests((current) => ({
        ...current,
        [sectionCode]: {
          ...(current[sectionCode] || {}),
          error: 'Lengkapi semua jawaban mini test dulu.',
        },
      }));
      return;
    }

    setActionLoading(`test-${sectionCode}`);
    setError('');
    setSuccessMessage('');

    try {
      const response = await apiClient.post('/learning/section-test/submit', {
        package_id: numericPackageId,
        section_code: sectionCode,
        answers,
      });
      const result = response.data.data;
      setSectionTests((current) => ({
        ...current,
        [sectionCode]: {
          ...(current[sectionCode] || {}),
          result,
          error: '',
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
          error: err.response?.data?.message || 'Gagal menyimpan mini test subtest',
        },
      }));
    } finally {
      setActionLoading('');
    }
  };

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

  return (
    <AccountShell
      title={`Ruang Belajar ${packageData.name}`}
      subtitle="Baca materi per subtest, kerjakan mini test, lalu lanjut ke tryout keseluruhan saat paket aktif."
    >
      {error && <div className="alert">{error}</div>}
      {successMessage && <div className="account-success learning-flash">{successMessage}</div>}

      <section className="learning-hero-panel">
        <div>
          <span className="account-package-tag">{packageData.category_name}</span>
          <h2>{packageData.name}</h2>
          <p>{packageData.description}</p>
        </div>
        <div className="learning-hero-actions">
          {hasAccess ? (
            <Link to={`/test/${numericPackageId}`} className="btn btn-primary">
              Mulai Tryout Keseluruhan
            </Link>
          ) : !viewerIsAuthenticated ? (
            <Link to="/login" className="btn btn-primary">
              Login untuk Buka Lengkap
            </Link>
          ) : (
            <Link to={`/payment/${numericPackageId}`} className="btn btn-primary">
              Aktifkan Paket
            </Link>
          )}
          <Link to="/" className="btn btn-outline">
            Kembali ke Home
          </Link>
        </div>
      </section>

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

      <section className="learning-dashboard">
        <div className="learning-milestone">
          <div className="learning-path-head">
            <div className="learning-section-title">
              <p>Timeline belajar</p>
              <h3>Milestone</h3>
            </div>
            <div className="learning-path-score" aria-label={`Progress belajar ${milestonePercent} persen`}>
              <strong>{milestonePercent}%</strong>
              <span>progress</span>
            </div>
          </div>

          <div className="learning-progress-track" aria-hidden="true">
            <span style={{ width: `${milestonePercent}%` }} />
          </div>

          <div className="learning-path-list">
            {sections.map((section, index) => {
              const materialDone = Boolean(section.progress.material_read);
              const subtestDone = Boolean(section.progress.subtest_test_completed);
              const sectionDone = materialDone && subtestDone;
              const isActive = section.code === activeSection?.code;

              return (
                <button
                  type="button"
                  key={section.code}
                  className={[
                    'learning-path-card',
                    sectionDone ? 'learning-path-card-done' : '',
                    isActive ? 'learning-path-card-active' : '',
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
            <div className={`learning-path-card learning-path-card-final ${completedTryout ? 'learning-path-card-done' : ''}`}>
              <span className="learning-path-index">T</span>
              <span className="learning-path-copy">
                <strong>Tryout keseluruhan</strong>
                <small>{completedTryout ? 'Simulasi penuh sudah dikerjakan' : 'Terbuka setelah paket aktif'}</small>
              </span>
              <span className="learning-path-steps">
                <span className={completedTryout ? 'learning-path-step learning-path-step-done' : 'learning-path-step'}>
                  {completedTryout ? 'Selesai' : 'Belum'}
                </span>
              </span>
            </div>
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
      </section>

      <div className="learning-tabs">
        <button
          type="button"
          className={activeTab === 'materi' ? 'learning-tab learning-tab-active' : 'learning-tab'}
          onClick={() => setActiveTab('materi')}
        >
          Materi
        </button>
        <button
          type="button"
          className={activeTab === 'tryout' ? 'learning-tab learning-tab-active' : 'learning-tab'}
          onClick={() => setActiveTab('tryout')}
        >
          Tryout
        </button>
      </div>

      {activeTab === 'materi' ? (
        <section className="learning-layout">
          <aside className="learning-section-nav">
            {sections.map((section) => (
              <button
                type="button"
                key={section.code}
                className={section.code === activeSection?.code ? 'learning-section-button learning-section-button-active' : 'learning-section-button'}
                onClick={() => setActiveSectionCode(section.code)}
              >
                <span>{section.name}</span>
                <small>
                  {section.progress.material_read && section.progress.subtest_test_completed
                    ? 'Milestone selesai'
                    : `${section.visible_page_count}/${section.total_page_count} halaman`}
                </small>
              </button>
            ))}
          </aside>

          {activeSection && (
            <article className="learning-material">
              <div className="learning-material-header">
                <div>
                  <span className="account-package-tag">
                    {activeSection.session_name || packageData.category_name}
                  </span>
                  <h2>{activeSection.name}</h2>
                  <p>
                    {hasAccess
                      ? 'Materi penuh terbuka. Baca sampai akhir, lalu tandai selesai dan kerjakan mini test.'
                      : `Preview ${activeSection.visible_page_count} dari ${activeSection.total_page_count} halaman materi.`}
                  </p>
                </div>
                {activeSection.progress.material_read && (
                  <span className="account-status-pill account-status-fresh">Materi selesai</span>
                )}
              </div>

              <div className="learning-page-list">
                {activeSection.pages.map((page, index) => (
                  <section key={page.title} className="learning-page">
                    <span>Halaman {index + 1}</span>
                    <h3>{page.title}</h3>
                    {page.content_html ? (
                      <div
                        className="learning-rich-content"
                        dangerouslySetInnerHTML={{ __html: sanitizeMaterialHtml(page.content_html) }}
                      />
                    ) : (
                      <>
                        <ul>
                          {page.points.map((point) => (
                            <li key={point}>{point}</li>
                          ))}
                        </ul>
                        <p>{page.closing}</p>
                      </>
                    )}
                  </section>
                ))}
              </div>

              {!hasAccess && activeSection.locked_page_count > 0 && (
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

              {hasAccess && (
                <div className="learning-section-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={activeSection.progress.material_read || actionLoading === `material-${activeSection.code}`}
                    onClick={() => markMaterialRead(activeSection.code)}
                  >
                    {activeSection.progress.material_read ? 'Materi Sudah Selesai' : 'Tandai Materi Selesai'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => loadSectionTest(activeSection.code)}
                  >
                    {currentSectionTest.open ? 'Muat Ulang Mini Test' : 'Buka Mini Test Subtest'}
                  </button>
                </div>
              )}

              {hasAccess && currentSectionTest.open && (
                <div className="learning-subtest-box">
                  <div className="learning-section-title">
                    <p>Mini test subtest</p>
                    <h3>{activeSection.name}</h3>
                  </div>

                  {currentSectionTest.loading ? (
                    <p>Memuat mini test...</p>
                  ) : currentSectionTest.error ? (
                    <div className="alert">{currentSectionTest.error}</div>
                  ) : (currentSectionTest.questions || []).length === 0 ? (
                    <p className="text-muted">Soal mini test untuk subtest ini belum tersedia.</p>
                  ) : (
                    <>
                      <div className="learning-question-list">
                        {currentSectionTest.questions.map((question, questionIndex) => (
                          <div key={question.id} className="learning-question">
                            <h4>{questionIndex + 1}. {question.question_text}</h4>
                            <div className="learning-option-list">
                              {(question.options || []).map((option) => (
                                <label key={option.id} className="learning-option">
                                  <input
                                    type="radio"
                                    name={`section-${activeSection.code}-question-${question.id}`}
                                    checked={Number(currentSectionTest.answers?.[question.id]) === Number(option.id)}
                                    onChange={() => setSectionAnswer(activeSection.code, question.id, option.id)}
                                  />
                                  <span>{option.letter}. {option.text}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      {currentSectionTest.result && (
                        <div className="learning-test-result">
                          Hasil mini test: <strong>{formatScore(currentSectionTest.result)}</strong>
                        </div>
                      )}

                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={actionLoading === `test-${activeSection.code}`}
                        onClick={() => submitSectionTest(activeSection.code)}
                      >
                        {activeSection.progress.subtest_test_completed ? 'Ulangi dan Simpan Hasil' : 'Submit Mini Test'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </article>
          )}
        </section>
      ) : (
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
            <button type="button" className="btn btn-outline" onClick={() => setActiveTab('materi')}>
              Lihat Materi Dulu
            </button>
          </div>
        </section>
      )}
    </AccountShell>
  );
}
