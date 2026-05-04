import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AccountShell from '../components/AccountShell';
import apiClient from '../api';
import { formatDateTime } from '../utils/date';

function createEmptyNewsForm() {
  return {
    id: null,
    title: '',
    slug: '',
    category: 'Nasional',
    author_name: 'Tim Redaksi',
    excerpt: '',
    content: '',
    cover_image_url: '',
    read_time_minutes: 4,
    status: 'draft',
    is_featured: false,
    featured_order: 0,
    is_popular: false,
    popular_order: 0,
    is_editor_pick: false,
    editor_pick_order: 0,
    published_at: null,
    created_at: null,
    updated_at: null,
  };
}

const statusFilters = ['semua', 'published', 'draft'];

function normalizeNewsForm(article) {
  return {
    id: Number(article?.id || 0) || null,
    title: article?.title || '',
    slug: article?.slug || '',
    category: article?.category || 'Nasional',
    author_name: article?.author_name || 'Tim Redaksi',
    excerpt: article?.excerpt || '',
    content: article?.content || '',
    cover_image_url: article?.cover_image_url || '',
    read_time_minutes: Math.max(1, Number(article?.read_time_minutes || 4)),
    status: article?.status === 'published' ? 'published' : 'draft',
    is_featured: Boolean(Number(article?.is_featured || 0)),
    featured_order: Math.max(0, Number(article?.featured_order || 0)),
    is_popular: Boolean(Number(article?.is_popular || 0)),
    popular_order: Math.max(0, Number(article?.popular_order || 0)),
    is_editor_pick: Boolean(Number(article?.is_editor_pick || 0)),
    editor_pick_order: Math.max(0, Number(article?.editor_pick_order || 0)),
    published_at: article?.published_at || null,
    created_at: article?.created_at || null,
    updated_at: article?.updated_at || null,
  };
}

export default function AdminNewsPanel() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedArticleId, setSelectedArticleId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('semua');
  const [newsForm, setNewsForm] = useState(createEmptyNewsForm());

  const filteredArticles = useMemo(() => (
    statusFilter === 'semua'
      ? articles
      : articles.filter((article) => article.status === statusFilter)
  ), [articles, statusFilter]);

  const selectedArticle = useMemo(
    () => articles.find((article) => Number(article.id) === Number(selectedArticleId)) || null,
    [articles, selectedArticleId]
  );

  const loadArticles = useCallback(async (preferredId = null) => {
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.get('/admin/news');
      const nextArticles = Array.isArray(response.data?.data) ? response.data.data.map(normalizeNewsForm) : [];
      setArticles(nextArticles);

      const targetId = preferredId ?? selectedArticleId;
      const matchedArticle = nextArticles.find((article) => Number(article.id) === Number(targetId)) || nextArticles[0] || null;

      if (matchedArticle) {
        setSelectedArticleId(matchedArticle.id);
        setNewsForm(normalizeNewsForm(matchedArticle));
      } else {
        setSelectedArticleId(null);
        setNewsForm(createEmptyNewsForm());
      }
    } catch (loadError) {
      setError(loadError?.response?.data?.message || 'Gagal memuat daftar berita admin');
    } finally {
      setLoading(false);
    }
  }, [selectedArticleId]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  const handleFormChange = (field, value) => {
    setNewsForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const handleSelectArticle = (article) => {
    setSelectedArticleId(article.id);
    setNewsForm(normalizeNewsForm(article));
    setError('');
    setSuccess('');
  };

  const handleCreateNew = () => {
    setSelectedArticleId(null);
    setNewsForm(createEmptyNewsForm());
    setError('');
    setSuccess('');
  };

  const uploadAdminMedia = async (file) => {
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('context', 'news');

      const response = await apiClient.post('/admin/media-upload', formData);
      const uploadedUrl = response.data?.data?.url || '';
      if (!uploadedUrl) {
        throw new Error('empty_url');
      }

      setNewsForm((currentForm) => ({
        ...currentForm,
        cover_image_url: uploadedUrl,
      }));
      setSuccess('Gambar berita berhasil diupload.');
    } catch (uploadError) {
      setError(uploadError?.response?.data?.message || 'Gagal mengupload gambar berita');
    } finally {
      setUploading(false);
    }
  };

  const handleCoverFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    await uploadAdminMedia(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    const payload = {
      ...newsForm,
      read_time_minutes: Math.max(1, Number(newsForm.read_time_minutes || 1)),
      featured_order: Math.max(0, Number(newsForm.featured_order || 0)),
      popular_order: Math.max(0, Number(newsForm.popular_order || 0)),
      editor_pick_order: Math.max(0, Number(newsForm.editor_pick_order || 0)),
    };

    try {
      const response = newsForm.id
        ? await apiClient.put('/admin/news', payload)
        : await apiClient.post('/admin/news', payload);
      const savedArticle = normalizeNewsForm(response.data?.data || {});

      await loadArticles(savedArticle.id);
      setSelectedArticleId(savedArticle.id);
      setNewsForm(savedArticle);
      setSuccess(newsForm.id ? 'Berita berhasil diperbarui.' : 'Berita baru berhasil dibuat.');
    } catch (saveError) {
      setError(saveError?.response?.data?.message || 'Gagal menyimpan berita');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!newsForm.id) {
      return;
    }

    const confirmed = window.confirm(`Hapus berita "${newsForm.title}"?`);
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError('');
    setSuccess('');

    try {
      await apiClient.delete(`/admin/news?id=${newsForm.id}`);
      await loadArticles();
      setSuccess('Berita berhasil dihapus.');
    } catch (deleteError) {
      setError(deleteError?.response?.data?.message || 'Gagal menghapus berita');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AccountShell
      shellClassName="account-shell-learning admin-news-shell"
      title="Panel Admin Berita"
      subtitle="Kelola artikel berita secara terpisah dari workspace materi dan soal."
      navContent={(
        <div className="admin-workspace-topnav admin-workspace-topnav-link-row">
          <Link to="/admin" className="admin-workspace-topnav-link">
            Pilih Modul
          </Link>
          <Link to="/admin/workspace" className="admin-workspace-topnav-link">
            Materi &amp; Soal
          </Link>
        </div>
      )}
    >
      {(error || success) && (
        <div className="account-card admin-message-card">
          {error && <div className="alert">{error}</div>}
          {success && <div className="account-success">{success}</div>}
        </div>
      )}

      <div className="admin-layout admin-news-layout">
        <aside className="account-card admin-news-sidebar">
          <div className="admin-news-sidebar-head">
            <div>
              <span className="admin-preview-eyebrow">Workspace</span>
              <h2>Daftar Berita</h2>
            </div>
            <button type="button" className="btn btn-primary" onClick={handleCreateNew}>
              Berita Baru
            </button>
          </div>

          <div className="admin-news-filter-row">
            {statusFilters.map((filter) => (
              <button
                key={filter}
                type="button"
                className={`admin-news-filter-chip ${statusFilter === filter ? 'admin-news-filter-chip-active' : ''}`}
                onClick={() => setStatusFilter(filter)}
              >
                {filter === 'semua' ? 'Semua' : filter === 'published' ? 'Published' : 'Draft'}
              </button>
            ))}
          </div>

          <div className="admin-news-list">
            {loading ? (
              <p className="text-muted">Memuat berita...</p>
            ) : filteredArticles.length === 0 ? (
              <p className="text-muted">Belum ada berita pada filter ini.</p>
            ) : filteredArticles.map((article) => (
              <button
                key={article.id}
                type="button"
                className={`admin-news-list-item ${Number(selectedArticleId) === Number(article.id) ? 'admin-news-list-item-active' : ''}`}
                onClick={() => handleSelectArticle(article)}
              >
                <div className="admin-news-list-item-copy">
                  <div className="admin-news-list-item-head">
                    <span className={`admin-inline-status admin-inline-status-${article.status}`}>
                      {article.status === 'published' ? 'Published' : 'Draft'}
                    </span>
                    <small>{formatDateTime(article.updated_at, '-')}</small>
                  </div>
                  <strong>{article.title}</strong>
                  <p>{article.category} • {article.author_name}</p>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="account-card admin-news-main-card">
          <div className="admin-news-main-head">
            <div>
              <span className="admin-preview-eyebrow">{newsForm.id ? 'Edit berita' : 'Draft baru'}</span>
              <h2>{newsForm.id ? newsForm.title || 'Berita tanpa judul' : 'Buat berita baru'}</h2>
            </div>
            {newsForm.id && (
              <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Menghapus...' : 'Hapus'}
              </button>
            )}
          </div>

          <form className="admin-news-form" onSubmit={handleSubmit}>
            <div className="admin-news-form-grid">
              <label>
                <span>Judul</span>
                <input
                  type="text"
                  value={newsForm.title}
                  onChange={(event) => handleFormChange('title', event.target.value)}
                  placeholder="Judul berita"
                  required
                />
              </label>

              <label>
                <span>Slug</span>
                <input
                  type="text"
                  value={newsForm.slug}
                  onChange={(event) => handleFormChange('slug', event.target.value)}
                  placeholder="otomatis-jika-kosong"
                />
              </label>

              <label>
                <span>Kategori</span>
                <input
                  type="text"
                  value={newsForm.category}
                  onChange={(event) => handleFormChange('category', event.target.value)}
                  placeholder="Nasional"
                />
              </label>

              <label>
                <span>Penulis</span>
                <input
                  type="text"
                  value={newsForm.author_name}
                  onChange={(event) => handleFormChange('author_name', event.target.value)}
                  placeholder="Tim Redaksi"
                />
              </label>

              <label>
                <span>Durasi baca (menit)</span>
                <input
                  type="number"
                  min="1"
                  value={newsForm.read_time_minutes}
                  onChange={(event) => handleFormChange('read_time_minutes', event.target.value)}
                />
              </label>

              <label>
                <span>Status</span>
                <select
                  value={newsForm.status}
                  onChange={(event) => handleFormChange('status', event.target.value)}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </label>
            </div>

            <label>
              <span>Ringkasan singkat</span>
              <textarea
                rows={3}
                value={newsForm.excerpt}
                onChange={(event) => handleFormChange('excerpt', event.target.value)}
                placeholder="Ringkasan berita yang tampil di kartu."
              />
            </label>

            <label>
              <span>Konten lengkap</span>
              <textarea
                rows={8}
                value={newsForm.content}
                onChange={(event) => handleFormChange('content', event.target.value)}
                placeholder="Isi berita lengkap untuk kebutuhan berikutnya."
              />
            </label>

            <div className="admin-news-cover-grid">
              <label>
                <span>URL gambar cover</span>
                <input
                  type="url"
                  value={newsForm.cover_image_url}
                  onChange={(event) => handleFormChange('cover_image_url', event.target.value)}
                  placeholder="https://..."
                />
              </label>

              <label className="btn btn-outline admin-news-upload-button">
                {uploading ? 'Mengupload...' : 'Upload Cover'}
                <input type="file" accept="image/*" onChange={handleCoverFileChange} hidden />
              </label>
            </div>

            {newsForm.cover_image_url && (
              <div className="admin-news-cover-preview">
                <img src={newsForm.cover_image_url} alt={newsForm.title || 'Preview cover berita'} />
              </div>
            )}

            <div className="admin-news-flag-grid">
              <div className="admin-news-flag-card">
                <label className="admin-news-checkbox">
                  <input
                    type="checkbox"
                    checked={newsForm.is_featured}
                    onChange={(event) => handleFormChange('is_featured', event.target.checked)}
                  />
                  <span>Masuk headline utama</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={newsForm.featured_order}
                  onChange={(event) => handleFormChange('featured_order', event.target.value)}
                  placeholder="Urutan headline"
                />
              </div>

              <div className="admin-news-flag-card">
                <label className="admin-news-checkbox">
                  <input
                    type="checkbox"
                    checked={newsForm.is_popular}
                    onChange={(event) => handleFormChange('is_popular', event.target.checked)}
                  />
                  <span>Masuk terpopuler</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={newsForm.popular_order}
                  onChange={(event) => handleFormChange('popular_order', event.target.value)}
                  placeholder="Urutan populer"
                />
              </div>

              <div className="admin-news-flag-card">
                <label className="admin-news-checkbox">
                  <input
                    type="checkbox"
                    checked={newsForm.is_editor_pick}
                    onChange={(event) => handleFormChange('is_editor_pick', event.target.checked)}
                  />
                  <span>Masuk pilihan redaksi</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={newsForm.editor_pick_order}
                  onChange={(event) => handleFormChange('editor_pick_order', event.target.value)}
                  placeholder="Urutan redaksi"
                />
              </div>
            </div>

            <div className="admin-news-meta-strip">
              <small>Dibuat: {formatDateTime(newsForm.created_at, '-')}</small>
              <small>Update: {formatDateTime(newsForm.updated_at, '-')}</small>
              <small>Publish: {formatDateTime(newsForm.published_at, '-')}</small>
            </div>

            <div className="admin-news-form-actions">
              <button type="button" className="btn btn-outline" onClick={handleCreateNew}>
                Reset Form
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Menyimpan...' : newsForm.id ? 'Update Berita' : 'Simpan Berita'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </AccountShell>
  );
}
