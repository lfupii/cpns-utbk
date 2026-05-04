import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api';
import { DEFAULT_NEWS_IMAGE, FALLBACK_NEWS_FEED } from '../data/newsFallback';
import PublicSiteChrome from '../components/PublicSiteChrome';

function normalizeStory(story, index = 0) {
  return {
    id: story?.id || story?.slug || `story-${index}`,
    slug: story?.slug || `story-${index}`,
    category: story?.category || 'Nasional',
    title: story?.title || 'Berita tanpa judul',
    excerpt: story?.excerpt || 'Ringkasan berita belum tersedia.',
    image: story?.image || story?.cover_image_url || DEFAULT_NEWS_IMAGE,
    author: story?.author || story?.author_name || 'Tim Redaksi',
    age: story?.age || 'Baru saja',
    readTime: story?.readTime || `${Math.max(1, Number(story?.read_time_minutes || 4))} min`,
    content: story?.content || '',
    tags: Array.isArray(story?.tags) ? story.tags : [],
  };
}

function normalizeSection(section, index = 0) {
  const allowedLayouts = ['hero', 'ranked', 'lead-grid', 'cards'];
  const layoutStyle = allowedLayouts.includes(section?.layout_style) ? section.layout_style : 'cards';

  return {
    id: section?.id || index + 1,
    slug: section?.slug || `section-${index}`,
    title: section?.title || `Section ${index + 1}`,
    description: section?.description || '',
    layout_style: layoutStyle,
    article_count: Math.max(1, Number(section?.article_count || 5)),
    items: Array.isArray(section?.items)
      ? section.items.map((story, storyIndex) => normalizeStory(story, storyIndex)).filter((story) => story.slug)
      : [],
  };
}

function normalizeFeed(feed) {
  const sections = Array.isArray(feed?.sections)
    ? feed.sections.map((section, index) => normalizeSection(section, index)).filter((section) => section.items.length > 0)
    : [];

  return {
    sections,
  };
}

function renderSectionDescription(section) {
  if (!section.description) {
    return null;
  }

  return <p className="news-section-description">{section.description}</p>;
}

export default function News() {
  const fallbackFeed = useMemo(() => normalizeFeed(FALLBACK_NEWS_FEED), []);
  const [feed, setFeed] = useState(fallbackFeed);
  const [activeHeroStoryBySection, setActiveHeroStoryBySection] = useState({});

  useEffect(() => {
    let ignore = false;

    const loadNewsFeed = async () => {
      try {
        const response = await apiClient.get('/news/feed');
        const nextFeed = normalizeFeed(response.data?.data);
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
  }, []);

  const renderHeroSection = (section) => {
    const activeSlug = activeHeroStoryBySection[section.slug] || section.items[0]?.slug || '';
    const activeStory = section.items.find((story) => story.slug === activeSlug) || section.items[0];
    const supportingStories = section.items.filter((story) => story.slug !== activeStory.slug).slice(0, 4);

    return (
      <section key={section.slug} className="news-section">
        <div className="news-section-head">
          <div>
            <span className="landing-kicker">Section utama</span>
            <h2>{section.title}</h2>
            {renderSectionDescription(section)}
          </div>
        </div>

        <div className="news-topics-bar news-topics-bar-article">
          {section.items.map((story) => (
            <button
              key={story.slug}
              type="button"
              className={`news-topic-pill ${activeStory.slug === story.slug ? 'news-topic-pill-active' : ''}`}
              onClick={() => setActiveHeroStoryBySection((current) => ({ ...current, [section.slug]: story.slug }))}
            >
              {story.category}
            </button>
          ))}
        </div>

        <div className="news-section-shell">
          <Link to={`/news/${activeStory.slug}`} className="news-feature-card news-story-link">
            <div className="news-story-cover news-story-cover-hero">
              <img src={activeStory.image} alt={activeStory.title} className="news-story-cover-image" />
            </div>
            <div className="news-feature-body">
              <span className="news-story-tag news-story-tag-feature">{activeStory.category}</span>
              <h1>{activeStory.title}</h1>
              <p>{activeStory.excerpt}</p>
              <div className="news-feature-meta">
                <div className="news-author-chip">
                  <span>{activeStory.author.slice(0, 1)}</span>
                  <strong>{activeStory.author}</strong>
                </div>
                <small>{activeStory.age}</small>
                <small>{activeStory.readTime} baca</small>
              </div>
            </div>
          </Link>

          {supportingStories.length > 0 && (
            <div className="news-side-stack">
              {supportingStories.map((story, index) => (
                <Link key={story.id || story.slug || `${story.title}-${index}`} to={`/news/${story.slug}`} className="policy-card news-compact-story news-story-link">
                  <div className="news-story-cover">
                    <img src={story.image} alt={story.title} className="news-story-cover-image" />
                  </div>
                  <div className="news-card-copy">
                    <span className="news-story-tag">{story.category}</span>
                    <h3>{story.title}</h3>
                    <div className="news-card-meta">
                      <strong>{story.author}</strong>
                      <small>{story.age}</small>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  };

  const renderRankedSection = (section) => (
    <section key={section.slug} className="news-section">
      <div className="news-block-head">
        <div>
          <span className="landing-kicker">Paling dibaca</span>
          <h2>{section.title}</h2>
          {renderSectionDescription(section)}
        </div>
      </div>

      <div className="news-popular-list">
        {section.items.map((story, index) => (
          <Link key={story.id || story.slug || `${story.title}-${index}`} to={`/news/${story.slug}`} className="news-popular-item news-story-link">
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
  );

  const renderLeadGridSection = (section) => {
    const leadStory = section.items[0];
    const sideStories = section.items.slice(1, 5);

    return (
      <section key={section.slug} className="news-section">
        <div className="news-section-head">
          <div>
            <span className="landing-kicker">Update terbaru</span>
            <h2>{section.title}</h2>
            {renderSectionDescription(section)}
          </div>
        </div>

        <div className="news-latest-grid">
          {leadStory && (
            <Link to={`/news/${leadStory.slug}`} className="policy-card news-lead-story news-story-link">
              <div className="news-story-cover news-story-cover-lead">
                <img src={leadStory.image} alt={leadStory.title} className="news-story-cover-image" />
              </div>
              <div className="news-card-copy">
                <span className="news-story-tag">{leadStory.category}</span>
                <h3>{leadStory.title}</h3>
                <p>{leadStory.excerpt}</p>
                <div className="news-card-meta">
                  <strong>{leadStory.author}</strong>
                  <small>{leadStory.age}</small>
                </div>
              </div>
            </Link>
          )}

          <div className="news-side-stack">
            {sideStories.map((story, index) => (
              <Link key={story.id || story.slug || `${story.title}-${index}`} to={`/news/${story.slug}`} className="policy-card news-compact-story news-story-link">
                <div className="news-story-cover">
                  <img src={story.image} alt={story.title} className="news-story-cover-image" />
                </div>
                <div className="news-card-copy">
                  <span className="news-story-tag">{story.category}</span>
                  <h3>{story.title}</h3>
                  <div className="news-card-meta">
                    <strong>{story.author}</strong>
                    <small>{story.age}</small>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    );
  };

  const renderCardsSection = (section) => (
    <section key={section.slug} className="news-section">
      <div className="news-block-head news-block-head-spaced">
        <div>
          <span className="landing-kicker">Kurasi section</span>
          <h2>{section.title}</h2>
          {renderSectionDescription(section)}
        </div>
      </div>

      <div className="news-editorial-grid">
        {section.items.map((story, index) => (
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
  );

  const renderSection = (section) => {
    if (section.layout_style === 'hero') {
      return renderHeroSection(section);
    }

    if (section.layout_style === 'ranked') {
      return renderRankedSection(section);
    }

    if (section.layout_style === 'lead-grid') {
      return renderLeadGridSection(section);
    }

    return renderCardsSection(section);
  };

  return (
    <PublicSiteChrome showHero={false} mainClassName="news-page-main">
      {feed.sections.map((section) => renderSection(section))}
    </PublicSiteChrome>
  );
}
