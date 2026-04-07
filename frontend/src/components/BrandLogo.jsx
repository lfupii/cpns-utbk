import React from 'react';
import { Link } from 'react-router-dom';

export default function BrandLogo() {
  return (
    <Link to="/" className="landing-logo brand-logo" aria-label="UJIIN">
      <img className="brand-logo-image" src="/ujiin-logo.png" alt="UJIIN" />
    </Link>
  );
}
