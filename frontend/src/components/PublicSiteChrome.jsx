import React from 'react';
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
  const displayName = user?.full_name || localStorage.getItem('fullName') || 'Pejuang ASN';

  return (
    <div className="landing-shell policy-shell">
      <nav className="landing-navbar">
        <div className="container landing-navbar-inner">
          <BrandLogo />

          <div className="landing-nav-links">
            <Link to="/#tentang">Tentang</Link>
            <Link to="/#keunggulan">Fitur</Link>
            <Link to="/#paket">Program</Link>
            <Link to="/contact">Kontak</Link>
            <Link to="/terms">Syarat &amp; Ketentuan</Link>
          </div>

          <div className="landing-nav-actions">
            {user ? (
              <ProfileDropdown displayName={displayName} onLogout={logout} isAdmin={isAdmin} />
            ) : (
              <>
                <Link to="/login" className="btn btn-outline">
                  Masuk
                </Link>
                <Link to="/register" className="btn btn-primary">
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
