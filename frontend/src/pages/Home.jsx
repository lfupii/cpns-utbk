import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import apiClient from '../api';
import ProfileDropdown from '../components/ProfileDropdown';
import BrandLogo from '../components/BrandLogo';
import { businessProfile } from '../siteContent';

export default function Home() {
  const { user, logout, isAdmin } = useAuth();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    activePackages: [],
    history: [],
    loading: false,
  });

  const displayName = user?.full_name || 'Pejuang ASN';
  const firstName = displayName.trim().split(/\s+/)[0] || 'Pejuang';

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const response = await apiClient.get('/questions/packages');
        setPackages(response.data.data);
      } catch (err) {
        setError('Gagal memuat paket test');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPackages();
  }, []);

  useEffect(() => {
    let ignore = false;

    if (!user) {
      setDashboardData({
        activePackages: [],
        history: [],
        loading: false,
      });
      return undefined;
    }

    const fetchDashboardData = async () => {
      setDashboardData((current) => ({
        ...current,
        loading: true,
      }));

      const [activePackagesResult, historyResult] = await Promise.allSettled([
        apiClient.get('/auth/active-packages'),
        apiClient.get('/auth/test-history'),
      ]);

      if (ignore) {
        return;
      }

      setDashboardData({
        activePackages: activePackagesResult.status === 'fulfilled' ? activePackagesResult.value.data.data || [] : [],
        history: historyResult.status === 'fulfilled' ? historyResult.value.data.data || [] : [],
        loading: false,
      });
    };

    fetchDashboardData();

    return () => {
      ignore = true;
    };
  }, [user]);

  const handleLogout = () => {
    setIsMobileMenuOpen(false);
    setIsProfileMenuOpen(false);
    logout();
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);
  const handleMobileMenuToggle = () => {
    setIsProfileMenuOpen(false);
    setIsMobileMenuOpen((current) => !current);
  };
  const handleProfileMenuChange = (nextOpen) => {
    setIsProfileMenuOpen(nextOpen);
    if (nextOpen) {
      setIsMobileMenuOpen(false);
    }
  };

  const cpnsSource = packages.find((pkg) => pkg.name === 'CPNS Intensif') || null;
  const utbkSource = packages.find((pkg) => pkg.name === 'UTBK Intensif') || null;
  const curatedPackages = [
    {
      slug: 'utbk',
      title: 'UTBK',
      accent: 'landing-package-accent-utbk',
      visualImage: 'https://images.pexels.com/photos/6146970/pexels-photo-6146970.jpeg?auto=compress&cs=tinysrgb&w=1200',
      price: Number(utbkSource?.price ?? 5000),
      source: utbkSource,
      badge: 'Paling Hemat',
      subtitle: 'Cocok untuk latihan cepat, pemanasan skor, dan evaluasi harian.',
      features: [
        `${utbkSource?.question_count || 10} soal pilihan`,
        `Durasi ${utbkSource?.time_limit || 90} menit`,
        'Ringkasan hasil instan',
      ],
    },
    {
      slug: 'cpns',
      title: 'CPNS',
      accent: 'landing-package-accent-cpns',
      visualImage: 'https://images.pexels.com/photos/10041250/pexels-photo-10041250.jpeg?auto=compress&cs=tinysrgb&w=1200',
      price: Number(cpnsSource?.price ?? 10000),
      source: cpnsSource,
      badge: 'Favorit Peserta',
      subtitle: 'Fokus SKD dengan simulasi waktu, latihan kategori, dan progres belajar.',
      features: [
        `${cpnsSource?.question_count || 30} soal pilihan`,
        `Durasi ${cpnsSource?.time_limit || 120} menit`,
        'Progress tracker harian',
      ],
    },
  ];
  const activePackageCount = dashboardData.activePackages.length;
  const completedTryoutCount = dashboardData.history.length;
  const totalRemainingAttempts = dashboardData.activePackages.reduce(
    (total, item) => total + Number(item.remaining_attempts || 0),
    0
  );
  const hasActivePackage = activePackageCount > 0;
  const dashboardPercent = user
    ? hasActivePackage
      ? Math.min(92, 34 + activePackageCount * 18 + completedTryoutCount * 7)
      : 18
    : 8;
  const dashboardSummaryLabel = !user
    ? 'Mode preview'
    : hasActivePackage
      ? 'Akun belajar aktif'
      : 'Akun siap diaktifkan';
  const dashboardSummaryTitle = !user
    ? 'Preview dulu. Lanjut saat siap.'
    : hasActivePackage
      ? `Halo ${firstName}, progresmu siap dilanjutkan.`
      : `Halo ${firstName}, pilih paket untuk mulai penuh.`;
  const dashboardSummaryText = !user
    ? 'Guest hanya lihat preview.'
    : hasActivePackage
      ? 'Data diambil dari akun aktif.'
      : 'Belum ada paket aktif di akun ini.';
  const dashboardQueue = !user
    ? [
        'Login & simpan',
        'Lihat preview',
        'Aktifkan paket',
      ]
    : hasActivePackage
      ? [
          'Lanjutkan materi',
          'Mini test',
          'Tryout penuh',
        ]
      : [
          'Pilih paket',
          'Cek preview',
          'Aktifkan akses',
        ];
  const heroProofs = [
    {
      value: user ? activePackageCount : 2,
      label: user ? 'Paket aktif di akun ini' : 'Pilihan program utama',
    },
    {
      value: user ? completedTryoutCount : 'Preview',
      label: user ? 'Tryout selesai' : 'Materi awal bisa dibuka',
    },
    {
      value: user ? totalRemainingAttempts : 'Instan',
      label: user ? 'Sisa attempt aktif' : 'Hasil evaluasi cepat',
    },
  ];
  const heroBenefits = ['Preview materi', 'Mini test', 'Tryout penuh'];
  const sideHighlights = [
    {
      title: 'UTBK',
      detail: '7 subtes',
    },
    {
      title: 'CPNS',
      detail: 'TWK TIU TKP',
    },
    {
      title: 'Guest',
      detail: 'Preview',
    },
  ];

  if (loading) {
    return (
      <div className="landing-shell landing-loading">
        <p>Memuat halaman...</p>
      </div>
    );
  }

  return (
    <div className="landing-shell">
      <nav className="landing-navbar">
        <div className={`container landing-navbar-inner ${user ? 'landing-navbar-inner-authenticated' : ''}`}>
          <div className="landing-navbar-brand">
            <BrandLogo />
          </div>

          <div className="landing-nav-menu-slot">
            <button
              type="button"
              className={`mobile-nav-toggle ${isMobileMenuOpen ? 'mobile-nav-toggle-open' : ''}`}
              aria-label={isMobileMenuOpen ? 'Tutup navigasi' : 'Buka navigasi'}
              aria-expanded={isMobileMenuOpen}
              aria-controls="landing-nav-panel"
              onClick={handleMobileMenuToggle}
            >
              <span />
              <span />
              <span />
            </button>

            <div
              id="landing-nav-panel"
              className={`landing-navbar-panel ${isMobileMenuOpen ? 'landing-navbar-panel-open' : ''}`}
            >
              <div className="landing-nav-links">
                <a href="#tentang" onClick={closeMobileMenu}>Tentang</a>
                <a href="#keunggulan" onClick={closeMobileMenu}>Fitur</a>
                <a href="#paket" onClick={closeMobileMenu}>Program</a>
                <Link to="/contact" onClick={closeMobileMenu}>Kontak</Link>
                <Link to="/terms" onClick={closeMobileMenu}>Syarat &amp; Ketentuan</Link>
              </div>
              {!user && (
                <div className="landing-nav-panel-actions">
                  <Link to="/login" className="btn btn-outline" onClick={closeMobileMenu}>
                    Masuk
                  </Link>
                  <Link to="/register" className="btn btn-primary" onClick={closeMobileMenu}>
                    Daftar
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className={`landing-nav-actions ${user ? 'landing-nav-actions-authenticated' : 'landing-nav-actions-guest'}`}>
            {user ? (
              <ProfileDropdown
                displayName={displayName}
                onLogout={handleLogout}
                isAdmin={isAdmin}
                open={isProfileMenuOpen}
                onOpenChange={handleProfileMenuChange}
              />
            ) : (
              <>
                <Link to="/login" className="btn btn-outline" onClick={closeMobileMenu}>
                  Masuk
                </Link>
                <Link to="/register" className="btn btn-primary" onClick={closeMobileMenu}>
                  Daftar
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main>
        {error && (
          <div className="container landing-error">
            {error}
          </div>
        )}

        <section className="landing-hero">
          <div className="container landing-hero-asymmetric">
            <div className="landing-hero-copy landing-hero-copy-modern">
              <span className="landing-kicker">UTBK dan CPNS dalam satu ritme belajar</span>
              <h1>
                Belajar,
                <br />
                Latihan,
                <br />
                <span>Naikkan Skor.</span>
              </h1>

              <p>
                Preview dulu, simpan progres saat login, dan buka materi penuh saat paket aktif.
              </p>

              <div className="landing-benefit-strip" aria-label="Fitur utama">
                {heroBenefits.map((item) => (
                  <span key={item} className="landing-benefit-pill">{item}</span>
                ))}
              </div>

              <div className="landing-hero-actions">
                <a href="#paket" className="btn btn-primary landing-cta-secondary">
                  Lihat Paket
                </a>
              </div>

              <div className="landing-hero-proof-grid" aria-label="Ringkasan layanan">
                {heroProofs.map((proof) => (
                  <div className="landing-hero-proof-card" key={proof.label}>
                    <strong>{proof.value}</strong>
                    <span>{proof.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="landing-hero-visual" key={user?.userId || 'guest'}>
              <div className="landing-hero-floating-card landing-hero-floating-card-top">
                <span>{user ? 'Akun aktif' : 'Guest mode'}</span>
                <strong>{user ? displayName : 'Preview materi terbuka'}</strong>
              </div>

              <div className="landing-hero-dashboard">
                <div className="landing-hero-dashboard-head">
                  <div className="landing-hero-dashboard-copy">
                    <span className="landing-showcase-badge">{dashboardSummaryLabel}</span>
                    <h3>{dashboardSummaryTitle}</h3>
                    <p>{dashboardSummaryText}</p>
                  </div>

                  <div className="landing-hero-score-pill">
                    <strong>{dashboardPercent}%</strong>
                    <small>{dashboardData.loading ? 'sync...' : user ? 'akun aktif' : 'preview'}</small>
                  </div>
                </div>

                <div className="landing-showcase-progress landing-showcase-progress-hero">
                  <span style={{ width: `${dashboardPercent}%` }} />
                </div>

                <div className="landing-hero-dashboard-grid">
                  <div className="landing-hero-dashboard-panel">
                    <span className="landing-showcase-lane-label">Lanjut berikutnya</span>
                    <div className="landing-hero-step-list">
                      {dashboardQueue.map((item, index) => (
                        <div className="landing-hero-step" key={item}>
                          <span>{index + 1}</span>
                          <strong>{item}</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="landing-hero-dashboard-panel landing-hero-dashboard-panel-stats">
                    {sideHighlights.map((item) => (
                      <div className="landing-side-highlight" key={item.title}>
                        <strong>{item.title}</strong>
                        <span>{item.detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="landing-hero-floating-card landing-hero-floating-card-bottom">
                <span>{user ? (hasActivePackage ? 'Tryout tersimpan' : 'Siap diaktifkan') : 'Tanpa login'}</span>
                <strong>
                  {user
                    ? (hasActivePackage ? `${completedTryoutCount} hasil masuk` : 'Pilih paket untuk full access')
                    : 'Lihat materi awal lebih dulu'}
                </strong>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section landing-section-about" id="tentang">
          <div className="container">
            <div className="landing-about-band">
              <div className="landing-about-copy">
                <h2>Tentang Ujiin</h2>
                <p>
                  Ujiin adalah platform yang membantu persiapan CPNS dan UTBK lewat materi belajar,
                  latihan bertahap, simulasi tryout, dan hasil evaluasi yang langsung bisa dibaca
                  dari satu akun.
                </p>

                <div className="landing-about-tags" aria-label="Fokus utama Ujiin">
                  <span className="landing-about-tag">Materi belajar</span>
                  <span className="landing-about-tag">Latihan bertahap</span>
                  <span className="landing-about-tag">Tryout online</span>
                </div>
              </div>

              <div className="landing-about-visual" aria-label="Ilustrasi belajar bersama Ujiin">
                <div
                  className="landing-about-media"
                  style={{
                    backgroundImage:
                      "linear-gradient(180deg, rgba(15, 23, 47, 0.1), rgba(15, 23, 47, 0.38)), url('https://images.pexels.com/photos/5905709/pexels-photo-5905709.jpeg?auto=compress&cs=tinysrgb&w=1200')",
                  }}
                />

                <div className="landing-about-stat landing-about-stat-top">
                  <span>Belajar aktif</span>
                  <strong>Preview, materi, tryout</strong>
                </div>

                <div className="landing-about-stat landing-about-stat-bottom">
                  <span>Fokus utama</span>
                  <strong>CPNS dan UTBK dalam satu flow</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section" id="keunggulan">
          <div className="container landing-highlight-grid">
            <article className="landing-highlight-card">
              <h3>Rute belajar adaptif</h3>
              <p>Sistem membantu memprioritaskan materi yang paling butuh perhatianmu lebih dulu.</p>
            </article>
            <article className="landing-highlight-card">
              <h3>Latihan + evaluasi</h3>
              <p>Bukan hanya ngerjain soal, tapi langsung dapat bacaan progres yang mudah dipahami.</p>
            </article>
            <article className="landing-highlight-card">
              <h3>Simulasi bertahap</h3>
              <p>Mulai dari drill singkat sampai sesi penuh untuk membangun stamina ujian.</p>
            </article>
          </div>
        </section>

        <section className="landing-section" id="paket">
          <div className="container">
            <div className="landing-section-heading">
              <h2>Dua paket, langsung jelas pilihannya</h2>
              <p>
                Kami sederhanakan jadi dua opsi paling gampang dipahami: satu untuk UTBK dan satu
                untuk CPNS.
              </p>
            </div>

            <div className="landing-package-grid landing-package-grid-curated">
          {curatedPackages.map((pkg) => (
              <article key={pkg.slug} className={`landing-package-card landing-package-featured ${pkg.accent}`}>
                <div className="landing-package-top">
                  <span className="landing-package-category">
                  Paket {pkg.title}
                  </span>
                  <span className="landing-package-badge">{pkg.badge}</span>
                </div>

                <h3>{pkg.title} Intensif</h3>
                <p className="landing-package-description">{pkg.subtitle}</p>

                <div className="landing-package-visual">
                  <div
                    className="landing-package-visual-media"
                    style={{ backgroundImage: `linear-gradient(90deg, rgba(15, 23, 42, 0.08), rgba(15, 23, 42, 0.02)), url('${pkg.visualImage}')` }}
                    aria-hidden="true"
                  />
                  <div className="landing-package-orb"></div>
                  <div className="landing-package-mini-card">
                    <span>Smart Focus</span>
                    <strong>{pkg.title === 'UTBK' ? 'TPS + drill cepat' : 'TWK • TIU • TKP'}</strong>
                  </div>
                </div>

                <div className="landing-package-meta landing-package-meta-curated">
                  {pkg.features.map((feature) => (
                    <p key={feature}>{feature}</p>
                  ))}
                </div>

                <div className="landing-package-footer landing-package-footer-curated">
                  <div>
                    <span className="landing-package-price-label">Mulai dari</span>
                    <span className="landing-package-price">
                      Rp{pkg.price.toLocaleString('id-ID')}
                    </span>
                  </div>
                  {pkg.source ? (
                    <Link
                      to={`/learning/${pkg.source.id}`}
                      className="btn btn-primary landing-package-action"
                    >
                      {user ? (isAdmin ? `Buka ${pkg.title}` : 'Lihat Paket') : `Preview ${pkg.title}`}
                    </Link>
                  ) : (
                    <button type="button" className="btn btn-outline landing-package-action" disabled>
                      Sedang disiapkan
                    </button>
                  )}
                </div>
              </article>
          ))}
            </div>

            {!cpnsSource && !utbkSource && (
              <div className="landing-empty">
                <p>Data paket asli belum ditemukan, tapi tampilan dua paket sudah siap dipakai.</p>
              </div>
            )}
          </div>
        </section>

        <section className="landing-section landing-section-muted" id="testimoni">
          <div className="container landing-bottom-grid">
            <article className="landing-quote-card">
              <p>
                &ldquo;Yang paling ngebantu itu dashboard progresnya. Saya jadi tahu materi mana yang
                masih bikin skor turun.&rdquo;
              </p>
              <strong>Dina, peserta batch Januari</strong>
            </article>
            <article className="landing-quote-card" id="blog">
              <p>
                &ldquo;Belajar terasa lebih ringan karena targetnya dibagi per sesi, bukan dilempar
                semua sekaligus.&rdquo;
              </p>
              <strong>Arga, pengguna simulasi harian</strong>
            </article>
          </div>
        </section>
      </main>

      <footer className="landing-footer-note">
        <div className="container landing-footer-note-grid">
          <div className="landing-footer-note-inner">
            <p className="landing-footer-note-title">Informasi Kontak</p>
            <p>
              Butuh bantuan atau verifikasi informasi layanan? Hubungi kami di{' '}
              <a href={businessProfile.supportMailto}>{businessProfile.supportEmail}</a>.
            </p>
            <p>
              Website resmi: <a href={businessProfile.websiteUrl}>{businessProfile.websiteUrl}</a>
            </p>
          </div>

          <div className="landing-footer-note-inner">
            <p className="landing-footer-note-title">Kebijakan</p>
            <p>
              <Link to="/contact">Kontak</Link>
            </p>
            <p>
              <Link to="/terms">Syarat &amp; Ketentuan</Link>
            </p>
            <p>
              <Link to="/terms#privacy-policy">Kebijakan Privasi</Link>
            </p>
            <p>
              <Link to="/terms#refund-policy">Kebijakan Refund</Link>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
