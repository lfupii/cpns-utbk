import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import apiClient from '../api';
import ProfileDropdown from '../components/ProfileDropdown';
import BrandLogo from '../components/BrandLogo';
import ThemeToggle from '../components/ThemeToggle';
import { businessProfile } from '../siteContent';

function FeatureIcon({ name }) {
  switch (name) {
    case 'bag':
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="5.4" y="8.2" width="13.2" height="11" rx="2.6" fill="#dbeafe" />
          <path
            d="M7 9V7.75C7 5.679 8.679 4 10.75 4h2.5C15.321 4 17 5.679 17 7.75V9"
            stroke="#4f46e5"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M6.1 8.75h11.8l-.7 9.13a2 2 0 0 1-1.99 1.85H8.79a2 2 0 0 1-1.99-1.85l-.7-9.13Z"
            stroke="#2563eb"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="m9.8 14.2 1.5 1.5 3.2-3.4"
            stroke="#16a34a"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'book':
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6.5 6.1h8.3a2.7 2.7 0 0 1 2.7 2.7v9.9H9.4a2.9 2.9 0 0 0-2.9 2.9V8.9a2.8 2.8 0 0 1 2.8-2.8Z" fill="#dbeafe" />
          <path d="M10.4 10.1h4.5" stroke="#2563eb" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M10.4 13.2h4.5" stroke="#60a5fa" strokeWidth="1.7" strokeLinecap="round" />
          <path
            d="M6.5 5.2h8.2a2.8 2.8 0 0 1 2.8 2.8v10.8H9.3a2.8 2.8 0 0 0-2.8 2.8V8a2.8 2.8 0 0 1 2.8-2.8Z"
            stroke="#1d4ed8"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M17.5 18.8H9.3a2.8 2.8 0 0 0-2.8 2.8m4.3-11.2h4.3m-4.3 3.4h4.3"
            stroke="#334155"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'checklist':
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="4.2" y="4.6" width="15.6" height="14.8" rx="3" fill="#eff6ff" />
          <path
            d="M9.8 6.5h7.7M9.8 12h7.7M9.8 17.5h7.7"
            stroke="#475569"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="m5.6 6.6 1.2 1.2 1.9-2.2M5.6 12.1l1.2 1.2 1.9-2.2M5.6 17.6l1.2 1.2 1.9-2.2"
            stroke="#2563eb"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'timer':
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="13.2" r="6.2" fill="#dbeafe" />
          <path
            d="M9 4h6m-3 0v2.2m4.9 1.6 1.5-1.5"
            stroke="#475569"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="13.2" r="6.8" stroke="#2563eb" strokeWidth="1.8" />
          <path
            d="M12 13.2 15 11.4M12 9.8v3.6"
            stroke="#7c3aed"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="13.2" r="1.2" fill="#0f172a" />
        </svg>
      );
    case 'chart':
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 18.5h2.5v-4.1H6v4.1Zm4.7 0h2.6v-6.7h-2.6v6.7Zm4.8 0h2.5V8.2h-2.5v10.3Z" fill="#93c5fd" />
          <path
            d="M5 18.5h14M6.5 16V12m4 4V9m4 7V6"
            stroke="#334155"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="m6.5 11.8 4-3 4 1.8 3-3.6"
            stroke="#2563eb"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="6.5" cy="11.8" r="1" fill="#7c3aed" />
          <circle cx="10.5" cy="8.8" r="1" fill="#2563eb" />
          <circle cx="14.5" cy="10.6" r="1" fill="#14b8a6" />
          <circle cx="17.5" cy="7" r="1" fill="#f59e0b" />
        </svg>
      );
    default:
      return null;
  }
}

export default function Home() {
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [activeLandingSection, setActiveLandingSection] = useState('tentang');

  const displayName = user?.full_name || 'Pejuang ASN';
  const isHomePage = location.pathname === '/';
  const isNewsPage = location.pathname.startsWith('/news');
  const isContactPage = location.pathname === '/contact';
  const isTermsPage = location.pathname === '/terms';
  const isLandingSectionActive = (sectionId) => isHomePage && activeLandingSection === sectionId;

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
    const handleScroll = () => {
      const nextScrollY = window.scrollY;
      setIsScrolled((current) => {
        if (current) {
          return nextScrollY > 20;
        }

        return nextScrollY > 64;
      });
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    if (!isHomePage) {
      return undefined;
    }

    const sectionIds = ['tentang', 'keunggulan', 'paket'];
    const resolveActiveSection = () => {
      const viewportOffset = window.innerWidth >= 1024 ? 180 : 140;
      let nextActiveSection = sectionIds[0];

      sectionIds.forEach((sectionId) => {
        const sectionElement = document.getElementById(sectionId);
        if (!sectionElement) {
          return;
        }

        const sectionTop = sectionElement.getBoundingClientRect().top;
        if (sectionTop - viewportOffset <= 0) {
          nextActiveSection = sectionId;
        }
      });

      setActiveLandingSection((current) => (
        current === nextActiveSection ? current : nextActiveSection
      ));
    };

    const hashSection = location.hash.replace('#', '');
    if (sectionIds.includes(hashSection)) {
      setActiveLandingSection(hashSection);
    } else {
      resolveActiveSection();
    }

    window.addEventListener('scroll', resolveActiveSection, { passive: true });

    return () => {
      window.removeEventListener('scroll', resolveActiveSection);
    };
  }, [isHomePage, location.hash]);

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
  const packageDiscountPercent = 50;
  const featureMindmap = [
    {
      step: '01',
      badge: 'Mulai',
      icon: 'bag',
      accent: '#7c4dff',
      align: 'top',
      title: 'Pilih paket yang mau dikerjakan',
    },
    {
      step: '02',
      badge: 'Materi',
      icon: 'book',
      accent: '#8a3ffc',
      align: 'bottom',
      title: 'Baca materi per subtest',
    },
    {
      step: '03',
      badge: 'Latihan',
      icon: 'checklist',
      accent: '#4f7dff',
      align: 'top',
      title: 'Kerjakan mini test subtest',
    },
    {
      step: '04',
      badge: 'Tryout',
      icon: 'timer',
      accent: '#7c4dff',
      align: 'bottom',
      title: 'Masuk tryout penuh dengan timer',
    },
    {
      step: '05',
      badge: 'Hasil',
      icon: 'chart',
      accent: '#7c4dff',
      align: 'top',
      title: 'Lihat hasil, skor, dan riwayat',
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
      <nav className={`landing-navbar ${isScrolled ? 'landing-navbar-scrolled' : ''}`}>
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
                <a
                  href="#tentang"
                  className={isLandingSectionActive('tentang') ? 'landing-nav-link-active' : ''}
                  onClick={closeMobileMenu}
                >
                  Tentang
                </a>
                <a
                  href="#keunggulan"
                  className={isLandingSectionActive('keunggulan') ? 'landing-nav-link-active' : ''}
                  onClick={closeMobileMenu}
                >
                  Fitur
                </a>
                <a
                  href="#paket"
                  className={isLandingSectionActive('paket') ? 'landing-nav-link-active' : ''}
                  onClick={closeMobileMenu}
                >
                  Program
                </a>
                <Link
                  to="/contact"
                  className={isContactPage ? 'landing-nav-link-active' : ''}
                  onClick={closeMobileMenu}
                >
                  Kontak
                </Link>
                <Link
                  to="/terms"
                  className={isTermsPage ? 'landing-nav-link-active' : ''}
                  onClick={closeMobileMenu}
                >
                  Syarat &amp; Ketentuan
                </Link>
                <Link
                  to="/news"
                  className={isNewsPage ? 'landing-nav-link-active' : ''}
                  onClick={closeMobileMenu}
                >
                  Berita
                </Link>
              </div>
              {!user && <ThemeToggle mobile onToggle={closeMobileMenu} />}
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

        <section className="landing-section landing-section-about" id="tentang">
          <div className="container">
            <div className="landing-about-band">
              <div className="landing-about-copy">
                <h2>
                  <span className="landing-about-title-prefix">Tentang</span>
                  <img
                    className="landing-about-title-logo landing-about-title-logo-default"
                    src="/ujiin-logo.png"
                    alt="Ujiin"
                  />
                  <img
                    className="landing-about-title-logo landing-about-title-logo-dark"
                    src="/ujiin-logo-dark.png"
                    alt="Ujiin"
                  />
                </h2>
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

                <div className="landing-about-actions">
                  <a href="#paket" className="btn btn-primary">
                    Lihat Program
                  </a>
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

        <section className="landing-section landing-section-featured" id="keunggulan">
          <div className="container">
            <div className="landing-section-heading">
              <h2>Fitur yang saling nyambung dalam satu flow belajar</h2>
            </div>

            <div className="landing-mindmap-shell">
              <div className="landing-mindmap-track" aria-label="Flow fitur Ujiin">
                <svg className="landing-mindmap-line" viewBox="0 0 1000 420" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="landingMindmapGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#8a3ffc" />
                      <stop offset="48%" stopColor="#4f7dff" />
                      <stop offset="100%" stopColor="#43c7bb" />
                    </linearGradient>
                  </defs>
                  <path d="M36 188 C88 188 96 188 100 188 S228 262 300 262 S428 188 500 188 S628 262 700 262 S828 188 900 188 S964 188 980 188" />
                </svg>
                {featureMindmap.map((item) => (
                  <article
                    key={item.step}
                    className={`landing-mindmap-node landing-mindmap-node-${item.align}`}
                    style={{
                      '--mindmap-accent': item.accent,
                    }}
                  >
                    <div className="landing-mindmap-copy">
                      <span className="landing-mindmap-badge">{item.badge}</span>
                      <h3>{item.title}</h3>
                    </div>

                    <div className="landing-mindmap-icon" aria-hidden="true">
                      <FeatureIcon name={item.icon} />
                    </div>
                  </article>
                ))}
              </div>
            </div>
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
                    <div className="landing-package-price-meta">
                      <span className="landing-package-discount-pill">
                        Diskon {packageDiscountPercent}%
                      </span>
                      <span className="landing-package-price-original">
                        Rp{(pkg.price * 2).toLocaleString('id-ID')}
                      </span>
                    </div>
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
