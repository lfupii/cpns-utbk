"use client";
import React, { useCallback, useEffect, useState } from 'react';
import AccountShell from '../components/AccountShell';
import { useAuth } from '../AuthContext';
import apiClient from '../api';
import { formatDate } from '../utils/date';

export default function Profile() {
  const { refreshProfile } = useAuth();
  const [profile, setProfile] = useState({
    email: '',
    full_name: '',
    phone: '',
    birth_date: '',
    created_at: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hasLoadedProfile, setHasLoadedProfile] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.get('/auth/profile');
      const data = response.data.data;
      setProfile({
        email: data.email || '',
        full_name: data.full_name || '',
        phone: data.phone || '',
        birth_date: data.birth_date || '',
        created_at: data.created_at || '',
      });
      setHasLoadedProfile(true);
    } catch (err) {
      setHasLoadedProfile(false);
      setError(err.response?.data?.message || 'Gagal memuat profil');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setProfile((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!hasLoadedProfile) {
      setError('Profil belum berhasil dimuat. Coba muat ulang lalu simpan kembali.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiClient.put('/auth/profile', {
        full_name: profile.full_name.trim(),
        phone: profile.phone || null,
        birth_date: profile.birth_date || null,
      });
      const nextProfile = await refreshProfile();
      if (nextProfile) {
        setProfile((current) => ({
          ...current,
          email: nextProfile.email || '',
          full_name: nextProfile.full_name || '',
          phone: nextProfile.phone || '',
          birth_date: nextProfile.birth_date || '',
          created_at: nextProfile.created_at || current.created_at,
        }));
      }
      setSuccess('Profil berhasil diperbarui.');
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memperbarui profil');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccountShell
      title="Rincian Profil"
      subtitle="Kelola data akunmu supaya pembelian paket dan riwayat belajar tetap rapi."
    >
      <div className="account-card">
        {loading ? (
          <p>Memuat profil...</p>
        ) : !hasLoadedProfile ? (
          <div className="account-form-grid">
            {error && <div className="alert">{error}</div>}
            <div className="account-form-actions">
              <button type="button" className="btn btn-primary" onClick={fetchProfile}>
                Coba Lagi
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="account-form-grid">
            {error && <div className="alert">{error}</div>}
            {success && <div className="account-success">{success}</div>}

            <div className="form-group">
              <label>Email</label>
              <input type="email" value={profile.email} disabled />
            </div>

            <div className="form-group">
              <label>Nama Lengkap</label>
              <input
                type="text"
                name="full_name"
                value={profile.full_name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Nomor HP</label>
              <input
                type="text"
                name="phone"
                value={profile.phone}
                onChange={handleChange}
                placeholder="0812xxxxxxx"
              />
            </div>

            <div className="form-group">
              <label>Tanggal Lahir</label>
              <input
                type="date"
                name="birth_date"
                value={profile.birth_date}
                onChange={handleChange}
              />
            </div>

            <div className="account-meta-box">
              <span>Bergabung sejak</span>
              <strong>
                {formatDate(profile.created_at)}
              </strong>
            </div>

            <div className="account-form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        )}
      </div>
    </AccountShell>
  );
}
