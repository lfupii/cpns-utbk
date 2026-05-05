import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AccountShell from '../components/AccountShell';
import apiClient from '../api';
import NewsSectionsPreview, { normalizeNewsFeed } from '../components/NewsSectionsPreview';
import { FALLBACK_NEWS_FEED } from '../data/newsFallback';
import { formatDateTime } from '../utils/date';

const NEWS_CATEGORY_OPTIONS = [
  'CPNS',
  'UTBK',
  'Formasi',
  'Regulasi',
  'Kampus',
  'Negara',
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
  const [sectionQuickUpdatingId, setSectionQuickUpdatingId] = useState(0);
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
  const fallbackPublishedPreviewFeed = useMemo(() => normalizeNewsFeed(FALLBACK_NEWS_FEED), []);
  const [publishedPreviewFeed, setPublishedPreviewFeed] = useState(fallbackPublishedPreviewFeed);
  const [publishedPreviewLoading, setPublishedPreviewLoading] = useState(false);
  const [activePublishedPreviewHeroStoryBySection, setActivePublishedPreviewHeroStoryBySection] = useState({});
  const contentInputRef = useRef(null);
  const selectedArticleIdRef = useRef(null);
  const selectedSectionIdRef = useRef(null);
  const sectionAssignmentPickerRef = useRef(null);

  const newsWorkspace = searchParams.get('workspace') === 'published' ? 'published' : 'draft';
  const newsPanelMode = searchParams.get('panel') === 'articles' ? 'articles' : 'sections';
  const sectionViewParam = searchParams.get('sectionView');
  const sectionEditorTabParam = searchParams.get('sectionTab');
  const sectionQueryId = Number(searchParams.get('sectionId') || 0);
  const articleQueryId = Number(searchParams.get('articleId') || 0);
  const isDraftWorkspace = newsWorkspace === 'draft';
  const isSectionPanel = newsPanelMode === 'sections';
  const sectionWorkspaceView = isSectionPanel && (sectionViewParam === 'edit' || sectionViewParam === 'manage')
    ? sectionViewParam
    : 'overview';
  const sectionEditorTab = sectionEditorTabParam === 'settings' ? 'settings' : 'content';
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
  const selectedSection = useMemo(() => (
    sections.find((section) => Number(section.id) === Number(selectedSectionId)) || null
  ), [sections, selectedSectionId]);
  const selectedSectionLeadAssignment = selectedSectionAssignments[0] || null;
  const selectedSectionLeadArticle = selectedSectionLeadAssignment
    ? (articlesById.get(Number(selectedSectionLeadAssignment.article_id)) || null)
    : null;
  const newsOverviewStats = useMemo(() => {
    const totalArticles = articles.length;
    const publishedArticles = articles.filter((article) => article.status === 'published').length;
    const draftArticles = articles.filter((article) => article.status === 'draft').length;
    const commentsEnabled = articles.filter((article) => article.allow_comments).length;
    const visitorPreview = Math.max(0, (publishedArticles * 1480) + (sections.length * 640));

    return [
      {
        key: 'total',
        title: 'Total Berita',
        value: totalArticles.toLocaleString('id-ID'),
        note: `${sections.length.toLocaleString('id-ID')} section aktif draft`,
        tone: 'blue',
        icon: 'N',
      },
      {
        key: 'published',
        title: 'Berita Terbit',
        value: publishedArticles.toLocaleString('id-ID'),
        note: 'Sudah siap tampil publik',
        tone: 'green',
        icon: 'T',
      },
      {
        key: 'draft',
        title: 'Draft',
        value: draftArticles.toLocaleString('id-ID'),
        note: 'Masih menunggu publish',
        tone: 'orange',
        icon: 'D',
      },
      {
        key: 'comments',
        title: 'Komentar',
        value: commentsEnabled.toLocaleString('id-ID'),
        note: 'Artikel dengan komentar aktif',
        tone: 'purple',
        icon: 'K',
      },
      {
        key: 'visitors',
        title: 'Pengunjung',
        value: new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(visitorPreview),
        note: 'Preview sampai analytics aktif',
        tone: 'cyan',
        icon: 'P',
      },
    ];
  }, [articles, sections]);

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

      const targetId = preferredId ?? (articleQueryId > 0 ? articleQueryId : selectedArticleIdRef.current);
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
  }, [articleQueryId, isDraftWorkspace, newsWorkspace]);

  const loadSections = useCallback(async (preferredId = null, preferredSourceSectionId = 0) => {
    setSectionsLoading(true);
    setError('');

    try {
      const response = await apiClient.get(`/admin/news-sections?workspace=${newsWorkspace}`);
      const nextSections = Array.isArray(response.data?.data) ? response.data.data.map(normalizeSectionForm) : [];
      setSections(nextSections);

      const targetId = preferredId ?? (sectionQueryId > 0 ? sectionQueryId : selectedSectionIdRef.current);
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
  }, [isDraftWorkspace, newsWorkspace, sectionQueryId]);

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

  const loadPublishedPreview = useCallback(async () => {
    setPublishedPreviewLoading(true);

    try {
      const response = await apiClient.get('/news/feed');
      const nextFeed = normalizeNewsFeed(response.data?.data);
      setPublishedPreviewFeed(nextFeed.sections.length > 0 ? nextFeed : fallbackPublishedPreviewFeed);
    } catch (loadError) {
      setPublishedPreviewFeed(fallbackPublishedPreviewFeed);
    } finally {
      setPublishedPreviewLoading(false);
    }
  }, [fallbackPublishedPreviewFeed]);

  useEffect(() => {
    if (!isDraftWorkspace) {
      loadPublishedPreview();
    }
  }, [isDraftWorkspace, loadPublishedPreview]);

  const updateSearchParamState = useCallback((applyChanges) => {
    const nextQuery = new URLSearchParams(searchParams);
    applyChanges(nextQuery);
    setSearchParams(nextQuery);
  }, [searchParams, setSearchParams]);

  const handleWorkspaceChange = (nextWorkspace) => {
    if (nextWorkspace === newsWorkspace) {
      return;
    }

    updateSearchParamState((nextQuery) => {
      nextQuery.set('workspace', nextWorkspace);
      nextQuery.delete('articleId');
      nextQuery.delete('sectionId');
      nextQuery.delete('sectionView');
      nextQuery.delete('sectionTab');
    });
    setWorkspaceCarryArticleId(Number(newsForm.article_id || newsForm.id || 0));
    setWorkspaceCarrySectionId(Number(sectionForm.section_id || sectionForm.id || 0));
    setStatusFilter('semua');
    setError('');
    setSuccess('');
  };

  const handlePanelModeChange = (nextMode) => {
    if (nextMode === newsPanelMode) {
      return;
    }

    updateSearchParamState((nextQuery) => {
      nextQuery.set('panel', nextMode);
      if (nextMode !== 'sections') {
        nextQuery.delete('sectionId');
        nextQuery.delete('sectionView');
        nextQuery.delete('sectionTab');
      }
      if (nextMode !== 'articles') {
        nextQuery.delete('articleId');
      }
    });
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

  const openSectionOverview = useCallback(() => {
    updateSearchParamState((nextQuery) => {
      nextQuery.set('panel', 'sections');
      nextQuery.delete('sectionId');
      nextQuery.delete('sectionView');
      nextQuery.delete('sectionTab');
    });
    setError('');
    setSuccess('');
  }, [updateSearchParamState]);

  const openSectionWorkspace = useCallback((section, nextView) => {
    if (section) {
      setSelectedSectionId(section.id);
      setSectionForm(normalizeSectionForm(section));
    }

    updateSearchParamState((nextQuery) => {
      nextQuery.set('panel', 'sections');
      nextQuery.set('sectionView', nextView);
      if (section?.id) {
        nextQuery.set('sectionId', String(section.id));
      } else {
        nextQuery.delete('sectionId');
      }
      nextQuery.set('sectionTab', nextView === 'edit' ? 'content' : 'settings');
      nextQuery.delete('articleId');
    });
    setError('');
    setSuccess('');
  }, [updateSearchParamState]);

  const openArticleWorkspace = useCallback((article) => {
    if (article) {
      setSelectedArticleId(article.id);
      setNewsForm(normalizeNewsForm(article));
    }

    updateSearchParamState((nextQuery) => {
      nextQuery.set('panel', 'articles');
      if (article?.id) {
        nextQuery.set('articleId', String(article.id));
      } else {
        nextQuery.delete('articleId');
      }
      nextQuery.delete('sectionId');
      nextQuery.delete('sectionView');
      nextQuery.delete('sectionTab');
    });
    setError('');
    setSuccess('');
  }, [updateSearchParamState]);

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

  const openNewSectionEditor = () => {
    handleCreateNewSection();
    updateSearchParamState((nextQuery) => {
      nextQuery.set('panel', 'sections');
      nextQuery.set('sectionView', 'edit');
      nextQuery.set('sectionTab', 'content');
      nextQuery.delete('sectionId');
      nextQuery.delete('articleId');
    });
  };

  const handleSectionEditorTabChange = (nextTab) => {
    updateSearchParamState((nextQuery) => {
      nextQuery.set('panel', 'sections');
      nextQuery.set('sectionView', 'edit');
      nextQuery.set('sectionTab', nextTab === 'settings' ? 'settings' : 'content');
      if (selectedSectionId) {
        nextQuery.set('sectionId', String(selectedSectionId));
      }
    });
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

  const handleQuickToggleSection = async (section) => {
    if (!isDraftWorkspace || !section?.id) {
      return;
    }

    setSectionQuickUpdatingId(Number(section.id));
    setError('');

    try {
      const response = await apiClient.put('/admin/news-sections', {
        id: section.id,
        workspace: newsWorkspace,
        title: section.title,
        slug: section.slug,
        description: section.description,
        layout_style: section.layout_style,
        article_count: section.article_count,
        section_order: section.section_order,
        is_active: !section.is_active,
        assigned_article_ids: section.assigned_article_ids,
      });
      const savedSection = normalizeSectionForm(response.data?.data || {});
      await loadSections(savedSection.id);
      if (Number(selectedSectionIdRef.current) === Number(savedSection.id)) {
        setSectionForm(savedSection);
      }
      setSuccess(savedSection.is_active ? 'Section diaktifkan.' : 'Section dinonaktifkan.');
    } catch (toggleError) {
      setError(toggleError?.response?.data?.message || 'Gagal memperbarui status section');
    } finally {
      setSectionQuickUpdatingId(0);
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

  const scrollToSectionAssignmentPicker = () => {
    sectionAssignmentPickerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  const resolveAssignmentDisplay = useCallback((assignment, index = 0) => {
    const linkedArticle = articlesById.get(Number(assignment?.article_id || 0));
    return {
      article_id: Number(assignment?.article_id || linkedArticle?.id || 0),
      article_order: Math.max(1, Number(assignment?.article_order || index + 1)),
      title: linkedArticle?.title || assignment?.title || `Berita #${index + 1}`,
      category: linkedArticle?.category || assignment?.category || 'Nasional',
      cover_image_url: linkedArticle?.cover_image_url || assignment?.cover_image_url || '',
      status: linkedArticle?.status || assignment?.status || 'draft',
      slug: linkedArticle?.slug || assignment?.slug || '',
      author_name: linkedArticle?.author_name || 'Tim Redaksi',
      excerpt: linkedArticle?.excerpt || '',
      published_at: linkedArticle?.published_at || assignment?.published_at || null,
      updated_at: linkedArticle?.updated_at || assignment?.updated_at || null,
    };
  }, [articlesById]);

  const renderSectionOverviewWorkspace = () => (
    <div className="admin-news-section-page">
      <section className="admin-news-overview-head">
        <div>
          <span className="admin-preview-eyebrow">Kelola Halaman Utama</span>
          <h2>Kelola Halaman Utama</h2>
          <p className="text-muted">Atur dan kelola setiap section yang tampil di halaman utama website berita.</p>
        </div>
      </section>

      <section className="admin-news-kpi-grid">
        {newsOverviewStats.map((stat) => (
          <div key={stat.key} className="admin-news-kpi-card">
            <div className={`admin-news-kpi-icon admin-news-kpi-icon-${stat.tone}`}>{stat.icon}</div>
            <div className="admin-news-kpi-copy">
              <span>{stat.title}</span>
              <strong>{stat.value}</strong>
              <small>{stat.note}</small>
            </div>
          </div>
        ))}
      </section>

      <section className="admin-news-section-overview-list">
        {sectionsLoading ? (
          <div className="account-card admin-news-section-overview-empty">
            <p className="text-muted">Memuat daftar section berita...</p>
          </div>
        ) : sections.length === 0 ? (
          <div className="account-card admin-news-section-overview-empty">
            <h3>Belum ada section berita</h3>
            <p>Buat section pertama untuk mulai menyusun halaman utama berita.</p>
          </div>
        ) : sections.map((section) => {
          const assignments = (section.assignments || []).map((assignment, index) => resolveAssignmentDisplay(assignment, index));
          const leadAssignment = assignments[0] || null;
          const previewAssignments = assignments.slice(0, 4);
          const updatedAt = section.last_saved_at || section.updated_at || leadAssignment?.updated_at || leadAssignment?.published_at || null;

          return (
            <article key={section.id} className="account-card admin-news-section-row">
              <div className="admin-news-section-row-handle" aria-hidden="true">
                <span />
                <span />
              </div>

              <div className="admin-news-section-row-copy">
                <div className="admin-news-section-row-title">
                  <h3>{section.title || 'Section tanpa judul'}</h3>
                  <span className={`admin-news-chip ${section.is_active ? 'admin-news-chip-active' : 'admin-news-chip-muted'}`}>
                    {section.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
                <p>{section.description || 'Section ini belum memiliki deskripsi.'}</p>
              </div>

              <div className="admin-news-section-row-preview">
                {previewAssignments.length > 0 ? (
                  <div className={`admin-news-section-preview-grid admin-news-section-preview-grid-${Math.min(previewAssignments.length, 4)}`}>
                    {previewAssignments.map((assignment) => (
                      <div key={`${section.id}-${assignment.article_id}`} className="admin-news-section-preview-tile">
                        {assignment.cover_image_url ? (
                          <img src={assignment.cover_image_url} alt={assignment.title} />
                        ) : (
                          <div className="admin-news-section-preview-empty">No Cover</div>
                        )}
                        {leadAssignment?.article_id === assignment.article_id ? (
                          <div className="admin-news-section-preview-caption">
                            <strong>{assignment.title}</strong>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="admin-news-section-preview-placeholder">
                    <strong>Belum ada konten</strong>
                    <p>Masuk ke Kelola untuk menambahkan berita.</p>
                  </div>
                )}
              </div>

              <div className="admin-news-section-row-meta">
                <span>{leadAssignment ? 'Berita saat ini' : 'Jumlah berita'}</span>
                <strong>{leadAssignment ? leadAssignment.title : `${assignments.length} berita`}</strong>
                <small>Diupdate: {formatDateTime(updatedAt, '-')}</small>

                <div className="admin-news-section-row-actions">
                  <button type="button" className="btn btn-outline" onClick={() => openSectionWorkspace(section, 'edit')}>
                    Ubah
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => openSectionWorkspace(section, 'manage')}>
                    Kelola
                  </button>
                </div>
              </div>

              <div className="admin-news-section-row-toggle">
                <button
                  type="button"
                  className={`theme-toggle admin-news-toggle ${section.is_active ? 'theme-toggle-on' : ''}`}
                  onClick={() => handleQuickToggleSection(section)}
                  disabled={!isDraftWorkspace || Number(sectionQuickUpdatingId) === Number(section.id)}
                  aria-pressed={section.is_active}
                >
                  <span className="theme-toggle-switch">
                    <span className="theme-toggle-thumb" />
                  </span>
                </button>
              </div>
            </article>
          );
        })}
      </section>

      {isDraftWorkspace && (
        <button type="button" className="account-card admin-news-section-add" onClick={openNewSectionEditor}>
          <span>+</span>
          <strong>Tambah Section Baru</strong>
        </button>
      )}
    </div>
  );

  const renderSectionEditWorkspace = () => {
    if (!selectedSection) {
      return (
        <div className="account-card admin-news-section-overview-empty">
          <h3>Section belum dipilih</h3>
          <p>Pilih section dulu dari halaman overview.</p>
          <button type="button" className="btn btn-primary" onClick={openSectionOverview}>
            Kembali ke Overview
          </button>
        </div>
      );
    }

    const leadAssignment = selectedSectionLeadAssignment ? resolveAssignmentDisplay(selectedSectionLeadAssignment, 0) : null;
    const leadLink = leadAssignment?.slug ? `/news/${leadAssignment.slug}` : `/news#${sectionForm.slug || selectedSection.slug}`;

    return (
      <form className="account-card admin-news-section-editor-page" onSubmit={handleSectionSubmit}>
        <div className="admin-news-section-page-head">
          <div>
            <div className="admin-news-section-page-title">
              <h2>Edit Section: {sectionForm.title || selectedSection.title}</h2>
              <span className={`admin-news-chip ${sectionForm.is_active ? 'admin-news-chip-active' : 'admin-news-chip-muted'}`}>
                {sectionForm.is_active ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>
            <p className="text-muted">Atur konten yang tampil pada bagian section ini di halaman utama website.</p>
          </div>

          <div className="admin-news-section-page-actions">
            <button type="button" className="btn btn-outline" onClick={openSectionOverview}>
              Kembali
            </button>
            <button type="button" className="btn btn-outline" onClick={() => openSectionWorkspace(selectedSection, 'manage')}>
              Kelola Konten
            </button>
          </div>
        </div>

        <div className="admin-news-mode-switch admin-news-mode-switch-compact" role="tablist" aria-label="Tab edit section">
          <button
            type="button"
            className={`admin-news-mode-button ${sectionEditorTab === 'content' ? 'admin-news-mode-button-active' : ''}`}
            onClick={() => handleSectionEditorTabChange('content')}
          >
            Konten
          </button>
          <button
            type="button"
            className={`admin-news-mode-button ${sectionEditorTab === 'settings' ? 'admin-news-mode-button-active' : ''}`}
            onClick={() => handleSectionEditorTabChange('settings')}
          >
            Pengaturan Section
          </button>
        </div>

        {sectionEditorTab === 'content' ? (
          <div className="admin-news-section-edit-grid">
            <div className="admin-news-section-edit-column">
              <label className="admin-news-field">
                <span>Judul Section</span>
                <input
                  type="text"
                  value={sectionForm.title}
                  onChange={(event) => handleSectionFormChange('title', event.target.value)}
                  disabled={sectionFormLocked}
                  required
                />
              </label>

              <label className="admin-news-field">
                <span>Deskripsi</span>
                <textarea
                  rows={5}
                  value={sectionForm.description}
                  onChange={(event) => handleSectionFormChange('description', event.target.value)}
                  disabled={sectionFormLocked}
                  placeholder="Teks pengantar singkat untuk section ini."
                />
              </label>

              <label className="admin-news-field">
                <span>Tautan (Link)</span>
                <input type="text" value={leadLink} readOnly disabled />
                <small>Kosongkan jika tidak ingin menambahkan tautan terpisah dari artikel.</small>
              </label>

              {leadAssignment ? (
                <>
                  <label className="admin-news-field">
                    <span>Label / Kategori</span>
                    <input type="text" value={leadAssignment.category} readOnly disabled />
                  </label>

                  <label className="admin-news-field">
                    <span>Penulis</span>
                    <input type="text" value={leadAssignment.author_name} readOnly disabled />
                  </label>

                  <div className="admin-news-inline-grid">
                    <label className="admin-news-field">
                      <span>Tanggal Tayang</span>
                      <input type="text" value={formatDateTime(leadAssignment.published_at || leadAssignment.updated_at, '-')} readOnly disabled />
                    </label>

                    <label className="admin-news-field">
                      <span>Status Artikel Utama</span>
                      <input type="text" value={leadAssignment.status === 'published' ? 'Terbit' : 'Draft'} readOnly disabled />
                    </label>
                  </div>
                </>
              ) : (
                <div className="admin-news-section-empty">
                  <strong>Belum ada artikel utama.</strong>
                  <p>Masuk ke menu Kelola untuk menambahkan berita pertama ke section ini.</p>
                </div>
              )}
            </div>

            <div className="admin-news-section-edit-column">
              <div className="admin-news-section-media-card">
                <div className="admin-news-settings-head">
                  <h3>Gambar Utama</h3>
                  {leadAssignment ? (
                    <div className="admin-news-section-page-actions">
                      <button type="button" className="btn btn-outline" onClick={() => openSectionWorkspace(selectedSection, 'manage')}>
                        Ganti
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => {
                          const linkedArticle = articlesById.get(Number(leadAssignment.article_id));
                          if (linkedArticle) {
                            openArticleWorkspace(linkedArticle);
                          }
                        }}
                      >
                        Edit Artikel
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="admin-news-section-lead-cover">
                  {leadAssignment?.cover_image_url ? (
                    <img src={leadAssignment.cover_image_url} alt={leadAssignment.title} />
                  ) : (
                    <div className="admin-news-section-preview-placeholder">
                      <strong>Belum ada gambar utama</strong>
                      <p>Tambahkan artikel ke section ini untuk menampilkan spotlight image.</p>
                    </div>
                  )}
                </div>

                {leadAssignment ? (
                  <>
                    <div className="admin-news-section-lead-meta">
                      <span className="news-story-tag">{leadAssignment.category}</span>
                      <strong>{leadAssignment.title}</strong>
                      <p>{leadAssignment.excerpt || 'Ringkasan artikel utama akan muncul di sini setelah berita dipilih.'}</p>
                    </div>

                    <div className="admin-news-section-page-actions">
                      <Link to={leadLink} target="_blank" rel="noreferrer" className="btn btn-primary">
                        Buka Artikel
                      </Link>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="admin-news-section-settings-grid">
            <label className="admin-news-field">
              <span>Slug</span>
              <input
                type="text"
                value={sectionForm.slug}
                onChange={(event) => handleSectionFormChange('slug', event.target.value)}
                disabled={sectionFormLocked}
                placeholder="slug-section-otomatis"
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

            <div className="admin-news-meta-strip admin-news-meta-strip-stack">
              <small>Dibuat: {formatDateTime(sectionForm.created_at, '-')}</small>
              <small>Update: {formatDateTime(sectionForm.updated_at, '-')}</small>
              <small>Simpan Draft: {formatDateTime(sectionForm.last_saved_at, '-')}</small>
              <small>Publish Terakhir: {formatDateTime(sectionForm.last_published_at, '-')}</small>
              {sectionForm.section_id ? <small>ID Live: #{sectionForm.section_id}</small> : null}
            </div>

            {sectionForm.id && (
              <button type="button" className="btn btn-danger admin-news-trash-button" onClick={handleDeleteSection} disabled={sectionDeleting}>
                {sectionDeleting ? 'Memindahkan...' : 'Pindahkan ke Sampah'}
              </button>
            )}
          </div>
        )}

        <div className="admin-news-form-actions admin-news-form-actions-bottom">
          {isDraftWorkspace ? (
            <>
              <button type="button" className="btn btn-outline" onClick={openSectionOverview}>
                Kembali ke Overview
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
  };

  const renderSectionManageWorkspace = () => {
    if (!selectedSection) {
      return (
        <div className="account-card admin-news-section-overview-empty">
          <h3>Section belum dipilih</h3>
          <p>Pilih section dulu dari halaman overview.</p>
          <button type="button" className="btn btn-primary" onClick={openSectionOverview}>
            Kembali ke Overview
          </button>
        </div>
      );
    }

    return (
      <div className="account-card admin-news-section-manage-page">
        <div className="admin-news-section-page-head">
          <div>
            <div className="admin-news-section-page-title">
              <h2>Konten: {sectionForm.title || selectedSection.title}</h2>
              <span className={`admin-news-chip ${sectionForm.is_active ? 'admin-news-chip-active' : 'admin-news-chip-muted'}`}>
                {sectionForm.is_active ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>
            <p className="text-muted">Kelola berita yang ditampilkan pada section ini.</p>
          </div>

          <div className="admin-news-section-page-actions">
            <button type="button" className="btn btn-outline" onClick={openSectionOverview}>
              Kembali
            </button>
            <button type="button" className="btn btn-outline" onClick={() => openSectionWorkspace(selectedSection, 'edit')}>
              Ubah Section
            </button>
          </div>
        </div>

        <div className="admin-news-section-table-head">
          <div>
            <h3>Daftar Berita ({selectedSectionAssignments.length} dari {sectionForm.article_count})</h3>
            <p>Berita akan ditampilkan di halaman utama sesuai urutan.</p>
          </div>

          <div className="admin-news-section-page-actions">
            <button type="button" className="btn btn-primary" onClick={scrollToSectionAssignmentPicker}>
              Tambah Berita
            </button>
            {isDraftWorkspace && (
              <button type="button" className="btn btn-outline" onClick={persistSectionDraft} disabled={sectionSaving}>
                {sectionSaving ? 'Menyimpan...' : 'Urutkan & Simpan'}
              </button>
            )}
          </div>
        </div>

        <div className="admin-news-section-table-wrap">
          <table className="admin-news-section-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Berita</th>
                <th>Kategori</th>
                <th>Tanggal</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {selectedSectionAssignments.length === 0 ? (
                <tr>
                  <td colSpan="6">
                    <div className="admin-news-section-overview-empty admin-news-section-overview-empty-inline">
                      <h3>Belum ada berita di section ini</h3>
                      <p>Tambahkan berita dari katalog di bawah.</p>
                    </div>
                  </td>
                </tr>
              ) : selectedSectionAssignments.map((assignment, index) => {
                const displayAssignment = resolveAssignmentDisplay(assignment, index);
                const linkedArticle = articlesById.get(Number(displayAssignment.article_id));

                return (
                  <tr key={`${displayAssignment.article_id}-${index}`}>
                    <td>
                      <div className="admin-news-section-order-cell">
                        <button type="button" className="btn btn-outline" onClick={() => moveSectionAssignment(displayAssignment.article_id, 'up')} disabled={!isDraftWorkspace}>
                          ↑
                        </button>
                        <span>{index + 1}</span>
                        <button type="button" className="btn btn-outline" onClick={() => moveSectionAssignment(displayAssignment.article_id, 'down')} disabled={!isDraftWorkspace}>
                          ↓
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="admin-news-section-article-cell">
                        <div className="admin-news-section-article-thumb">
                          {displayAssignment.cover_image_url ? (
                            <img src={displayAssignment.cover_image_url} alt={displayAssignment.title} />
                          ) : (
                            <div className="admin-news-section-preview-empty">No Cover</div>
                          )}
                        </div>
                        <div className="admin-news-section-article-copy">
                          <strong>{displayAssignment.title}</strong>
                          <p>{displayAssignment.excerpt || 'Ringkasan berita belum tersedia.'}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="news-story-tag">{displayAssignment.category}</span>
                    </td>
                    <td>{formatDateTime(displayAssignment.published_at || displayAssignment.updated_at, '-')}</td>
                    <td>
                      <span className={`admin-news-chip ${displayAssignment.status === 'published' ? 'admin-news-chip-active' : 'admin-news-chip-muted'}`}>
                        {displayAssignment.status === 'published' ? 'Aktif' : 'Draft'}
                      </span>
                    </td>
                    <td>
                      <div className="admin-news-section-table-actions">
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => {
                            if (linkedArticle) {
                              openArticleWorkspace(linkedArticle);
                            }
                          }}
                        >
                          Edit
                        </button>
                        <button type="button" className="btn btn-outline" onClick={() => toggleSectionAssignment(displayAssignment.article_id)} disabled={!isDraftWorkspace}>
                          Lepas
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <small className="text-muted">Menampilkan {selectedSectionAssignments.length} dari {sectionForm.article_count} berita.</small>

        <section ref={sectionAssignmentPickerRef} className="admin-news-section-builder">
          <div className="admin-news-section-builder-head">
            <div>
              <span className="admin-preview-eyebrow">Tambah berita</span>
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

        {isDraftWorkspace && (
          <div className="admin-news-form-actions admin-news-form-actions-bottom">
            <button type="button" className="btn btn-outline" onClick={openSectionOverview}>
              Kembali ke Overview
            </button>
            <button type="button" className="btn btn-outline" onClick={persistSectionDraft} disabled={sectionSaving || sectionPublishing}>
              {sectionSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
            <button type="button" className="btn btn-primary" onClick={handlePublishSectionDraft} disabled={sectionSaving || sectionPublishing}>
              {sectionPublishing ? 'Publish Draft...' : 'Publish Draft'}
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderSectionWorkspace = () => {
    if (sectionWorkspaceView === 'edit') {
      return renderSectionEditWorkspace();
    }

    if (sectionWorkspaceView === 'manage') {
      return renderSectionManageWorkspace();
    }

    return renderSectionOverviewWorkspace();
  };

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

      {!isDraftWorkspace && (
        <section className="account-card admin-news-live-preview-card">
          <div className="admin-news-live-preview-head">
            <div>
              <span className="admin-preview-eyebrow">Preview publik</span>
              <h3>Tampilan halaman berita live saat ini</h3>
              <p className="text-muted">Preview ini pakai renderer yang sama dengan halaman `/news`. Klik kartu untuk buka halaman publik di tab baru.</p>
            </div>

            <div className="admin-news-live-preview-actions">
              <button type="button" className="btn btn-outline" onClick={loadPublishedPreview} disabled={publishedPreviewLoading}>
                {publishedPreviewLoading ? 'Memuat...' : 'Refresh Preview'}
              </button>
              <Link to="/news" target="_blank" rel="noreferrer" className="btn btn-primary">
                Buka Halaman Berita
              </Link>
            </div>
          </div>

          {publishedPreviewLoading ? (
            <p className="text-muted">Memuat preview halaman berita...</p>
          ) : (
            <NewsSectionsPreview
              feed={publishedPreviewFeed}
              className="admin-news-live-preview-shell"
              linkTarget="_blank"
              activeHeroStoryBySection={activePublishedPreviewHeroStoryBySection}
              onHeroStoryChange={(sectionSlug, storySlug) => {
                setActivePublishedPreviewHeroStoryBySection((current) => ({ ...current, [sectionSlug]: storySlug }));
              }}
            />
          )}
        </section>
      )}

      {isSectionPanel ? renderSectionWorkspace() : (
        <div className="admin-news-layout admin-news-layout-studio">
          <aside className="account-card admin-news-sidebar">
            <div className="admin-news-sidebar-head">
              <div>
                <span className="admin-preview-eyebrow">Daftar</span>
                <h2>{isDraftWorkspace ? 'Draft Berita' : 'Berita Live'}</h2>
              </div>
              {isDraftWorkspace ? (
                <button type="button" className="btn btn-primary" onClick={handleCreateNew}>
                  Tambah Berita
                </button>
              ) : null}
            </div>

            {renderArticleSidebarList()}
          </aside>

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
        </div>
      )}
    </AccountShell>
  );
}
