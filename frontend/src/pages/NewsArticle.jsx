import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import apiClient from '../api';
import { findFallbackArticleBySlug } from '../data/newsFallback';
import PublicSiteChrome from '../components/PublicSiteChrome';

function renderNewsContent(content) {
  return { __html: content || '<p>Konten berita belum tersedia.</p>' };
}

export default function NewsArticle() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [article, setArticle] = useState(null);
  const [relatedStories, setRelatedStories] = useState([]);

  useEffect(() => {
    let ignore = false;

    const loadArticle = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await apiClient.get(`/news/article?slug=${encodeURIComponent(slug || '')}`);
        if (!ignore) {
          setArticle(response.data?.data?.article || null);
          setRelatedStories(Array.isArray(response.data?.data?.related_stories) ? response.data.data.related_stories : []);
        }
      } catch (loadError) {
        if (ignore) {
          return;
        }

        const fallbackDetail = findFallbackArticleBySlug(slug);
        if (fallbackDetail?.article) {
          setArticle(fallbackDetail.article);
          setRelatedStories(Array.isArray(fallbackDetail.related_stories) ? fallbackDetail.related_stories : []);
          setError('');
          return;
        }

        setError(loadError?.response?.data?.message || 'Berita tidak ditemukan.');
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
          <article className="policy-card news-article-shell">
            <div className="news-article-meta-head">
              <span className="news-story-tag">{article.category}</span>
              <div className="news-card-meta">
                <strong>{article.author}</strong>
                <small>{article.age}</small>
                <small>{article.readTime} baca</small>
              </div>
            </div>

            <h1>{article.title}</h1>
            {article.excerpt ? <p className="news-article-excerpt">{article.excerpt}</p> : null}

            {article.tags?.length > 0 && (
              <div className="news-article-tag-row">
                {article.tags.map((tag) => (
                  <span key={tag} className="news-topic-pill">{tag}</span>
                ))}
              </div>
            )}

            {article.image && (
              <div className="news-article-cover">
                <img src={article.image} alt={article.title} />
              </div>
            )}

            <div className="news-article-content" dangerouslySetInnerHTML={renderNewsContent(article.content)} />
          </article>

          {relatedStories.length > 0 && (
            <section className="news-section">
              <div className="news-block-head news-block-head-spaced">
                <div>
                  <span className="landing-kicker">Baca berikutnya</span>
                  <h2>Berita Terkait</h2>
                </div>
                <Link to="/news" className="news-inline-link">
                  Kembali ke Berita
                </Link>
              </div>

              <div className="news-editorial-grid">
                {relatedStories.map((story, index) => (
                  <Link key={story.id || story.slug || `${story.title}-${index}`} to={`/news/${story.slug}`} className="policy-card news-editorial-card news-story-link">
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
          )}
        </>
      )}
    </PublicSiteChrome>
  );
}
