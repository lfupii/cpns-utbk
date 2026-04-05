import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import apiClient from '../api';
import ProfileDropdown from '../components/ProfileDropdown';

export default function Home() {
  const { user, logout, isAdmin } = useAuth();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const displayName = user?.full_name || localStorage.getItem('fullName') || 'Pejuang ASN';

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

  const handleLogout = () => {
    logout();
  };

  const cpnsSource = packages.find((pkg) => pkg.name === 'CPNS Intensif') || null;
  const utbkSource = packages.find((pkg) => pkg.name === 'UTBK Intensif') || null;
  const curatedPackages = [
    {
      slug: 'utbk',
      title: 'UTBK',
      accent: 'landing-package-accent-utbk',
      price: 5000,
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
      price: 10000,
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
        <div className="container landing-navbar-inner">
          <Link to="/" className="landing-logo" aria-label="AYO CPNS">
            <span className="landing-logo-badge">AYO</span>
            <span>CPNS</span>
          </Link>

          <div className="landing-nav-links">
            <a href="#tentang">Tentang</a>
            <a href="#keunggulan">Fitur</a>
            <a href="#paket">Program</a>
            <a href="#testimoni">Cerita</a>
            <a href="#blog">Insight</a>
          </div>

          <div className="landing-nav-actions">
            {user ? (
              <ProfileDropdown displayName={displayName} onLogout={handleLogout} isAdmin={isAdmin} />
            ) : (
              <>
                <Link to="/login" className="btn btn-outline">
                  Masuk
                </Link>
                <Link to="/register" className="btn btn-primary">
                  Coba Gratis →
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
          <div className="container landing-hero-grid">
            <div className="landing-hero-copy">
              <span className="landing-kicker">Persiapan SKD yang lebih terarah</span>
              <h1>
                Naikkan Skor
                <br />
                Dengan Ritme
                <br />
                <span>Belajar yang Jelas</span>
              </h1>

              <div className="landing-pill">
                <span className="landing-pill-icon">●</span>
                <span>
                  Dipakai <strong>ribuan peserta</strong> untuk latihan harian dan simulasi penuh
                </span>
              </div>

              <p>
                Bukan cuma kumpulan soal. Kamu dapat paket latihan, pemetaan kemampuan, dan alur
                belajar yang membantu fokus ke materi paling berdampak.
              </p>

              <div className="landing-bullet-list">
                <span>Target mingguan yang mudah diikuti</span>
                <span>Analisis hasil per kategori soal</span>
                <span>Simulasi waktu yang terasa realistis</span>
              </div>

              <div className="landing-hero-actions">
                {user ? (
                  <>
                    <a href="#paket" className="btn btn-primary landing-cta-main">
                      Mulai Gratis Sekarang
                    </a>
                    <a href="#paket" className="btn btn-outline landing-cta-secondary">
                      Lihat Paket
                    </a>
                  </>
                ) : (
                  <>
                    <Link to="/register" className="btn btn-primary landing-cta-main">
                      Mulai Gratis Sekarang
                    </Link>
                    <Link to="/login" className="btn btn-outline landing-cta-secondary">
                      Masuk
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="landing-hero-showcase">
              <div className="landing-showcase-panel">
                <div className="landing-showcase-badge">Belajar lebih fokus</div>
                <h3>Latihan singkat, evaluasi cepat, dan pilihan paket yang langsung to the point.</h3>

                <div className="landing-showcase-orbits">
                  <div className="landing-showcase-ring landing-showcase-ring-large"></div>
                  <div className="landing-showcase-ring landing-showcase-ring-small"></div>
                  <div className="landing-showcase-core"></div>
                </div>

                <div className="landing-showcase-stat-grid">
                  <div className="landing-showcase-stat">
                    <strong>2</strong>
                    <span>Paket inti</span>
                  </div>
                  <div className="landing-showcase-stat">
                    <strong>100</strong>
                    <span>Soal per sesi</span>
                  </div>
                  <div className="landing-showcase-stat">
                    <strong>Instan</strong>
                    <span>Hasil evaluasi</span>
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
                    user ? (
                      <Link
                        to={`/payment/${pkg.source.id}`}
                        className="btn btn-primary landing-package-action"
                      >
                        {`Ambil ${pkg.title}`}
                      </Link>
                    ) : (
                      <Link to="/login" className="btn btn-primary landing-package-action">
                        Login untuk mulai
                      </Link>
                    )
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
        <div className="container landing-footer-note-inner">
          <p className="landing-footer-note-title">Informasi Kontak</p>
          <p>
            Butuh bantuan atau verifikasi informasi layanan? Hubungi kami di{' '}
            <a href="mailto:support@tocpnsutbk.com">support@tocpnsutbk.com</a>.
          </p>
          <p>
            Website resmi: <a href="https://tocpnsutbk.com">tocpnsutbk.com</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
