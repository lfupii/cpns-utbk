"use client";
import React, { useEffect, useState } from 'react';
import { Link } from '@/utils/router-shim';
import AccountShell from '../components/AccountShell';
import apiClient from '../api';
import { formatDate } from '../utils/date';

export default function ActivePackages() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const flashMessage = window.sessionStorage.getItem('paymentSuccessMessage');
    if (!flashMessage) {
      return;
    }

    setSuccessMessage(flashMessage);
    window.sessionStorage.removeItem('paymentSuccessMessage');
  }, []);

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const response = await apiClient.get('/auth/active-packages');
        setPackages(response.data.data || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Gagal memuat paket aktif');
      } finally {
        setLoading(false);
      }
    };

    fetchPackages();
  }, []);

  const packageList = (
    <div className="account-card-grid">
      {packages.map((pkg) => (
        <article key={pkg.access_id} className="account-package-card">
          <div className="account-package-top">
            <span className="account-package-tag">{pkg.category_name}</span>
            <span className={`account-status-pill ${pkg.is_unused ? 'account-status-fresh' : 'account-status-used'}`}>
              {pkg.is_unused ? 'Belum digunakan' : 'Sedang aktif'}
            </span>
          </div>

          <h2>{pkg.package_name}</h2>
          <p>{pkg.description}</p>

          <div className="account-package-stats">
            <div>
              <span>Soal</span>
              <strong>{pkg.question_count}</strong>
            </div>
            <div>
              <span>Waktu</span>
              <strong>{pkg.time_limit} menit</strong>
            </div>
            <div>
              <span>Sisa percobaan</span>
              <strong>{pkg.remaining_attempts}</strong>
            </div>
          </div>

          <div className="account-package-meta">
            <p>Dibeli: <strong>{formatDate(pkg.purchased_at)}</strong></p>
            <p>
              Aktif sampai: <strong>{pkg.access_expires_at ? formatDate(pkg.access_expires_at) : 'Tanpa batas'}</strong>
            </p>
          </div>

          <div className="account-package-actions">
            <Link to={`/learning/${pkg.package_id}`} className="btn btn-primary">
              {pkg.can_start_test
                ? (pkg.is_unused ? 'Masuk Ruang Belajar' : 'Lanjut Belajar')
                : 'Lihat Materi'}
            </Link>
          </div>
        </article>
      ))}
    </div>
  );

  return (
    <AccountShell
      title="Paket Aktif"
      subtitle="Daftar paket yang sudah dibeli dan masih bisa kamu gunakan untuk mulai test."
    >
      {successMessage && !loading && (
        <div className="account-card">
          <div className="account-success">{successMessage}</div>
        </div>
      )}
      {loading ? (
        <div className="account-card">
          <p>Memuat paket aktif...</p>
        </div>
      ) : error ? (
        <div className="account-card">
          <div className="alert">{error}</div>
        </div>
      ) : packages.length === 0 ? (
        <div className="account-card">
          <p className="text-muted">Belum ada paket aktif yang tersedia untuk akun ini.</p>
        </div>
      ) : (
        packageList
      )}
    </AccountShell>
  );
}
