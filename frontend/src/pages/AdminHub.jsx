import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AccountShell from '../components/AccountShell';

function ModuleIcon({ variant }) {
  if (variant === 'news') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="5" width="16" height="14" rx="3" fill="currentColor" opacity="0.16" />
        <path d="M8 9h8M8 12h8M8 15h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="17" cy="15.5" r="1.25" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="2" fill="currentColor" opacity="0.18" />
      <rect x="13" y="4" width="7" height="7" rx="2" fill="currentColor" opacity="0.28" />
      <rect x="4" y="13" width="7" height="7" rx="2" fill="currentColor" opacity="0.28" />
      <rect x="13" y="13" width="7" height="7" rx="2" fill="currentColor" opacity="0.18" />
    </svg>
  );
}

const moduleCards = [
  {
    title: 'Materi dan Soal',
    description: 'Masuk ke workspace paket, subtest, materi, soal tryout, mini test, draft, dan publish.',
    to: '/admin/workspace',
    action: 'Masuk Workspace',
    variant: 'workspace',
  },
  {
    title: 'Berita',
    description: 'Kelola artikel berita, status publish, urutan headline, populer, dan pilihan redaksi.',
    to: '/admin/news?workspace=draft',
    action: 'Kelola Berita',
    variant: 'news',
  },
];

export default function AdminHub() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.search) {
      navigate(`/admin/workspace${location.search}`, { replace: true });
    }
  }, [location.search, navigate]);

  return (
    <AccountShell
      shellClassName="account-shell-learning admin-module-shell"
      title="Pilih Modul Admin"
      subtitle="Pisahkan workspace materi dan soal dari workspace berita supaya alur edit lebih fokus."
    >
      <div className="admin-module-grid">
        {moduleCards.map((module) => (
          <article key={module.to} className="account-card admin-module-card">
            <div className={`admin-module-icon admin-module-icon-${module.variant}`}>
              <ModuleIcon variant={module.variant} />
            </div>
            <div className="admin-module-copy">
              <span className="admin-preview-eyebrow">Modul</span>
              <h2>{module.title}</h2>
              <p>{module.description}</p>
            </div>
            <Link to={module.to} className="btn btn-primary admin-module-action">
              {module.action}
            </Link>
          </article>
        ))}
      </div>
    </AccountShell>
  );
}
