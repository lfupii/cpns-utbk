import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import ProfileDropdown from './ProfileDropdown';
import { businessProfile } from '../siteContent';

const footerLinks = [
  { label: 'Beranda', to: '/' },
  { label: 'Program', to: '/#paket' },
  { label: 'Kontak', to: '/contact' },
  { label: 'Syarat', to: '/terms' },
  { label: 'Privasi', to: '/terms#privacy-policy' },
  { label: 'Refund', to: '/terms#refund-policy' },
  { label: 'Reviewer', to: '/midtrans-review' },
];

export default function PublicSiteChrome({ eyebrow, title, subtitle, children }) {
  const { user, logout, isAdmin } = useAuth();
  const displayName = user?.full_name || localStorage.getItem('fullName') || 'Pejuang ASN';

  return (
    <div className="landing-shell policy-shell">
      <nav className="landing-navbar">
        <div className="container landing-navbar-inner">
          <Link to="/" className="landing-logo" aria-label="AYO CPNS">
            <span className="landing-logo-badge">AYO</span>
            <span>CPNS</span>
          </Link>

          <div className="landing-nav-links">
            <Link to="/">Beranda</Link>
            <Link to="/#paket">Program</Link>
            <Link to="/contact">Kontak</Link>
            <Link to="/terms">Syarat</Link>
            <Link to="/terms#privacy-policy">Privasi</Link>
            <Link to="/terms#refund-policy">Refund</Link>
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
        <div className="container policy-footer-grid">
          <div>
            <p className="landing-footer-note-title">{businessProfile.brandName}</p>
            <p>{businessProfile.serviceSummary}</p>
          </div>

          <div>
            <p className="landing-footer-note-title">Link Penting</p>
            <div className="policy-link-list">
              {footerLinks.map((link) => (
                <Link key={link.to} to={link.to}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="landing-footer-note-title">Kontak</p>
            <p>
              Email: <a href={businessProfile.supportMailto}>{businessProfile.supportEmail}</a>
            </p>
            <p>
              Website: <a href={businessProfile.websiteUrl}>{businessProfile.websiteUrl}</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
