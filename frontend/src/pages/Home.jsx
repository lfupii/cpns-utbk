import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import apiClient from '../api';
import ProfileDropdown from '../components/ProfileDropdown';
import BrandLogo from '../components/BrandLogo';
import ThemeToggle from '../components/ThemeToggle';
import { businessProfile } from '../siteContent';

export default function Home() {
  const { user, logout, isAdmin } = useAuth();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const displayName = user?.full_name || 'Pejuang ASN';

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
  const featureMindmap = [
    {
      step: '01',
      badge: 'Mulai',
      icon: 'P',
      title: 'Preview yang bikin cepat paham',
      description: 'Masuk, cek materi awal, lalu rasakan dulu ritme belajar sebelum commit ke sesi penuh.',
    },
    {
      step: '02',
      badge: 'Fokus',
      icon: 'A',
      title: 'Rute belajar adaptif',
      description: 'Sistem bantu menaruh subtest yang paling perlu perhatian di depan supaya progres terasa lebih jelas.',
    },
    {
      step: '03',
      badge: 'Latihan',
      icon: 'L',
      title: 'Latihan plus evaluasi',
      description: 'Bukan cuma ngerjain soal, tapi langsung kebaca mana materi yang sudah kuat dan mana yang masih goyang.',
    },
    {
      step: '04',
      badge: 'Stamina',
      icon: 'S',
      title: 'Simulasi bertahap',
      description: 'Mulai dari drill singkat, mini test, sampai tryout penuh untuk bangun tempo dan fokus ujian.',
    },
    {
      step: '05',
      badge: 'Naik',
      icon: 'N',
      title: 'Skor naik lebih kebaca',
      description: 'Semua progres masuk ke satu flow yang rapi, jadi keputusan belajarmu selalu punya arah berikutnya.',
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
                <a href="#tentang" onClick={closeMobileMenu}>Tentang</a>
                <a href="#keunggulan" onClick={closeMobileMenu}>Fitur</a>
                <a href="#paket" onClick={closeMobileMenu}>Program</a>
                <Link to="/contact" onClick={closeMobileMenu}>Kontak</Link>
                <Link to="/terms" onClick={closeMobileMenu}>Syarat &amp; Ketentuan</Link>
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

        <section className="landing-section" id="keunggulan">
          <div className="container">
            <div className="landing-section-heading">
              <h2>Fitur yang saling nyambung dalam satu flow belajar</h2>
              <p>
                Ujiin tidak berhenti di latihan soal. Semuanya dirangkai jadi jalur belajar yang
                lebih gampang dibaca dari awal sampai skor naik.
              </p>
            </div>

            <div className="landing-mindmap-shell">
              <div className="landing-mindmap-track" aria-label="Flow fitur Ujiin">
                {featureMindmap.map((item) => (
                  <article key={item.step} className="landing-mindmap-node">
                    <div className="landing-mindmap-node-top">
                      <span className="landing-mindmap-step">{item.step}</span>
                      <span className="landing-mindmap-badge">{item.badge}</span>
                    </div>

                    <div className="landing-mindmap-icon" aria-hidden="true">
                      <span>{item.icon}</span>
                    </div>

                    <div className="landing-mindmap-copy">
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
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
