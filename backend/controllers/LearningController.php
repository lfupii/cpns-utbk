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

    private function buildLearningSections(array $package, array $workflow, array $progress, bool $hasAccess): array {
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
        $defaultPages = LearningContent::defaultMaterialPages($section, (string) ($workflow['mode'] ?? ''));
        $defaultTopics = $this->buildTopicsFromPages($defaultPages);

        if ($packageId > 0 && $sectionCode !== '') {
            $query = 'SELECT title, content_json FROM learning_materials WHERE package_id = ? AND section_code = ? LIMIT 1';
            $stmt = $this->mysqli->prepare($query);
            $stmt->bind_param('is', $packageId, $sectionCode);
            $stmt->execute();
            $row = $stmt->get_result()->fetch_assoc();
            $materialPayload = json_decode((string) ($row['content_json'] ?? ''), true);
            if (is_array($materialPayload) && count($materialPayload) > 0) {
                return [
                    'title' => trim((string) ($row['title'] ?? '')) ?: (string) ($section['name'] ?? 'Materi'),
                    'topics' => $this->hydrateMaterialTopics($materialPayload, $defaultPages),
                ];
            }
        }

        return [
            'title' => (string) ($section['name'] ?? 'Materi'),
            'topics' => $defaultTopics,
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
                      ORDER BY q.question_order ASC, q.id ASC
                      LIMIT 5";
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

            sendResponse('success', 'Soal test subtest berhasil diambil', [
                'package_id' => $packageId,
                'section_code' => $sectionCode,
                'section' => array_values(array_filter($workflow['sections'], static function (array $section) use ($sectionCode): bool {
                    return (string) ($section['code'] ?? '') === $sectionCode;
                }))[0] ?? null,
                'questions' => $questions,
            ]);
        } catch (RuntimeException $error) {
            sendResponse('error', $error->getMessage(), null, $error->getCode() ?: 400);
        } catch (Throwable $error) {
            sendResponse('error', 'Gagal memuat test subtest', ['details' => $error->getMessage()], 500);
        }
    }

    public function submitSectionTest() {
        $tokenData = verifyToken();
        $userId = (int) $tokenData['userId'];
        $data = json_decode(file_get_contents('php://input'), true);
        $packageId = (int) ($data['package_id'] ?? 0);
        $sectionCode = trim((string) ($data['section_code'] ?? ''));
        $answers = $data['answers'] ?? [];

        if ($packageId <= 0 || $sectionCode === '' || !is_array($answers)) {
            sendResponse('error', 'Data test subtest tidak lengkap', null, 400);
        }

        try {
            $isAdmin = userHasRole($tokenData, $this->mysqli, 'admin');
            $package = $this->getPackage($packageId);
            $workflow = TestWorkflow::buildPackageWorkflow($package);
            $this->assertActiveAccess($userId, $packageId, $isAdmin);

            if (!$this->sectionExists($workflow, $sectionCode)) {
                throw new RuntimeException('Subtest tidak ditemukan pada paket ini', 404);
            }

            $answerMap = [];
            foreach ($answers as $answer) {
                $questionId = (int) ($answer['question_id'] ?? 0);
                $optionId = (int) ($answer['option_id'] ?? 0);
                if ($questionId > 0 && $optionId > 0) {
                    $answerMap[$questionId] = $optionId;
                }
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

                if (array_key_exists($questionId, $answerMap) && ($answerMap[$questionId] ?? 0) === $optionId && (int) $row['is_correct'] === 1) {
                    $correctAnswers++;
                }
            }

            $totalQuestions = count($questionIds);
            if ($totalQuestions === 0) {
                throw new RuntimeException('Soal test subtest tidak ditemukan', 404);
            }

            $score = round(($correctAnswers / $totalQuestions) * 100, 2);
            $metadata = [
                'score' => $score,
                'correct_answers' => $correctAnswers,
                'total_questions' => $totalQuestions,
            ];
            $this->upsertProgress($userId, $packageId, $sectionCode, 'subtest_test_completed', $metadata);

            sendResponse('success', 'Test subtest selesai dan milestone diperbarui', [
                'package_id' => $packageId,
                'section_code' => $sectionCode,
                'score' => $score,
                'correct_answers' => $correctAnswers,
                'total_questions' => $totalQuestions,
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
} elseif (strpos($requestPath, '/api/learning/section-test/submit') !== false && $requestMethod === 'POST') {
    $controller->submitSectionTest();
} elseif (strpos($requestPath, '/api/learning/section-test') !== false && $requestMethod === 'GET') {
    $controller->getSectionTest();
} else {
    sendResponse('error', 'Endpoint tidak ditemukan', null, 404);
}
