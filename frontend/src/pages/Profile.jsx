import React, { useEffect, useState } from 'react';
import AccountShell from '../components/AccountShell';
import { useAuth } from '../AuthContext';
import apiClient from '../api';

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

  useEffect(() => {
    const fetchProfile = async () => {
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
      } catch (err) {
        setError(err.response?.data?.message || 'Gagal memuat profil');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setProfile((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiClient.put('/auth/profile', {
        full_name: profile.full_name,
        phone: profile.phone || null,
        birth_date: profile.birth_date || null,
      });
      await refreshProfile();
      setSuccess('Profil berhasil diperbarui.');
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memperbarui profil');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccountShell
      title="Rincian Profile"
      subtitle="Kelola data akunmu supaya pembelian paket dan riwayat belajar tetap rapi."
    >
      <div className="account-card">
        {loading ? (
          <p>Memuat profil...</p>
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
                {profile.created_at ? new Date(profile.created_at).toLocaleDateString('id-ID') : '-'}
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
