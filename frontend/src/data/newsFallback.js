export const DEFAULT_NEWS_IMAGE = 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1400&q=80';

function buildFallbackContent(story) {
  const points = Array.isArray(story?.bullets) && story.bullets.length > 0
    ? story.bullets
    : [
        `Ringkasan utama dari topik ${story?.category || 'Nasional'} untuk pembaca CPNS UTBK.`,
        'Dampak ke strategi persiapan, pendaftaran, atau pemetaan peluang.',
        'Catatan lanjutan yang bisa diedit ulang penuh dari panel admin berita.',
      ];

  const pointMarkup = points.map((point) => `<li>${point}</li>`).join('');
  const safeExcerpt = story?.excerpt || 'Konten simulasi berita belum memiliki ringkasan.';

  return `
    <p>${safeExcerpt}</p>
    <p>Artikel contoh ini disiapkan untuk simulasi newsroom CPNS UTBK. Struktur section, thumbnail sampul, metadata, dan isi penuh dapat diubah dari workspace admin berita tanpa menyentuh kode frontend.</p>
    <h2>Poin penting</h2>
    <ul>${pointMarkup}</ul>
    <p>Jika nanti artikel ini sudah diganti dengan data produksi, slug, thumbnail, dan posisi section tetap mengikuti konfigurasi dari panel admin.</p>
  `;
}

function createFallbackStory(story) {
  const tags = Array.isArray(story?.tags) && story.tags.length > 0
    ? story.tags
    : [story?.category || 'Nasional', 'CPNS UTBK'];

  return {
    ...story,
    image: story?.image || DEFAULT_NEWS_IMAGE,
    tags,
    content: story?.content || buildFallbackContent(story),
  };
}

export const FALLBACK_NEWS_FEED = {
  sections: [
    {
      slug: 'sorotan-cpns-utbk',
      title: 'Sorotan CPNS & UTBK',
      description: 'Contoh section headline untuk tema CPNS, UTBK, formasi, dan kebijakan negara.',
      layout_style: 'hero',
      article_count: 6,
      items: [
        createFallbackStory({
          slug: 'cpns-2026',
          category: 'CPNS',
          title: 'Prediksi Formasi CPNS 2026: Instansi Pusat dan Daerah yang Paling Banyak Diburu',
          excerpt: 'Contoh konten berita untuk simulasi halaman publik: fokus pada tren formasi, kebutuhan jabatan, dan strategi pelamar CPNS.',
          image: 'https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?auto=format&fit=crop&w=1400&q=80',
          author: 'Redaksi CPNS',
          age: '2 jam lalu',
          readTime: '5 min',
          tags: ['CPNS', 'Formasi', 'ASN'],
          bullets: [
            'Instansi pusat dan daerah biasanya ramai pada jabatan administrasi, teknis, dan digital.',
            'Pelamar perlu membaca syarat jabatan dan jenjang pendidikan sejak awal.',
            'Strategi memilih formasi penting untuk menekan persaingan yang terlalu padat.',
          ],
        }),
        createFallbackStory({
          slug: 'utbk-strategi',
          category: 'UTBK',
          title: 'Strategi UTBK 2026: Cara Menyusun Jadwal Belajar 90 Hari Sebelum Ujian',
          excerpt: 'Contoh berita edukatif untuk siswa UTBK: pembagian waktu latihan TPS, literasi, numerasi, dan evaluasi mingguan.',
          image: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=1400&q=80',
          author: 'Desk Pendidikan',
          age: '37 menit lalu',
          readTime: '4 min',
          tags: ['UTBK', 'Belajar', 'PTN'],
          bullets: [
            'Minggu awal fokus pemetaan kemampuan dasar dan tryout baseline.',
            'Minggu tengah untuk drilling numerasi, literasi, dan review kesalahan.',
            'Minggu akhir dipakai untuk simulasi tempo ujian dan penguatan topik lemah.',
          ],
        }),
        createFallbackStory({
          slug: 'formasi-prioritas',
          category: 'Formasi',
          title: 'Formasi CPNS Prioritas: Tenaga Teknis, Kesehatan, dan Digital Masih Dominan',
          excerpt: 'Simulasi artikel terkait peluang formasi CPNS, kebutuhan nasional, dan jabatan yang sering jadi target pendaftar.',
          image: DEFAULT_NEWS_IMAGE,
          author: 'Desk ASN',
          age: '1 jam lalu',
          readTime: '6 min',
          tags: ['Formasi', 'CPNS', 'Jabatan'],
          bullets: [
            'Formasi teknis dan digital cenderung naik seiring kebutuhan transformasi layanan.',
            'Bidang kesehatan dan pelayanan publik tetap relevan pada banyak instansi.',
            'Pelamar perlu cocokkan kompetensi dengan kebutuhan jabatan yang diumumkan.',
          ],
        }),
        createFallbackStory({
          slug: 'regulasi-asn',
          category: 'Regulasi',
          title: 'Rangkuman Aturan Baru ASN dan Dampaknya ke Pola Rekrutmen CPNS',
          excerpt: 'Contoh konten berita regulasi untuk pembaca CPNS: menyorot keputusan pemerintah, pembaruan aturan, dan implikasi seleksi.',
          image: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1400&q=80',
          author: 'Desk Regulasi',
          age: '44 menit lalu',
          readTime: '3 min',
          tags: ['Regulasi', 'ASN', 'CPNS'],
          bullets: [
            'Aturan baru biasanya memengaruhi syarat, tahapan, atau penataan jabatan.',
            'Pembaca perlu fokus pada pasal yang terkait rekrutmen dan kebutuhan formasi.',
            'Bahasa aturan perlu diterjemahkan ke langkah praktis untuk pelamar.',
          ],
        }),
        createFallbackStory({
          slug: 'kampus-terbaik',
          category: 'Kampus',
          title: 'Top 5 Universitas Incaran Jalur UTBK dan Tips Memilih Program Studi',
          excerpt: 'Contoh artikel kampus untuk UTBK: membahas daya tampung, minat tinggi, dan cara memilih jurusan lebih realistis.',
          image: 'https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=1400&q=80',
          author: 'Desk Kampus',
          age: '28 menit lalu',
          readTime: '4 min',
          tags: ['Kampus', 'UTBK', 'PTN'],
          bullets: [
            'Target kampus perlu dibagi menjadi ambisius, tengah, dan aman.',
            'Daya tampung dan tren peminat membantu membaca tingkat kompetisi.',
            'Program studi harus selaras minat, bukan hanya reputasi kampus.',
          ],
        }),
        createFallbackStory({
          slug: 'kebijakan-negara',
          category: 'Negara',
          title: 'Keputusan Negara dan Arah Belanja SDM Publik: Apa Dampaknya ke Formasi Baru',
          excerpt: 'Contoh berita kebijakan negara yang relevan untuk pembaca CPNS: anggaran, prioritas pemerintah, dan rekrutmen aparatur.',
          image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1400&q=80',
          author: 'Desk Nasional',
          age: '53 menit lalu',
          readTime: '5 min',
          tags: ['Negara', 'Anggaran', 'CPNS'],
          bullets: [
            'Arah belanja SDM publik berpengaruh ke pembukaan dan prioritas formasi.',
            'Keputusan fiskal dan program prioritas sering menentukan sektor yang diperkuat.',
            'Pelamar perlu membaca tren kebijakan, bukan hanya pengumuman formasi akhir.',
          ],
        }),
      ],
    },
    {
      slug: 'terpopuler',
      title: 'Terpopuler',
      description: 'Artikel paling sering dibaca pengunjung.',
      layout_style: 'ranked',
      article_count: 5,
      items: [
        createFallbackStory({
          slug: 'gagal-administrasi-cpns',
          category: 'CPNS',
          title: '7 Kesalahan Umum Saat Daftar CPNS yang Bikin Pelamar Gugur Administrasi',
          image: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=320&q=80',
          age: '1 jam lalu',
          author: 'Redaksi CPNS',
          excerpt: 'Kesalahan administrasi sering terjadi pada dokumen, format unggahan, dan ketidaksesuaian syarat formasi.',
          tags: ['CPNS', 'Administrasi', 'Pendaftaran'],
        }),
        createFallbackStory({
          slug: 'materi-utbk-penghambat',
          category: 'UTBK',
          title: 'Materi UTBK yang Paling Sering Jadi Penghambat Nilai Akhir Siswa',
          image: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=320&q=80',
          age: '2 jam lalu',
          author: 'Desk Pendidikan',
          excerpt: 'Bahasan bernalar, numerasi, dan konsistensi review sering jadi pembeda performa akhir peserta.',
          tags: ['UTBK', 'Materi', 'Skor'],
        }),
        createFallbackStory({
          slug: 'formasi-daerah-vs-pusat',
          category: 'Formasi',
          title: 'Formasi CPNS Daerah vs Pusat: Mana yang Lebih Kompetitif untuk Fresh Graduate',
          image: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=320&q=80',
          age: '2 jam lalu',
          author: 'Desk ASN',
          excerpt: 'Perbandingan tingkat persaingan, syarat, dan peluang lolos antara formasi pusat dan daerah.',
          tags: ['Formasi', 'CPNS', 'Fresh Graduate'],
        }),
        createFallbackStory({
          slug: 'membaca-aturan-asn',
          category: 'Regulasi',
          title: 'Cara Membaca Aturan Baru Seleksi ASN Tanpa Salah Tafsir',
          image: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=320&q=80',
          age: '3 jam lalu',
          author: 'Desk Regulasi',
          excerpt: 'Panduan membaca struktur aturan supaya pembaca fokus ke poin yang benar-benar memengaruhi seleksi.',
          tags: ['Regulasi', 'ASN', 'Panduan'],
        }),
        createFallbackStory({
          slug: 'passing-trend-kampus',
          category: 'Kampus',
          title: 'Top 5 Kampus dengan Passing Trend Tinggi untuk Peserta UTBK',
          image: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=320&q=80',
          age: '5 jam lalu',
          author: 'Desk Kampus',
          excerpt: 'Gambaran kampus favorit, minat tinggi, dan strategi menyusun opsi cadangan UTBK.',
          tags: ['Kampus', 'UTBK', 'Passing Grade'],
        }),
      ],
    },
    {
      slug: 'berita-terbaru',
      title: 'Berita Terbaru',
      description: 'Deretan update terbaru seputar CPNS, UTBK, regulasi, dan kampus.',
      layout_style: 'lead-grid',
      article_count: 6,
      items: [
        createFallbackStory({
          id: 'latest-cpns-1',
          slug: 'checklist-berkas-cpns',
          category: 'CPNS',
          title: 'Checklist Berkas CPNS: Dokumen yang Harus Siap Sebelum Portal Dibuka',
          excerpt: 'Contoh berita praktis untuk pelamar CPNS: susun dokumen, scan file, dan validasi syarat sebelum pendaftaran.',
          image: 'https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=1200&q=80',
          author: 'Redaksi CPNS',
          age: '1 jam lalu',
          tags: ['CPNS', 'Berkas', 'Pendaftaran'],
        }),
        createFallbackStory({
          id: 'latest-utbk-1',
          slug: 'jadwal-belajar-utbk-mingguan',
          category: 'UTBK',
          title: 'Jadwal Belajar UTBK Mingguan: Pola Latihan untuk Siswa Kelas 12',
          excerpt: 'Simulasi artikel UTBK tentang ritme belajar, evaluasi tryout, dan cara menaikkan konsistensi skor.',
          image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=720&q=80',
          author: 'Desk Pendidikan',
          age: '2 jam lalu',
          tags: ['UTBK', 'Jadwal Belajar', 'Tryout'],
        }),
        createFallbackStory({
          id: 'latest-formasi-1',
          slug: 'formasi-cpns-berdasarkan-jenjang',
          category: 'Formasi',
          title: 'Formasi CPNS untuk Lulusan SMA, D3, dan S1: Cara Membaca Peluang dengan Tepat',
          excerpt: 'Contoh konten peluang formasi CPNS berdasarkan jenjang pendidikan dan kecocokan jabatan.',
          image: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=720&q=80',
          author: 'Desk ASN',
          age: '2 jam lalu',
          tags: ['Formasi', 'CPNS', 'Pendidikan'],
        }),
        createFallbackStory({
          id: 'latest-regulasi-1',
          slug: 'arti-revisi-aturan-asn',
          category: 'Regulasi',
          title: 'Apa Arti Revisi Aturan ASN untuk Pelamar Baru dan Pegawai Pemerintah',
          excerpt: 'Simulasi artikel hukum dan regulasi yang menjelaskan perubahan aturan dengan bahasa lebih sederhana.',
          image: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=720&q=80',
          author: 'Desk Regulasi',
          age: '4 jam lalu',
          tags: ['Regulasi', 'ASN', 'Perubahan Aturan'],
        }),
        createFallbackStory({
          id: 'latest-kampus-1',
          slug: 'top-universitas-negeri-utbk',
          category: 'Kampus',
          title: 'Top 5 Universitas Negeri Favorit UTBK dan Strategi Memilih Cadangan Aman',
          excerpt: 'Contoh berita kampus untuk calon mahasiswa: bandingkan target ambisius dan opsi realistis saat memilih PTN.',
          image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=720&q=80',
          author: 'Desk Kampus',
          age: '5 jam lalu',
          tags: ['Kampus', 'UTBK', 'PTN'],
        }),
        createFallbackStory({
          id: 'latest-negara-1',
          slug: 'arah-kebijakan-negara-pendidikan-asn',
          category: 'Negara',
          title: 'Arah Kebijakan Negara terhadap Pendidikan dan Rekrutmen ASN Tahun Ini',
          excerpt: 'Simulasi artikel kebijakan nasional yang menghubungkan keputusan negara dengan sektor pendidikan dan rekrutmen.',
          image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=720&q=80',
          author: 'Desk Nasional',
          age: '6 jam lalu',
          tags: ['Negara', 'Pendidikan', 'ASN'],
        }),
      ],
    },
    {
      slug: 'pilihan-redaksi',
      title: 'Pilihan Redaksi',
      description: 'Kurasi artikel penting untuk CPNS dan UTBK.',
      layout_style: 'cards',
      article_count: 5,
      items: [
        createFallbackStory({
          id: 'editor-1',
          slug: 'target-belajar-skd-mingguan',
          category: 'CPNS',
          title: 'Cara Menyusun Target Belajar SKD Mingguan supaya Progres Terukur',
          image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=720&q=80',
          age: '3 jam lalu',
          author: 'Redaksi CPNS',
          excerpt: 'Target mingguan membuat evaluasi belajar CPNS lebih terukur dan tidak terlalu reaktif.',
          tags: ['CPNS', 'SKD', 'Belajar'],
        }),
        createFallbackStory({
          id: 'editor-2',
          slug: 'review-tryout-utbk',
          category: 'UTBK',
          title: 'Teknik Review Tryout UTBK agar Kesalahan Tidak Berulang',
          image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=720&q=80',
          age: '5 jam lalu',
          author: 'Desk Pendidikan',
          excerpt: 'Review tryout bukan hanya cek skor, tapi membaca pola salah dan keputusan waktu.',
          tags: ['UTBK', 'Tryout', 'Evaluasi'],
        }),
        createFallbackStory({
          id: 'editor-3',
          slug: 'glosarium-istilah-asn',
          category: 'Regulasi',
          title: 'Glosarium Istilah Aturan ASN untuk Pembaca Non-Hukum',
          image: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=720&q=80',
          age: '6 jam lalu',
          author: 'Desk Regulasi',
          excerpt: 'Istilah regulasi kerap bikin pembaca bingung, sehingga glosarium singkat jadi penting.',
          tags: ['Regulasi', 'ASN', 'Glosarium'],
        }),
        createFallbackStory({
          id: 'editor-4',
          slug: 'bandingkan-formasi-ramai-sepi',
          category: 'Formasi',
          title: 'Cara Membandingkan Formasi Ramai dan Sepi Peminat secara Lebih Rasional',
          image: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=720&q=80',
          age: '7 jam lalu',
          author: 'Desk ASN',
          excerpt: 'Pemilih formasi perlu lihat kecocokan syarat dan peluang, bukan angka peminat saja.',
          tags: ['Formasi', 'CPNS', 'Analisis'],
        }),
        createFallbackStory({
          id: 'editor-5',
          slug: 'kampus-target-tengah-aman',
          category: 'Kampus',
          title: 'Menyusun Daftar Kampus Target, Tengah, dan Aman untuk UTBK',
          image: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=720&q=80',
          age: '8 jam lalu',
          author: 'Desk Kampus',
          excerpt: 'Strategi tiga lapis membantu peserta UTBK membagi risiko pilihan kampus lebih masuk akal.',
          tags: ['Kampus', 'UTBK', 'Strategi'],
        }),
      ],
    },
  ],
};

function flattenUniqueStories(feed) {
  const storyMap = new Map();

  (feed?.sections || []).forEach((section) => {
    (section?.items || []).forEach((story) => {
      if (story?.slug && !storyMap.has(story.slug)) {
        storyMap.set(story.slug, story);
      }
    });
  });

  return Array.from(storyMap.values());
}

export function findFallbackArticleBySlug(slug) {
  const normalizedSlug = String(slug || '').trim();
  if (!normalizedSlug) {
    return null;
  }

  const stories = flattenUniqueStories(FALLBACK_NEWS_FEED);
  const story = stories.find((item) => item.slug === normalizedSlug);
  if (!story) {
    return null;
  }

  const relatedPool = stories.filter((item) => item.slug !== normalizedSlug);
  const relatedStories = relatedPool
    .filter((item) => item.category === story.category)
    .concat(relatedPool.filter((item) => item.category !== story.category))
    .slice(0, 4)
    .map((item) => ({
      id: item.id || item.slug,
      slug: item.slug,
      category: item.category,
      title: item.title,
      excerpt: item.excerpt,
      image: item.image,
      author: item.author || 'Tim Redaksi',
      age: item.age || 'Baru saja',
      readTime: item.readTime || '4 min',
    }));

  return {
    article: {
      id: story.id || story.slug,
      slug: story.slug,
      title: story.title,
      excerpt: story.excerpt,
      content: story.content,
      image: story.image,
      category: story.category,
      author: story.author || 'Tim Redaksi',
      age: story.age || 'Baru saja',
      readTime: story.readTime || '4 min',
      published_at: null,
      tags: story.tags || [],
      focus_keyword: story.tags?.[0] || story.category,
    },
    related_stories: relatedStories,
  };
}
