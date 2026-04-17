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

export default function Learning() {
  const { packageId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const numericPackageId = Number(packageId);
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
      setActiveTopicIndex(0);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat ruang belajar');
    } finally {
      setLoading(false);
    }
  }, [numericPackageId]);

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
  const summary = learning?.summary || {};
  const packageData = learning?.package || null;
  const currentSectionTest = activeSection ? sectionTests[activeSection.code] || {} : {};
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

    if (hasAccess) {
      loadSectionTest(sectionCode);
    }
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

  const openTryoutView = () => {
    setContentView('tryout');
  };

  const openDashboardView = () => {
    setContentView('dashboard');
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
      shellClassName="account-shell-learning"
      title={`Ruang Belajar ${packageData.name}`}
      subtitle="Baca materi per subtest, kerjakan mini test, lalu lanjut ke tryout keseluruhan saat paket aktif."
    >
      {error && <div className="alert">{error}</div>}
      {successMessage && <div className="account-success learning-flash">{successMessage}</div>}

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
                  <section className="learning-page learning-page-topic-intro">
                    <span>{`Topik ${activeTopicIndex + 1}`}</span>
                    <h3>{activeTopic.title || `Topik ${activeTopicIndex + 1}`}</h3>
                    <p>
                      {hasAccess
                        ? `${activeTopic.pages?.length || 0} halaman siap dibaca di topik ini.`
                        : `Preview ${activeTopic.visible_page_count || activeTopic.pages?.length || 0} dari ${activeTopic.total_page_count || activeTopic.pages?.length || 0} halaman di topik ini.`}
                    </p>
                  </section>

                  {(activeTopic.pages || []).map((page, index) => (
                    <section key={`${activeTopic.title || 'topic'}-${index}`} className="learning-page learning-page-document">
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
                            {(page.points || []).map((point) => (
                              <li key={point}>{point}</li>
                            ))}
                          </ul>
                          <p>{page.closing}</p>
                        </>
                      )}
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
                            {question.question_image_url && (
                              <img
                                src={question.question_image_url}
                                alt={`Mini test ${questionIndex + 1}`}
                                className="test-question-image"
                                loading="lazy"
                              />
                            )}
                            <div className="learning-option-list">
                              {(question.options || []).map((option) => (
                                <label key={option.id} className="learning-option">
                                  <input
                                    type="radio"
                                    name={`section-${activeSection.code}-question-${question.id}`}
                                    checked={Number(currentSectionTest.answers?.[question.id]) === Number(option.id)}
                                    onChange={() => setSectionAnswer(activeSection.code, question.id, option.id)}
                                  />
                                  <span className="learning-option-copy">
                                    <span>{option.letter}. {option.text}</span>
                                    {option.image_url && (
                                      <img
                                        src={option.image_url}
                                        alt={`Opsi ${option.letter}`}
                                        className="test-option-image"
                                        loading="lazy"
                                      />
                                    )}
                                  </span>
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

              {hasAccess && activeSectionView === 'mini-test' && !currentSectionTest.open && (
                <div className="learning-subtest-box">
                  <div className="learning-section-title">
                    <p>Mini test subtest</p>
                    <h3>{activeSection.name}</h3>
                  </div>
                  <button type="button" className="btn btn-primary" onClick={() => loadSectionTest(activeSection.code)}>
                    Buka Mini Test
                  </button>
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
