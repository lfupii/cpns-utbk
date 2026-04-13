import React from 'react';
import { useTheme } from '../ThemeContext';

export default function ThemeToggle({ mobile = false, onToggle }) {
  const { isDark, toggleTheme } = useTheme();

  const handleClick = () => {
    toggleTheme();
    onToggle?.();
  };

  return (
    <button
      type="button"
      className={`theme-toggle ${mobile ? 'theme-toggle-mobile' : ''} ${isDark ? 'theme-toggle-on' : ''}`}
      aria-label={isDark ? 'Nonaktifkan dark mode' : 'Aktifkan dark mode'}
      aria-pressed={isDark}
      onClick={handleClick}
    >
      <span className="theme-toggle-copy">
        <span className="theme-toggle-label">Dark Mode</span>
        <span className="theme-toggle-state">{isDark ? 'On' : 'Off'}</span>
      </span>
      <span className="theme-toggle-switch" aria-hidden="true">
        <span className="theme-toggle-thumb" />
      </span>
    </button>
  );
}
