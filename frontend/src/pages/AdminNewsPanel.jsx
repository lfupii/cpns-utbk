import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AccountShell from '../components/AccountShell';
import apiClient from '../api';
import { formatDateTime } from '../utils/date';

const NEWS_CATEGORY_OPTIONS = [
  'Nasional',
  'Ekonomi',
  'Politik',
  'Teknologi',
  'Olahraga',
  'Gaya Hidup',
  'Hiburan',
  'Edukasi',
];

const STATUS_FILTERS = ['semua', 'published', 'draft'];
const NEWS_PANEL_MODES = [
  { value: 'articles', label: 'Artikel' },
  { value: 'sections', label: 'Section' },
];
const NEWS_SECTION_LAYOUT_OPTIONS = [
  { value: 'hero', label: 'Hero + Stack' },
  { value: 'ranked', label: 'Ranking' },
  { value: 'lead-grid', label: 'Lead Grid' },
  { value: 'cards', label: 'Cards' },
];

const TOOLBAR_ACTIONS = [
  { label: 'Paragraph', mode: 'paragraph' },
  { label: 'H2', mode: 'heading' },
  { label: 'B', mode: 'bold' },
  { label: 'I', mode: 'italic' },
  { label: 'Quote', mode: 'quote' },
  { label: 'List', mode: 'list' },
];

function createCurrentLocalDateTime() {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  const day = String(currentDate.getDate()).padStart(2, '0');
  const hours = String(currentDate.getHours()).padStart(2, '0');
  const minutes = String(currentDate.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:00`;
}

function createEmptyNewsForm() {
  return {
    id: null,
    article_id: null,
    title: '',
    slug: '',
    category: 'Nasional',
    tags: [],
    author_name: 'Tim Redaksi',
    excerpt: '',
    content: '',
    cover_image_url: '',
    read_time_minutes: 4,
    status: 'draft',
    visibility: 'public',
    focus_keyword: '',
    allow_comments: true,
    is_featured: false,
    featured_order: 0,
    is_popular: false,
    popular_order: 0,
    is_editor_pick: false,
    editor_pick_order: 0,
    published_at: createCurrentLocalDateTime(),
    created_at: null,
    updated_at: null,
    last_saved_at: null,
    last_published_at: null,
  };
}

function normalizeNewsForm(article) {
  return {
    id: Number(article?.id || 0) || null,
    article_id: Number(article?.article_id || 0) || null,
    title: article?.title || '',
    slug: article?.slug || '',
    category: article?.category || 'Nasional',
    tags: Array.isArray(article?.tags) ? article.tags.filter(Boolean) : [],
    author_name: article?.author_name || 'Tim Redaksi',
    excerpt: article?.excerpt || '',
    content: article?.content || '',
    cover_image_url: article?.cover_image_url || '',
    read_time_minutes: Math.max(1, Number(article?.read_time_minutes || 4)),
    status: article?.status === 'published' ? 'published' : 'draft',
    visibility: article?.visibility === 'private' ? 'private' : 'public',
    focus_keyword: article?.focus_keyword || '',
    allow_comments: Boolean(Number(article?.allow_comments ?? 1)),
    is_featured: Boolean(Number(article?.is_featured || 0)),
    featured_order: Math.max(0, Number(article?.featured_order || 0)),
    is_popular: Boolean(Number(article?.is_popular || 0)),
    popular_order: Math.max(0, Number(article?.popular_order || 0)),
    is_editor_pick: Boolean(Number(article?.is_editor_pick || 0)),
    editor_pick_order: Math.max(0, Number(article?.editor_pick_order || 0)),
    published_at: article?.published_at || createCurrentLocalDateTime(),
    created_at: article?.created_at || null,
    updated_at: article?.updated_at || null,
    last_saved_at: article?.last_saved_at || null,
    last_published_at: article?.last_published_at || null,
  };
}

function createEmptySectionForm() {
  return {
    id: null,
    section_id: null,
    title: '',
    slug: '',
    description: '',
    layout_style: 'cards',
    article_count: 5,
    section_order: 0,
    is_active: true,
    assignments: [],
    assigned_article_ids: [],
    created_at: null,
    updated_at: null,
    last_saved_at: null,
    last_published_at: null,
  };
}

function normalizeSectionAssignment(assignment) {
  return {
    relation_id: Number(assignment?.relation_id || 0) || null,
    article_order: Math.max(1, Number(assignment?.article_order || 1)),
    article_id: Number(assignment?.article_id || 0) || null,
    published_article_id: Number(assignment?.published_article_id || 0) || null,
    slug: assignment?.slug || '',
    title: assignment?.title || '',
    category: assignment?.category || 'Nasional',
    cover_image_url: assignment?.cover_image_url || '',
    status: assignment?.status === 'published' ? 'published' : 'draft',
    published_at: assignment?.published_at || null,
    updated_at: assignment?.updated_at || null,
  };
}

function normalizeSectionForm(section) {
  const assignments = Array.isArray(section?.assignments)
    ? section.assignments.map((assignment) => normalizeSectionAssignment(assignment))
    : [];

  return {
    id: Number(section?.id || 0) || null,
    section_id: Number(section?.section_id || 0) || null,
    title: section?.title || '',
    slug: section?.slug || '',
    description: section?.description || '',
    layout_style: section?.layout_style || 'cards',
    article_count: Math.max(1, Number(section?.article_count || 5)),
    section_order: Math.max(0, Number(section?.section_order || 0)),
    is_active: Boolean(Number(section?.is_active ?? 1)),
    assignments,
    assigned_article_ids: assignments.map((assignment) => Number(assignment.article_id || 0)).filter(Boolean),
    created_at: section?.created_at || null,
    updated_at: section?.updated_at || null,
    last_saved_at: section?.last_saved_at || null,
    last_published_at: section?.last_published_at || null,
  };
}

function extractPlainText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getDateInputValue(value) {
  const normalized = String(value || '').trim();
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

function getTimeInputValue(value) {
  const normalized = String(value || '').trim();
  const match = normalized.match(/(?:\s|T)(\d{2}:\d{2})/);
  return match ? match[1] : '';
}

function mergeDateAndTime(dateValue, timeValue) {
  const safeDate = String(dateValue || '').trim();
  if (!safeDate) {
    return null;
  }

  const safeTime = String(timeValue || '').trim() || '00:00';
  return `${safeDate} ${safeTime}:00`;
}

function countWords(value) {
  const plainText = extractPlainText(value);
  if (!plainText) {
    return 0;
  }

  return plainText.split(/\s+/).filter(Boolean).length;
}

function getSectionLayoutLabel(layoutStyle) {
  return NEWS_SECTION_LAYOUT_OPTIONS.find((option) => option.value === layoutStyle)?.label || 'Cards';
}

export default function AdminNewsPanel() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [articles, setArticles] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sectionsLoading, setSectionsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sectionSaving, setSectionSaving] = useState(false);
  const [sectionPublishing, setSectionPublishing] = useState(false);
  const [sectionDeleting, setSectionDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedArticleId, setSelectedArticleId] = useState(null);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('semua');
  const [workspaceCarryArticleId, setWorkspaceCarryArticleId] = useState(0);
  const [workspaceCarrySectionId, setWorkspaceCarrySectionId] = useState(0);
  const [tagDraft, setTagDraft] = useState('');
  const [newsForm, setNewsForm] = useState(createEmptyNewsForm());
  const [sectionForm, setSectionForm] = useState(createEmptySectionForm());
  const contentInputRef = useRef(null);
  const selectedArticleIdRef = useRef(null);
  const selectedSectionIdRef = useRef(null);

  const newsWorkspace = searchParams.get('workspace') === 'published' ? 'published' : 'draft';
  const newsPanelMode = searchParams.get('panel') === 'sections' ? 'sections' : 'articles';
  const isDraftWorkspace = newsWorkspace === 'draft';
  const isSectionPanel = newsPanelMode === 'sections';
  const formLocked = !isDraftWorkspace || saving || publishing;
  const sectionFormLocked = !isDraftWorkspace || sectionSaving || sectionPublishing;

  const filteredArticles = useMemo(() => (
    statusFilter === 'semua'
      ? articles
      : articles.filter((article) => article.status === statusFilter)
  ), [articles, statusFilter]);
  const contentWordCount = useMemo(() => countWords(newsForm.content), [newsForm.content]);
  const excerptCharacterCount = newsForm.excerpt.trim().length;
  const keywordCharacterCount = newsForm.focus_keyword.trim().length;
  const publishDateValue = getDateInputValue(newsForm.published_at);
  const publishTimeValue = getTimeInputValue(newsForm.published_at);
  const articlesById = useMemo(() => new Map(articles.map((article) => [Number(article.id), article])), [articles]);
  const fallbackAssignmentsById = useMemo(
    () => new Map((sectionForm.assignments || []).map((assignment) => [Number(assignment.article_id), assignment])),
    [sectionForm.assignments],
  );
  const selectedSectionAssignments = useMemo(() => (
    sectionForm.assigned_article_ids
      .map((articleId, index) => {
        const numericId = Number(articleId);
        const article = articlesById.get(numericId);
        const fallbackAssignment = fallbackAssignmentsById.get(numericId);

        return {
          article_id: numericId,
          article_order: index + 1,
          published_article_id: article
            ? (isDraftWorkspace ? Number(article.article_id || 0) : Number(article.id || 0))
            : Number(fallbackAssignment?.published_article_id || 0),
          slug: article?.slug || fallbackAssignment?.slug || '',
          title: article?.title || fallbackAssignment?.title || `Artikel #${numericId}`,
          category: article?.category || fallbackAssignment?.category || 'Nasional',
          cover_image_url: article?.cover_image_url || fallbackAssignment?.cover_image_url || '',
          status: article?.status || fallbackAssignment?.status || 'draft',
          updated_at: article?.updated_at || fallbackAssignment?.updated_at || null,
        };
      })
      .filter((assignment) => Number(assignment.article_id) > 0)
  ), [articlesById, fallbackAssignmentsById, isDraftWorkspace, sectionForm.assigned_article_ids]);
  const publishedReadyAssignmentsCount = useMemo(() => (
    isDraftWorkspace
      ? selectedSectionAssignments.filter((assignment) => Number(assignment.published_article_id || 0) > 0).length
      : selectedSectionAssignments.length
  ), [isDraftWorkspace, selectedSectionAssignments]);

  useEffect(() => {
    selectedArticleIdRef.current = selectedArticleId;
  }, [selectedArticleId]);

  useEffect(() => {
    selectedSectionIdRef.current = selectedSectionId;
  }, [selectedSectionId]);

  const loadArticles = useCallback(async (preferredId = null, preferredSourceArticleId = 0) => {
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.get(`/admin/news?workspace=${newsWorkspace}`);
      const nextArticles = Array.isArray(response.data?.data) ? response.data.data.map(normalizeNewsForm) : [];
      setArticles(nextArticles);

      const targetId = preferredId ?? selectedArticleIdRef.current;
      let matchedArticle = nextArticles.find((article) => Number(article.id) === Number(targetId)) || null;

      if (!matchedArticle && preferredSourceArticleId > 0) {
        matchedArticle = isDraftWorkspace
          ? nextArticles.find((article) => Number(article.article_id) === Number(preferredSourceArticleId)) || null
          : nextArticles.find((article) => Number(article.id) === Number(preferredSourceArticleId)) || null;
      }

      if (!matchedArticle) {
        matchedArticle = nextArticles[0] || null;
      }

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
  }, [isDraftWorkspace, newsWorkspace]);

  const loadSections = useCallback(async (preferredId = null, preferredSourceSectionId = 0) => {
    setSectionsLoading(true);
    setError('');

    try {
      const response = await apiClient.get(`/admin/news-sections?workspace=${newsWorkspace}`);
      const nextSections = Array.isArray(response.data?.data) ? response.data.data.map(normalizeSectionForm) : [];
      setSections(nextSections);

      const targetId = preferredId ?? selectedSectionIdRef.current;
      let matchedSection = nextSections.find((section) => Number(section.id) === Number(targetId)) || null;

      if (!matchedSection && preferredSourceSectionId > 0) {
        matchedSection = isDraftWorkspace
          ? nextSections.find((section) => Number(section.section_id) === Number(preferredSourceSectionId)) || null
          : nextSections.find((section) => Number(section.id) === Number(preferredSourceSectionId)) || null;
      }

      if (!matchedSection) {
        matchedSection = nextSections[0] || null;
      }

      if (matchedSection) {
        setSelectedSectionId(matchedSection.id);
        setSectionForm(normalizeSectionForm(matchedSection));
      } else {
        setSelectedSectionId(null);
        setSectionForm(createEmptySectionForm());
      }
    } catch (loadError) {
      setError(loadError?.response?.data?.message || 'Gagal memuat master section berita');
    } finally {
      setSectionsLoading(false);
    }
  }, [isDraftWorkspace, newsWorkspace]);

  useEffect(() => {
    loadArticles(null, workspaceCarryArticleId);
    if (workspaceCarryArticleId > 0) {
      setWorkspaceCarryArticleId(0);
    }
  }, [loadArticles, workspaceCarryArticleId]);

  useEffect(() => {
    loadSections(null, workspaceCarrySectionId);
    if (workspaceCarrySectionId > 0) {
      setWorkspaceCarrySectionId(0);
    }
  }, [loadSections, workspaceCarrySectionId]);

  const handleWorkspaceChange = (nextWorkspace) => {
    if (nextWorkspace === newsWorkspace) {
      return;
    }

    const nextQuery = new URLSearchParams(searchParams);
    nextQuery.set('workspace', nextWorkspace);
    setWorkspaceCarryArticleId(Number(newsForm.article_id || newsForm.id || 0));
    setWorkspaceCarrySectionId(Number(sectionForm.section_id || sectionForm.id || 0));
    setSearchParams(nextQuery);
    setStatusFilter('semua');
    setError('');
    setSuccess('');
  };

  const handlePanelModeChange = (nextMode) => {
    if (nextMode === newsPanelMode) {
      return;
    }

    const nextQuery = new URLSearchParams(searchParams);
    nextQuery.set('panel', nextMode);
    setSearchParams(nextQuery);
    setError('');
    setSuccess('');
  };

  const handleFormChange = (field, value) => {
    setNewsForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const handleSectionFormChange = (field, value) => {
    setSectionForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const handleSelectArticle = (article) => {
    setSelectedArticleId(article.id);
    setNewsForm(normalizeNewsForm(article));
    setTagDraft('');
    setError('');
    setSuccess('');
  };

  const handleSelectSection = (section) => {
    setSelectedSectionId(section.id);
    setSectionForm(normalizeSectionForm(section));
    setError('');
    setSuccess('');
  };

  const handleCreateNew = () => {
    if (!isDraftWorkspace) {
      handleWorkspaceChange('draft');
      return;
    }

    setSelectedArticleId(null);
    setTagDraft('');
    setNewsForm(createEmptyNewsForm());
    setError('');
    setSuccess('');
  };

  const handleCreateNewSection = () => {
    if (!isDraftWorkspace) {
      handleWorkspaceChange('draft');
      return;
    }

    setSelectedSectionId(null);
    setSectionForm(createEmptySectionForm());
    setError('');
    setSuccess('');
  };

  const syncPublishDate = (nextDate, nextTime = publishTimeValue) => {
    handleFormChange('published_at', mergeDateAndTime(nextDate, nextTime));
  };

  const syncPublishTime = (nextTime, nextDate = publishDateValue) => {
    handleFormChange('published_at', mergeDateAndTime(nextDate, nextTime));
  };

  const pushTags = useCallback((rawValue) => {
    const nextTags = String(rawValue || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (nextTags.length === 0) {
      setTagDraft('');
      return;
    }

    setNewsForm((currentForm) => {
      const mergedTags = [...currentForm.tags];
      nextTags.forEach((tag) => {
        const exists = mergedTags.some((existingTag) => existingTag.toLowerCase() === tag.toLowerCase());
        if (!exists) {
          mergedTags.push(tag);
        }
      });

      return {
        ...currentForm,
        tags: mergedTags,
      };
    });
    setTagDraft('');
  }, []);

  const handleTagKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      pushTags(tagDraft);
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setNewsForm((currentForm) => ({
      ...currentForm,
      tags: currentForm.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const insertEditorSnippet = (mode) => {
    if (formLocked) {
      return;
    }

    const textareaElement = contentInputRef.current;
    const currentValue = newsForm.content || '';
    let prefix = '';
    let suffix = '';
    let placeholder = 'Tulis di sini';

    if (mode === 'heading') {
      prefix = '\n<h2>';
      suffix = '</h2>\n';
      placeholder = 'Judul subbagian';
    } else if (mode === 'bold') {
      prefix = '<strong>';
      suffix = '</strong>';
      placeholder = 'Teks tebal';
    } else if (mode === 'italic') {
      prefix = '<em>';
      suffix = '</em>';
      placeholder = 'Teks miring';
    } else if (mode === 'quote') {
      prefix = '\n<blockquote>';
      suffix = '</blockquote>\n';
      placeholder = 'Kutipan';
    } else if (mode === 'list') {
      prefix = '\n<ul>\n  <li>';
      suffix = '</li>\n  <li>Poin berikutnya</li>\n</ul>\n';
      placeholder = 'Poin utama';
    } else {
      prefix = '\n<p>';
      suffix = '</p>\n';
      placeholder = 'Paragraf berita';
    }

    if (!textareaElement) {
      handleFormChange('content', `${currentValue}${prefix}${placeholder}${suffix}`.trim());
      return;
    }

    const start = textareaElement.selectionStart;
    const end = textareaElement.selectionEnd;
    const selectedText = currentValue.slice(start, end) || placeholder;
    const nextValue = `${currentValue.slice(0, start)}${prefix}${selectedText}${suffix}${currentValue.slice(end)}`;
    handleFormChange('content', nextValue);

    requestAnimationFrame(() => {
      textareaElement.focus();
      const cursorPosition = start + prefix.length + selectedText.length + suffix.length;
      textareaElement.setSelectionRange(cursorPosition, cursorPosition);
    });
  };

  const uploadAdminMedia = async (file) => {
    if (!isDraftWorkspace) {
      return;
    }

    setUploading(true);
    setError('');

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
      setSuccess('Gambar unggulan berhasil diupload.');
    } catch (uploadError) {
      setError(uploadError?.response?.data?.message || 'Gagal mengupload gambar unggulan');
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

  const buildPayload = () => ({
    ...newsForm,
    workspace: newsWorkspace,
    tags: newsForm.tags,
    read_time_minutes: Math.max(1, Number(newsForm.read_time_minutes || 1)),
    featured_order: Math.max(0, Number(newsForm.featured_order || 0)),
    popular_order: Math.max(0, Number(newsForm.popular_order || 0)),
    editor_pick_order: Math.max(0, Number(newsForm.editor_pick_order || 0)),
    published_at: mergeDateAndTime(publishDateValue, publishTimeValue),
  });

  const buildSectionPayload = () => ({
    ...sectionForm,
    workspace: newsWorkspace,
    article_count: Math.max(1, Number(sectionForm.article_count || 1)),
    section_order: Math.max(0, Number(sectionForm.section_order || 0)),
    assigned_article_ids: sectionForm.assigned_article_ids
      .map((articleId) => Number(articleId))
      .filter((articleId) => articleId > 0 && articlesById.has(articleId)),
  });

  const persistDraft = useCallback(async () => {
    if (!isDraftWorkspace) {
      return null;
    }

    setSaving(true);
    setError('');

    try {
      const payload = buildPayload();
      const response = newsForm.id
        ? await apiClient.put('/admin/news', payload)
        : await apiClient.post('/admin/news', payload);
      const savedDraft = normalizeNewsForm(response.data?.data || {});

      await loadArticles(savedDraft.id);
      setSelectedArticleId(savedDraft.id);
      setNewsForm(savedDraft);
      setTagDraft('');
      return {
        message: response.data?.message || (newsForm.id ? 'Draft berita berhasil diperbarui.' : 'Draft berita berhasil dibuat.'),
        article: savedDraft,
      };
    } catch (saveError) {
      setError(saveError?.response?.data?.message || 'Gagal menyimpan draft berita');
      return null;
    } finally {
      setSaving(false);
    }
  }, [isDraftWorkspace, loadArticles, newsForm, newsWorkspace, publishDateValue, publishTimeValue]);

  const persistSectionDraft = useCallback(async () => {
    if (!isDraftWorkspace) {
      return null;
    }

    setSectionSaving(true);
    setError('');

    try {
      const payload = buildSectionPayload();
      const response = sectionForm.id
        ? await apiClient.put('/admin/news-sections', payload)
        : await apiClient.post('/admin/news-sections', payload);
      const savedSection = normalizeSectionForm(response.data?.data || {});

      await loadSections(savedSection.id);
      setSelectedSectionId(savedSection.id);
      setSectionForm(savedSection);
      return {
        message: response.data?.message || (sectionForm.id ? 'Draft section berita berhasil diperbarui.' : 'Draft section berita berhasil dibuat.'),
        section: savedSection,
      };
    } catch (saveError) {
      setError(saveError?.response?.data?.message || 'Gagal menyimpan draft section berita');
      return null;
    } finally {
      setSectionSaving(false);
    }
  }, [articlesById, isDraftWorkspace, loadSections, newsWorkspace, sectionForm]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const savedResult = await persistDraft();
    if (savedResult) {
      setSuccess(savedResult.message);
    }
  };

  const handleSectionSubmit = async (event) => {
    event.preventDefault();
    const savedResult = await persistSectionDraft();
    if (savedResult) {
      setSuccess(savedResult.message);
    }
  };

  const handlePublishDraft = async () => {
    if (!isDraftWorkspace) {
      return;
    }

    const savedResult = await persistDraft();
    if (!savedResult?.article?.id) {
      return;
    }

    setPublishing(true);
    setError('');

    try {
      const response = await apiClient.post('/admin/news/publish', {
        id: savedResult.article.id,
      });
      const refreshedDraft = normalizeNewsForm(response.data?.data?.draft || {});
      await loadArticles(refreshedDraft.id || savedResult.article.id);
      if (refreshedDraft.id) {
        setSelectedArticleId(refreshedDraft.id);
        setNewsForm(refreshedDraft);
      }
      setSuccess(response.data?.message || 'Draft berita berhasil dipublish ke workspace live.');
    } catch (publishError) {
      setError(publishError?.response?.data?.message || 'Gagal mempublish draft berita');
    } finally {
      setPublishing(false);
    }
  };

  const handlePublishSectionDraft = async () => {
    if (!isDraftWorkspace) {
      return;
    }

    const savedResult = await persistSectionDraft();
    if (!savedResult?.section?.id) {
      return;
    }

    setSectionPublishing(true);
    setError('');

    try {
      const response = await apiClient.post('/admin/news-sections/publish', {
        id: savedResult.section.id,
      });
      const refreshedDraft = normalizeSectionForm(response.data?.data?.draft || {});
      await loadSections(refreshedDraft.id || savedResult.section.id);
      if (refreshedDraft.id) {
        setSelectedSectionId(refreshedDraft.id);
        setSectionForm(refreshedDraft);
      }
      setSuccess(response.data?.message || 'Draft section berita berhasil dipublish ke workspace live.');
    } catch (publishError) {
      setError(publishError?.response?.data?.message || 'Gagal mempublish draft section berita');
    } finally {
      setSectionPublishing(false);
    }
  };

  const handleDelete = async () => {
    if (!newsForm.id) {
      return;
    }

    const confirmationMessage = isDraftWorkspace
      ? `Hapus draft berita "${newsForm.title}"?`
      : `Hapus berita published "${newsForm.title}" beserta draft turunannya?`;

    if (!window.confirm(confirmationMessage)) {
      return;
    }

    setDeleting(true);
    setError('');

    try {
      await apiClient.delete(`/admin/news?workspace=${newsWorkspace}&id=${newsForm.id}`);
      await loadArticles();
      setSuccess(isDraftWorkspace ? 'Draft berita berhasil dihapus.' : 'Berita published berhasil dihapus.');
    } catch (deleteError) {
      setError(deleteError?.response?.data?.message || 'Gagal menghapus berita');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSection = async () => {
    if (!sectionForm.id) {
      return;
    }

    const confirmationMessage = isDraftWorkspace
      ? `Hapus draft section "${sectionForm.title}"?`
      : `Hapus section published "${sectionForm.title}" beserta draft turunannya?`;

    if (!window.confirm(confirmationMessage)) {
      return;
    }

    setSectionDeleting(true);
    setError('');

    try {
      await apiClient.delete(`/admin/news-sections?workspace=${newsWorkspace}&id=${sectionForm.id}`);
      await loadSections();
      setSuccess(isDraftWorkspace ? 'Draft section berita berhasil dihapus.' : 'Section berita published berhasil dihapus.');
    } catch (deleteError) {
      setError(deleteError?.response?.data?.message || 'Gagal menghapus section berita');
    } finally {
      setSectionDeleting(false);
    }
  };

  const toggleSectionAssignment = (articleId) => {
    if (sectionFormLocked) {
      return;
    }

    const numericId = Number(articleId);
    if (numericId <= 0) {
      return;
    }

    setSectionForm((currentForm) => {
      const exists = currentForm.assigned_article_ids.includes(numericId);
      return {
        ...currentForm,
        assigned_article_ids: exists
          ? currentForm.assigned_article_ids.filter((id) => Number(id) !== numericId)
          : [...currentForm.assigned_article_ids, numericId],
      };
    });
  };

  const moveSectionAssignment = (articleId, direction) => {
    if (sectionFormLocked) {
      return;
    }

    const numericId = Number(articleId);
    setSectionForm((currentForm) => {
      const currentIndex = currentForm.assigned_article_ids.findIndex((id) => Number(id) === numericId);
      if (currentIndex === -1) {
        return currentForm;
      }

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= currentForm.assigned_article_ids.length) {
        return currentForm;
      }

      const nextIds = [...currentForm.assigned_article_ids];
      const [movedId] = nextIds.splice(currentIndex, 1);
      nextIds.splice(targetIndex, 0, movedId);

      return {
        ...currentForm,
        assigned_article_ids: nextIds,
      };
    });
  };

  const renderArticleSidebarList = () => (
    <>
      <div className="admin-news-filter-row">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            className={`admin-news-filter-chip ${statusFilter === filter ? 'admin-news-filter-chip-active' : ''}`}
            onClick={() => setStatusFilter(filter)}
          >
            {filter === 'semua' ? 'Semua' : filter === 'published' ? 'Terbit' : 'Draft'}
          </button>
        ))}
      </div>

      <div className="admin-news-list">
        {loading ? (
          <p className="text-muted">Memuat berita...</p>
        ) : filteredArticles.length === 0 ? (
          <p className="text-muted">Belum ada berita pada workspace ini.</p>
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
                  {article.status === 'published' ? 'Terbit' : 'Draft'}
                </span>
                <small>{formatDateTime(article.last_saved_at || article.updated_at, '-')}</small>
              </div>
              <strong>{article.title || 'Berita tanpa judul'}</strong>
              <p>{article.category} • {article.author_name}</p>
              {isDraftWorkspace && article.article_id ? (
                <small className="text-muted">Tersambung ke artikel live #{article.article_id}</small>
              ) : null}
            </div>
          </button>
        ))}
      </div>
    </>
  );

  const renderSectionSidebarList = () => (
    <>
      <div className="admin-news-sidebar-note">
        <strong>Master section</strong>
        <p className="text-muted">Satu berita bisa dipasang ke banyak section. Urutan atas tampil duluan di halaman publik.</p>
      </div>

      <div className="admin-news-list">
        {sectionsLoading ? (
          <p className="text-muted">Memuat master section...</p>
        ) : sections.length === 0 ? (
          <p className="text-muted">Belum ada section berita pada workspace ini.</p>
        ) : sections.map((section) => (
          <button
            key={section.id}
            type="button"
            className={`admin-news-list-item ${Number(selectedSectionId) === Number(section.id) ? 'admin-news-list-item-active' : ''}`}
            onClick={() => handleSelectSection(section)}
          >
            <div className="admin-news-list-item-copy">
              <div className="admin-news-list-item-head">
                <span className={`admin-inline-status ${section.is_active ? 'admin-inline-status-published' : 'admin-inline-status-draft'}`}>
                  {section.is_active ? 'Aktif' : 'Nonaktif'}
                </span>
                <small>Urutan {section.section_order}</small>
              </div>
              <strong>{section.title || 'Section tanpa judul'}</strong>
              <p>{getSectionLayoutLabel(section.layout_style)} • {section.assigned_article_ids.length} berita</p>
              {isDraftWorkspace && section.section_id ? (
                <small className="text-muted">Tersambung ke section live #{section.section_id}</small>
              ) : null}
            </div>
          </button>
        ))}
      </div>
    </>
  );

  const renderSectionEditor = () => (
    <form className="account-card admin-news-editor-card" onSubmit={handleSectionSubmit}>
      <div className="admin-news-editor-head">
        <div>
          <span className="admin-preview-eyebrow">{sectionForm.id ? 'Edit section' : 'Tambah section'}</span>
          <h2>{sectionForm.title || (isDraftWorkspace ? 'Susun master section baru' : 'Preview section live')}</h2>
        </div>
        {!isDraftWorkspace && (
          <button type="button" className="btn btn-outline" onClick={() => handleWorkspaceChange('draft')}>
            Edit via Draft
          </button>
        )}
      </div>

      <div className="admin-news-editor-grid">
        <label className="admin-news-field admin-news-field-full">
          <span>Judul Section</span>
          <input
            type="text"
            value={sectionForm.title}
            onChange={(event) => handleSectionFormChange('title', event.target.value)}
            placeholder="Misal: Berita Terbaru CPNS"
            required
            disabled={sectionFormLocked}
          />
        </label>

        <label className="admin-news-field">
          <span>Slug</span>
          <input
            type="text"
            value={sectionForm.slug}
            onChange={(event) => handleSectionFormChange('slug', event.target.value)}
            placeholder="slug-section-otomatis"
            disabled={sectionFormLocked}
          />
        </label>

        <label className="admin-news-field">
          <span>Layout</span>
          <select
            value={sectionForm.layout_style}
            onChange={(event) => handleSectionFormChange('layout_style', event.target.value)}
            disabled={sectionFormLocked}
          >
            {NEWS_SECTION_LAYOUT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="admin-news-field admin-news-field-full">
          <span>Deskripsi Section</span>
          <textarea
            rows={3}
            value={sectionForm.description}
            onChange={(event) => handleSectionFormChange('description', event.target.value)}
            placeholder="Deskripsi singkat untuk heading section di halaman publik."
            disabled={sectionFormLocked}
          />
        </label>
      </div>

      <section className="admin-news-section-builder">
        <div className="admin-news-section-builder-head">
          <div>
            <span className="admin-preview-eyebrow">Urutan tampil</span>
            <h3>Berita di Section</h3>
          </div>
          <small>{selectedSectionAssignments.length} berita dipilih</small>
        </div>

        {selectedSectionAssignments.length === 0 ? (
          <div className="admin-news-section-empty">
            <strong>Belum ada berita di section ini.</strong>
            <p>Pilih berita di daftar bawah untuk memasukkannya ke section.</p>
          </div>
        ) : (
          <div className="admin-news-assigned-list">
            {selectedSectionAssignments.map((assignment, index) => (
              <div key={`${assignment.article_id}-${index}`} className="admin-news-assigned-item">
                <div className="admin-news-assigned-order">{index + 1}</div>

                <div className="admin-news-assigned-main">
                  {assignment.cover_image_url ? (
                    <div className="admin-news-assigned-thumb">
                      <img src={assignment.cover_image_url} alt={assignment.title} />
                    </div>
                  ) : (
                    <div className="admin-news-assigned-thumb admin-news-assigned-thumb-empty">No Cover</div>
                  )}

                  <div className="admin-news-assigned-copy">
                    <strong>{assignment.title}</strong>
                    <p>{assignment.category} • {assignment.status === 'published' ? 'Terbit' : 'Draft'}</p>
                    {isDraftWorkspace && !assignment.published_article_id ? (
                      <small className="text-muted">Belum punya versi live. Publish artikelnya dulu kalau mau ikut tampil publik.</small>
                    ) : null}
                  </div>
                </div>

                {isDraftWorkspace && (
                  <div className="admin-news-assigned-actions">
                    <button type="button" className="btn btn-outline" onClick={() => moveSectionAssignment(assignment.article_id, 'up')}>
                      Naik
                    </button>
                    <button type="button" className="btn btn-outline" onClick={() => moveSectionAssignment(assignment.article_id, 'down')}>
                      Turun
                    </button>
                    <button type="button" className="btn btn-outline" onClick={() => toggleSectionAssignment(assignment.article_id)}>
                      Lepas
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="admin-news-section-builder">
        <div className="admin-news-section-builder-head">
          <div>
            <span className="admin-preview-eyebrow">Katalog berita</span>
            <h3>Pilih Berita untuk Section</h3>
          </div>
          <small>{articles.length} berita tersedia</small>
        </div>

        <div className="admin-news-assignment-grid">
          {loading ? (
            <p className="text-muted">Memuat artikel untuk assignment...</p>
          ) : articles.length === 0 ? (
            <div className="admin-news-section-empty">
              <strong>Belum ada berita.</strong>
              <p>Buat draft berita dulu, lalu pasang ke section yang diinginkan.</p>
            </div>
          ) : articles.map((article) => {
            const isSelected = sectionForm.assigned_article_ids.includes(Number(article.id));
            const isLiveLinked = isDraftWorkspace ? Number(article.article_id || 0) > 0 : true;

            return (
              <button
                key={article.id}
                type="button"
                className={`admin-news-assign-card ${isSelected ? 'admin-news-assign-card-active' : ''}`}
                onClick={() => toggleSectionAssignment(article.id)}
                disabled={sectionFormLocked}
              >
                {article.cover_image_url ? (
                  <div className="admin-news-assign-thumb">
                    <img src={article.cover_image_url} alt={article.title} />
                  </div>
                ) : (
                  <div className="admin-news-assign-thumb admin-news-assign-thumb-empty">No Cover</div>
                )}

                <div className="admin-news-assign-copy">
                  <div className="admin-news-assign-meta">
                    <span className={`admin-inline-status admin-inline-status-${article.status}`}>
                      {article.status === 'published' ? 'Terbit' : 'Draft'}
                    </span>
                    {isSelected ? <strong>Terpasang</strong> : <strong>Pilih</strong>}
                  </div>
                  <h4>{article.title || 'Berita tanpa judul'}</h4>
                  <p>{article.category} • {article.author_name}</p>
                  {isDraftWorkspace && !isLiveLinked ? (
                    <small className="text-muted">Belum tersambung ke artikel live.</small>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="admin-news-form-actions admin-news-form-actions-bottom">
        {isDraftWorkspace ? (
          <>
            <button type="button" className="btn btn-outline" onClick={handleCreateNewSection}>
              Tambah Section Baru
            </button>
            <button type="submit" className="btn btn-outline" disabled={sectionSaving || sectionPublishing}>
              {sectionSaving ? 'Menyimpan...' : (sectionForm.id ? 'Simpan Edit Draft' : 'Simpan Draft')}
            </button>
            <button type="button" className="btn btn-primary" onClick={handlePublishSectionDraft} disabled={sectionSaving || sectionPublishing}>
              {sectionPublishing ? 'Publish Draft...' : 'Publish Draft'}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => handleWorkspaceChange('draft')}>
            Pindah ke Draft untuk Edit
          </button>
        )}
      </div>
    </form>
  );

  const renderSectionSettings = () => (
    <aside className="admin-news-settings-column">
      <section className="account-card admin-news-settings-card">
        <div className="admin-news-settings-head">
          <h3>Konfigurasi Section</h3>
        </div>

        <label className="admin-news-field">
          <span>Layout Tampil</span>
          <select
            value={sectionForm.layout_style}
            onChange={(event) => handleSectionFormChange('layout_style', event.target.value)}
            disabled={sectionFormLocked}
          >
            {NEWS_SECTION_LAYOUT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <div className="admin-news-inline-grid">
          <label className="admin-news-field">
            <span>Jumlah artikel tampil</span>
            <input
              type="number"
              min="1"
              max="24"
              value={sectionForm.article_count}
              onChange={(event) => handleSectionFormChange('article_count', event.target.value)}
              disabled={sectionFormLocked}
            />
          </label>

          <label className="admin-news-field">
            <span>Urutan section</span>
            <input
              type="number"
              min="0"
              value={sectionForm.section_order}
              onChange={(event) => handleSectionFormChange('section_order', event.target.value)}
              disabled={sectionFormLocked}
            />
          </label>
        </div>

        <label className="admin-news-toggle-row">
          <span>Section aktif di publik</span>
          <button
            type="button"
            className={`theme-toggle admin-news-toggle ${sectionForm.is_active ? 'theme-toggle-on' : ''}`}
            onClick={() => handleSectionFormChange('is_active', !sectionForm.is_active)}
            disabled={sectionFormLocked}
            aria-pressed={sectionForm.is_active}
          >
            <span className="theme-toggle-switch">
              <span className="theme-toggle-thumb" />
            </span>
          </button>
        </label>

        {sectionForm.id && (
          <button type="button" className="btn btn-danger admin-news-trash-button" onClick={handleDeleteSection} disabled={sectionDeleting}>
            {sectionDeleting ? 'Memindahkan...' : 'Pindahkan ke Sampah'}
          </button>
        )}
      </section>

      <section className="account-card admin-news-settings-card">
        <div className="admin-news-settings-head">
          <h3>Sinkronisasi Publik</h3>
        </div>

        <div className="admin-news-section-stats">
          <div className="admin-news-stat-card">
            <strong>{selectedSectionAssignments.length}</strong>
            <span>Total berita di section</span>
          </div>
          <div className="admin-news-stat-card">
            <strong>{publishedReadyAssignmentsCount}</strong>
            <span>Siap tampil di workspace live</span>
          </div>
        </div>

        <p className="text-muted">
          Di workspace draft, section bisa memuat berita draft maupun live. Saat section dipublish, frontend publik hanya membaca berita yang sudah punya versi live.
        </p>
      </section>

      <section className="account-card admin-news-settings-card">
        <div className="admin-news-settings-head">
          <h3>Metadata</h3>
        </div>

        <div className="admin-news-meta-strip admin-news-meta-strip-stack">
          <small>Dibuat: {formatDateTime(sectionForm.created_at, '-')}</small>
          <small>Update: {formatDateTime(sectionForm.updated_at, '-')}</small>
          <small>Simpan Draft: {formatDateTime(sectionForm.last_saved_at, '-')}</small>
          <small>Publish Terakhir: {formatDateTime(sectionForm.last_published_at, '-')}</small>
          {sectionForm.section_id ? <small>ID Live: #{sectionForm.section_id}</small> : null}
        </div>
      </section>
    </aside>
  );

  return (
    <AccountShell
      shellClassName="account-shell-learning admin-news-shell"
      title="Workspace Berita"
      subtitle="Kelola artikel dan master section berita dengan alur draft dan live yang terpisah."
      navContent={(
        <div className="admin-workspace-topnav" role="tablist" aria-label="Navigasi workspace berita">
          <button
            type="button"
            className={`admin-workspace-topnav-link ${newsWorkspace === 'published' ? 'admin-workspace-topnav-link-active' : ''}`}
            onClick={() => handleWorkspaceChange('published')}
            aria-pressed={newsWorkspace === 'published'}
          >
            Published
          </button>
          <button
            type="button"
            className={`admin-workspace-topnav-link ${newsWorkspace === 'draft' ? 'admin-workspace-topnav-link-active' : ''}`}
            onClick={() => handleWorkspaceChange('draft')}
            aria-pressed={newsWorkspace === 'draft'}
          >
            Draft
          </button>
        </div>
      )}
    >
      {(error || success) && (
        <div className="account-card admin-message-card">
          {error && <div className="alert">{error}</div>}
          {success && <div className="account-success">{success}</div>}
        </div>
      )}

      <div className="account-card admin-message-card admin-workspace-switcher-card admin-news-workspace-card">
        <div className="admin-workspace-switcher-layout">
          <div className="admin-workspace-switcher-copy">
            <span className={`admin-workspace-mode-pill admin-workspace-mode-pill-${newsWorkspace}`}>
              {isDraftWorkspace ? 'Draft Workspace' : 'Published Workspace'}
            </span>
            <h3>{isDraftWorkspace ? 'Newsroom draft aktif' : 'Newsroom live aktif'}</h3>
            <p className="text-muted">
              {isDraftWorkspace
                ? 'Kelola artikel dan section di draft dulu. Kalau sudah rapi, publish ke workspace live.'
                : 'Workspace ini menampilkan versi live. Untuk edit atau tambah artikel dan section, pindah ke tab Draft.'}
            </p>
          </div>

          <div className="admin-news-workspace-actions">
            <Link to="/admin" className="btn btn-outline">
              Pilih Modul
            </Link>
            {!isDraftWorkspace && (
              <button type="button" className="btn btn-primary" onClick={() => handleWorkspaceChange('draft')}>
                Buka Draft
              </button>
            )}
          </div>
        </div>

        <div className="admin-news-mode-switch" role="tablist" aria-label="Mode workspace berita">
          {NEWS_PANEL_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              className={`admin-news-mode-button ${newsPanelMode === mode.value ? 'admin-news-mode-button-active' : ''}`}
              onClick={() => handlePanelModeChange(mode.value)}
              aria-pressed={newsPanelMode === mode.value}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-news-layout admin-news-layout-studio">
        <aside className="account-card admin-news-sidebar">
          <div className="admin-news-sidebar-head">
            <div>
              <span className="admin-preview-eyebrow">Daftar</span>
              <h2>{isSectionPanel ? (isDraftWorkspace ? 'Draft Section' : 'Section Live') : (isDraftWorkspace ? 'Draft Berita' : 'Berita Live')}</h2>
            </div>
            {isSectionPanel ? (
              isDraftWorkspace ? (
                <button type="button" className="btn btn-primary" onClick={handleCreateNewSection}>
                  Tambah Section
                </button>
              ) : null
            ) : (
              isDraftWorkspace ? (
                <button type="button" className="btn btn-primary" onClick={handleCreateNew}>
                  Tambah Berita
                </button>
              ) : null
            )}
          </div>

          {isSectionPanel ? renderSectionSidebarList() : renderArticleSidebarList()}
        </aside>

        {isSectionPanel ? renderSectionEditor() : (
          <form className="account-card admin-news-editor-card" onSubmit={handleSubmit}>
            <div className="admin-news-editor-head">
              <div>
                <span className="admin-preview-eyebrow">{newsForm.id ? 'Edit berita' : 'Tambah berita'}</span>
                <h2>{newsForm.title || (isDraftWorkspace ? 'Susun draft berita baru' : 'Preview berita live')}</h2>
              </div>
              {!isDraftWorkspace && (
                <button type="button" className="btn btn-outline" onClick={() => handleWorkspaceChange('draft')}>
                  Edit via Draft
                </button>
              )}
            </div>

            <div className="admin-news-editor-grid">
              <label className="admin-news-field admin-news-field-full">
                <span>Judul Berita</span>
                <input
                  type="text"
                  value={newsForm.title}
                  onChange={(event) => handleFormChange('title', event.target.value)}
                  placeholder="Masukkan judul berita"
                  required
                  disabled={formLocked}
                />
              </label>

              <label className="admin-news-field admin-news-field-full">
                <span>Slug</span>
                <input
                  type="text"
                  value={newsForm.slug}
                  onChange={(event) => handleFormChange('slug', event.target.value)}
                  placeholder="slug-otomatis-jika-kosong"
                  disabled={formLocked}
                />
              </label>

              <label className="admin-news-field">
                <span>Kategori</span>
                <select
                  value={newsForm.category}
                  onChange={(event) => handleFormChange('category', event.target.value)}
                  disabled={formLocked}
                >
                  {NEWS_CATEGORY_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>

              <div className="admin-news-field">
                <span>Tag</span>
                <div className={`admin-news-tag-box ${formLocked ? 'admin-news-tag-box-locked' : ''}`}>
                  <div className="admin-news-tag-list">
                    {newsForm.tags.map((tag) => (
                      <span key={tag} className="admin-news-tag-pill">
                        {tag}
                        {!formLocked && (
                          <button type="button" onClick={() => handleRemoveTag(tag)} aria-label={`Hapus tag ${tag}`}>
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={tagDraft}
                    onChange={(event) => setTagDraft(event.target.value)}
                    onKeyDown={handleTagKeyDown}
                    onBlur={() => pushTags(tagDraft)}
                    placeholder="ketik tag lalu Enter"
                    disabled={formLocked}
                  />
                </div>
              </div>
            </div>

            <div className="admin-news-editor-shell">
              <div className="admin-news-editor-toolbar">
                {TOOLBAR_ACTIONS.map((action) => (
                  <button
                    key={action.mode}
                    type="button"
                    className={action.mode === 'paragraph' ? 'admin-news-toolbar-select' : 'admin-news-toolbar-button'}
                    onClick={() => insertEditorSnippet(action.mode)}
                    disabled={formLocked}
                  >
                    {action.label}
                  </button>
                ))}
              </div>

              {newsForm.cover_image_url && (
                <div className="admin-news-editor-cover">
                  <img src={newsForm.cover_image_url} alt={newsForm.title || 'Preview cover berita'} />
                </div>
              )}

              <label className="admin-news-editor-label">
                <span>Konten Berita</span>
                <textarea
                  ref={contentInputRef}
                  rows={18}
                  value={newsForm.content}
                  onChange={(event) => handleFormChange('content', event.target.value)}
                  placeholder="Tulis isi berita. Kamu bisa pakai HTML sederhana seperti <p>, <strong>, <em>, <h2>, <ul>, dan <blockquote>."
                  disabled={formLocked}
                />
              </label>

              <div className="admin-news-editor-footer">
                <small>{contentWordCount} kata</small>
                <small>{newsForm.tags.length} tag</small>
                <small>{isDraftWorkspace ? 'Mode edit draft' : 'Mode baca published'}</small>
              </div>
            </div>

            <div className="admin-news-form-actions admin-news-form-actions-bottom">
              {isDraftWorkspace ? (
                <>
                  <button type="button" className="btn btn-outline" onClick={handleCreateNew}>
                    Tambah Berita Baru
                  </button>
                  <button type="submit" className="btn btn-outline" disabled={saving || publishing}>
                    {saving ? 'Menyimpan...' : (newsForm.id ? 'Simpan Edit Draft' : 'Simpan Draft')}
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handlePublishDraft} disabled={saving || publishing}>
                    {publishing ? 'Publish Draft...' : 'Publish Draft'}
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-primary" onClick={() => handleWorkspaceChange('draft')}>
                  Pindah ke Draft untuk Edit
                </button>
              )}
            </div>
          </form>
        )}

        {isSectionPanel ? renderSectionSettings() : (
          <aside className="admin-news-settings-column">
            <section className="account-card admin-news-settings-card">
              <div className="admin-news-settings-head">
                <h3>Status &amp; Publikasi</h3>
              </div>

              <label className="admin-news-field">
                <span>Status</span>
                <select
                  value={newsForm.status}
                  onChange={(event) => handleFormChange('status', event.target.value)}
                  disabled={formLocked}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Terbit</option>
                </select>
              </label>

              <label className="admin-news-field">
                <span>Visibilitas</span>
                <select
                  value={newsForm.visibility}
                  onChange={(event) => handleFormChange('visibility', event.target.value)}
                  disabled={formLocked}
                >
                  <option value="public">Publik</option>
                  <option value="private">Private</option>
                </select>
              </label>

              <div className="admin-news-inline-grid">
                <label className="admin-news-field">
                  <span>Dipublikasikan pada</span>
                  <input
                    type="date"
                    value={publishDateValue}
                    onChange={(event) => syncPublishDate(event.target.value)}
                    disabled={formLocked}
                  />
                </label>

                <label className="admin-news-field">
                  <span>Jam</span>
                  <input
                    type="time"
                    value={publishTimeValue}
                    onChange={(event) => syncPublishTime(event.target.value)}
                    disabled={formLocked}
                  />
                </label>
              </div>

              <label className="admin-news-field">
                <span>Penulis</span>
                <input
                  type="text"
                  value={newsForm.author_name}
                  onChange={(event) => handleFormChange('author_name', event.target.value)}
                  disabled={formLocked}
                />
              </label>

              <label className="admin-news-field">
                <span>Estimasi baca (menit)</span>
                <input
                  type="number"
                  min="1"
                  value={newsForm.read_time_minutes}
                  onChange={(event) => handleFormChange('read_time_minutes', event.target.value)}
                  disabled={formLocked}
                />
              </label>

              {newsForm.id && (
                <button type="button" className="btn btn-danger admin-news-trash-button" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Memindahkan...' : 'Pindahkan ke Sampah'}
                </button>
              )}
            </section>

            <section className="account-card admin-news-settings-card">
              <div className="admin-news-settings-head">
                <h3>Gambar Unggulan</h3>
              </div>

              <div className="admin-news-cover-preview admin-news-cover-preview-panel">
                {newsForm.cover_image_url ? (
                  <img src={newsForm.cover_image_url} alt={newsForm.title || 'Gambar unggulan berita'} />
                ) : (
                  <div className="admin-news-cover-empty">Belum ada gambar unggulan</div>
                )}
              </div>

              <div className="admin-news-cover-actions">
                <label className="btn btn-outline admin-news-upload-button">
                  {uploading ? 'Mengupload...' : 'Ganti Gambar'}
                  <input type="file" accept="image/*" onChange={handleCoverFileChange} hidden disabled={formLocked || uploading} />
                </label>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => handleFormChange('cover_image_url', '')}
                  disabled={formLocked || !newsForm.cover_image_url}
                >
                  Hapus
                </button>
              </div>
              <small className="text-muted">Rekomendasi rasio 16:9 untuk hero dan thumbnail berita.</small>
            </section>

            <section className="account-card admin-news-settings-card">
              <div className="admin-news-settings-head">
                <h3>Ringkasan</h3>
              </div>

              <label className="admin-news-field">
                <span>Deskripsi Meta</span>
                <textarea
                  rows={4}
                  value={newsForm.excerpt}
                  onChange={(event) => handleFormChange('excerpt', event.target.value)}
                  placeholder="Ringkasan singkat berita untuk kartu dan preview."
                  disabled={formLocked}
                />
                <small>{excerptCharacterCount}/160 karakter</small>
              </label>

              <label className="admin-news-field">
                <span>Kata Kunci Fokus</span>
                <input
                  type="text"
                  value={newsForm.focus_keyword}
                  onChange={(event) => handleFormChange('focus_keyword', event.target.value)}
                  placeholder="contoh: pertumbuhan ekonomi indonesia"
                  disabled={formLocked}
                />
                <small>{keywordCharacterCount}/100 karakter</small>
              </label>

              <label className="admin-news-toggle-row">
                <span>Izinkan komentar</span>
                <button
                  type="button"
                  className={`theme-toggle admin-news-toggle ${newsForm.allow_comments ? 'theme-toggle-on' : ''}`}
                  onClick={() => handleFormChange('allow_comments', !newsForm.allow_comments)}
                  disabled={formLocked}
                  aria-pressed={newsForm.allow_comments}
                >
                  <span className="theme-toggle-switch">
                    <span className="theme-toggle-thumb" />
                  </span>
                </button>
              </label>
            </section>

            <section className="account-card admin-news-settings-card">
              <div className="admin-news-settings-head">
                <h3>Penempatan Fallback Lama</h3>
              </div>

              <div className="admin-news-flag-grid admin-news-flag-grid-stack">
                <div className="admin-news-flag-card">
                  <label className="admin-news-checkbox">
                    <input
                      type="checkbox"
                      checked={newsForm.is_featured}
                      onChange={(event) => handleFormChange('is_featured', event.target.checked)}
                      disabled={formLocked}
                    />
                    <span>Headline utama</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newsForm.featured_order}
                    onChange={(event) => handleFormChange('featured_order', event.target.value)}
                    placeholder="Urutan headline"
                    disabled={formLocked}
                  />
                </div>

                <div className="admin-news-flag-card">
                  <label className="admin-news-checkbox">
                    <input
                      type="checkbox"
                      checked={newsForm.is_popular}
                      onChange={(event) => handleFormChange('is_popular', event.target.checked)}
                      disabled={formLocked}
                    />
                    <span>Terpopuler</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newsForm.popular_order}
                    onChange={(event) => handleFormChange('popular_order', event.target.value)}
                    placeholder="Urutan populer"
                    disabled={formLocked}
                  />
                </div>

                <div className="admin-news-flag-card">
                  <label className="admin-news-checkbox">
                    <input
                      type="checkbox"
                      checked={newsForm.is_editor_pick}
                      onChange={(event) => handleFormChange('is_editor_pick', event.target.checked)}
                      disabled={formLocked}
                    />
                    <span>Pilihan redaksi</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newsForm.editor_pick_order}
                    onChange={(event) => handleFormChange('editor_pick_order', event.target.value)}
                    placeholder="Urutan redaksi"
                    disabled={formLocked}
                  />
                </div>
              </div>

              <p className="text-muted">Flag ini dipakai sebagai fallback kalau master section publik belum diatur.</p>
            </section>

            <section className="account-card admin-news-settings-card">
              <div className="admin-news-settings-head">
                <h3>Metadata</h3>
              </div>

              <div className="admin-news-meta-strip admin-news-meta-strip-stack">
                <small>Dibuat: {formatDateTime(newsForm.created_at, '-')}</small>
                <small>Update: {formatDateTime(newsForm.updated_at, '-')}</small>
                <small>Simpan Draft: {formatDateTime(newsForm.last_saved_at, '-')}</small>
                <small>Publish Terakhir: {formatDateTime(newsForm.last_published_at, '-')}</small>
                {newsForm.article_id ? <small>ID Live: #{newsForm.article_id}</small> : null}
              </div>
            </section>
          </aside>
        )}
      </div>
    </AccountShell>
  );
}
