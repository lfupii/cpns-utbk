<?php

if (!function_exists('newsSeedEscape')) {
    function newsSeedEscape(string $value): string {
        return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
    }
}

if (!function_exists('buildDefaultNewsSeedContent')) {
    function buildDefaultNewsSeedContent(array $story): string {
        $points = is_array($story['bullets'] ?? null) && count($story['bullets']) > 0
            ? array_values(array_filter(array_map('strval', $story['bullets'])))
            : [
                sprintf(
                    'Ringkasan utama dari topik %s untuk pembaca CPNS UTBK.',
                    (string) ($story['category'] ?? 'Nasional')
                ),
                'Dampak ke strategi persiapan, pendaftaran, atau pemetaan peluang.',
                'Catatan lanjutan yang bisa diedit ulang penuh dari panel admin berita.',
            ];

        $safeExcerpt = newsSeedEscape(
            trim((string) ($story['excerpt'] ?? 'Konten simulasi berita belum memiliki ringkasan.'))
        );
        $safeCategory = newsSeedEscape((string) ($story['category'] ?? 'Nasional'));
        $pointMarkup = implode('', array_map(
            static fn(string $point): string => '<li>' . newsSeedEscape($point) . '</li>',
            $points
        ));

        return <<<HTML
<p>{$safeExcerpt}</p>
<p>Artikel contoh ini disiapkan untuk simulasi newsroom CPNS UTBK. Struktur section, thumbnail sampul, metadata, dan isi penuh dapat diubah dari workspace admin berita tanpa menyentuh kode frontend.</p>
<h2>Poin penting</h2>
<ul>{$pointMarkup}</ul>
<p>Jika nanti artikel ini sudah diganti dengan data produksi, slug, thumbnail, dan posisi section tetap mengikuti konfigurasi dari panel admin.</p>
<p>Fokus bahasan tetap diarahkan ke topik {$safeCategory} agar mudah dikembangkan lagi oleh editor.</p>
HTML;
    }
}

if (!function_exists('getDefaultNewsSeedFeed')) {
    function getDefaultNewsSeedFeed(): array {
        return [
            'sections' => [
                [
                    'slug' => 'sorotan-cpns-utbk',
                    'title' => 'Sorotan CPNS & UTBK',
                    'description' => 'Contoh section headline untuk tema CPNS, UTBK, formasi, dan kebijakan negara.',
                    'layout_style' => 'hero',
                    'article_count' => 6,
                    'items' => [
                        [
                            'slug' => 'cpns-2026',
                            'category' => 'CPNS',
                            'title' => 'Prediksi Formasi CPNS 2026: Instansi Pusat dan Daerah yang Paling Banyak Diburu',
                            'excerpt' => 'Contoh konten berita untuk simulasi halaman publik: fokus pada tren formasi, kebutuhan jabatan, dan strategi pelamar CPNS.',
                            'image' => 'https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?auto=format&fit=crop&w=1400&q=80',
                            'author' => 'Redaksi CPNS',
                            'read_time_minutes' => 5,
                            'published_offset_minutes' => 120,
                            'tags' => ['CPNS', 'Formasi', 'ASN'],
                            'bullets' => [
                                'Instansi pusat dan daerah biasanya ramai pada jabatan administrasi, teknis, dan digital.',
                                'Pelamar perlu membaca syarat jabatan dan jenjang pendidikan sejak awal.',
                                'Strategi memilih formasi penting untuk menekan persaingan yang terlalu padat.',
                            ],
                        ],
                        [
                            'slug' => 'utbk-strategi',
                            'category' => 'UTBK',
                            'title' => 'Strategi UTBK 2026: Cara Menyusun Jadwal Belajar 90 Hari Sebelum Ujian',
                            'excerpt' => 'Contoh berita edukatif untuk siswa UTBK: pembagian waktu latihan TPS, literasi, numerasi, dan evaluasi mingguan.',
                            'image' => 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=1400&q=80',
                            'author' => 'Desk Pendidikan',
                            'read_time_minutes' => 4,
                            'published_offset_minutes' => 37,
                            'tags' => ['UTBK', 'Belajar', 'PTN'],
                            'bullets' => [
                                'Minggu awal fokus pemetaan kemampuan dasar dan tryout baseline.',
                                'Minggu tengah untuk drilling numerasi, literasi, dan review kesalahan.',
                                'Minggu akhir dipakai untuk simulasi tempo ujian dan penguatan topik lemah.',
                            ],
                        ],
                        [
                            'slug' => 'formasi-prioritas',
                            'category' => 'Formasi',
                            'title' => 'Formasi CPNS Prioritas: Tenaga Teknis, Kesehatan, dan Digital Masih Dominan',
                            'excerpt' => 'Simulasi artikel terkait peluang formasi CPNS, kebutuhan nasional, dan jabatan yang sering jadi target pendaftar.',
                            'image' => 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1400&q=80',
                            'author' => 'Desk ASN',
                            'read_time_minutes' => 6,
                            'published_offset_minutes' => 60,
                            'tags' => ['Formasi', 'CPNS', 'Jabatan'],
                            'bullets' => [
                                'Formasi teknis dan digital cenderung naik seiring kebutuhan transformasi layanan.',
                                'Bidang kesehatan dan pelayanan publik tetap relevan pada banyak instansi.',
                                'Pelamar perlu cocokkan kompetensi dengan kebutuhan jabatan yang diumumkan.',
                            ],
                        ],
                        [
                            'slug' => 'regulasi-asn',
                            'category' => 'Regulasi',
                            'title' => 'Rangkuman Aturan Baru ASN dan Dampaknya ke Pola Rekrutmen CPNS',
                            'excerpt' => 'Contoh konten berita regulasi untuk pembaca CPNS: menyorot keputusan pemerintah, pembaruan aturan, dan implikasi seleksi.',
                            'image' => 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1400&q=80',
                            'author' => 'Desk Regulasi',
                            'read_time_minutes' => 3,
                            'published_offset_minutes' => 44,
                            'tags' => ['Regulasi', 'ASN', 'CPNS'],
                            'bullets' => [
                                'Aturan baru biasanya memengaruhi syarat, tahapan, atau penataan jabatan.',
                                'Pembaca perlu fokus pada pasal yang terkait rekrutmen dan kebutuhan formasi.',
                                'Bahasa aturan perlu diterjemahkan ke langkah praktis untuk pelamar.',
                            ],
                        ],
                        [
                            'slug' => 'kampus-terbaik',
                            'category' => 'Kampus',
                            'title' => 'Top 5 Universitas Incaran Jalur UTBK dan Tips Memilih Program Studi',
                            'excerpt' => 'Contoh artikel kampus untuk UTBK: membahas daya tampung, minat tinggi, dan cara memilih jurusan lebih realistis.',
                            'image' => 'https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=1400&q=80',
                            'author' => 'Desk Kampus',
                            'read_time_minutes' => 4,
                            'published_offset_minutes' => 28,
                            'tags' => ['Kampus', 'UTBK', 'PTN'],
                            'bullets' => [
                                'Target kampus perlu dibagi menjadi ambisius, tengah, dan aman.',
                                'Daya tampung dan tren peminat membantu membaca tingkat kompetisi.',
                                'Program studi harus selaras minat, bukan hanya reputasi kampus.',
                            ],
                        ],
                        [
                            'slug' => 'kebijakan-negara',
                            'category' => 'Negara',
                            'title' => 'Keputusan Negara dan Arah Belanja SDM Publik: Apa Dampaknya ke Formasi Baru',
                            'excerpt' => 'Contoh berita kebijakan negara yang relevan untuk pembaca CPNS: anggaran, prioritas pemerintah, dan rekrutmen aparatur.',
                            'image' => 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1400&q=80',
                            'author' => 'Desk Nasional',
                            'read_time_minutes' => 5,
                            'published_offset_minutes' => 53,
                            'tags' => ['Negara', 'Anggaran', 'CPNS'],
                            'bullets' => [
                                'Arah belanja SDM publik berpengaruh ke pembukaan dan prioritas formasi.',
                                'Keputusan fiskal dan program prioritas sering menentukan sektor yang diperkuat.',
                                'Pelamar perlu membaca tren kebijakan, bukan hanya pengumuman formasi akhir.',
                            ],
                        ],
                    ],
                ],
                [
                    'slug' => 'terpopuler',
                    'title' => 'Terpopuler',
                    'description' => 'Artikel paling sering dibaca pengunjung.',
                    'layout_style' => 'ranked',
                    'article_count' => 5,
                    'items' => [
                        [
                            'slug' => 'gagal-administrasi-cpns',
                            'category' => 'CPNS',
                            'title' => '7 Kesalahan Umum Saat Daftar CPNS yang Bikin Pelamar Gugur Administrasi',
                            'excerpt' => 'Kesalahan administrasi sering terjadi pada dokumen, format unggahan, dan ketidaksesuaian syarat formasi.',
                            'image' => 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=320&q=80',
                            'author' => 'Redaksi CPNS',
                            'published_offset_minutes' => 60,
                            'tags' => ['CPNS', 'Administrasi', 'Pendaftaran'],
                        ],
                        [
                            'slug' => 'materi-utbk-penghambat',
                            'category' => 'UTBK',
                            'title' => 'Materi UTBK yang Paling Sering Jadi Penghambat Nilai Akhir Siswa',
                            'excerpt' => 'Bahasan bernalar, numerasi, dan konsistensi review sering jadi pembeda performa akhir peserta.',
                            'image' => 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=320&q=80',
                            'author' => 'Desk Pendidikan',
                            'published_offset_minutes' => 120,
                            'tags' => ['UTBK', 'Materi', 'Skor'],
                        ],
                        [
                            'slug' => 'formasi-daerah-vs-pusat',
                            'category' => 'Formasi',
                            'title' => 'Formasi CPNS Daerah vs Pusat: Mana yang Lebih Kompetitif untuk Fresh Graduate',
                            'excerpt' => 'Perbandingan tingkat persaingan, syarat, dan peluang lolos antara formasi pusat dan daerah.',
                            'image' => 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=320&q=80',
                            'author' => 'Desk ASN',
                            'published_offset_minutes' => 120,
                            'tags' => ['Formasi', 'CPNS', 'Fresh Graduate'],
                        ],
                        [
                            'slug' => 'membaca-aturan-asn',
                            'category' => 'Regulasi',
                            'title' => 'Cara Membaca Aturan Baru Seleksi ASN Tanpa Salah Tafsir',
                            'excerpt' => 'Panduan membaca struktur aturan supaya pembaca fokus ke poin yang benar-benar memengaruhi seleksi.',
                            'image' => 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=320&q=80',
                            'author' => 'Desk Regulasi',
                            'published_offset_minutes' => 180,
                            'tags' => ['Regulasi', 'ASN', 'Panduan'],
                        ],
                        [
                            'slug' => 'passing-trend-kampus',
                            'category' => 'Kampus',
                            'title' => 'Top 5 Kampus dengan Passing Trend Tinggi untuk Peserta UTBK',
                            'excerpt' => 'Gambaran kampus favorit, minat tinggi, dan strategi menyusun opsi cadangan UTBK.',
                            'image' => 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=320&q=80',
                            'author' => 'Desk Kampus',
                            'published_offset_minutes' => 300,
                            'tags' => ['Kampus', 'UTBK', 'Passing Grade'],
                        ],
                    ],
                ],
                [
                    'slug' => 'berita-terbaru',
                    'title' => 'Berita Terbaru',
                    'description' => 'Deretan update terbaru seputar CPNS, UTBK, regulasi, dan kampus.',
                    'layout_style' => 'lead-grid',
                    'article_count' => 6,
                    'items' => [
                        [
                            'slug' => 'checklist-berkas-cpns',
                            'category' => 'CPNS',
                            'title' => 'Checklist Berkas CPNS: Dokumen yang Harus Siap Sebelum Portal Dibuka',
                            'excerpt' => 'Contoh berita praktis untuk pelamar CPNS: susun dokumen, scan file, dan validasi syarat sebelum pendaftaran.',
                            'image' => 'https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=1200&q=80',
                            'author' => 'Redaksi CPNS',
                            'published_offset_minutes' => 60,
                            'tags' => ['CPNS', 'Berkas', 'Pendaftaran'],
                        ],
                        [
                            'slug' => 'jadwal-belajar-utbk-mingguan',
                            'category' => 'UTBK',
                            'title' => 'Jadwal Belajar UTBK Mingguan: Pola Latihan untuk Siswa Kelas 12',
                            'excerpt' => 'Simulasi artikel UTBK tentang ritme belajar, evaluasi tryout, dan cara menaikkan konsistensi skor.',
                            'image' => 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=720&q=80',
                            'author' => 'Desk Pendidikan',
                            'published_offset_minutes' => 120,
                            'tags' => ['UTBK', 'Jadwal Belajar', 'Tryout'],
                        ],
                        [
                            'slug' => 'formasi-cpns-berdasarkan-jenjang',
                            'category' => 'Formasi',
                            'title' => 'Formasi CPNS untuk Lulusan SMA, D3, dan S1: Cara Membaca Peluang dengan Tepat',
                            'excerpt' => 'Contoh konten peluang formasi CPNS berdasarkan jenjang pendidikan dan kecocokan jabatan.',
                            'image' => 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=720&q=80',
                            'author' => 'Desk ASN',
                            'published_offset_minutes' => 120,
                            'tags' => ['Formasi', 'CPNS', 'Pendidikan'],
                        ],
                        [
                            'slug' => 'arti-revisi-aturan-asn',
                            'category' => 'Regulasi',
                            'title' => 'Apa Arti Revisi Aturan ASN untuk Pelamar Baru dan Pegawai Pemerintah',
                            'excerpt' => 'Simulasi artikel hukum dan regulasi yang menjelaskan perubahan aturan dengan bahasa lebih sederhana.',
                            'image' => 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=720&q=80',
                            'author' => 'Desk Regulasi',
                            'published_offset_minutes' => 240,
                            'tags' => ['Regulasi', 'ASN', 'Perubahan Aturan'],
                        ],
                        [
                            'slug' => 'top-universitas-negeri-utbk',
                            'category' => 'Kampus',
                            'title' => 'Top 5 Universitas Negeri Favorit UTBK dan Strategi Memilih Cadangan Aman',
                            'excerpt' => 'Contoh berita kampus untuk calon mahasiswa: bandingkan target ambisius dan opsi realistis saat memilih PTN.',
                            'image' => 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=720&q=80',
                            'author' => 'Desk Kampus',
                            'published_offset_minutes' => 300,
                            'tags' => ['Kampus', 'UTBK', 'PTN'],
                        ],
                        [
                            'slug' => 'arah-kebijakan-negara-pendidikan-asn',
                            'category' => 'Negara',
                            'title' => 'Arah Kebijakan Negara terhadap Pendidikan dan Rekrutmen ASN Tahun Ini',
                            'excerpt' => 'Simulasi artikel kebijakan nasional yang menghubungkan keputusan negara dengan sektor pendidikan dan rekrutmen.',
                            'image' => 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=720&q=80',
                            'author' => 'Desk Nasional',
                            'published_offset_minutes' => 360,
                            'tags' => ['Negara', 'Pendidikan', 'ASN'],
                        ],
                    ],
                ],
                [
                    'slug' => 'pilihan-redaksi',
                    'title' => 'Pilihan Redaksi',
                    'description' => 'Kurasi artikel penting untuk CPNS dan UTBK.',
                    'layout_style' => 'cards',
                    'article_count' => 5,
                    'items' => [
                        [
                            'slug' => 'target-belajar-skd-mingguan',
                            'category' => 'CPNS',
                            'title' => 'Cara Menyusun Target Belajar SKD Mingguan supaya Progres Terukur',
                            'excerpt' => 'Target mingguan membuat evaluasi belajar CPNS lebih terukur dan tidak terlalu reaktif.',
                            'image' => 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=720&q=80',
                            'author' => 'Redaksi CPNS',
                            'published_offset_minutes' => 180,
                            'tags' => ['CPNS', 'SKD', 'Belajar'],
                        ],
                        [
                            'slug' => 'review-tryout-utbk',
                            'category' => 'UTBK',
                            'title' => 'Teknik Review Tryout UTBK agar Kesalahan Tidak Berulang',
                            'excerpt' => 'Review tryout bukan hanya cek skor, tapi membaca pola salah dan keputusan waktu.',
                            'image' => 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=720&q=80',
                            'author' => 'Desk Pendidikan',
                            'published_offset_minutes' => 300,
                            'tags' => ['UTBK', 'Tryout', 'Evaluasi'],
                        ],
                        [
                            'slug' => 'glosarium-istilah-asn',
                            'category' => 'Regulasi',
                            'title' => 'Glosarium Istilah Aturan ASN untuk Pembaca Non-Hukum',
                            'excerpt' => 'Istilah regulasi kerap bikin pembaca bingung, sehingga glosarium singkat jadi penting.',
                            'image' => 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=720&q=80',
                            'author' => 'Desk Regulasi',
                            'published_offset_minutes' => 360,
                            'tags' => ['Regulasi', 'ASN', 'Glosarium'],
                        ],
                        [
                            'slug' => 'bandingkan-formasi-ramai-sepi',
                            'category' => 'Formasi',
                            'title' => 'Cara Membandingkan Formasi Ramai dan Sepi Peminat secara Lebih Rasional',
                            'excerpt' => 'Pemilih formasi perlu lihat kecocokan syarat dan peluang, bukan angka peminat saja.',
                            'image' => 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=720&q=80',
                            'author' => 'Desk ASN',
                            'published_offset_minutes' => 420,
                            'tags' => ['Formasi', 'CPNS', 'Analisis'],
                        ],
                        [
                            'slug' => 'kampus-target-tengah-aman',
                            'category' => 'Kampus',
                            'title' => 'Menyusun Daftar Kampus Target, Tengah, dan Aman untuk UTBK',
                            'excerpt' => 'Strategi tiga lapis membantu peserta UTBK membagi risiko pilihan kampus lebih masuk akal.',
                            'image' => 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=720&q=80',
                            'author' => 'Desk Kampus',
                            'published_offset_minutes' => 480,
                            'tags' => ['Kampus', 'UTBK', 'Strategi'],
                        ],
                    ],
                ],
            ],
        ];
    }
}
