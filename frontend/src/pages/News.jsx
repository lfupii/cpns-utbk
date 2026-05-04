import React, { useEffect, useMemo, useState } from 'react';
import apiClient from '../api';
import NewsSectionsPreview, { normalizeNewsFeed } from '../components/NewsSectionsPreview';
import { FALLBACK_NEWS_FEED } from '../data/newsFallback';
import PublicSiteChrome from '../components/PublicSiteChrome';

export default function News() {
  const fallbackFeed = useMemo(() => normalizeNewsFeed(FALLBACK_NEWS_FEED), []);
  const [feed, setFeed] = useState(fallbackFeed);
  const [activeHeroStoryBySection, setActiveHeroStoryBySection] = useState({});

  useEffect(() => {
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
  }, []);

  return (
    <PublicSiteChrome showHero={false} mainClassName="news-page-main">
      <NewsSectionsPreview
        feed={feed}
        activeHeroStoryBySection={activeHeroStoryBySection}
        onHeroStoryChange={(sectionSlug, storySlug) => {
          setActiveHeroStoryBySection((current) => ({ ...current, [sectionSlug]: storySlug }));
        }}
      />
    </PublicSiteChrome>
  );
}
