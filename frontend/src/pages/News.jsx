import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import apiClient from '../api';
import NewsSectionsPreview, { normalizeNewsFeed } from '../components/NewsSectionsPreview';
import { DEFAULT_NEWS_IMAGE, FALLBACK_NEWS_FEED } from '../data/newsFallback';
import PublicSiteChrome from '../components/PublicSiteChrome';

function normalizeArchiveArticle(article, index = 0) {
  return {
    id: article?.id || article?.slug || `archive-story-${index}`,
    slug: article?.slug || `archive-story-${index}`,
    category: article?.category || 'Nasional',
    title: article?.title || 'Berita tanpa judul',
    excerpt: article?.excerpt || 'Ringkasan berita belum tersedia.',
    image: article?.image || article?.cover_image_url || DEFAULT_NEWS_IMAGE,
    author: article?.author || article?.author_name || 'Tim Redaksi',
    age: article?.age || 'Baru saja',
    readTime: article?.readTime || `${Math.max(1, Number(article?.read_time_minutes || 4))} min`,
  };
}

function normalizeArchiveArticles(items) {
  return Array.isArray(items)
    ? items.map((item, index) => normalizeArchiveArticle(item, index)).filter((item) => item.slug)
    : [];
}

function buildFallbackArchive(feed) {
  const seenSlugs = new Set();
  const archiveItems = [];

  (feed?.sections || []).forEach((section) => {
    (section.items || []).forEach((story) => {
      const normalizedStory = normalizeArchiveArticle(story, archiveItems.length);
      if (!normalizedStory.slug || seenSlugs.has(normalizedStory.slug)) {
        return;
      }

      seenSlugs.add(normalizedStory.slug);
      archiveItems.push(normalizedStory);
    });
  });

  return archiveItems;
}

function NewsArchiveList({ articles, loading }) {
  return (
    <section className="news-archive-shell">
      <div className="news-archive-head">
        <div>
          <span className="landing-kicker">Semua berita</span>
          <h1>Daftar Seluruh Berita</h1>
          <p className="news-section-description">Kumpulan seluruh berita live dalam satu halaman, ditampilkan memanjang satu baris per artikel.</p>
        </div>

        <div className="news-archive-actions">
          <small>{articles.length} berita live</small>
          <Link to="/news" className="news-inline-link news-section-more-link">
            Kembali ke section berita
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="policy-card news-archive-empty">
          <p className="text-muted">Memuat daftar seluruh berita...</p>
        </div>
      ) : articles.length === 0 ? (
        <div className="policy-card news-archive-empty">
          <h2>Belum ada berita live</h2>
          <p>Publish artikel dari panel admin supaya daftar berita publik muncul di sini.</p>
        </div>
      ) : (
        <div className="news-archive-list">
          {articles.map((article, index) => (
            <Link
              key={article.id || article.slug || `${article.title}-${index}`}
              to={`/news/${article.slug}`}
              className="policy-card news-archive-item news-story-link"
            >
              <div className="news-story-cover news-archive-cover">
                <img src={article.image} alt={article.title} className="news-story-cover-image" />
              </div>

              <div className="news-archive-copy">
                <span className="news-story-tag">{article.category}</span>
                <h2>{article.title}</h2>
                <p>{article.excerpt}</p>
                <div className="news-card-meta">
                  <strong>{article.author}</strong>
                  <small>{article.age}</small>
                  <small>{article.readTime} baca</small>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export default function News() {
  const [searchParams] = useSearchParams();
  const newsView = searchParams.get('view') === 'list' ? 'list' : 'sections';
  const fallbackFeed = useMemo(() => normalizeNewsFeed(FALLBACK_NEWS_FEED), []);
  const fallbackArchive = useMemo(() => buildFallbackArchive(fallbackFeed), [fallbackFeed]);
  const [feed, setFeed] = useState(fallbackFeed);
  const [archiveArticles, setArchiveArticles] = useState(fallbackArchive);
  const [archiveLoading, setArchiveLoading] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [newsView]);

  useEffect(() => {
    if (newsView !== 'sections') {
      return undefined;
    }

    let ignore = false;

    const loadNewsFeed = async () => {
      try {
        const response = await apiClient.get('/news/feed');
        const nextFeed = normalizeNewsFeed(response.data?.data);
        if (!ignore && nextFeed.sections.length > 0) {
          setFeed(nextFeed);
        }
      } catch (error) {
        // fallback feed stays active
      }
    };

    loadNewsFeed();

    return () => {
      ignore = true;
    };
  }, [newsView]);

  useEffect(() => {
    if (newsView !== 'list') {
      return undefined;
    }

    let ignore = false;
    setArchiveLoading(true);

    const loadNewsArchive = async () => {
      try {
        const response = await apiClient.get('/news/articles');
        const nextArticles = normalizeArchiveArticles(response.data?.data?.articles);
        if (!ignore) {
          setArchiveArticles(nextArticles);
        }
      } catch (error) {
        if (!ignore) {
          setArchiveArticles(fallbackArchive);
        }
      } finally {
        if (!ignore) {
          setArchiveLoading(false);
        }
      }
    };

    loadNewsArchive();

    return () => {
      ignore = true;
    };
  }, [fallbackArchive, newsView]);

  return (
    <PublicSiteChrome showHero={false} mainClassName="news-page-main">
      {newsView === 'list'
        ? <NewsArchiveList articles={archiveArticles} loading={archiveLoading} />
        : <NewsSectionsPreview feed={feed} />}
    </PublicSiteChrome>
  );
}
