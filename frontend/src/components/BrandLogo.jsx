import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../ThemeContext';

export default function BrandLogo() {
  const { isDark } = useTheme();
  const logoSrc = isDark ? '/ujiin-logo-dark.png' : '/ujiin-logo-light.png';

  return (
    <Link to="/" className="landing-logo brand-logo" aria-label="UJIIN">
      <img className="brand-logo-image" src={logoSrc} alt="UJIIN" />
    </Link>
  );
}
