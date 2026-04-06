import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import ProfileDropdown from './ProfileDropdown';

export default function AccountShell({ title, subtitle, children }) {
  const { user, logout, isAdmin } = useAuth();
  const displayName = user?.full_name || localStorage.getItem('fullName') || 'Pejuang ASN';

  return (
    <div className="account-shell">
      <nav className="landing-navbar">
        <div className="container landing-navbar-inner">
          <Link to="/" className="landing-logo" aria-label="AYO CPNS">
            <span className="landing-logo-badge">AYO</span>
            <span>CPNS</span>
          </Link>

          <div className="landing-nav-actions">
            <ProfileDropdown displayName={displayName} onLogout={logout} isAdmin={isAdmin} />
          </div>
        </div>
      </nav>

      <main className="container account-main">
        <div className="account-page-header">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {children}
      </main>
    </div>
  );
}
