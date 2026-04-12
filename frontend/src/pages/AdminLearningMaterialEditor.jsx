import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AccountShell from '../components/AccountShell';
import apiClient from '../api';

const FONT_SIZE_COMMANDS = {
  '12': '2',
  '14': '3',
  '16': '4',
  '20': '5',
  '28': '6',
  '36': '7',
};

const createEmptyMaterialPage = (order = 1) => ({
  title: `Halaman ${order}`,
  points: [''],
  closing: '',
  content_html: '<p>Tulis materi di sini.</p>',
});

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function pageToHtml(page) {
  if (page.content_html) {
    return sanitizeEditorHtml(page.content_html);
  }

  const points = Array.isArray(page.points) ? page.points : String(page.points || '').split('\n');
  const pointItems = points
    .map((point) => String(point || '').trim())
    .filter(Boolean)
    .map((point) => `<li>${escapeHtml(point)}</li>`)
    .join('');
  const closing = String(page.closing || '').trim();

  return [
    pointItems ? `<ul>${pointItems}</ul>` : '<p>Tulis materi di sini.</p>',
    closing ? `<p><strong>Rangkuman:</strong> ${escapeHtml(closing)}</p>` : '',
  ].join('');
}

function sanitizeEditorHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(html || ''), 'text/html');
  doc.querySelectorAll('script, iframe, object, embed, link, meta, style').forEach((node) => node.remove());
  doc.body.querySelectorAll('*').forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (name.startsWith('on') || value.startsWith('javascript:')) {
        node.removeAttribute(attribute.name);
      }
    });
  });
  return doc.body.innerHTML.trim();
}

function extractPointsFromHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(html || ''), 'text/html');
  const items = [...doc.querySelectorAll('li')]
    .map((item) => item.textContent.trim())
    .filter(Boolean);

  if (items.length > 0) {
    return items;
  }

  return doc.body.textContent
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function AdminLearningMaterialEditor() {
  const { packageId, sectionCode } = useParams();
  const navigate = useNavigate();
  const editorRefs = useRef({});
  const [learningContent, setLearningContent] = useState([]);
  const [materialForm, setMaterialForm] = useState({ title: '', pages: [createEmptyMaterialPage()] });
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const numericPackageId = Number(packageId);
  const activeSection = useMemo(
    () => learningContent.find((section) => section.code === sectionCode) || null,
    [learningContent, sectionCode]
  );

  const fetchLearningContent = useCallback(async () => {
    if (!Number.isInteger(numericPackageId) || numericPackageId <= 0 || !sectionCode) {
      setError('Link editor materi tidak valid.');
      setLoading(false);
      return;
    }

    try {
      const response = await apiClient.get(`/admin/learning-content?package_id=${numericPackageId}&_=${Date.now()}`);
      const sections = response.data.data?.sections || [];
      const section = sections.find((item) => item.code === sectionCode);
      setLearningContent(sections);

      if (!section) {
        setError('Subtest tidak ditemukan pada paket ini.');
        return;
      }

      setMaterialForm({
        title: section.material?.title || section.name || '',
        pages: (section.material?.pages || [createEmptyMaterialPage()]).map((page, index) => ({
          title: page.title || `Halaman ${index + 1}`,
          points: Array.isArray(page.points) ? page.points : String(page.points || '').split('\n'),
          closing: page.closing || '',
          content_html: pageToHtml(page),
        })),
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat materi subtest');
    } finally {
      setLoading(false);
    }
  }, [numericPackageId, sectionCode]);

  useEffect(() => {
    fetchLearningContent();
  }, [fetchLearningContent]);

  const readPagesFromEditor = () => materialForm.pages.map((page, pageIndex) => {
    const rawHtml = editorRefs.current[pageIndex]?.innerHTML || page.content_html || '';
    const contentHtml = sanitizeEditorHtml(rawHtml);
    return {
      title: page.title || `Halaman ${pageIndex + 1}`,
      points: extractPointsFromHtml(contentHtml),
      closing: '',
      content_html: contentHtml,
    };
  });

  const updatePageTitle = (pageIndex, title) => {
    setMaterialForm((current) => ({
      ...current,
      pages: current.pages.map((page, index) => (
        index === pageIndex ? { ...page, title } : page
      )),
    }));
  };

  const updatePageContent = (pageIndex) => {
    const rawHtml = editorRefs.current[pageIndex]?.innerHTML || '';
    const contentHtml = sanitizeEditorHtml(rawHtml);
    setMaterialForm((current) => ({
      ...current,
      pages: current.pages.map((page, index) => (
        index === pageIndex
          ? {
              ...page,
              content_html: contentHtml,
              points: extractPointsFromHtml(contentHtml),
            }
          : page
      )),
    }));
  };

  const addMaterialPage = () => {
    setMaterialForm((current) => ({
      ...current,
      pages: [...readPagesFromEditor(), createEmptyMaterialPage(current.pages.length + 1)],
    }));
    setActivePageIndex(materialForm.pages.length);
  };

  const removeMaterialPage = (pageIndex) => {
    setMaterialForm((current) => {
      if (current.pages.length <= 1) {
        return current;
      }

      return {
        ...current,
        pages: readPagesFromEditor().filter((_, index) => index !== pageIndex),
      };
    });
    setActivePageIndex((current) => Math.max(0, Math.min(current, materialForm.pages.length - 2)));
  };

  const runCommand = (command, value = null) => {
    const editor = editorRefs.current[activePageIndex];
    if (editor) {
      editor.focus();
    }
    document.execCommand(command, false, value);
  };

  const applyFontSize = (size) => {
    runCommand('fontSize', FONT_SIZE_COMMANDS[size] || '3');
  };

  const insertImage = () => {
    const url = window.prompt('Masukkan URL gambar');
    if (!url) {
      return;
    }

    runCommand('insertImage', url.trim());
  };

  const insertLink = () => {
    const url = window.prompt('Masukkan URL link');
    if (!url) {
      return;
    }

    runCommand('createLink', url.trim());
  };

  const handleSave = async () => {
    if (!activeSection) {
      return;
    }

    const pages = readPagesFromEditor();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiClient.put('/admin/learning-material', {
        package_id: numericPackageId,
        section_code: activeSection.code,
        title: materialForm.title,
        pages,
      });
      setMaterialForm((current) => ({ ...current, pages }));
      setSuccess('Materi berhasil disimpan.');
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan materi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccountShell title="Editor Materi" subtitle="Tulis materi subtest dengan format dokumen, gambar, warna, dan ukuran font.">
      <div className="admin-material-editor-topbar">
        <Link to="/admin" className="btn btn-outline">Kembali ke Admin</Link>
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || loading}>
          {saving ? 'Menyimpan...' : 'Simpan Materi'}
        </button>
      </div>

      {error && <div className="alert">{error}</div>}
      {success && <div className="account-success">{success}</div>}

      {loading ? (
        <div className="account-card">
          <p>Memuat editor materi...</p>
        </div>
      ) : activeSection ? (
        <section className="account-card admin-material-editor-shell">
          <div className="admin-doc-toolbar admin-doc-toolbar-sticky">
            <div>
              <span className="account-package-tag">{activeSection.session_name || 'Subtest'}</span>
              <h3>{activeSection.name}</h3>
            </div>
            <div className="admin-doc-toolbar-actions">
              <button type="button" className="btn btn-outline" onClick={addMaterialPage}>Tambah Halaman</button>
              <button type="button" className="btn btn-outline" onClick={() => navigate('/admin')}>Tutup Editor</button>
            </div>
          </div>

          <div
            className="admin-word-ribbon"
            aria-label="Toolbar format materi"
            onMouseDown={(event) => {
              if (event.target.closest?.('button')) {
                event.preventDefault();
              }
            }}
          >
            <select onChange={(event) => runCommand('formatBlock', event.target.value)} defaultValue="p">
              <option value="p">Paragraf</option>
              <option value="h2">Heading 1</option>
              <option value="h3">Heading 2</option>
            </select>
            <select onChange={(event) => applyFontSize(event.target.value)} defaultValue="16">
              <option value="12">12</option>
              <option value="14">14</option>
              <option value="16">16</option>
              <option value="20">20</option>
              <option value="28">28</option>
              <option value="36">36</option>
            </select>
            <label className="admin-color-control">
              Warna
              <input type="color" defaultValue="#16243c" onChange={(event) => runCommand('foreColor', event.target.value)} />
            </label>
            <button type="button" onClick={() => runCommand('bold')}>B</button>
            <button type="button" onClick={() => runCommand('italic')}><em>I</em></button>
            <button type="button" onClick={() => runCommand('underline')}><u>U</u></button>
            <button type="button" onClick={() => runCommand('insertUnorderedList')}>Bullet</button>
            <button type="button" onClick={() => runCommand('insertOrderedList')}>Nomor</button>
            <button type="button" onClick={() => runCommand('justifyLeft')}>Kiri</button>
            <button type="button" onClick={() => runCommand('justifyCenter')}>Tengah</button>
            <button type="button" onClick={() => runCommand('justifyRight')}>Kanan</button>
            <button type="button" onClick={insertLink}>Link</button>
            <button type="button" onClick={insertImage}>Gambar</button>
            <button type="button" onClick={() => runCommand('removeFormat')}>Hapus Format</button>
          </div>

          <div className="admin-doc-editor admin-material-doc-editor">
            <aside className="admin-doc-outline">
              <strong>Halaman</strong>
              {materialForm.pages.map((page, pageIndex) => (
                <button
                  key={`outline-${pageIndex}`}
                  type="button"
                  className={pageIndex === activePageIndex ? 'admin-doc-outline-item-active' : ''}
                  onClick={() => {
                    setActivePageIndex(pageIndex);
                    editorRefs.current[pageIndex]?.focus();
                  }}
                >
                  {pageIndex + 1}. {page.title || `Halaman ${pageIndex + 1}`}
                </button>
              ))}
            </aside>

            <div className="admin-doc-page-stack">
              <div className="admin-doc-cover">
                <label>Judul Materi</label>
                <input
                  value={materialForm.title}
                  onChange={(event) => setMaterialForm((current) => ({ ...current, title: event.target.value }))}
                />
              </div>

              {materialForm.pages.map((page, pageIndex) => (
                <section key={`material-page-${pageIndex}`} className="admin-doc-page admin-word-page">
                  <div className="admin-doc-page-head">
                    <span>Halaman {pageIndex + 1}</span>
                    <button
                      type="button"
                      className="btn btn-outline admin-option-delete"
                      onClick={() => removeMaterialPage(pageIndex)}
                      disabled={materialForm.pages.length <= 1}
                    >
                      Hapus
                    </button>
                  </div>
                  <input
                    className="admin-doc-title-input"
                    value={page.title}
                    onChange={(event) => updatePageTitle(pageIndex, event.target.value)}
                    onFocus={() => setActivePageIndex(pageIndex)}
                    placeholder="Judul halaman"
                  />
                  <div
                    ref={(node) => {
                      editorRefs.current[pageIndex] = node;
                    }}
                    className="admin-word-editable"
                    contentEditable
                    suppressContentEditableWarning
                    onFocus={() => setActivePageIndex(pageIndex)}
                    onBlur={() => updatePageContent(pageIndex)}
                    dangerouslySetInnerHTML={{ __html: page.content_html || '<p>Tulis materi di sini.</p>' }}
                  />
                </section>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <div className="account-card">
          <p className="text-muted">Subtest tidak ditemukan.</p>
        </div>
      )}
    </AccountShell>
  );
}
