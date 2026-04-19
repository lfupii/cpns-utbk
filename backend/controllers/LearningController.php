<?php
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../utils/TestWorkflow.php';
require_once __DIR__ . '/../utils/LearningContent.php';
require_once __DIR__ . '/../middleware/Response.php';

class LearningController {
    private $mysqli;

    public function __construct($mysqli) {
        $this->mysqli = $mysqli;
    }

    private function getPackage(int $packageId): array {
        $query = "SELECT tp.*, tc.name AS category_name
                  FROM test_packages tp
                  JOIN test_categories tc ON tc.id = tp.category_id
                  WHERE tp.id = ?
                  LIMIT 1";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('i', $packageId);
        $stmt->execute();
        $package = $stmt->get_result()->fetch_assoc();

        if (!$package) {
            throw new RuntimeException('Paket tidak ditemukan', 404);
        }

        return $package;
    }

    private function hasActiveAccess(int $userId, int $packageId, bool $isAdmin = false): bool {
        if ($isAdmin) {
            return true;
        }

        $query = "SELECT ua.id
                  FROM user_access ua
                  WHERE ua.user_id = ? AND ua.package_id = ? AND ua.access_status = 'active'
                    AND (ua.access_expires_at IS NULL OR ua.access_expires_at > NOW())
                  LIMIT 1";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('ii', $userId, $packageId);
        $stmt->execute();

        return (bool) $stmt->get_result()->fetch_assoc();
    }

    private function assertActiveAccess(int $userId, int $packageId, bool $isAdmin = false): void {
        if (!$this->hasActiveAccess($userId, $packageId, $isAdmin)) {
            throw new RuntimeException('Akses penuh materi tersedia setelah paket aktif.', 403);
        }
    }

    private function getOptionalTokenData(): ?array {
        $token = getBearerToken();
        if (!$token) {
            return null;
        }

        require_once __DIR__ . '/../utils/JWTHandler.php';
        $decoded = JWTHandler::verifyToken($token);
        return is_array($decoded) ? $decoded : null;
    }

    private function getAttemptStats(int $userId, int $packageId): array {
        $query = "SELECT
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_attempts,
                    SUM(CASE WHEN status = 'ongoing' THEN 1 ELSE 0 END) AS ongoing_attempts
                  FROM test_attempts
                  WHERE user_id = ? AND package_id = ?";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('ii', $userId, $packageId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc() ?: [];

        return [
            'completed_attempts' => (int) ($row['completed_attempts'] ?? 0),
            'ongoing_attempts' => (int) ($row['ongoing_attempts'] ?? 0),
        ];
    }

    private function getProgressMap(int $userId, int $packageId): array {
        $query = "SELECT section_code, milestone_type, metadata, completed_at
                  FROM learning_progress
                  WHERE user_id = ? AND package_id = ?";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('ii', $userId, $packageId);
        $stmt->execute();
        $result = $stmt->get_result();

        $progress = [];
        while ($row = $result->fetch_assoc()) {
            $sectionCode = (string) $row['section_code'];
            $milestoneType = (string) $row['milestone_type'];
            if (!isset($progress[$sectionCode])) {
                $progress[$sectionCode] = [];
            }

            $metadata = json_decode((string) ($row['metadata'] ?? ''), true);
            $progress[$sectionCode][$milestoneType] = [
                'completed_at' => $row['completed_at'],
                'metadata' => is_array($metadata) ? $metadata : null,
            ];
        }

        return $progress;
    }

    private function buildPage(string $title, array $points, string $closing): array {
        return [
            'title' => $title,
            'points' => $points,
            'closing' => $closing,
        ];
    }

    private function buildMaterialPages(array $package, array $section): array {
        $mode = TestWorkflow::detectMode($package);
        $code = (string) ($section['code'] ?? 'general');
        $name = (string) ($section['name'] ?? 'Materi');

        $templates = [
            'twk' => [
                $this->buildPage('Peta TWK', [
                    'Mulai dari Pancasila, UUD 1945, NKRI, Bhinneka Tunggal Ika, nasionalisme, dan integritas.',
                    'Biasakan membaca kata kunci pada soal: sesuai, tidak sesuai, pengecualian, dan implementasi nilai.',
                    'Untuk hafalan pasal, catat fungsi besarnya dulu sebelum masuk ke nomor pasal.',
                ], 'Target awal TWK adalah memahami hubungan nilai, aturan, dan contoh perilaku.'),
                $this->buildPage('Pancasila dan Konstitusi', [
                    'Pancasila sering muncul sebagai nilai dasar, etika penyelenggara negara, dan sikap warga negara.',
                    'UUD 1945 dibaca sebagai kerangka lembaga negara, hak warga, kewajiban, dan mekanisme pemerintahan.',
                    'Latih pembedaan antara nilai ideal, aturan normatif, dan penerapan di kasus singkat.',
                ], 'Jika ragu, tarik soal ke prinsip dasar: persatuan, keadilan, musyawarah, dan kepentingan publik.'),
                $this->buildPage('NKRI dan Bhinneka Tunggal Ika', [
                    'NKRI menekankan persatuan wilayah, kedaulatan, dan kepentingan nasional.',
                    'Bhinneka Tunggal Ika menguji toleransi, kolaborasi lintas latar, dan anti-diskriminasi.',
                    'Waspadai opsi yang tampak tegas tetapi mengabaikan hukum, persatuan, atau hak warga.',
                ], 'Jawaban TWK yang kuat biasanya seimbang: konstitusional, inklusif, dan berpihak pada negara.'),
                $this->buildPage('Strategi Soal TWK', [
                    'Baca pertanyaan sebelum studi kasus agar tahu nilai apa yang dicari.',
                    'Coret opsi yang ekstrem, diskriminatif, atau mengutamakan kepentingan pribadi.',
                    'Ulang materi dengan membuat contoh kasus sendiri untuk tiap sila dan prinsip kebangsaan.',
                ], 'Selesaikan sesi ini dengan mini test TWK untuk mengunci milestone belajar.'),
            ],
            'tiu' => [
                $this->buildPage('Peta TIU', [
                    'TIU mengukur kemampuan verbal, numerik, logika, dan analitis.',
                    'Kelompokkan soal: sinonim/antonim, analogi, silogisme, deret, hitungan, dan figural.',
                    'Catat tipe yang paling sering membuat waktu habis, lalu latih terpisah.',
                ], 'TIU bukan hanya hafalan rumus, tapi kebiasaan melihat pola.'),
                $this->buildPage('Verbal dan Logika', [
                    'Untuk verbal, cari hubungan makna yang paling spesifik, bukan sekadar kata yang terasa mirip.',
                    'Untuk silogisme, ubah kalimat ke bentuk himpunan atau panah sebab-akibat.',
                    'Jangan menarik kesimpulan dari informasi yang tidak disebutkan di premis.',
                ], 'Kunci logika adalah disiplin pada data yang diberikan.'),
                $this->buildPage('Numerik dan Deret', [
                    'Cek operasi dasar: tambah, kurang, kali, bagi, kuadrat, dan pola selang-seling.',
                    'Pada soal persen, pecah angka ke bentuk yang mudah dihitung mental.',
                    'Jika hitungan terlalu panjang, cari opsi yang bisa dieliminasi dengan estimasi.',
                ], 'Tujuan latihan numerik adalah cepat memilih metode, bukan menghitung paling panjang.'),
                $this->buildPage('Strategi Soal TIU', [
                    'Kerjakan tipe yang paling stabil lebih dulu jika mode test mengizinkan navigasi bebas.',
                    'Sisakan tanda untuk soal panjang agar bisa kembali setelah poin mudah aman.',
                    'Gunakan mini test TIU untuk mengecek apakah akurasi masih turun saat dibatasi waktu.',
                ], 'Milestone TIU selesai setelah materi dibaca dan mini test subtest dikerjakan.'),
            ],
            'tkp' => [
                $this->buildPage('Peta TKP', [
                    'TKP menguji pelayanan publik, jejaring kerja, sosial budaya, profesionalisme, dan teknologi informasi.',
                    'Pilih jawaban yang matang, etis, komunikatif, dan tetap mengikuti aturan.',
                    'Hindari opsi pasif, emosional, menyalahkan orang lain, atau mengambil jalan pintas.',
                ], 'TKP mencari kualitas respons, bukan benar-salah tunggal seperti TIU.'),
                $this->buildPage('Pelayanan dan Profesionalisme', [
                    'Utamakan kepentingan masyarakat dan penyelesaian masalah secara tertib.',
                    'Ketika ada konflik, pilih komunikasi terbuka, bukti yang jelas, dan eskalasi sesuai prosedur.',
                    'Jawaban terbaik biasanya aktif membantu tanpa melanggar kewenangan.',
                ], 'Bayangkan posisi ASN yang tenang, akuntabel, dan solutif.'),
                $this->buildPage('Sosial Budaya dan Jejaring', [
                    'Sikap inklusif lebih kuat daripada memaksa keseragaman.',
                    'Kolaborasi yang baik menghargai perbedaan, membagi peran, dan menjaga tujuan bersama.',
                    'Pada dilema tim, pilih opsi yang memperbaiki koordinasi tanpa mempermalukan pihak lain.',
                ], 'TKP sering menguji kedewasaan sikap dalam situasi tidak ideal.'),
                $this->buildPage('Strategi Soal TKP', [
                    'Urutkan opsi dari paling pasif ke paling proaktif dan etis.',
                    'Bandingkan dua opsi terbaik dari sisi dampak, aturan, dan komunikasi.',
                    'Gunakan mini test TKP untuk membiasakan diri membaca nuansa pilihan jawaban.',
                ], 'Selesaikan materi lalu mini test agar milestone TKP tercentang.'),
            ],
        ];

        $utbkTemplates = [
            'penalaran' => [
                $this->buildPage('Peta Penalaran', [
                    'Fokus pada pola hubungan, kesimpulan, kecukupan data, dan konsistensi informasi.',
                    'Pisahkan fakta, asumsi, dan inferensi sebelum memilih jawaban.',
                    'Untuk kuantitatif, cek apakah soal meminta nilai pasti atau cukup-tidaknya informasi.',
                ], 'Penalaran kuat dimulai dari membaca struktur soal, bukan memburu rumus.'),
                $this->buildPage('Membaca Pola', [
                    'Cari pola perubahan, kategori, hubungan sebab-akibat, atau perbandingan.',
                    'Buat notasi singkat untuk premis agar tidak perlu membaca ulang seluruh paragraf.',
                    'Eliminasi opsi yang menambahkan informasi baru di luar soal.',
                ], 'Jawaban yang sah harus lahir dari data yang tersedia.'),
                $this->buildPage('Kuantitatif Ringkas', [
                    'Gunakan estimasi untuk menyingkirkan opsi yang terlalu jauh.',
                    'Ubah persen, rasio, dan pecahan ke bentuk yang paling mudah dibandingkan.',
                    'Pada kecukupan data, nilai apakah informasi cukup, bukan apakah perhitungan terasa panjang.',
                ], 'Latihan terbaik adalah memilih strategi tercepat untuk tipe yang sama.'),
                $this->buildPage('Strategi Subtest', [
                    'Jangan terpaku di satu soal penalaran yang panjang.',
                    'Tandai jebakan: selalu, pasti, semua, tidak ada, dan hanya jika.',
                    'Akhiri dengan mini test subtest untuk mengunci ritme pengerjaan.',
                ], 'Milestone subtest selesai setelah bacaan dan mini test selesai.'),
            ],
            'literasi' => [
                $this->buildPage('Peta Literasi', [
                    'Literasi menguji pemahaman gagasan utama, detail, inferensi, sikap penulis, dan hubungan antarparagraf.',
                    'Baca pertanyaan dulu jika teks panjang agar fokus pada informasi yang dicari.',
                    'Bedakan jawaban yang benar menurut teks dengan jawaban yang benar menurut pengetahuan umum.',
                ], 'Pegangan utama literasi selalu kembali ke bukti dalam teks.'),
                $this->buildPage('Gagasan dan Detail', [
                    'Gagasan utama biasanya menjawab topik besar dan arah pembahasan.',
                    'Detail pendukung harus cocok dengan kalimat di teks, bukan hanya mirip kata.',
                    'Untuk bahasa Inggris, pahami konteks kalimat sebelum menerjemahkan kata kunci.',
                ], 'Jangan memilih opsi yang benar sebagian tetapi mengubah maksud teks.'),
                $this->buildPage('Inferensi dan Sikap Penulis', [
                    'Inferensi adalah kesimpulan wajar dari teks, bukan spekulasi baru.',
                    'Sikap penulis terlihat dari pilihan kata, struktur argumen, dan penekanan.',
                    'Hubungan paragraf bisa berupa sebab-akibat, contoh, pertentangan, atau penjelasan ulang.',
                ], 'Latih membaca bukti kecil yang menentukan arah jawaban.'),
                $this->buildPage('Strategi Subtest', [
                    'Jika teks panjang, kerjakan soal detail setelah menemukan lokasi paragrafnya.',
                    'Coret opsi yang terlalu umum, terlalu sempit, atau tidak didukung teks.',
                    'Gunakan mini test literasi untuk melatih stamina membaca.',
                ], 'Milestone literasi selesai setelah materi dan mini test beres.'),
            ],
            'matematika' => [
                $this->buildPage('Peta Penalaran Matematika', [
                    'Fokus pada aljabar dasar, fungsi, geometri, peluang, statistika, rasio, dan interpretasi data.',
                    'Tuliskan apa yang diketahui dan yang ditanya sebelum memilih rumus.',
                    'Banyak soal menguji penalaran dari konteks, bukan substitusi angka mentah.',
                ], 'Matematika UTBK perlu rapi membaca konteks dan hemat langkah.'),
                $this->buildPage('Model dan Data', [
                    'Ubah cerita menjadi persamaan, tabel kecil, atau diagram sederhana.',
                    'Pada grafik, cek satuan, interval, tren, dan nilai ekstrem.',
                    'Pada statistika, pahami beda rata-rata, median, modus, jangkauan, dan perubahan data.',
                ], 'Representasi yang tepat biasanya memangkas separuh kerja hitung.'),
                $this->buildPage('Strategi Hitung', [
                    'Pilih angka mudah untuk mengecek pola jika soal berbentuk umum.',
                    'Gunakan estimasi ketika opsi berjauhan.',
                    'Jangan lanjut hitungan panjang sebelum yakin model matematikanya benar.',
                ], 'Akurasi naik saat langkah awal tidak buru-buru.'),
                $this->buildPage('Strategi Subtest', [
                    'Pisahkan soal cepat, sedang, dan panjang sejak membaca pertama.',
                    'Kembalikan semua jawaban ke konteks: satuan, rentang, dan logika hasil.',
                    'Akhiri dengan mini test penalaran matematika untuk menutup milestone.',
                ], 'Milestone selesai saat materi dibaca dan mini test subtest dikerjakan.'),
            ],
        ];

        if (isset($templates[$code])) {
            return $templates[$code];
        }

        if ($mode === TestWorkflow::MODE_UTBK_SECTIONED) {
            $lowerName = strtolower($code . ' ' . $name);
            if (strpos($lowerName, 'literasi') !== false || strpos($lowerName, 'ppu') !== false || strpos($lowerName, 'pbm') !== false) {
                return $utbkTemplates['literasi'];
            }
            if (strpos($lowerName, 'matematika') !== false || strpos($lowerName, 'kuantitatif') !== false || strpos($lowerName, 'pk') !== false) {
                return $utbkTemplates['matematika'];
            }

            return $utbkTemplates['penalaran'];
        }

        return [
            $this->buildPage('Peta ' . $name, [
                'Kenali tipe soal utama dan target kemampuan yang diuji.',
                'Buat catatan pendek berisi rumus, konsep, atau pola pilihan jawaban yang sering muncul.',
                'Latih soal bertahap dari mudah ke sedang sebelum masuk simulasi penuh.',
            ], 'Mulai dari gambaran besar, lalu kunci detail yang paling sering keluar.'),
            $this->buildPage('Konsep Dasar', [
                'Pisahkan definisi, contoh, dan pengecualian.',
                'Gunakan latihan singkat untuk menguji apakah konsep sudah bisa diterapkan.',
                'Catat kesalahan yang berulang agar target belajar berikutnya jelas.',
            ], 'Konsep dianggap kuat jika kamu bisa menjelaskan ulang dengan kata sendiri.'),
            $this->buildPage('Strategi Pengerjaan', [
                'Baca pertanyaan lebih dulu agar fokus pada kebutuhan soal.',
                'Eliminasi opsi yang tidak sesuai data.',
                'Atur waktu agar tidak terkunci pada satu soal panjang.',
            ], 'Strategi yang stabil akan terasa saat masuk mini test.'),
            $this->buildPage('Penutup Subtest', [
                'Ulang ringkasan konsep sebelum mengerjakan test subtest.',
                'Gunakan hasil mini test untuk menentukan materi yang perlu dibaca ulang.',
                'Simpan catatan kecil dari kesalahan paling penting.',
            ], 'Milestone selesai setelah materi dan mini test dituntaskan.'),
        ];
    }

    private function getSectionQuestionCounts(int $packageId): array {
        $query = "SELECT section_code, COUNT(*) AS total
                  FROM learning_section_questions
                  WHERE package_id = ?
                  GROUP BY section_code";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('i', $packageId);
        $stmt->execute();
        $result = $stmt->get_result();

        $counts = [];
        while ($row = $result->fetch_assoc()) {
            $counts[(string) ($row['section_code'] ?? '')] = (int) ($row['total'] ?? 0);
        }

        return $counts;
    }

    private function buildLearningSections(array $package, array $workflow, array $progress, bool $hasAccess): array {
        $sectionQuestionCounts = $this->getSectionQuestionCounts((int) ($package['id'] ?? 0));
        $sections = [];
        foreach ($workflow['sections'] as $section) {
            $sectionCode = (string) $section['code'];
            $material = $this->getMaterialContent($package, $workflow, $section);
            $allTopics = $material['topics'];
            $allPages = $this->flattenMaterialTopics($allTopics);
            $previewPageCount = min(2, count($allPages));
            $visibleTopics = $hasAccess
                ? $this->decorateMaterialTopics($allTopics)
                : $this->limitMaterialTopicsForAccess($allTopics, $previewPageCount);
            $visiblePages = $this->flattenMaterialTopics($visibleTopics);
            $sectionProgress = $progress[$sectionCode] ?? [];

            $sections[] = [
                'code' => $sectionCode,
                'name' => $section['name'],
                'session_name' => $section['session_name'] ?? null,
                'session_order' => $section['session_order'] ?? 1,
                'order' => $section['order'],
                'duration_minutes' => $section['duration_minutes'] ?? null,
                'target_question_count' => $section['target_question_count'] ?? null,
                'mini_test_question_count' => (int) ($sectionQuestionCounts[$sectionCode] ?? 0),
                'preview_page_count' => $previewPageCount,
                'total_topic_count' => count($allTopics),
                'visible_topic_count' => count($visibleTopics),
                'total_page_count' => count($allPages),
                'visible_page_count' => count($visiblePages),
                'locked_page_count' => max(0, count($allPages) - count($visiblePages)),
                'has_full_access' => $hasAccess,
                'material' => [
                    'title' => $material['title'],
                    'topics' => $visibleTopics,
                    'status' => $material['status'],
                    'is_draft_preview' => false,
                ],
                'pages' => $visiblePages,
                'progress' => [
                    'material_read' => isset($sectionProgress['material_read']),
                    'material_read_at' => $sectionProgress['material_read']['completed_at'] ?? null,
                    'subtest_test_completed' => isset($sectionProgress['subtest_test_completed']),
                    'subtest_test_completed_at' => $sectionProgress['subtest_test_completed']['completed_at'] ?? null,
                    'subtest_test_result' => $sectionProgress['subtest_test_completed']['metadata'] ?? null,
                ],
            ];
        }

        return $sections;
    }

    private function buildFallbackMaterialPage(string $title, string $point = 'Materi sedang disiapkan.'): array {
        return [
            'title' => $title,
            'points' => [$point],
            'closing' => '',
            'content_html' => '',
        ];
    }

    private function hydrateMaterialPages(array $pages, bool $allowEmpty = false): array {
        $normalized = [];
        foreach ($pages as $index => $page) {
            if (!is_array($page)) {
                continue;
            }

            $points = $page['points'] ?? [];
            if (!is_array($points)) {
                $points = array_filter(array_map('trim', explode("\n", (string) $points)));
            }

            $contentHtml = trim((string) ($page['content_html'] ?? ''));
            if (count($points) === 0 && $contentHtml !== '') {
                $plainText = trim(preg_replace('/\s+/', "\n", strip_tags($contentHtml)) ?? '');
                $points = array_values(array_filter(array_map('trim', explode("\n", $plainText))));
            }

            if (count($points) === 0 && $contentHtml === '') {
                $points = ['Materi sedang disiapkan.'];
            }

            $normalized[] = [
                'title' => trim((string) ($page['title'] ?? '')) ?: 'Halaman ' . ($index + 1),
                'points' => array_values(array_filter(array_map(static function ($point): string {
                    return trim((string) $point);
                }, $points))),
                'closing' => trim((string) ($page['closing'] ?? '')),
                'content_html' => $contentHtml,
            ];
        }

        if (count($normalized) > 0) {
            return $normalized;
        }

        if ($allowEmpty) {
            return [];
        }

        return [
            $this->buildFallbackMaterialPage('Halaman 1'),
        ];
    }

    private function buildTopicsFromPages(array $pages): array {
        $hydratedPages = $this->hydrateMaterialPages($pages);
        $topics = [];

        foreach ($hydratedPages as $index => $page) {
            $topics[] = [
                'title' => trim((string) ($page['title'] ?? '')) ?: 'Topik ' . ($index + 1),
                'pages' => [$page],
            ];
        }

        return $topics;
    }

    private function hydrateMaterialTopics($payload, array $fallbackPages = []): array {
        $hasExplicitTopics = is_array($payload) && array_key_exists('topics', $payload) && is_array($payload['topics']);

        if ($hasExplicitTopics) {
            $topics = $payload['topics'];
        } elseif (is_array($payload) && array_values($payload) === $payload) {
            $topics = $this->buildTopicsFromPages($payload);
        } else {
            $topics = $this->buildTopicsFromPages($fallbackPages);
        }

        $normalized = [];
        foreach ($topics as $index => $topic) {
            if (!is_array($topic)) {
                continue;
            }

            $normalized[] = [
                'title' => trim((string) ($topic['title'] ?? '')) ?: 'Topik ' . ($index + 1),
                'pages' => $this->hydrateMaterialPages(is_array($topic['pages'] ?? null) ? $topic['pages'] : [], true),
            ];
        }

        if (count($normalized) > 0) {
            return $normalized;
        }

        if ($hasExplicitTopics) {
            return [];
        }

        return $this->buildTopicsFromPages($fallbackPages);
    }

    private function decorateMaterialTopics(array $topics): array {
        return array_map(static function (array $topic, int $index): array {
            $pageCount = count($topic['pages'] ?? []);
            return [
                'title' => $topic['title'],
                'topic_index' => $index,
                'page_count' => $pageCount,
                'total_page_count' => $pageCount,
                'visible_page_count' => $pageCount,
                'locked_page_count' => 0,
                'pages' => $topic['pages'],
            ];
        }, $topics, array_keys($topics));
    }

    private function limitMaterialTopicsForAccess(array $topics, int $visiblePageLimit): array {
        $remaining = max(0, $visiblePageLimit);
        $visibleTopics = [];

        foreach ($topics as $index => $topic) {
            if ($remaining <= 0) {
                break;
            }

            $pages = $topic['pages'] ?? [];
            $visiblePages = array_slice($pages, 0, $remaining);
            $visibleCount = count($visiblePages);
            if ($visibleCount === 0) {
                continue;
            }

            $totalPageCount = count($pages);
            $visibleTopics[] = [
                'title' => $topic['title'],
                'topic_index' => $index,
                'page_count' => $totalPageCount,
                'total_page_count' => $totalPageCount,
                'visible_page_count' => $visibleCount,
                'locked_page_count' => max(0, $totalPageCount - $visibleCount),
                'pages' => $visiblePages,
            ];
            $remaining -= $visibleCount;
        }

        return $visibleTopics;
    }

    private function flattenMaterialTopics(array $topics): array {
        $pages = [];
        foreach ($topics as $topic) {
            foreach (($topic['pages'] ?? []) as $page) {
                $pages[] = $page;
            }
        }

        return $pages;
    }

    private function getMaterialContent(array $package, array $workflow, array $section): array {
        $packageId = (int) ($package['id'] ?? 0);
        $sectionCode = (string) ($section['code'] ?? '');
        $defaultMaterialPayload = LearningContent::defaultMaterialContent($section, (string) ($workflow['mode'] ?? ''));
        $defaultPages = LearningContent::defaultMaterialPages($section, (string) ($workflow['mode'] ?? ''));
        $defaultTopics = $this->hydrateMaterialTopics($defaultMaterialPayload, []);

        if ($packageId > 0 && $sectionCode !== '') {
            $query = "SELECT title, content_json
                      FROM learning_materials
                      WHERE package_id = ? AND section_code = ?
                      LIMIT 1";
            $stmt = $this->mysqli->prepare($query);
            $stmt->bind_param('is', $packageId, $sectionCode);
            $stmt->execute();
            $row = $stmt->get_result()->fetch_assoc();
            $materialPayload = json_decode((string) ($row['content_json'] ?? ''), true);
            if (is_array($materialPayload) && count($materialPayload) > 0) {
                return [
                    'title' => trim((string) ($row['title'] ?? '')) ?: (string) ($section['name'] ?? 'Materi'),
                    'topics' => $this->hydrateMaterialTopics($materialPayload, $defaultPages),
                    'status' => 'published',
                ];
            }
        }

        return [
            'title' => (string) ($section['name'] ?? 'Materi'),
            'topics' => $defaultTopics,
            'status' => 'published',
        ];
    }

    private function upsertProgress(int $userId, int $packageId, string $sectionCode, string $milestoneType, ?array $metadata = null): void {
        $allowedTypes = ['material_read', 'subtest_test_completed'];
        if (!in_array($milestoneType, $allowedTypes, true)) {
            throw new RuntimeException('Tipe milestone tidak valid', 422);
        }

        $metadataJson = $metadata ? json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null;
        $query = "INSERT INTO learning_progress (user_id, package_id, section_code, milestone_type, metadata)
                  VALUES (?, ?, ?, ?, ?)
                  ON DUPLICATE KEY UPDATE
                    metadata = VALUES(metadata),
                    completed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('iisss', $userId, $packageId, $sectionCode, $milestoneType, $metadataJson);
        $stmt->execute();
    }

    private function sectionExists(array $workflow, string $sectionCode): bool {
        foreach ($workflow['sections'] as $section) {
            if ((string) ($section['code'] ?? '') === $sectionCode) {
                return true;
            }
        }

        return false;
    }

    private function getWorkflowSection(array $workflow, string $sectionCode): ?array {
        foreach ($workflow['sections'] as $section) {
            if ((string) ($section['code'] ?? '') === $sectionCode) {
                return $section;
            }
        }

        return null;
    }

    private function getSectionTestQuestionCount(int $packageId, string $sectionCode): int {
        $stmt = $this->mysqli->prepare(
            'SELECT COUNT(*) AS total FROM learning_section_questions WHERE package_id = ? AND section_code = ?'
        );
        $stmt->bind_param('is', $packageId, $sectionCode);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();

        return (int) ($row['total'] ?? 0);
    }

    private function computeSectionTestDurationSeconds(array $section, int $questionCount): int {
        $totalQuestions = max(0, $questionCount);
        $durationMinutes = max(0, (float) ($section['duration_minutes'] ?? 0));
        $targetQuestionCount = max(0, (int) ($section['target_question_count'] ?? 0));

        if ($durationMinutes > 0 && $targetQuestionCount > 0 && $totalQuestions > 0) {
            $estimatedSeconds = (int) round(($durationMinutes * 60 * $totalQuestions) / $targetQuestionCount);
            return max(180, $estimatedSeconds);
        }

        if ($durationMinutes > 0) {
            return max(180, (int) round($durationMinutes * 60));
        }

        return max(300, $totalQuestions * 90);
    }

    private function getSectionTestQuestions(int $packageId, string $sectionCode): array {
        $query = "SELECT q.id, q.question_text, q.question_image_url, q.section_code,
                         GROUP_CONCAT(
                            JSON_OBJECT(
                                'id', qo.id,
                                'letter', qo.option_letter,
                                'text', qo.option_text,
                                'image_url', qo.option_image_url
                            )
                            ORDER BY qo.id SEPARATOR ','
                         ) AS options
                  FROM learning_section_questions q
                  LEFT JOIN learning_section_question_options qo ON qo.question_id = q.id
                  WHERE q.package_id = ? AND q.section_code = ?
                  GROUP BY q.id
                  ORDER BY q.question_order ASC, q.id ASC";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('is', $packageId, $sectionCode);
        $stmt->execute();
        $result = $stmt->get_result();

        $questions = [];
        while ($row = $result->fetch_assoc()) {
            $row['id'] = (int) $row['id'];
            $row['options'] = $row['options'] ? json_decode('[' . $row['options'] . ']', true) : [];
            $questions[] = $row;
        }

        return $questions;
    }

    private function getSectionTestQuestion(int $packageId, string $sectionCode, int $questionId): ?array {
        $stmt = $this->mysqli->prepare(
            'SELECT id, package_id, section_code
             FROM learning_section_questions
             WHERE id = ? AND package_id = ? AND section_code = ?
             LIMIT 1'
        );
        $stmt->bind_param('iis', $questionId, $packageId, $sectionCode);
        $stmt->execute();
        $question = $stmt->get_result()->fetch_assoc();

        return $question ?: null;
    }

    private function getSectionTestOptionCorrectness(int $questionId, int $optionId): int {
        $stmt = $this->mysqli->prepare(
            'SELECT is_correct
             FROM learning_section_question_options
             WHERE id = ? AND question_id = ?
             LIMIT 1'
        );
        $stmt->bind_param('ii', $optionId, $questionId);
        $stmt->execute();
        $option = $stmt->get_result()->fetch_assoc();

        if (!$option) {
            throw new RuntimeException('Pilihan jawaban tidak sesuai dengan soal mini test', 422);
        }

        return (int) ($option['is_correct'] ?? 0);
    }

    private function getOngoingSectionTestAttempt(int $userId, int $packageId, string $sectionCode): ?array {
        $stmt = $this->mysqli->prepare(
            "SELECT *
             FROM learning_section_test_attempts
             WHERE user_id = ? AND package_id = ? AND section_code = ? AND status = 'ongoing'
             ORDER BY id DESC
             LIMIT 1"
        );
        $stmt->bind_param('iis', $userId, $packageId, $sectionCode);
        $stmt->execute();
        $attempt = $stmt->get_result()->fetch_assoc();

        return $attempt ?: null;
    }

    private function getSectionTestAttemptForUser(int $attemptId, int $userId, bool $forUpdate = false): ?array {
        $query = "SELECT *
                  FROM learning_section_test_attempts
                  WHERE id = ? AND user_id = ?
                  LIMIT 1";
        if ($forUpdate) {
            $query .= ' FOR UPDATE';
        }

        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('ii', $attemptId, $userId);
        $stmt->execute();
        $attempt = $stmt->get_result()->fetch_assoc();

        return $attempt ?: null;
    }

    private function decodeSectionTestAnswers(?string $raw): array {
        $decoded = json_decode((string) ($raw ?? ''), true);
        if (!is_array($decoded)) {
            return [];
        }

        $answers = [];
        foreach ($decoded as $questionId => $optionId) {
            $normalizedQuestionId = (int) $questionId;
            $normalizedOptionId = (int) $optionId;
            if ($normalizedQuestionId > 0 && $normalizedOptionId > 0) {
                $answers[(string) $normalizedQuestionId] = $normalizedOptionId;
            }
        }

        return $answers;
    }

    private function decodeSectionTestReviewFlags(?string $raw): array {
        $decoded = json_decode((string) ($raw ?? ''), true);
        if (!is_array($decoded)) {
            return [];
        }

        $reviewFlags = [];
        foreach ($decoded as $questionId => $isMarkedReview) {
            $normalizedQuestionId = (int) $questionId;
            if ($normalizedQuestionId > 0 && filter_var($isMarkedReview, FILTER_VALIDATE_BOOLEAN)) {
                $reviewFlags[(string) $normalizedQuestionId] = true;
            }
        }

        return $reviewFlags;
    }

    private function hasSectionTestAnsweredQuestion(array $answers, int $questionId): bool {
        return isset($answers[(string) $questionId]) && (int) $answers[(string) $questionId] > 0;
    }

    private function assertNoPendingSectionTestReviewFlags(array $reviewFlags, string $actionLabel): void {
        if (count($reviewFlags) > 0) {
            throw new RuntimeException(
                'Masih ada soal mini test bertanda ragu-ragu. Matikan status ragu-ragu sebelum ' . strtolower($actionLabel) . '.',
                409
            );
        }
    }

    private function decodeSectionTestResult(?string $raw): ?array {
        $decoded = json_decode((string) ($raw ?? ''), true);
        if (!is_array($decoded)) {
            return null;
        }

        return [
            'score' => round((float) ($decoded['score'] ?? 0), 2),
            'correct_answers' => (int) ($decoded['correct_answers'] ?? 0),
            'total_questions' => (int) ($decoded['total_questions'] ?? 0),
            'answered_count' => (int) ($decoded['answered_count'] ?? 0),
            'time_taken' => (int) ($decoded['time_taken'] ?? 0),
        ];
    }

    private function computeSectionTestAttemptState(array $attempt, int $durationSeconds, ?int $nowTimestamp = null): array {
        $now = $nowTimestamp ?? time();
        $startTime = strtotime((string) ($attempt['start_time'] ?? 'now'));
        if ($startTime === false) {
            $startTime = $now;
        }

        $safeDurationSeconds = max(0, $durationSeconds);
        $elapsedSeconds = max(0, $now - $startTime);
        $remainingSeconds = max(0, $safeDurationSeconds - $elapsedSeconds);
        $isExpired = $safeDurationSeconds > 0 && $remainingSeconds <= 0;

        return [
            'started_at' => date(DATE_ATOM, $startTime),
            'server_time' => date(DATE_ATOM, $now),
            'elapsed_seconds' => $elapsedSeconds,
            'remaining_seconds' => $remainingSeconds,
            'total_duration_seconds' => $safeDurationSeconds,
            'is_expired' => $isExpired,
        ];
    }

    private function buildSectionTestPayload(array $attempt, array $questions, array $section): array {
        $durationSeconds = (int) ($attempt['duration_seconds'] ?? 0);
        $savedAnswers = $this->decodeSectionTestAnswers($attempt['answers_json'] ?? null);
        $reviewFlags = $this->decodeSectionTestReviewFlags($attempt['review_flags_json'] ?? null);
        $result = $this->decodeSectionTestResult($attempt['result_json'] ?? null);

        return [
            'attempt_id' => (int) $attempt['id'],
            'package_id' => (int) $attempt['package_id'],
            'section_code' => (string) ($attempt['section_code'] ?? ''),
            'section' => $section,
            'questions' => $questions,
            'saved_answers' => $savedAnswers,
            'review_flags' => $reviewFlags,
            'result' => $result,
            'attempt' => [
                'id' => (int) $attempt['id'],
                'status' => (string) ($attempt['status'] ?? ''),
                'start_time' => $attempt['start_time'] ?? null,
                'state' => $this->computeSectionTestAttemptState($attempt, $durationSeconds),
                'answered_count' => count($savedAnswers),
            ],
        ];
    }

    private function persistSectionTestAnswers(
        int $attemptId,
        int $packageId,
        string $sectionCode,
        array $existingAnswers,
        array $answers
    ): array {
        if (!is_array($answers)) {
            throw new RuntimeException('Format jawaban mini test tidak valid', 422);
        }

        $nextAnswers = $existingAnswers;
        $seenQuestionIds = [];

        foreach ($answers as $answer) {
            $questionId = (int) ($answer['question_id'] ?? 0);
            $optionId = array_key_exists('option_id', $answer) && $answer['option_id'] !== null
                ? (int) $answer['option_id']
                : 0;

            if ($questionId <= 0 || $optionId <= 0) {
                throw new RuntimeException('Data jawaban mini test tidak lengkap', 422);
            }

            if (isset($seenQuestionIds[$questionId])) {
                throw new RuntimeException('Setiap soal mini test hanya boleh dikirim sekali per request', 422);
            }

            $question = $this->getSectionTestQuestion($packageId, $sectionCode, $questionId);
            if (!$question) {
                throw new RuntimeException('Soal mini test tidak ditemukan pada subtest ini', 404);
            }

            $this->getSectionTestOptionCorrectness($questionId, $optionId);
            $nextAnswers[(string) $questionId] = $optionId;
            $seenQuestionIds[$questionId] = true;
        }

        $encodedAnswers = json_encode($nextAnswers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $stmt = $this->mysqli->prepare(
            'UPDATE learning_section_test_attempts
             SET answers_json = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?'
        );
        $stmt->bind_param('si', $encodedAnswers, $attemptId);
        $stmt->execute();

        return $nextAnswers;
    }

    private function setSectionTestReviewFlag(
        int $attemptId,
        int $packageId,
        string $sectionCode,
        int $questionId,
        bool $isMarkedReview,
        array $existingReviewFlags
    ): array {
        $question = $this->getSectionTestQuestion($packageId, $sectionCode, $questionId);
        if (!$question) {
            throw new RuntimeException('Soal mini test tidak ditemukan pada subtest ini', 404);
        }

        $nextReviewFlags = $existingReviewFlags;
        $questionKey = (string) $questionId;

        if ($isMarkedReview) {
            $nextReviewFlags[$questionKey] = true;
        } else {
            unset($nextReviewFlags[$questionKey]);
        }

        $encodedFlags = json_encode($nextReviewFlags, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $stmt = $this->mysqli->prepare(
            'UPDATE learning_section_test_attempts
             SET review_flags_json = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?'
        );
        $stmt->bind_param('si', $encodedFlags, $attemptId);
        $stmt->execute();

        return $nextReviewFlags;
    }

    private function abandonSectionTestAttempt(int $attemptId): void {
        $stmt = $this->mysqli->prepare(
            "UPDATE learning_section_test_attempts
             SET status = 'abandoned', end_time = NOW(), updated_at = CURRENT_TIMESTAMP
             WHERE id = ?"
        );
        $stmt->bind_param('i', $attemptId);
        $stmt->execute();
    }

    private function finalizeSectionTestAttempt(int $attemptId, int $userId, array $answers = [], bool $isAdmin = false): array {
        $this->mysqli->begin_transaction();

        try {
            $attempt = $this->getSectionTestAttemptForUser($attemptId, $userId, true);
            if (!$attempt) {
                throw new RuntimeException('Attempt mini test tidak ditemukan', 404);
            }

            $existingResult = $this->decodeSectionTestResult($attempt['result_json'] ?? null);
            if (($attempt['status'] ?? '') === 'completed' && $existingResult) {
                $this->mysqli->rollback();

                return [
                    'already_completed' => true,
                    'result' => $existingResult,
                ];
            }

            if (($attempt['status'] ?? '') !== 'ongoing') {
                throw new RuntimeException('Attempt mini test sudah tidak aktif lagi', 409);
            }

            $packageId = (int) ($attempt['package_id'] ?? 0);
            $sectionCode = (string) ($attempt['section_code'] ?? '');
            $package = $this->getPackage($packageId);
            $workflow = TestWorkflow::buildPackageWorkflow($package);
            $section = $this->getWorkflowSection($workflow, $sectionCode);
            if (!$section) {
                throw new RuntimeException('Subtest tidak ditemukan pada paket ini', 404);
            }

            $this->assertActiveAccess($userId, $packageId, $isAdmin);

            $answerMap = $this->decodeSectionTestAnswers($attempt['answers_json'] ?? null);
            if (!empty($answers)) {
                $answerMap = $this->persistSectionTestAnswers($attemptId, $packageId, $sectionCode, $answerMap, $answers);
            }

            $query = "SELECT q.id AS question_id, qo.id AS option_id, qo.is_correct
                      FROM learning_section_questions q
                      JOIN learning_section_question_options qo ON qo.question_id = q.id
                      WHERE q.package_id = ? AND q.section_code = ?";
            $stmt = $this->mysqli->prepare($query);
            $stmt->bind_param('is', $packageId, $sectionCode);
            $stmt->execute();
            $result = $stmt->get_result();

            $questionIds = [];
            $correctAnswers = 0;
            while ($row = $result->fetch_assoc()) {
                $questionId = (int) $row['question_id'];
                $optionId = (int) $row['option_id'];
                $questionIds[$questionId] = true;

                if (($answerMap[(string) $questionId] ?? 0) === $optionId && (int) $row['is_correct'] === 1) {
                    $correctAnswers++;
                }
            }

            $totalQuestions = count($questionIds);
            if ($totalQuestions === 0) {
                throw new RuntimeException('Soal mini test tidak ditemukan', 404);
            }

            $durationSeconds = (int) ($attempt['duration_seconds'] ?? 0);
            $attemptState = $this->computeSectionTestAttemptState($attempt, $durationSeconds);
            $score = round(($correctAnswers / $totalQuestions) * 100, 2);
            $timeTaken = $durationSeconds > 0
                ? min($durationSeconds, (int) ($attemptState['elapsed_seconds'] ?? 0))
                : (int) ($attemptState['elapsed_seconds'] ?? 0);
            $resultPayload = [
                'score' => $score,
                'correct_answers' => $correctAnswers,
                'total_questions' => $totalQuestions,
                'answered_count' => count($answerMap),
                'time_taken' => $timeTaken,
            ];
            $resultJson = json_encode($resultPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

            $updateAttempt = $this->mysqli->prepare(
                "UPDATE learning_section_test_attempts
                 SET status = 'completed',
                     answers_json = ?,
                     result_json = ?,
                     end_time = NOW(),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?"
            );
            $encodedAnswers = json_encode($answerMap, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $updateAttempt->bind_param('ssi', $encodedAnswers, $resultJson, $attemptId);
            $updateAttempt->execute();

            $this->upsertProgress($userId, $packageId, $sectionCode, 'subtest_test_completed', $resultPayload);
            $this->mysqli->commit();

            return [
                'already_completed' => false,
                'result' => $resultPayload,
            ];
        } catch (Throwable $error) {
            $this->mysqli->rollback();
            throw $error;
        }
    }

    public function getPackageLearning() {
        $tokenData = $this->getOptionalTokenData();
        $userId = (int) ($tokenData['userId'] ?? 0);
        $packageId = (int) ($_GET['package_id'] ?? 0);

        if ($packageId <= 0) {
            sendResponse('error', 'Package ID harus diisi', null, 400);
        }

        try {
            $isAuthenticated = $userId > 0;
            $isAdmin = $isAuthenticated ? userHasRole($tokenData, $this->mysqli, 'admin') : false;
            $package = $this->getPackage($packageId);
            $workflow = TestWorkflow::buildPackageWorkflow($package);
            $hasAccess = $isAuthenticated && $this->hasActiveAccess($userId, $packageId, $isAdmin);
            $progress = $isAuthenticated ? $this->getProgressMap($userId, $packageId) : [];
            $attemptStats = $isAuthenticated
                ? $this->getAttemptStats($userId, $packageId)
                : ['completed_attempts' => 0, 'ongoing_attempts' => 0];
            $remainingAttempts = $isAdmin ? null : max(0, (int) $package['max_attempts'] - $attemptStats['completed_attempts']);
            $sections = $this->buildLearningSections($package, $workflow, $progress, $hasAccess);
            $materialDone = count($sections) > 0 && count(array_filter($sections, static function (array $section): bool {
                return !empty($section['progress']['material_read']);
            })) === count($sections);
            $subtestDone = count($sections) > 0 && count(array_filter($sections, static function (array $section): bool {
                return !empty($section['progress']['subtest_test_completed']);
            })) === count($sections);

            sendResponse('success', 'Ruang belajar berhasil diambil', [
                'has_access' => $hasAccess,
                'is_authenticated' => $isAuthenticated,
                'admin_bypass' => $isAdmin,
                'package' => [
                    'id' => (int) $package['id'],
                    'name' => $package['name'],
                    'description' => $package['description'],
                    'category_name' => $package['category_name'],
                    'price' => (int) $package['price'],
                    'duration_days' => (int) $package['duration_days'],
                    'max_attempts' => (int) $package['max_attempts'],
                    'question_count' => (int) $package['question_count'],
                    'time_limit' => (int) round((float) ($workflow['total_duration_minutes'] ?? $package['time_limit'])),
                    'test_mode' => $workflow['mode'],
                ],
                'workflow' => $workflow,
                'preview' => [
                    'mode' => null,
                    'section_code' => null,
                ],
                'sections' => $sections,
                'summary' => [
                    'material_done' => $materialDone,
                    'subtest_done' => $subtestDone,
                    'completed_attempts' => $attemptStats['completed_attempts'],
                    'ongoing_attempts' => $attemptStats['ongoing_attempts'],
                    'remaining_attempts' => $remainingAttempts,
                    'can_start_tryout' => $hasAccess && ($isAdmin || $remainingAttempts > 0),
                ],
            ]);
        } catch (RuntimeException $error) {
            sendResponse('error', $error->getMessage(), null, $error->getCode() ?: 400);
        } catch (Throwable $error) {
            sendResponse('error', 'Gagal memuat ruang belajar', ['details' => $error->getMessage()], 500);
        }
    }

    public function markProgress() {
        $tokenData = verifyToken();
        $userId = (int) $tokenData['userId'];
        $data = json_decode(file_get_contents('php://input'), true);
        $packageId = (int) ($data['package_id'] ?? 0);
        $sectionCode = trim((string) ($data['section_code'] ?? ''));
        $milestoneType = trim((string) ($data['milestone_type'] ?? ''));

        if ($packageId <= 0 || $sectionCode === '' || $milestoneType === '') {
            sendResponse('error', 'Package ID, section, dan milestone harus diisi', null, 400);
        }

        try {
            $isAdmin = userHasRole($tokenData, $this->mysqli, 'admin');
            $package = $this->getPackage($packageId);
            $workflow = TestWorkflow::buildPackageWorkflow($package);
            $this->assertActiveAccess($userId, $packageId, $isAdmin);

            if (!$this->sectionExists($workflow, $sectionCode)) {
                throw new RuntimeException('Subtest tidak ditemukan pada paket ini', 404);
            }

            $this->upsertProgress($userId, $packageId, $sectionCode, $milestoneType);
            sendResponse('success', 'Milestone berhasil diperbarui', [
                'package_id' => $packageId,
                'section_code' => $sectionCode,
                'milestone_type' => $milestoneType,
            ]);
        } catch (RuntimeException $error) {
            sendResponse('error', $error->getMessage(), null, $error->getCode() ?: 400);
        } catch (Throwable $error) {
            sendResponse('error', 'Gagal memperbarui milestone', ['details' => $error->getMessage()], 500);
        }
    }

    public function getSectionTest() {
        $tokenData = verifyToken();
        $userId = (int) $tokenData['userId'];
        $packageId = (int) ($_GET['package_id'] ?? 0);
        $sectionCode = trim((string) ($_GET['section_code'] ?? ''));

        if ($packageId <= 0 || $sectionCode === '') {
            sendResponse('error', 'Package ID dan section harus diisi', null, 400);
        }

        try {
            $isAdmin = userHasRole($tokenData, $this->mysqli, 'admin');
            $package = $this->getPackage($packageId);
            $workflow = TestWorkflow::buildPackageWorkflow($package);
            $this->assertActiveAccess($userId, $packageId, $isAdmin);

            if (!$this->sectionExists($workflow, $sectionCode)) {
                throw new RuntimeException('Subtest tidak ditemukan pada paket ini', 404);
            }

            $questions = $this->getSectionTestQuestions($packageId, $sectionCode);

            sendResponse('success', 'Soal test subtest berhasil diambil', [
                'package_id' => $packageId,
                'section_code' => $sectionCode,
                'section' => $this->getWorkflowSection($workflow, $sectionCode),
                'questions' => $questions,
            ]);
        } catch (RuntimeException $error) {
            sendResponse('error', $error->getMessage(), null, $error->getCode() ?: 400);
        } catch (Throwable $error) {
            sendResponse('error', 'Gagal memuat test subtest', ['details' => $error->getMessage()], 500);
        }
    }

    public function startSectionTest() {
        $tokenData = verifyToken();
        $userId = (int) $tokenData['userId'];
        $data = json_decode(file_get_contents('php://input'), true);
        $packageId = (int) ($data['package_id'] ?? 0);
        $sectionCode = trim((string) ($data['section_code'] ?? ''));
        $restart = filter_var($data['restart'] ?? false, FILTER_VALIDATE_BOOLEAN);

        if ($packageId <= 0 || $sectionCode === '') {
            sendResponse('error', 'Package ID dan section harus diisi', null, 400);
        }

        try {
            $isAdmin = userHasRole($tokenData, $this->mysqli, 'admin');
            $package = $this->getPackage($packageId);
            $workflow = TestWorkflow::buildPackageWorkflow($package);
            $this->assertActiveAccess($userId, $packageId, $isAdmin);

            $section = $this->getWorkflowSection($workflow, $sectionCode);
            if (!$section) {
                throw new RuntimeException('Subtest tidak ditemukan pada paket ini', 404);
            }

            $questionCount = $this->getSectionTestQuestionCount($packageId, $sectionCode);
            $questions = $this->getSectionTestQuestions($packageId, $sectionCode);
            if ($questionCount <= 0 || count($questions) === 0) {
                sendResponse('success', 'Soal test subtest belum tersedia', [
                    'package_id' => $packageId,
                    'section_code' => $sectionCode,
                    'section' => $section,
                    'questions' => [],
                    'saved_answers' => [],
                    'review_flags' => [],
                    'result' => null,
                    'attempt' => null,
                    'attempt_id' => null,
                    'resumed' => false,
                    'result_ready' => false,
                ]);
            }

            $ongoingAttempt = $this->getOngoingSectionTestAttempt($userId, $packageId, $sectionCode);
            if ($ongoingAttempt) {
                $ongoingState = $this->computeSectionTestAttemptState(
                    $ongoingAttempt,
                    (int) ($ongoingAttempt['duration_seconds'] ?? 0)
                );

                if (!empty($ongoingState['is_expired'])) {
                    $completion = $this->finalizeSectionTestAttempt((int) $ongoingAttempt['id'], $userId, [], $isAdmin);

                    if (!$restart) {
                        sendResponse('success', 'Waktu mini test sebelumnya sudah habis dan hasil diproses otomatis.', [
                            'package_id' => $packageId,
                            'section_code' => $sectionCode,
                            'section' => $section,
                            'questions' => [],
                            'saved_answers' => [],
                            'review_flags' => [],
                            'result' => $completion['result'],
                            'attempt' => null,
                            'attempt_id' => (int) $ongoingAttempt['id'],
                            'resumed' => false,
                            'result_ready' => true,
                            'auto_submitted' => true,
                        ]);
                    }
                } elseif (!$restart) {
                    sendResponse('success', 'Melanjutkan mini test yang sedang berjalan', array_merge(
                        $this->buildSectionTestPayload($ongoingAttempt, $questions, $section),
                        [
                            'resumed' => true,
                            'result_ready' => false,
                            'auto_submitted' => false,
                        ]
                    ));
                }

                $this->mysqli->begin_transaction();
                try {
                    $lockedAttempt = $this->getSectionTestAttemptForUser((int) $ongoingAttempt['id'], $userId, true);
                    if ($lockedAttempt && ($lockedAttempt['status'] ?? '') === 'ongoing') {
                        $this->abandonSectionTestAttempt((int) $lockedAttempt['id']);
                    }
                    $this->mysqli->commit();
                } catch (Throwable $error) {
                    $this->mysqli->rollback();
                    throw $error;
                }
            }

            $durationSeconds = $this->computeSectionTestDurationSeconds($section, $questionCount);
            $insertAttempt = $this->mysqli->prepare(
                "INSERT INTO learning_section_test_attempts (
                    user_id,
                    package_id,
                    section_code,
                    status,
                    duration_seconds,
                    answers_json,
                    review_flags_json
                 ) VALUES (?, ?, ?, 'ongoing', ?, '{}', '{}')"
            );
            $insertAttempt->bind_param('iisi', $userId, $packageId, $sectionCode, $durationSeconds);
            $insertAttempt->execute();

            $attemptId = (int) $insertAttempt->insert_id;
            $attempt = $this->getSectionTestAttemptForUser($attemptId, $userId);
            if (!$attempt) {
                throw new RuntimeException('Gagal memulai mini test', 500);
            }

            sendResponse('success', 'Mini test dimulai', array_merge(
                $this->buildSectionTestPayload($attempt, $questions, $section),
                [
                    'resumed' => false,
                    'result_ready' => false,
                    'auto_submitted' => false,
                ]
            ));
        } catch (RuntimeException $error) {
            sendResponse('error', $error->getMessage(), null, $error->getCode() ?: 400);
        } catch (Throwable $error) {
            sendResponse('error', 'Gagal memulai mini test', ['details' => $error->getMessage()], 500);
        }
    }

    public function saveSectionTestAnswer() {
        $tokenData = verifyToken();
        $userId = (int) $tokenData['userId'];
        $data = json_decode(file_get_contents('php://input'), true);
        $attemptId = (int) ($data['attempt_id'] ?? 0);
        $questionId = (int) ($data['question_id'] ?? 0);
        $optionId = (int) ($data['option_id'] ?? 0);

        if ($attemptId <= 0 || $questionId <= 0 || $optionId <= 0) {
            sendResponse('error', 'Attempt ID, Question ID, dan Option ID harus diisi', null, 400);
        }

        $this->mysqli->begin_transaction();

        try {
            $attempt = $this->getSectionTestAttemptForUser($attemptId, $userId, true);
            if (!$attempt) {
                throw new RuntimeException('Attempt mini test tidak ditemukan', 404);
            }

            $existingResult = $this->decodeSectionTestResult($attempt['result_json'] ?? null);
            if (($attempt['status'] ?? '') !== 'ongoing') {
                throw new RuntimeException(
                    $existingResult ? 'Attempt mini test ini sudah selesai.' : 'Attempt mini test ini sudah tidak aktif lagi',
                    409
                );
            }

            $isAdmin = userHasRole($tokenData, $this->mysqli, 'admin');
            $this->assertActiveAccess($userId, (int) $attempt['package_id'], $isAdmin);
            $attemptState = $this->computeSectionTestAttemptState(
                $attempt,
                (int) ($attempt['duration_seconds'] ?? 0)
            );

            if (!empty($attemptState['is_expired'])) {
                $this->mysqli->rollback();
                $completion = $this->finalizeSectionTestAttempt($attemptId, $userId, [], $isAdmin);
                sendResponse('error', 'Waktu mini test sudah habis. Hasil diproses otomatis.', [
                    'attempt_completed' => true,
                    'attempt_id' => $attemptId,
                    'result' => $completion['result'],
                ], 409);
            }

            $answers = $this->decodeSectionTestAnswers($attempt['answers_json'] ?? null);
            $answers = $this->persistSectionTestAnswers(
                $attemptId,
                (int) $attempt['package_id'],
                (string) ($attempt['section_code'] ?? ''),
                $answers,
                [[
                    'question_id' => $questionId,
                    'option_id' => $optionId,
                ]]
            );

            $this->mysqli->commit();

            sendResponse('success', 'Jawaban mini test berhasil disimpan', [
                'attempt_id' => $attemptId,
                'question_id' => $questionId,
                'answered_count' => count($answers),
            ]);
        } catch (RuntimeException $error) {
            $this->mysqli->rollback();
            sendResponse('error', $error->getMessage(), null, $error->getCode() ?: 400);
        } catch (Throwable $error) {
            $this->mysqli->rollback();
            sendResponse('error', 'Gagal menyimpan jawaban mini test', ['details' => $error->getMessage()], 500);
        }
    }

    public function saveSectionTestReviewFlag() {
        $tokenData = verifyToken();
        $userId = (int) $tokenData['userId'];
        $data = json_decode(file_get_contents('php://input'), true);
        $attemptId = (int) ($data['attempt_id'] ?? 0);
        $questionId = (int) ($data['question_id'] ?? 0);
        $isMarkedReview = filter_var($data['is_marked_review'] ?? false, FILTER_VALIDATE_BOOLEAN);

        if ($attemptId <= 0 || $questionId <= 0) {
            sendResponse('error', 'Attempt ID dan Question ID harus diisi', null, 400);
        }

        $this->mysqli->begin_transaction();

        try {
            $attempt = $this->getSectionTestAttemptForUser($attemptId, $userId, true);
            if (!$attempt) {
                throw new RuntimeException('Attempt mini test tidak ditemukan', 404);
            }

            $existingResult = $this->decodeSectionTestResult($attempt['result_json'] ?? null);
            if (($attempt['status'] ?? '') !== 'ongoing') {
                throw new RuntimeException(
                    $existingResult ? 'Attempt mini test ini sudah selesai.' : 'Attempt mini test ini sudah tidak aktif lagi',
                    409
                );
            }

            $isAdmin = userHasRole($tokenData, $this->mysqli, 'admin');
            $this->assertActiveAccess($userId, (int) $attempt['package_id'], $isAdmin);
            $attemptState = $this->computeSectionTestAttemptState(
                $attempt,
                (int) ($attempt['duration_seconds'] ?? 0)
            );

            if (!empty($attemptState['is_expired'])) {
                $this->mysqli->rollback();
                $completion = $this->finalizeSectionTestAttempt($attemptId, $userId, [], $isAdmin);
                sendResponse('error', 'Waktu mini test sudah habis. Hasil diproses otomatis.', [
                    'attempt_completed' => true,
                    'attempt_id' => $attemptId,
                    'result' => $completion['result'],
                ], 409);
            }

            $answers = $this->decodeSectionTestAnswers($attempt['answers_json'] ?? null);
            if ($isMarkedReview && !$this->hasSectionTestAnsweredQuestion($answers, $questionId)) {
                throw new RuntimeException('Jawab soal mini test ini dulu sebelum menandai ragu-ragu.', 422);
            }

            $reviewFlags = $this->decodeSectionTestReviewFlags($attempt['review_flags_json'] ?? null);
            $reviewFlags = $this->setSectionTestReviewFlag(
                $attemptId,
                (int) $attempt['package_id'],
                (string) ($attempt['section_code'] ?? ''),
                $questionId,
                $isMarkedReview,
                $reviewFlags
            );

            $this->mysqli->commit();

            sendResponse('success', 'Status ragu-ragu mini test berhasil disimpan', [
                'attempt_id' => $attemptId,
                'question_id' => $questionId,
                'is_marked_review' => $isMarkedReview,
                'review_count' => count($reviewFlags),
            ]);
        } catch (RuntimeException $error) {
            $this->mysqli->rollback();
            sendResponse('error', $error->getMessage(), null, $error->getCode() ?: 400);
        } catch (Throwable $error) {
            $this->mysqli->rollback();
            sendResponse('error', 'Gagal menyimpan status ragu-ragu mini test', ['details' => $error->getMessage()], 500);
        }
    }

    public function submitSectionTest() {
        $tokenData = verifyToken();
        $userId = (int) $tokenData['userId'];
        $data = json_decode(file_get_contents('php://input'), true);
        $attemptId = (int) ($data['attempt_id'] ?? 0);
        $answers = $data['answers'] ?? [];
        $autoSubmit = filter_var($data['auto_submit'] ?? false, FILTER_VALIDATE_BOOLEAN);

        if ($attemptId <= 0 || !is_array($answers)) {
            sendResponse('error', 'Data test subtest tidak lengkap', null, 400);
        }

        try {
            $isAdmin = userHasRole($tokenData, $this->mysqli, 'admin');
            if (!$autoSubmit) {
                $attempt = $this->getSectionTestAttemptForUser($attemptId, $userId);
                if ($attempt && ($attempt['status'] ?? '') === 'ongoing') {
                    $reviewFlags = $this->decodeSectionTestReviewFlags($attempt['review_flags_json'] ?? null);
                    $this->assertNoPendingSectionTestReviewFlags($reviewFlags, 'menyelesaikan mini test');
                }
            }

            $completion = $this->finalizeSectionTestAttempt($attemptId, $userId, $answers, $isAdmin);

            sendResponse('success', 'Test subtest selesai dan milestone diperbarui', [
                'attempt_id' => $attemptId,
                ...$completion['result'],
            ]);
        } catch (RuntimeException $error) {
            sendResponse('error', $error->getMessage(), null, $error->getCode() ?: 400);
        } catch (Throwable $error) {
            sendResponse('error', 'Gagal menyimpan test subtest', ['details' => $error->getMessage()], 500);
        }
    }
}

$requestMethod = $_SERVER['REQUEST_METHOD'];
$requestPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

$controller = new LearningController($mysqli);

if (strpos($requestPath, '/api/learning/package') !== false && $requestMethod === 'GET') {
    $controller->getPackageLearning();
} elseif (strpos($requestPath, '/api/learning/progress') !== false && $requestMethod === 'POST') {
    $controller->markProgress();
} elseif (strpos($requestPath, '/api/learning/section-test/start') !== false && $requestMethod === 'POST') {
    $controller->startSectionTest();
} elseif (strpos($requestPath, '/api/learning/section-test/save-answer') !== false && $requestMethod === 'POST') {
    $controller->saveSectionTestAnswer();
} elseif (strpos($requestPath, '/api/learning/section-test/review-flag') !== false && $requestMethod === 'POST') {
    $controller->saveSectionTestReviewFlag();
} elseif (strpos($requestPath, '/api/learning/section-test/submit') !== false && $requestMethod === 'POST') {
    $controller->submitSectionTest();
} elseif (strpos($requestPath, '/api/learning/section-test') !== false && $requestMethod === 'GET') {
    $controller->getSectionTest();
} else {
    sendResponse('error', 'Endpoint tidak ditemukan', null, 404);
}
