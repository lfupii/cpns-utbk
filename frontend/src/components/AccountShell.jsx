import React from 'react';
import { useAuth } from '../AuthContext';
import BrandLogo from './BrandLogo';
import ProfileDropdown from './ProfileDropdown';

export default function AccountShell({ title, subtitle, children }) {
  const { user, logout, isAdmin } = useAuth();
  const displayName = user?.full_name || localStorage.getItem('fullName') || 'Pejuang ASN';

  return (
    <div className="account-shell">
      <nav className="landing-navbar">
        <div className="container landing-navbar-inner">
          <BrandLogo />

          <div className="landing-nav-actions landing-nav-actions-authenticated">
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
