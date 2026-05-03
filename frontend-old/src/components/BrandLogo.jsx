import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../ThemeContext';

export default function BrandLogo() {
  const { isDark } = useTheme();
  const logoSrc = isDark ? '/ujiin-logo-dark.png' : '/ujiin-logo-light.png';
  const logoClassName = `brand-logo-image ${isDark ? 'brand-logo-image-dark' : 'brand-logo-image-light'}`;

  return (
    <Link to="/" className="landing-logo brand-logo" aria-label="UJIIN">
      <img className={logoClassName} src={logoSrc} alt="UJIIN" />
    </Link>
  );
}
