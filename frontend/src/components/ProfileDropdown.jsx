import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function ProfileDropdown({
  displayName,
  onLogout,
  isAdmin = false,
  open: controlledOpen,
  onOpenChange,
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const wrapperRef = useRef(null);
  const location = useLocation();
  const open = typeof controlledOpen === 'boolean' ? controlledOpen : uncontrolledOpen;

  const setOpen = (nextValue) => {
    if (typeof controlledOpen !== 'boolean') {
      setUncontrolledOpen(nextValue);
    }

    if (onOpenChange) {
      onOpenChange(nextValue);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        if (typeof controlledOpen !== 'boolean') {
          setUncontrolledOpen(false);
        }
        if (onOpenChange) {
          onOpenChange(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [controlledOpen, onOpenChange]);

  useEffect(() => {
    if (typeof controlledOpen !== 'boolean') {
      setUncontrolledOpen(false);
    }
    if (onOpenChange) {
      onOpenChange(false);
    }
  }, [location.pathname, location.search, location.hash, controlledOpen, onOpenChange]);

  return (
    <div className="profile-dropdown" ref={wrapperRef}>
      <button
        type="button"
        className="profile-dropdown-trigger"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="profile-dropdown-trigger-mobile" aria-hidden="true">
          <span className="profile-dropdown-avatar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21a8 8 0 0 0-16 0" />
              <circle cx="12" cy="8" r="4" />
            </svg>
          </span>
        </span>
        <span className="landing-user-chip">Halo, {displayName}</span>
        <span className={`profile-dropdown-chevron ${open ? 'profile-dropdown-chevron-open' : ''}`}>
          ▾
        </span>
      </button>

      {open && (
        <div className="profile-dropdown-menu">
          <div className="profile-dropdown-menu-header">
            <strong>Halo, {displayName}</strong>
          </div>
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
          <button
            type="button"
            className="profile-dropdown-item profile-dropdown-danger"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
