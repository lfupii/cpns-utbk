import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import BrandLogo from './BrandLogo';
import ProfileDropdown from './ProfileDropdown';

export default function AccountShell({ title, subtitle, children, shellClassName = '' }) {
  const { user, logout, isAdmin } = useAuth();
  const displayName = user?.full_name || localStorage.getItem('fullName') || 'Pejuang ASN';

  return (
    <div className={`account-shell ${shellClassName}`.trim()}>
      <nav className="landing-navbar">
        <div className="container landing-navbar-inner account-shell-nav-container">
          <BrandLogo />

          <div className="landing-nav-actions landing-nav-actions-authenticated">
            {user ? (
              <ProfileDropdown displayName={displayName} onLogout={logout} isAdmin={isAdmin} />
            ) : (
              <>
                <Link to="/login" className="btn btn-outline">Login</Link>
                <Link to="/register" className="btn btn-primary">Daftar</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="container account-main account-shell-main-container">
        <div className="account-page-header">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {children}
      </main>
    </div>
  );
}
