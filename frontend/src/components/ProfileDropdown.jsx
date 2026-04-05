import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function ProfileDropdown({ displayName, onLogout, isAdmin = false }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search, location.hash]);

  return (
    <div className="profile-dropdown" ref={wrapperRef}>
      <button
        type="button"
        className="profile-dropdown-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span className="landing-user-chip">Halo, {displayName}</span>
        <span className={`profile-dropdown-chevron ${open ? 'profile-dropdown-chevron-open' : ''}`}>
          ▾
        </span>
      </button>

      {open && (
        <div className="profile-dropdown-menu">
          {isAdmin && (
            <Link to="/admin" className="profile-dropdown-item profile-dropdown-admin">
              Panel Admin
            </Link>
          )}
          <Link to="/profile" className="profile-dropdown-item">
            Rincian Profile
          </Link>
          <Link to="/active-packages" className="profile-dropdown-item">
            Paket Aktif
          </Link>
          <Link to="/test-history" className="profile-dropdown-item">
            Riwayat Test
          </Link>
          <button type="button" className="profile-dropdown-item profile-dropdown-danger" onClick={onLogout}>
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
