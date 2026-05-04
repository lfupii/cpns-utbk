import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import apiClient from '../api';
import { FALLBACK_NEWS_FEED, findFallbackArticleBySlug } from '../data/newsFallback';
import { normalizeNewsFeed } from '../components/NewsSectionsPreview';
import PublicSiteChrome from '../components/PublicSiteChrome';
import { useAuth } from '../AuthContext';

const DEFAULT_COMMENT_AUTHOR = 'Pembaca Ujiin';
const TOPIC_META = {
  CPNS: {
    title: 'CPNS',
    description: 'Update seputar formasi, jadwal seleksi, syarat administrasi, strategi belajar SKD, dan arah rekrutmen ASN.',
  },
  UTBK: {
    title: 'UTBK',
    description: 'Ringkasan strategi belajar, kampus, passing trend, tryout, dan evaluasi topik yang paling sering muncul.',
  },
  Formasi: {
    title: 'Formasi',
    description: 'Bahasan peluang jabatan, kebutuhan instansi, jenjang pendidikan, dan cara membaca persaingan formasi secara lebih rasional.',
  },
  Regulasi: {
    title: 'Regulasi',
    description: 'Kupasan aturan baru, keputusan negara, dan dampaknya ke pola seleksi, administrasi, atau strategi pendaftaran.',
  },
  Kampus: {
    title: 'Kampus',
    description: 'Berita seputar universitas, program studi, daya tampung, dan strategi memilih target PTN untuk UTBK.',
  },
  Nasional: {
    title: 'Nasional',
    description: 'Isu nasional yang relevan untuk pembaca CPNS UTBK, terutama kebijakan, ekonomi, pendidikan, dan pelayanan publik.',
  },
  Negara: {
    title: 'Negara',
    description: 'Keputusan negara, arah kebijakan, dan belanja SDM publik yang bisa memengaruhi formasi maupun pendidikan.',
  },
  Ekonomi: {
    title: 'Ekonomi',
    description: 'Analisis ekonomi nasional, inflasi, fiskal, pasar, dan dampaknya ke kebijakan negara atau peluang sektor publik.',
  },
  default: {
    title: 'Topik Berita',
    description: 'Kumpulan berita pilihan redaksi yang disusun untuk pembaca CPNS UTBK dengan fokus praktis dan cepat dipahami.',
  },
};

function renderNewsContent(content) {
  return { __html: content || '<p>Konten berita belum tersedia.</p>' };
}

function formatPublishedDateTime(value) {
  if (!value) {
    return 'Waktu terbit belum tersedia';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Waktu terbit belum tersedia';
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getInitials(value) {
  const words = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (words.length <= 0) {
    return 'U';
  }

  return words.map((word) => word.charAt(0).toUpperCase()).join('');
}

function getTopicMeta(category) {
  return TOPIC_META[String(category || '').trim()] || TOPIC_META.default;
}

function flattenStoriesFromSections(sections = []) {
  const storyMap = new Map();

  sections.forEach((section) => {
    (section?.items || []).forEach((story) => {
      if (story?.slug && !storyMap.has(story.slug)) {
        storyMap.set(story.slug, story);
      }
    });
  });

  return Array.from(storyMap.values());
}

function buildMockComments(article) {
  const safeCategory = article?.category || 'Berita';
  const safeKeyword = article?.focus_keyword || article?.tags?.[0] || safeCategory;

  return [
    {
      id: `${article?.slug || 'article'}-comment-1`,
      author: 'Budi Santoso',
      age: '58 menit lalu',
      text: `Bahasan ${safeCategory.toLowerCase()} begini enak dibaca. Poin tentang ${safeKeyword} kerasa paling kepakai.`,
      likes: 12,
    },
    {
      id: `${article?.slug || 'article'}-comment-2`,
      author: 'Rina Amelia',
      age: '1 jam lalu',
      text: 'Struktur penjelasannya rapi. Kalau ada update lanjutan, bagus juga kalau dibikin seri berikutnya.',
      likes: 8,
    },
  ];
}

function ShareIcon({ name }) {
  switch (name) {
    case 'copy':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="10" height="10" rx="2" />
          <path d="M5 15V7a2 2 0 0 1 2-2h8" />
        </svg>
      );
    case 'share':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="m8.6 13.5 6.8 3.9" />
          <path d="m15.4 6.6-6.8 3.9" />
        </svg>
      );
    case 'whatsapp':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 11.94c0 4.62-3.7 8.38-8.28 8.46a8.2 8.2 0 0 1-4.07-.99L4 20.4l1.03-3.54A8.43 8.43 0 0 1 3.72 12c0-4.66 3.78-8.44 8.44-8.44S20.6 7.34 20.6 12Z" />
          <path fill="#fff" d="M16.22 14.25c-.2-.1-1.2-.6-1.38-.67-.19-.07-.32-.1-.45.1-.13.2-.52.67-.64.8-.12.14-.24.15-.45.05-.2-.1-.86-.31-1.63-.99-.6-.54-1.01-1.2-1.13-1.4-.12-.2-.01-.31.09-.42.09-.09.2-.24.3-.36.1-.12.13-.2.2-.34.07-.14.04-.26-.02-.36-.06-.1-.45-1.08-.62-1.48-.16-.38-.32-.33-.45-.34h-.38c-.13 0-.35.05-.53.24-.18.2-.69.67-.69 1.63s.7 1.9.8 2.04c.1.13 1.37 2.08 3.32 2.92.46.2.82.32 1.11.4.47.15.9.13 1.24.08.38-.06 1.2-.49 1.37-.97.17-.48.17-.89.12-.97-.05-.08-.18-.12-.38-.22Z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.9 2H22l-6.77 7.74L23 22h-6.1l-4.77-6.25L6.66 22H3.55l7.23-8.26L1 2h6.25l4.3 5.68L18.9 2Zm-1.07 18.17h1.69L6.33 3.74H4.5l13.33 16.43Z" />
        </svg>
      );
  }
}

export default function NewsArticle() {
  const { slug } = useParams();
  const location = useLocation();
  const { isAuthenticated, authReady, user, login, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [article, setArticle] = useState(null);
  const [relatedStories, setRelatedStories] = useState([]);
  const [feedSections, setFeedSections] = useState([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [comments, setComments] = useState([]);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [commentNotice, setCommentNotice] = useState('');
  const [shareFeedback, setShareFeedback] = useState('');
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginInfo, setLoginInfo] = useState('');
  const commentDraftStorageKey = useMemo(
    () => (slug ? `news-comment-draft:${slug}` : ''),
    [slug]
  );
  const articleReturnPath = useMemo(
    () => `${location.pathname}${location.search}${location.hash}`,
    [location.hash, location.pathname, location.search]
  );

  useEffect(() => {
    let ignore = false;

    const loadArticle = async () => {
      setLoading(true);
      setError('');

      try {
        const [articleResult, feedResult] = await Promise.allSettled([
          apiClient.get(`/news/article?slug=${encodeURIComponent(slug || '')}`),
          apiClient.get('/news/feed'),
        ]);

        if (ignore) {
          return;
        }

        if (articleResult.status === 'fulfilled') {
          setArticle(articleResult.value.data?.data?.article || null);
          setRelatedStories(Array.isArray(articleResult.value.data?.data?.related_stories) ? articleResult.value.data.data.related_stories : []);
          setComments(Array.isArray(articleResult.value.data?.data?.comments) ? articleResult.value.data.data.comments : []);
        } else {
          const fallbackDetail = findFallbackArticleBySlug(slug);
          if (fallbackDetail?.article) {
            setArticle(fallbackDetail.article);
            setRelatedStories(Array.isArray(fallbackDetail.related_stories) ? fallbackDetail.related_stories : []);
            setComments(buildMockComments(fallbackDetail.article));
            setError('');
          } else {
            setComments([]);
            setError(articleResult.reason?.response?.data?.message || 'Berita tidak ditemukan.');
          }
        }

        if (feedResult.status === 'fulfilled') {
          setFeedSections(normalizeNewsFeed(feedResult.value.data?.data || {}).sections);
        } else {
          setFeedSections(normalizeNewsFeed(FALLBACK_NEWS_FEED).sections);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadArticle();

    return () => {
      ignore = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!commentDraftStorageKey || typeof window === 'undefined') {
      return;
    }

    const savedDraft = window.sessionStorage.getItem(commentDraftStorageKey);
    setCommentDraft(savedDraft || '');
  }, [commentDraftStorageKey]);

  useEffect(() => {
    if (!commentDraftStorageKey || typeof window === 'undefined') {
      return;
    }

    if (commentDraft.trim()) {
      window.sessionStorage.setItem(commentDraftStorageKey, commentDraft);
      return;
    }

    window.sessionStorage.removeItem(commentDraftStorageKey);
  }, [commentDraft, commentDraftStorageKey]);

  useEffect(() => {
    if (!article) {
      setCommentError('');
      setCommentNotice('');
      setShowLoginPrompt(false);
      setLoginError('');
      setLoginInfo('');
      return;
    }

    setShareFeedback('');
    setCommentError('');
    setCommentNotice('');
  }, [article]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    setShowLoginPrompt(false);
    setLoginError('');
  }, [isAuthenticated]);

  const topicMeta = useMemo(
    () => getTopicMeta(article?.category),
    [article?.category]
  );
  const articleUrl = useMemo(() => {
    if (typeof window !== 'undefined') {
      return window.location.href;
    }

    return `/news/${article?.slug || ''}`;
  }, [article?.slug]);
  const popularStories = useMemo(() => {
    const normalizedSections = normalizeNewsFeed({ sections: feedSections }).sections;
    const popularSection = normalizedSections.find((section) => (
      section.layout_style === 'ranked'
      || /terpopuler|trending|popular/i.test(`${section.slug} ${section.title}`)
    ));

    if (popularSection?.items?.length) {
      return popularSection.items
        .filter((story) => story.slug !== article?.slug)
        .slice(0, 5);
    }

    return flattenStoriesFromSections(normalizedSections)
      .filter((story) => story.slug !== article?.slug)
      .slice(0, 5);
  }, [article?.slug, feedSections]);
  const fallbackRelatedStories = useMemo(() => {
    if (relatedStories.length > 0) {
      return relatedStories.slice(0, 4);
    }

    const normalizedSections = normalizeNewsFeed({ sections: feedSections }).sections;
    return flattenStoriesFromSections(normalizedSections)
      .filter((story) => story.slug !== article?.slug && story.category === article?.category)
      .slice(0, 4);
  }, [article?.category, article?.slug, feedSections, relatedStories]);
  const commentsEnabled = Boolean(article?.allow_comments ?? true);
  const shouldRenderCommentsSection = commentsEnabled || comments.length > 0;
  const currentCommentAuthor = user?.full_name || DEFAULT_COMMENT_AUTHOR;

  const closeLoginPrompt = () => {
    setShowLoginPrompt(false);
    setLoginError('');
    setLoginInfo('');
  };

  const handleCommentSubmit = async (event) => {
    event.preventDefault();

    if (!isAuthenticated) {
      setCommentError('Login dulu untuk ikut berdiskusi.');
      setShowLoginPrompt(true);
      return;
    }

    if (!commentsEnabled) {
      setCommentError('Komentar untuk berita ini sedang ditutup.');
      return;
    }

    const nextComment = commentDraft.trim();
    if (!nextComment) {
      return;
    }

    setCommentSubmitting(true);
    setCommentError('');
    setCommentNotice('');

    try {
      const response = await apiClient.post('/news/comment', {
        slug: article?.slug,
        content: nextComment,
      });

      const createdComment = response.data?.data?.comment || null;
      if (createdComment) {
        setComments((current) => [createdComment, ...current]);
      }
      setCommentDraft('');
      if (commentDraftStorageKey && typeof window !== 'undefined') {
        window.sessionStorage.removeItem(commentDraftStorageKey);
      }
      setCommentNotice(response.data?.message || 'Komentar berhasil dikirim.');
    } catch (submitError) {
      setCommentError(submitError.response?.data?.message || 'Gagal mengirim komentar.');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleInlineLoginSubmit = async (event) => {
    event.preventDefault();
    setLoginError('');
    setLoginInfo('');

    const email = loginEmail.trim().toLowerCase();
    const password = loginPassword;
    if (!email || !password) {
      setLoginError('Email dan password wajib diisi.');
      return;
    }

    const result = await login(email, password);
    if (result.success) {
      setLoginPassword('');
      setShowLoginPrompt(false);
      setCommentError('');
      setCommentNotice('Login berhasil. Klik kirim sekali lagi untuk mengirim komentar.');
      return;
    }

    setLoginError(result.message || 'Login gagal. Periksa email dan password Anda.');
  };

  const handleShare = async (type) => {
    if (!article) {
      return;
    }

    const safeTitle = encodeURIComponent(article.title || 'Berita Ujiin');
    const safeUrl = encodeURIComponent(articleUrl);

    if (type === 'copy') {
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(articleUrl);
          setShareFeedback('Link disalin');
          window.setTimeout(() => setShareFeedback(''), 1800);
          return;
        }
      } catch (shareError) {
        setShareFeedback('Gagal menyalin');
        window.setTimeout(() => setShareFeedback(''), 1800);
        return;
      }
    }

    if (type === 'share' && navigator?.share) {
      try {
        await navigator.share({
          title: article.title,
          text: article.excerpt || article.title,
          url: articleUrl,
        });
        return;
      } catch (shareError) {
        return;
      }
    }

    const shareMap = {
      whatsapp: `https://wa.me/?text=${safeTitle}%20${safeUrl}`,
      x: `https://twitter.com/intent/tweet?text=${safeTitle}&url=${safeUrl}`,
      share: `https://www.facebook.com/sharer/sharer.php?u=${safeUrl}`,
    };

    const targetUrl = shareMap[type];
    if (targetUrl && typeof window !== 'undefined') {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <PublicSiteChrome showHero={false} mainClassName="news-page-main news-article-main">
      {loading ? (
        <section className="policy-card news-article-shell">
          <p>Memuat berita...</p>
        </section>
      ) : error || !article ? (
        <section className="policy-card news-article-shell">
          <h1>Berita tidak ditemukan</h1>
          <p>{error || 'Slug berita tidak tersedia.'}</p>
          <Link to="/news" className="btn btn-primary">Kembali ke Halaman Berita</Link>
        </section>
      ) : (
        <>
          <section className="news-article-layout">
            <article className="policy-card news-article-shell news-article-shell-detail">
              <nav className="news-breadcrumbs" aria-label="Breadcrumb">
                <Link to="/">Beranda</Link>
                <span>/</span>
                <Link to="/news">Berita</Link>
                <span>/</span>
                <span>{article.category}</span>
              </nav>

            <div className="news-article-meta-head">
              <span className="news-story-tag">{article.category}</span>
            </div>

            <header className="news-article-headline-block">
              <h1>{article.title}</h1>
              {article.excerpt ? <p className="news-article-excerpt">{article.excerpt}</p> : null}
            </header>

            <div className="news-article-toolbar">
              <div className="news-article-author-group">
                <span className="news-article-author-avatar">{getInitials(article.author)}</span>
                <div className="news-article-author-copy">
                  <strong>{article.author}</strong>
                  <small>
                    {formatPublishedDateTime(article.published_at)} • {article.readTime} baca
                  </small>
                </div>
              </div>

              <div className="news-article-share-group">
                <button type="button" className="news-share-button" onClick={() => handleShare('share')} aria-label="Bagikan berita">
                  <ShareIcon name="share" />
                </button>
                <button type="button" className="news-share-button news-share-button-whatsapp" onClick={() => handleShare('whatsapp')} aria-label="Bagikan ke WhatsApp">
                  <ShareIcon name="whatsapp" />
                </button>
                <button type="button" className="news-share-button news-share-button-dark" onClick={() => handleShare('x')} aria-label="Bagikan ke X">
                  <ShareIcon name="x" />
                </button>
                <button type="button" className="news-share-button" onClick={() => handleShare('copy')} aria-label="Salin tautan">
                  <ShareIcon name="copy" />
                </button>
              </div>
            </div>

            {shareFeedback ? <span className="news-share-feedback">{shareFeedback}</span> : null}

            {article.image && (
              <figure className="news-article-cover">
                <img src={article.image} alt={article.title} />
                <figcaption>Ilustrasi sampul berita {article.category}. Materi visual dapat diganti dari panel admin berita.</figcaption>
              </figure>
            )}

            {article.excerpt ? (
              <blockquote className="news-article-pull-quote">
                <span aria-hidden="true">“</span>
                <p>{article.excerpt}</p>
                <strong>{article.author}</strong>
              </blockquote>
            ) : null}

            <div className="news-article-content" dangerouslySetInnerHTML={renderNewsContent(article.content)} />

            {article.tags?.length > 0 && (
              <section className="news-article-tags-section">
                <h2>Topik Terkait</h2>
                <div className="news-article-tag-row">
                  {article.tags.map((tag) => (
                    <span key={tag} className="news-topic-pill">{tag}</span>
                  ))}
                </div>
              </section>
            )}

            {shouldRenderCommentsSection ? (
              <section className="news-comments-section">
                <div className="news-comments-head">
                  <h2>Komentar ({comments.length})</h2>
                  <label className="news-comments-sort">
                    <span>Urutkan</span>
                    <select defaultValue="newest">
                      <option value="newest">Terbaru</option>
                      <option value="popular">Terpopuler</option>
                    </select>
                  </label>
                </div>

                {commentsEnabled ? (
                  <form className="news-comment-form" onSubmit={handleCommentSubmit}>
                    <span className="news-comment-avatar">{getInitials(currentCommentAuthor)}</span>
                    <div className="news-comment-form-main">
                      <textarea
                        value={commentDraft}
                        onChange={(event) => setCommentDraft(event.target.value)}
                        placeholder="Tulis komentar Anda..."
                        rows={3}
                        disabled={commentSubmitting || (isAuthenticated && !authReady)}
                      />
                      <div className="news-comment-form-actions">
                        <small>
                          {isAuthenticated
                            ? `Masuk sebagai ${currentCommentAuthor}.`
                            : 'Boleh tulis komentar dulu. Login saat ingin mengirim.'}
                        </small>
                        {!isAuthenticated ? (
                          <Link
                            to="/login"
                            state={{ redirectTo: articleReturnPath }}
                            className="news-inline-link"
                          >
                            Login untuk komentar
                          </Link>
                        ) : null}
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={!commentDraft.trim() || commentSubmitting || (isAuthenticated && !authReady)}
                        >
                          {commentSubmitting ? 'Mengirim...' : 'Kirim'}
                        </button>
                      </div>
                      {commentError ? <p className="news-comment-form-message news-comment-form-message-error">{commentError}</p> : null}
                      {commentNotice ? <p className="news-comment-form-message news-comment-form-message-success">{commentNotice}</p> : null}
                    </div>
                  </form>
                ) : (
                  <div className="news-comment-auth-card news-comment-auth-card-muted">
                    <strong>Komentar ditutup.</strong>
                    <p>Diskusi untuk berita ini sementara tidak dibuka oleh redaksi.</p>
                  </div>
                )}

                {comments.length > 0 ? (
                  <div className="news-comment-list">
                    {comments.map((comment) => (
                      <article key={comment.id} className="news-comment-card">
                        <span className="news-comment-avatar">{getInitials(comment.author)}</span>
                        <div className="news-comment-body">
                          <div className="news-comment-head">
                            <strong>{comment.author}</strong>
                            <small>{comment.age}</small>
                          </div>
                          <p>{comment.text}</p>
                          <div className="news-comment-actions">
                            <span>{comment.likes || 0} suka</span>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="news-comment-empty">
                    <p>Belum ada komentar. Jadi yang pertama membuka diskusi.</p>
                  </div>
                )}
              </section>
            ) : null}
            </article>

            <aside className="news-article-sidebar">
              <section className="policy-card news-side-card news-topic-info-card">
                <div className="news-side-card-head">
                  <h2>Tentang Topik</h2>
                </div>
                <div className="news-topic-info-box">
                  <span className="news-topic-info-icon">{topicMeta.title.charAt(0)}</span>
                  <div>
                    <strong>{topicMeta.title}</strong>
                    <p>{topicMeta.description}</p>
                  </div>
                </div>
                <Link to="/news" className="news-inline-link">
                  Lihat semua berita {topicMeta.title.toLowerCase()}
                </Link>
              </section>

              {fallbackRelatedStories.length > 0 ? (
                <section className="policy-card news-side-card">
                  <div className="news-side-card-head">
                    <h2>Berita Terkait</h2>
                  </div>
                  <div className="news-side-stack">
                    {fallbackRelatedStories.map((story, index) => (
                      <Link
                        key={story.id || story.slug || `${story.title}-${index}`}
                        to={`/news/${story.slug}`}
                        className="policy-card news-compact-story news-story-link"
                      >
                        <div className="news-story-cover">
                          <img src={story.image} alt={story.title} className="news-story-cover-image" />
                        </div>
                        <div className="news-card-copy">
                          <span className="news-story-tag">{story.category}</span>
                          <h3>{story.title}</h3>
                          <small>{story.age}</small>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}

              {popularStories.length > 0 ? (
                <section className="policy-card news-side-card">
                  <div className="news-side-card-head">
                    <h2>Terpopuler</h2>
                  </div>
                  <div className="news-popular-list">
                    {popularStories.map((story, index) => (
                      <Link
                        key={story.id || story.slug || `${story.title}-${index}`}
                        to={`/news/${story.slug}`}
                        className="news-popular-item news-story-link"
                      >
                        <span className="news-rank-badge">{index + 1}</span>
                        <div className="news-story-cover news-story-cover-ranked">
                          <img src={story.image} alt={story.title} className="news-story-cover-image" />
                        </div>
                        <div className="news-popular-copy">
                          <span>{story.category}</span>
                          <h3>{story.title}</h3>
                          <small>{story.age}</small>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}
            </aside>
          </section>

          {showLoginPrompt ? (
            <div className="news-login-modal-overlay" role="presentation" onClick={() => setShowLoginPrompt(false)}>
              <div
                className="policy-card news-login-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="news-login-modal-title"
                onClick={(event) => event.stopPropagation()}
              >
                <button type="button" className="news-login-modal-close" onClick={closeLoginPrompt} aria-label="Tutup popup login">
                  ×
                </button>
                <span className="news-story-tag">Komentar</span>
                <h2 id="news-login-modal-title">Login dulu untuk kirim komentar</h2>
                <p>Komentar yang sudah Anda tulis tetap aman. Login di sini, lalu tinggal kirim lagi dari artikel ini.</p>
                <form className="news-login-modal-form" onSubmit={handleInlineLoginSubmit}>
                  <label className="news-login-modal-field">
                    <span>Email</span>
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(event) => setLoginEmail(event.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                      disabled={authLoading}
                    />
                  </label>
                  <label className="news-login-modal-field">
                    <span>Password</span>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                      disabled={authLoading}
                    />
                  </label>
                  {loginError ? <p className="news-comment-form-message news-comment-form-message-error">{loginError}</p> : null}
                  {loginInfo ? <p className="news-comment-form-message news-comment-form-message-success">{loginInfo}</p> : null}
                  <div className="news-login-modal-actions">
                    <button type="submit" className="btn btn-primary" disabled={authLoading}>
                      {authLoading ? 'Login...' : 'Login'}
                    </button>
                    <Link to="/register" state={{ redirectTo: articleReturnPath }} className="btn btn-outline">Daftar</Link>
                    <Link to="/login" state={{ redirectTo: articleReturnPath }} className="news-inline-link">
                      Buka halaman login penuh
                    </Link>
                  </div>
                </form>
                <button type="button" className="news-inline-link news-login-modal-dismiss" onClick={closeLoginPrompt}>
                    Lanjut baca dulu
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </PublicSiteChrome>
  );
}
