"use client";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from '@/utils/router-shim';
import ThemeToggle from './ThemeToggle';

export default function ProfileDropdown({
  displayName,
  onLogout,
  isAdmin = false,
  open: controlledOpen,
  onOpenChange,
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const wrapperRef = useRef(null);
  const controlledModeRef = useRef(typeof controlledOpen === 'boolean');
  const onOpenChangeRef = useRef(onOpenChange);
  const location = useLocation();
  const open = typeof controlledOpen === 'boolean' ? controlledOpen : uncontrolledOpen;

  useEffect(() => {
    controlledModeRef.current = typeof controlledOpen === 'boolean';
    onOpenChangeRef.current = onOpenChange;
  }, [controlledOpen, onOpenChange]);

  const setOpen = useCallback((nextValue) => {
    if (!controlledModeRef.current) {
      setUncontrolledOpen(nextValue);
    }

    if (onOpenChangeRef.current) {
      onOpenChangeRef.current(nextValue);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setOpen]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search, location.hash, setOpen]);

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
          <div className="profile-dropdown-theme">
            <ThemeToggle dropdown onToggle={() => setOpen(false)} />
          </div>
          {isAdmin && (
            <Link to="/admin" className="profile-dropdown-item profile-dropdown-admin">
              Panel Admin
            </Link>
          )}
          <Link to="/profile" className="profile-dropdown-item">
            Rincian Profil
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
