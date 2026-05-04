import React, { useEffect, useMemo, useState } from 'react';
import apiClient from '../api';
import PublicSiteChrome from '../components/PublicSiteChrome';
import { businessProfile } from '../siteContent';

const DEFAULT_NEWS_IMAGE = 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1400&q=80';

const FALLBACK_NEWS_FEED = {
  featured_tabs: [
    { slug: 'trending', label: 'Trending' },
    { slug: 'pemilu', label: 'Pemilu 2024' },
    { slug: 'ikn', label: 'Ibu Kota Baru' },
    { slug: 'harga-bbm', label: 'Harga BBM' },
    { slug: 'timnas', label: 'Timnas Indonesia' },
    { slug: 'tekno', label: 'Apple Vision Pro' },
  ],
  featured_stories: [
    {
      slug: 'trending',
      category: 'Ekonomi',
      title: 'Pertumbuhan Ekonomi Indonesia Kuartal I-2024 Tembus 5,11 Persen',
      excerpt: 'Badan Pusat Statistik (BPS) mencatat pertumbuhan ekonomi nasional tetap tangguh meski konsumsi global melambat.',
      image: 'https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?auto=format&fit=crop&w=1400&q=80',
      author: 'Aditya Putra',
      age: '2 jam lalu',
      readTime: '5 min',
    },
    {
      slug: 'pemilu',
      category: 'Politik',
      title: 'Peta Koalisi Daerah Mulai Bergeser Jelang Penetapan Resmi KPU',
      excerpt: 'Sejumlah partai mulai mengubah strategi komunikasi dan penjajakan kandidat setelah peta elektabilitas terbaru keluar.',
      image: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=1400&q=80',
      author: 'Maya Nandini',
      age: '37 menit lalu',
      readTime: '4 min',
    },
    {
      slug: 'ikn',
      category: 'Nasional',
      title: 'Kawasan Inti IKN Dikebut, Infrastruktur Dasar Masuk Tahap Finalisasi',
      excerpt: 'Pemerintah menargetkan sejumlah klaster layanan publik dan konektivitas utama siap digunakan bertahap tahun ini.',
      image: DEFAULT_NEWS_IMAGE,
      author: 'Raka Prananda',
      age: '1 jam lalu',
      readTime: '6 min',
    },
    {
      slug: 'harga-bbm',
      category: 'Bisnis',
      title: 'Harga BBM Resmi Naik, Distribusi Daerah Kepulauan Jadi Sorotan',
      excerpt: 'Kenaikan harga memicu evaluasi biaya logistik dan respons cepat operator transportasi laut serta darat.',
      image: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1400&q=80',
      author: 'Salsa Maharani',
      age: '44 menit lalu',
      readTime: '3 min',
    },
    {
      slug: 'timnas',
      category: 'Olahraga',
      title: 'Timnas Indonesia Jaga Momentum, Persiapan Intensif Menuju Laga Krusial',
      excerpt: 'Sesi latihan difokuskan pada transisi cepat dan variasi serangan untuk menghadapi lawan dengan blok rendah.',
      image: 'https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=1400&q=80',
      author: 'Rifqi Maulana',
      age: '28 menit lalu',
      readTime: '4 min',
    },
    {
      slug: 'tekno',
      category: 'Teknologi',
      title: 'Apple Vision Pro Resmi Hadir Lebih Luas, Ekosistem Spatial App Kian Ramai',
      excerpt: 'Peluncuran gelombang baru memicu kenaikan minat pengembang untuk menghadirkan pengalaman komputasi spasial.',
      image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1400&q=80',
      author: 'Nadia Rahma',
      age: '53 menit lalu',
      readTime: '5 min',
    },
  ],
  popular_stories: [
    {
      category: 'Politik',
      title: 'Pemilu 2024: KPU Tetapkan Hasil Resmi Pagi Ini',
      image: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=320&q=80',
      age: '1 jam lalu',
    },
    {
      category: 'Bisnis',
      title: 'Harga BBM Resmi Naik, Ini Daftar Lengkapnya',
      image: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=320&q=80',
      age: '2 jam lalu',
    },
    {
      category: 'Olahraga',
      title: 'Timnas Indonesia Menang 2-0 Lawan Vietnam',
      image: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=320&q=80',
      age: '2 jam lalu',
    },
    {
      category: 'Nasional',
      title: 'Jokowi Resmikan Proyek Ibu Kota Nusantara Tahap 1',
      image: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=320&q=80',
      age: '3 jam lalu',
    },
    {
      category: 'Teknologi',
      title: 'Apple Vision Pro Resmi Dijual di Indonesia',
      image: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=320&q=80',
      age: '5 jam lalu',
    },
  ],
  latest_filters: ['Semua', 'Politik', 'Ekonomi', 'Teknologi', 'Olahraga', 'Hiburan', 'Gaya Hidup'],
  latest_stories: [
    {
      id: 'latest-politik-1',
      category: 'Politik',
      title: 'DPR Setujui RUU Kesehatan Jadi Undang-Undang',
      excerpt: 'Dewan Perwakilan Rakyat menyepakati revisi layanan primer, digitalisasi faskes, dan integrasi data.',
      image: 'https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=1200&q=80',
      author: 'Arka Aditama',
      age: '1 jam lalu',
    },
    {
      id: 'latest-tech-1',
      category: 'Teknologi',
      title: 'OpenAI Luncurkan GPT-4o Lebih Cepat dan Canggih',
      excerpt: 'Model baru diposisikan untuk percakapan multimodal yang lebih natural di perangkat harian.',
      image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=720&q=80',
      author: 'Nadia Rahma',
      age: '2 jam lalu',
    },
    {
      id: 'latest-economy-1',
      category: 'Ekonomi',
      title: 'Inflasi April 2024 Terkendali di Angka 2,84 Persen',
      excerpt: 'Komponen pangan bergejolak mereda, sementara tarif transportasi menjadi faktor penggerak utama.',
      image: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=720&q=80',
      author: 'Dina Puspa',
      age: '2 jam lalu',
    },
    {
      id: 'latest-sport-1',
      category: 'Olahraga',
      title: 'Liga 1: Persib Bandung Kalahkan Persija 3-1',
      excerpt: 'Laga panas berakhir dengan tiga gol cepat di babak kedua dan tekanan tinggi sepanjang pertandingan.',
      image: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=720&q=80',
      author: 'Rifqi Maulana',
      age: '4 jam lalu',
    },
    {
      id: 'latest-life-1',
      category: 'Gaya Hidup',
      title: '5 Ritual Pagi yang Membantu Fokus Kerja Sepanjang Hari',
      excerpt: 'Mulai dari hidrasi, journaling singkat, sampai gerak 10 menit untuk menjaga energi mental.',
      image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=720&q=80',
      author: 'Maya Nandini',
      age: '5 jam lalu',
    },
    {
      id: 'latest-ent-1',
      category: 'Hiburan',
      title: 'Film “Bad Boys 4” Siap Tayang di Indonesia Pekan Ini',
      excerpt: 'Jaringan bioskop menyiapkan layar premium karena animo penonton diprediksi tinggi sejak hari pertama.',
      image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=720&q=80',
      author: 'Salsa Maharani',
      age: '6 jam lalu',
    },
  ],
  editorial_stories: [
    {
      id: 'editor-1',
      category: 'Gaya Hidup',
      title: '5 Tips Hidup Sehat di Tengah Kesibukan',
      image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=720&q=80',
      age: '3 jam lalu',
    },
    {
      id: 'editor-2',
      category: 'Teknologi',
      title: '5 Smartphone Terbaru Mei 2024, Spek Gahar',
      image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=720&q=80',
      age: '5 jam lalu',
    },
    {
      id: 'editor-3',
      category: 'Hiburan',
      title: 'Film “Bad Boys 4” Siap Tayang di Indonesia',
      image: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=720&q=80',
      age: '6 jam lalu',
    },
    {
      id: 'editor-4',
      category: 'Ekonomi',
      title: 'Nilai Tukar Rupiah Menguat Terhadap Dolar AS',
      image: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=720&q=80',
      age: '7 jam lalu',
    },
    {
      id: 'editor-5',
      category: 'Nasional',
      title: 'Survei: Kepuasan Publik Terhadap Pemerintah Naik',
      image: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=720&q=80',
      age: '8 jam lalu',
    },
  ],
};

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
  };
}

function normalizeFeed(feed) {
  const featuredStories = Array.isArray(feed?.featured_stories)
    ? feed.featured_stories.map((story, index) => normalizeStory(story, index))
    : [];
  const popularStories = Array.isArray(feed?.popular_stories)
    ? feed.popular_stories.map((story, index) => normalizeStory(story, index))
    : [];
  const latestStories = Array.isArray(feed?.latest_stories)
    ? feed.latest_stories.map((story, index) => normalizeStory(story, index))
    : [];
  const editorialStories = Array.isArray(feed?.editorial_stories)
    ? feed.editorial_stories.map((story, index) => normalizeStory(story, index))
    : [];

  const fallbackFeatureTabs = featuredStories.map((story, index) => ({
    slug: story.slug || `featured-${index}`,
    label: story.category || `Topik ${index + 1}`,
  }));

  const featuredTabs = Array.isArray(feed?.featured_tabs) && feed.featured_tabs.length > 0
    ? feed.featured_tabs.map((tab, index) => ({
        slug: tab?.slug || featuredStories[index]?.slug || `featured-${index}`,
        label: tab?.label || featuredStories[index]?.category || `Topik ${index + 1}`,
      }))
    : fallbackFeatureTabs;

  const latestFilters = Array.isArray(feed?.latest_filters) && feed.latest_filters.length > 0
    ? feed.latest_filters.filter(Boolean)
    : ['Semua', ...latestStories.map((story) => story.category).filter((category, index, list) => list.indexOf(category) === index)];

  return {
    featured_tabs: featuredTabs,
    featured_stories: featuredStories,
    popular_stories: popularStories,
    latest_filters: latestFilters.length > 0 ? latestFilters : ['Semua'],
    latest_stories: latestStories,
    editorial_stories: editorialStories,
  };
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2.5 13.93 8.07 19.5 10 13.93 11.93 12 17.5 10.07 11.93 4.5 10 10.07 8.07 12 2.5Z" fill="currentColor" />
      <path d="M18.5 15.5 19.24 17.26 21 18 19.24 18.74 18.5 20.5 17.76 18.74 16 18 17.76 17.26 18.5 15.5Z" fill="currentColor" />
    </svg>
  );
}

function ArrowUpRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 17 17 7M9 7h8v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function News() {
  const fallbackFeed = useMemo(() => normalizeFeed(FALLBACK_NEWS_FEED), []);
  const [feed, setFeed] = useState(fallbackFeed);
  const [activeFeatureSlug, setActiveFeatureSlug] = useState(fallbackFeed.featured_tabs[0]?.slug || '');
  const [activeLatestFilter, setActiveLatestFilter] = useState('Semua');

  useEffect(() => {
    let ignore = false;

    const loadNewsFeed = async () => {
      try {
        const response = await apiClient.get('/news/feed');
        const nextFeed = normalizeFeed(response.data?.data);
        const hasRemoteContent = [
          nextFeed.featured_stories.length,
          nextFeed.popular_stories.length,
          nextFeed.latest_stories.length,
          nextFeed.editorial_stories.length,
        ].some((count) => count > 0);

        if (!ignore && hasRemoteContent) {
          setFeed(nextFeed);
        }
      } catch (error) {
        // Fallback UI stays active when API feed is still empty or unavailable.
      }
    };

    loadNewsFeed();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!feed.featured_tabs.some((tab) => tab.slug === activeFeatureSlug)) {
      setActiveFeatureSlug(feed.featured_tabs[0]?.slug || '');
    }
  }, [activeFeatureSlug, feed.featured_tabs]);

  useEffect(() => {
    if (!feed.latest_filters.includes(activeLatestFilter)) {
      setActiveLatestFilter(feed.latest_filters[0] || 'Semua');
    }
  }, [activeLatestFilter, feed.latest_filters]);

  const featuredStories = feed.featured_stories.length > 0 ? feed.featured_stories : feed.latest_stories.slice(0, 6);
  const featuredStory = featuredStories.find((story) => story.slug === activeFeatureSlug) || featuredStories[0];
  const filteredLatestStories = activeLatestFilter === 'Semua'
    ? feed.latest_stories
    : feed.latest_stories.filter((story) => story.category === activeLatestFilter);
  const leadStory = filteredLatestStories[0] || feed.latest_stories[0] || featuredStory;
  const secondaryStories = filteredLatestStories.length > 1
    ? filteredLatestStories.slice(1, 4)
    : feed.latest_stories.slice(1, 4);
  const popularStories = feed.popular_stories.length > 0 ? feed.popular_stories : feed.latest_stories.slice(0, 5);
  const editorialStories = feed.editorial_stories.length > 0 ? feed.editorial_stories : feed.latest_stories.slice(0, 5);

  if (!featuredStory || !leadStory) {
    return null;
  }

  return (
    <PublicSiteChrome showHero={false} mainClassName="news-page-main">
      <section className="news-topics-bar" aria-label="Sorotan topik">
        {feed.featured_tabs.map((tab) => (
          <button
            key={tab.slug}
            type="button"
            className={`news-topic-pill ${activeFeatureSlug === tab.slug ? 'news-topic-pill-active' : ''}`}
            onClick={() => setActiveFeatureSlug(tab.slug)}
          >
            {tab.label}
          </button>
        ))}
      </section>

      <section className="news-hero-grid">
        <article className="news-feature-card">
          <div
            className="news-feature-media"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(10, 18, 35, 0.08), rgba(10, 18, 35, 0.78)), url('${featuredStory.image}')`,
            }}
          />
          <div className="news-feature-body">
            <span className="news-story-tag news-story-tag-feature">{featuredStory.category}</span>
            <h1>{featuredStory.title}</h1>
            <p>{featuredStory.excerpt}</p>
            <div className="news-feature-meta">
              <div className="news-author-chip">
                <span>{featuredStory.author.slice(0, 1)}</span>
                <strong>{featuredStory.author}</strong>
              </div>
              <small>{featuredStory.age}</small>
              <small>{featuredStory.readTime} baca</small>
            </div>
          </div>
        </article>

        <aside className="policy-card news-popular-card">
          <div className="news-block-head">
            <h2>Terpopuler</h2>
            <button type="button" className="news-inline-link">Lihat Semua</button>
          </div>

          <div className="news-popular-list">
            {popularStories.map((story, index) => (
              <article key={story.id || story.slug || `${story.title}-${index}`} className="news-popular-item">
                <span className="news-rank-badge">{index + 1}</span>
                <div
                  className="news-popular-thumb"
                  style={{ backgroundImage: `url('${story.image}')` }}
                  aria-hidden="true"
                />
                <div className="news-popular-copy">
                  <span>{story.category}</span>
                  <h3>{story.title}</h3>
                  <small>{story.age}</small>
                </div>
              </article>
            ))}
          </div>
        </aside>
      </section>

      <section className="news-section">
        <div className="news-section-head">
          <div>
            <span className="landing-kicker">Update hari ini</span>
            <h2>Berita Terbaru</h2>
          </div>
          <div className="news-filter-row" aria-label="Filter berita terbaru">
            {feed.latest_filters.map((filter) => (
              <button
                key={filter}
                type="button"
                className={`news-filter-chip ${activeLatestFilter === filter ? 'news-filter-chip-active' : ''}`}
                onClick={() => setActiveLatestFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="news-latest-grid">
          <article className="policy-card news-lead-story">
            <div
              className="news-lead-story-media"
              style={{ backgroundImage: `url('${leadStory.image}')` }}
              aria-hidden="true"
            />
            <div className="news-card-copy">
              <span className="news-story-tag">{leadStory.category}</span>
              <h3>{leadStory.title}</h3>
              <p>{leadStory.excerpt}</p>
              <div className="news-card-meta">
                <strong>{leadStory.author}</strong>
                <small>{leadStory.age}</small>
              </div>
            </div>
          </article>

          <div className="news-side-stack">
            {secondaryStories.map((story, index) => (
              <article key={story.id || story.slug || `${story.title}-${index}`} className="policy-card news-compact-story">
                <div
                  className="news-compact-thumb"
                  style={{ backgroundImage: `url('${story.image}')` }}
                  aria-hidden="true"
                />
                <div className="news-card-copy">
                  <span className="news-story-tag">{story.category}</span>
                  <h3>{story.title}</h3>
                  <div className="news-card-meta">
                    <strong>{story.author}</strong>
                    <small>{story.age}</small>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <aside className="policy-card news-newsletter-card">
            <div className="news-newsletter-badge">
              <SparkIcon />
            </div>
            <h3>Dapatkan Berita Terbaru Langsung di Email Anda</h3>
            <p>
              Berlangganan newsletter ringan untuk update singkat seputar nasional, ekonomi, teknologi,
              dan insight mingguan dari tim redaksi {businessProfile.shortName}.
            </p>

            <form
              className="news-newsletter-form"
              onSubmit={(event) => event.preventDefault()}
            >
              <input type="email" placeholder="Masukkan email Anda" aria-label="Masukkan email Anda" />
              <button type="submit">Berlangganan</button>
            </form>

            <small>
              Dengan berlangganan, Anda menyetujui ringkasan berita dikirim berkala ke email.
            </small>
          </aside>
        </div>
      </section>

      <section className="news-section">
        <div className="news-block-head news-block-head-spaced">
          <div>
            <span className="landing-kicker">Kurasi redaksi</span>
            <h2>Pilihan Redaksi</h2>
          </div>
          <button type="button" className="news-inline-link">
            Lihat Semua
            <ArrowUpRightIcon />
          </button>
        </div>

        <div className="news-editorial-grid">
          {editorialStories.map((story, index) => (
            <article key={story.id || story.slug || `${story.title}-${index}`} className="policy-card news-editorial-card">
              <div
                className="news-editorial-media"
                style={{ backgroundImage: `url('${story.image}')` }}
                aria-hidden="true"
              />
              <div className="news-card-copy">
                <span className="news-story-tag">{story.category}</span>
                <h3>{story.title}</h3>
                <small>{story.age}</small>
              </div>
            </article>
          ))}
        </div>
      </section>
    </PublicSiteChrome>
  );
}
