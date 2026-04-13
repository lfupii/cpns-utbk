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
    ? 'Masuk ke materi preview dulu, lalu lanjutkan saat sudah siap.'
    : hasActivePackage
      ? `Halo ${firstName}, lanjutkan sesi belajarmu dari titik terakhir.`
      : `Halo ${firstName}, akunmu sudah masuk dan tinggal pilih paket yang mau diaktifkan.`;
  const dashboardSummaryText = !user
    ? 'Panel ini tidak menyimpan progres akun. Setelah login, ringkasan belajar akan menyesuaikan akun yang sedang aktif.'
    : hasActivePackage
      ? 'Ringkasan ini mengambil data paket aktif dan riwayat tryout dari akun yang sedang login.'
      : 'Belum ada paket aktif di akun ini, jadi dashboard menampilkan langkah awal yang perlu diselesaikan lebih dulu.';
  const dashboardQueue = !user
    ? [
        'Masuk untuk menyimpan progres dan milestone',
        'Buka preview materi per subtes',
        'Aktifkan paket saat ingin akses penuh',
      ]
    : hasActivePackage
      ? [
          'Lanjutkan materi prioritas yang belum selesai',
          'Kerjakan mini test subtes terlemah',
          'Masuk ke tryout penuh dan review hasilnya',
        ]
      : [
          'Pilih paket UTBK atau CPNS yang ingin dibuka',
          'Baca preview materi untuk cek kecocokan',
          'Lanjutkan pembayaran agar semua materi aktif',
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
  const sideHighlights = [
    {
      title: 'UTBK',
      detail: 'TPS, literasi, dan penalaran disusun per subtes agar fokus belajarnya rapi.',
    },
    {
      title: 'CPNS',
      detail: 'TWK, TIU, dan TKP dibuka dalam jalur belajar yang mudah diikuti.',
    },
    {
      title: 'Preview',
      detail: 'Tanpa login tetap bisa lihat bagian awal materi sebelum lanjut ke paket.',
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

        <section className="landing-hero" id="tentang">
          <div className="container landing-hero-stack">
            <div className="landing-hero-grid">
              <div className="landing-hero-copy">
                <span className="landing-kicker">Persiapan SKD dan UTBK yang lebih tertata</span>
                <h1>
                  Belajar Cepat,
                  <br />
                  Tahu Harus
                  <br />
                  <span>Lanjut ke Mana</span>
                </h1>

                <div className="landing-pill">
                  <span className="landing-pill-icon">●</span>
                  <span>
                    Preview materi terbuka lebih dulu, lalu lanjut ke paket saat kamu sudah siap
                  </span>
                </div>

                <p>
                  Mulai dari lihat materi awal, lanjut ke mini test subtes, lalu tutup dengan tryout
                  penuh. Alurnya dibikin ringkas supaya kamu tidak kehilangan arah di tengah belajar.
                </p>

                <div className="landing-bullet-list">
                  <span>Materi dibagi per subtes yang gampang dipilih</span>
                  <span>Ringkasan hasil dan prioritas belajar langsung terlihat</span>
                  <span>Dashboard menyesuaikan akun aktif, bukan sisa akun sebelumnya</span>
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

              <aside className="landing-hero-sidecard">
                <div className="landing-showcase-badge">{user ? `Halo, ${firstName}` : 'Mode preview terbuka'}</div>
                <h3>UTBK dan CPNS sekarang punya alur masuk yang lebih jelas dari awal.</h3>
                <p>
                  Mulai sebagai guest untuk lihat preview, lalu login saat ingin menyimpan progres,
                  dan aktifkan paket untuk membuka seluruh materi beserta tryout lengkap.
                </p>

                <div className="landing-side-highlight-list">
                  {sideHighlights.map((item) => (
                    <div className="landing-side-highlight" key={item.title}>
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                    </div>
                  ))}
                </div>
              </aside>
            </div>

            <div className="landing-showcase-panel landing-showcase-panel-wide" key={user?.userId || 'guest'}>
              <div className="landing-showcase-summary">
                <div className="landing-showcase-summary-copy">
                  <span className="landing-showcase-summary-label">{dashboardSummaryLabel}</span>
                  <h3>{dashboardSummaryTitle}</h3>
                  <p>{dashboardSummaryText}</p>
                </div>

                <div className="landing-showcase-progress-card">
                  <span className="landing-showcase-progress-account">
                    {dashboardData.loading ? 'Memuat data akun...' : user ? displayName : 'Guest preview'}
                  </span>
                  <strong>{dashboardPercent}%</strong>
                  <div className="landing-showcase-progress">
                    <span style={{ width: `${dashboardPercent}%` }} />
                  </div>
                  <small>
                    {!user
                      ? 'Saat logout, panel kembali ke mode preview dan progres akun tidak dibawa.'
                      : hasActivePackage
                        ? `${activePackageCount} paket aktif dan ${completedTryoutCount} tryout tersimpan di akun ini.`
                        : 'Belum ada paket aktif di akun ini, jadi langkah berikutnya adalah memilih paket.'}
                  </small>
                </div>
              </div>

              <div className="landing-showcase-lanes">
                <div className="landing-showcase-lane">
                  <span className="landing-showcase-lane-label">Agenda berikutnya</span>
                  <div className="landing-showcase-task-list">
                    {dashboardQueue.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                </div>

                <div className="landing-showcase-lane">
                  <span className="landing-showcase-lane-label">Status akun</span>
                  <div className="landing-showcase-stat-grid landing-showcase-stat-grid-compact">
                    <div className="landing-showcase-stat">
                      <strong>{user ? activePackageCount : '2'}</strong>
                      <span>{user ? 'Paket aktif' : 'Program utama'}</span>
                    </div>
                    <div className="landing-showcase-stat">
                      <strong>{user ? completedTryoutCount : 'Preview'}</strong>
                      <span>{user ? 'Tryout selesai' : 'Materi awal terbuka'}</span>
                    </div>
                    <div className="landing-showcase-stat">
                      <strong>{user ? totalRemainingAttempts : 'Login'}</strong>
                      <span>{user ? 'Sisa attempt' : 'Untuk simpan progres'}</span>
                    </div>
                  </div>
                </div>

                <div className="landing-showcase-lane">
                  <span className="landing-showcase-lane-label">Alur belajar</span>
                  <div className="landing-showcase-flow">
                    <div className="landing-showcase-flow-item">
                      <span>01</span>
                      <div>
                        <strong>Pilih subtes</strong>
                        <p>Masuk dari materi yang paling butuh perhatian terlebih dahulu.</p>
                      </div>
                    </div>
                    <div className="landing-showcase-flow-item">
                      <span>02</span>
                      <div>
                        <strong>Baca materi</strong>
                        <p>Guest melihat preview, user berpaket membuka pembahasan penuh.</p>
                      </div>
                    </div>
                    <div className="landing-showcase-flow-item">
                      <span>03</span>
                      <div>
                        <strong>Tutup dengan tryout</strong>
                        <p>Hasil akhir langsung masuk ke riwayat akun yang sedang aktif.</p>
                      </div>
                    </div>
                  </div>
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
