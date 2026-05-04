import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import ProfileDropdown from './ProfileDropdown';
import BrandLogo from './BrandLogo';
import ThemeToggle from './ThemeToggle';
import { businessProfile } from '../siteContent';

const footerLinks = [
  { label: 'Syarat & Ketentuan', to: '/terms' },
  { label: 'Kebijakan Privasi', to: '/terms#privacy-policy' },
  { label: 'Kebijakan Refund', to: '/terms#refund-policy' },
];

export default function PublicSiteChrome({
  eyebrow,
  title,
  subtitle,
  children,
  showHero = true,
  mainClassName = '',
}) {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const displayName = user?.full_name || localStorage.getItem('fullName') || 'Pejuang ASN';
  const activeHash = location.hash || '#tentang';
  const isLandingPage = location.pathname === '/';
  const isLandingSectionActive = (sectionHash) => isLandingPage && activeHash === sectionHash;
  const isNewsPage = location.pathname.startsWith('/news');
  const isContactPage = location.pathname === '/contact';
  const isTermsPage = location.pathname === '/terms';

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

  return (
    <div className="landing-shell policy-shell">
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
              aria-controls="public-nav-panel"
              onClick={handleMobileMenuToggle}
            >
              <span />
              <span />
              <span />
            </button>

            <div
              id="public-nav-panel"
              className={`landing-navbar-panel ${isMobileMenuOpen ? 'landing-navbar-panel-open' : ''}`}
            >
              <div className="landing-nav-links">
                <Link
                  to="/#tentang"
                  className={isLandingSectionActive('#tentang') ? 'landing-nav-link-active' : ''}
                  onClick={closeMobileMenu}
                >
                  Tentang
                </Link>
                <Link
                  to="/#keunggulan"
                  className={isLandingSectionActive('#keunggulan') ? 'landing-nav-link-active' : ''}
                  onClick={closeMobileMenu}
                >
                  Fitur
                </Link>
                <Link
                  to="/#paket"
                  className={isLandingSectionActive('#paket') ? 'landing-nav-link-active' : ''}
                  onClick={closeMobileMenu}
                >
                  Program
                </Link>
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

      <main className={`container policy-main ${mainClassName}`.trim()}>
        {showHero && (
          <section className="policy-hero">
            {eyebrow && <span className="landing-kicker">{eyebrow}</span>}
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </section>
        )}

        {children}
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
            <div className="policy-link-list">
              {footerLinks.map((link) => (
                <Link key={link.to} to={link.to}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
