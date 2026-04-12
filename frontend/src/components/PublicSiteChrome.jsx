import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import ProfileDropdown from './ProfileDropdown';
import BrandLogo from './BrandLogo';
import { businessProfile } from '../siteContent';

const footerLinks = [
  { label: 'Syarat & Ketentuan', to: '/terms' },
  { label: 'Kebijakan Privasi', to: '/terms#privacy-policy' },
  { label: 'Kebijakan Refund', to: '/terms#refund-policy' },
];

export default function PublicSiteChrome({ eyebrow, title, subtitle, children }) {
  const { user, logout, isAdmin } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const displayName = user?.full_name || localStorage.getItem('fullName') || 'Pejuang ASN';

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

  return (
    <div className="landing-shell policy-shell">
      <nav className="landing-navbar">
        <div className="container landing-navbar-inner">
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
                <Link to="/#tentang" onClick={closeMobileMenu}>Tentang</Link>
                <Link to="/#keunggulan" onClick={closeMobileMenu}>Fitur</Link>
                <Link to="/#paket" onClick={closeMobileMenu}>Program</Link>
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

      <main className="container policy-main">
        <section className="policy-hero">
          {eyebrow && <span className="landing-kicker">{eyebrow}</span>}
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </section>

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
