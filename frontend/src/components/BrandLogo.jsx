import React from 'react';
import { Link } from 'react-router-dom';

export default function BrandLogo() {
  return (
    <Link to="/" className="landing-logo brand-logo" aria-label="Ruang Tryout">
      <span className="brand-logo-mark" aria-hidden="true">
        <span className="brand-logo-word brand-logo-word-top">RUANG</span>
        <span className="brand-logo-word brand-logo-word-bottom">TRYOUT</span>
        <span className="brand-logo-swoosh brand-logo-swoosh-back"></span>
        <span className="brand-logo-swoosh brand-logo-swoosh-middle"></span>
        <span className="brand-logo-swoosh brand-logo-swoosh-front"></span>
        <span className="brand-logo-spark brand-logo-spark-1"></span>
        <span className="brand-logo-spark brand-logo-spark-2"></span>
        <span className="brand-logo-spark brand-logo-spark-3"></span>
      </span>
    </Link>
  );
}
