<?php

class LearningContent {
    private static function page(string $title, array $points, string $closing): array {
        return [
            'title' => $title,
            'points' => $points,
            'closing' => $closing,
        ];
    }

    private static function topic(string $title, array $pages): array {
        return [
            'title' => $title,
            'pages' => $pages,
        ];
    }

    private static function wrapPagesAsTopics(array $pages): array {
        return [
            'topics' => array_map(static function (array $page, int $index): array {
                return [
                    'title' => trim((string) ($page['title'] ?? '')) ?: 'Topik ' . ($index + 1),
                    'pages' => [$page],
                ];
            }, $pages, array_keys($pages)),
        ];
    }

    private static function flattenTopics(array $topics): array {
        $pages = [];
        foreach ($topics as $topic) {
            foreach (($topic['pages'] ?? []) as $page) {
                if (is_array($page)) {
                    $pages[] = $page;
                }
            }
        }

        return $pages;
    }

    public static function defaultMaterialContent(array $section, string $mode = ''): array {
        $code = (string) ($section['code'] ?? 'general');
        $name = (string) ($section['name'] ?? 'Materi');
        $haystack = strtolower($code . ' ' . $name . ' ' . $mode);

        if ($code === 'twk') {
            return [
                'topics' => [
                    self::topic('Pancasila', [
                        self::page('Pancasila sebagai Dasar Negara', [
                            'Pancasila menjadi dasar negara sekaligus panduan nilai dalam kehidupan berbangsa dan bernegara. Kedudukannya terlihat pada Pembukaan UUD 1945 yang memuat lima sila sebagai landasan penyelenggaraan negara.',
                            'Dalam TWK, Pancasila tidak cukup dipahami sebagai hafalan urutan sila. Peserta perlu melihat fungsi Pancasila sebagai sumber orientasi moral, arah kebijakan, dan tolok ukur perilaku warga negara maupun aparatur.',
                            'Karena itu, soal Pancasila sering menempatkan peserta pada situasi konkret. Jawaban yang paling kuat biasanya tidak hanya benar secara pribadi, tetapi juga selaras dengan kepentingan umum, persatuan, dan keadilan.',
                        ], 'Fokus halaman ini adalah memahami bahwa Pancasila menjadi fondasi nilai, bukan sekadar simbol atau slogan kebangsaan.'),
                        self::page('Makna Tiap Sila', [
                            'Sila pertama menekankan penghormatan terhadap ketuhanan dan kebebasan menjalankan ibadah. Sila kedua mengarahkan manusia Indonesia untuk bersikap adil, beradab, dan menghormati martabat sesama.',
                            'Sila ketiga menegaskan bahwa keberagaman harus diarahkan pada persatuan Indonesia. Sila keempat mengutamakan musyawarah, kebijaksanaan, dan keterwakilan dalam mengambil keputusan bersama.',
                            'Sila kelima menuntut keadilan sosial yang dirasakan seluruh rakyat. Dalam soal, pilihan yang baik umumnya menunjukkan keseimbangan antara hak, kewajiban, kepentingan masyarakat, dan keadilan yang tidak diskriminatif.',
                        ], 'Saat membaca opsi jawaban, hubungkan kasus dengan sila yang paling dominan, lalu cek apakah solusi yang dipilih tetap menjaga sila lainnya.'),
                        self::page('Penerapan Pancasila dalam Kehidupan', [
                            'Penerapan Pancasila tampak dalam sikap toleran, mau bermusyawarah, mendahulukan kepentingan bangsa, taat hukum, dan menjaga pelayanan yang adil. Nilai-nilai ini menjadi pola perilaku, bukan hanya teori kebangsaan.',
                            'Dalam konteks pekerjaan, implementasi Pancasila terlihat saat seseorang menolak penyalahgunaan wewenang, tidak memihak secara tidak adil, dan tetap menjaga kepentingan publik. Dalam konteks sosial, penerapannya terlihat dari kerja sama lintas kelompok dan penghormatan terhadap perbedaan.',
                            'Karena TWK sering memakai soal situasional, peserta perlu membiasakan diri memilih tindakan yang etis, tidak ekstrem, dan tidak hanya menguntungkan diri sendiri. Opsi yang terlalu keras, diskriminatif, atau mengabaikan musyawarah biasanya lemah.',
                        ], 'Kesimpulan utamanya: implementasi Pancasila selalu mengarah pada sikap yang manusiawi, inklusif, dan berpihak pada kepentingan bersama.'),
                    ]),
                    self::topic('Undang-Undang Dasar 1945', [
                        self::page('Kedudukan UUD NRI 1945', [
                            'Undang-Undang Dasar Negara Republik Indonesia Tahun 1945 merupakan konstitusi negara. Fungsinya adalah menjadi dasar hukum tertinggi yang mengatur bentuk negara, hubungan lembaga negara, serta hak dan kewajiban warga negara.',
                            'Dalam belajar TWK, UUD 1945 perlu dipahami sebagai kerangka besar penyelenggaraan negara. Artinya, ketika muncul soal tentang lembaga negara, hak warga, atau prinsip pemerintahan, acuannya tetap kembali pada konstitusi.',
                            'Pemahaman yang baik tidak berhenti pada nomor pasal. Yang lebih penting adalah mengetahui mengapa suatu aturan ada, siapa yang diatur, dan nilai apa yang dilindungi oleh ketentuan tersebut.',
                        ], 'Halaman ini menekankan bahwa UUD 1945 adalah acuan tertinggi dalam tata negara Indonesia.'),
                        self::page('Pembukaan UUD 1945', [
                            'Pembukaan UUD 1945 memuat pokok pikiran yang sangat penting: alasan kemerdekaan, tujuan negara, dan dasar negara. Di dalamnya tercermin cita-cita untuk melindungi segenap bangsa, memajukan kesejahteraan umum, mencerdaskan kehidupan bangsa, dan ikut melaksanakan ketertiban dunia.',
                            'Pembukaan juga memuat rumusan Pancasila yang menjadi dasar negara. Karena itu, dalam soal TWK, pembahasan Pancasila dan UUD 1945 sering beririsan. Satu berbicara tentang nilai dasar, yang lain memberi bentuk konstitusionalnya.',
                            'Peserta perlu melihat bahwa Pembukaan bukan sekadar teks sejarah. Ia menjadi sumber arah penyelenggaraan negara dan sering dipakai untuk menilai apakah kebijakan atau tindakan sejalan dengan tujuan bernegara.',
                        ], 'Jika soal menyentuh tujuan negara atau dasar filosofis penyelenggaraan pemerintahan, fokus utama biasanya berada pada Pembukaan UUD 1945.'),
                        self::page('Pasal-Pasal Penting dan Prinsip Negara Hukum', [
                            'UUD 1945 menegaskan bahwa Indonesia adalah negara kesatuan berbentuk republik dan juga negara hukum. Artinya, kekuasaan dijalankan menurut aturan, bukan semata-mata kehendak penguasa atau kelompok tertentu.',
                            'Konstitusi juga menegaskan bahwa kedaulatan berada di tangan rakyat dan dilaksanakan menurut undang-undang dasar. Dari sini lahir pengaturan mengenai lembaga negara, pembagian kewenangan, mekanisme pengawasan, dan proses pembentukan peraturan.',
                            'Dalam TWK, prinsip negara hukum biasanya terlihat pada pilihan jawaban yang menekankan prosedur, akuntabilitas, dan penghormatan terhadap hak warga. Pilihan yang melompati hukum demi kepentingan sesaat cenderung tidak tepat.',
                        ], 'Pegangan utamanya adalah membedakan tindakan yang konstitusional dari tindakan yang tampak cepat tetapi mengabaikan hukum.'),
                        self::page('Hak dan Kewajiban Warga Negara', [
                            'UUD 1945 tidak hanya mengatur hak warga negara, tetapi juga kewajiban. Keduanya harus dipahami secara seimbang agar kehidupan bernegara berjalan tertib dan adil.',
                            'Hak mencakup perlindungan hukum, kesempatan memperoleh pendidikan, kebebasan beragama, dan berbagai jaminan konstitusional lainnya. Di sisi lain, warga negara juga berkewajiban menaati hukum, menghormati hak orang lain, serta ikut menjaga kehidupan kebangsaan.',
                            'Dalam soal TWK, jawaban yang baik biasanya tidak memisahkan hak dari tanggung jawab. Opsi yang menuntut hak tanpa memperhatikan aturan, kewajiban, atau kepentingan umum sering kali kurang tepat.',
                        ], 'Pahami hak dan kewajiban sebagai pasangan yang saling melengkapi dalam kehidupan demokratis dan negara hukum.'),
                    ]),
                    self::topic('Bhinneka Tunggal Ika', [
                        self::page('Asal Usul dan Makna Bhinneka Tunggal Ika', [
                            'Bhinneka Tunggal Ika merupakan semboyan negara yang tertulis pada lambang Garuda Pancasila. Maknanya menegaskan bahwa Indonesia terdiri atas banyak perbedaan, tetapi tetap dipersatukan dalam satu kebangsaan.',
                            'Secara historis, frasa ini berasal dari Kakawin Sutasoma karya Mpu Tantular. Dalam konteks kebangsaan modern, semboyan ini dipahami sebagai semangat menjaga persatuan di tengah kemajemukan suku, agama, budaya, bahasa, dan pandangan sosial.',
                            'TWK sering menguji pemahaman ini melalui situasi yang melibatkan perbedaan latar belakang. Opsi yang baik biasanya menjaga rasa hormat, menolak diskriminasi, dan tetap mendorong kerja sama untuk tujuan bersama.',
                        ], 'Inti halaman ini adalah memahami Bhinneka Tunggal Ika sebagai perekat kebangsaan, bukan sekadar semboyan formal.'),
                        self::page('Implementasi dalam Kehidupan Berbangsa', [
                            'Penerapan Bhinneka Tunggal Ika terlihat ketika masyarakat mampu bekerja sama tanpa mempersoalkan identitas asal, agama, bahasa, atau budaya. Semangat ini menolak sikap eksklusif yang memecah belah kehidupan sosial.',
                            'Dalam lingkungan sekolah, kampus, kantor, atau masyarakat, implementasinya tampak pada komunikasi yang saling menghormati, penyelesaian konflik tanpa prasangka, dan kemauan membangun tujuan bersama. Nilai ini juga sejalan dengan semangat persatuan Indonesia dalam Pancasila.',
                            'Pada soal TWK, pilihan yang terlalu memihak kelompok sendiri, menutup ruang dialog, atau membiarkan diskriminasi biasanya tidak sesuai. Yang dicari adalah sikap inklusif, proporsional, dan tetap menjaga ketertiban bersama.',
                        ], 'Bhinneka Tunggal Ika mengajarkan bahwa keragaman perlu dikelola melalui toleransi aktif dan komitmen pada persatuan nasional.'),
                    ]),
                    self::topic('NKRI', [
                        self::page('Pengertian NKRI', [
                            'NKRI adalah Negara Kesatuan Republik Indonesia. UUD 1945 menegaskan bahwa Indonesia berbentuk negara kesatuan, sehingga seluruh wilayah nusantara berada dalam satu kedaulatan, satu pemerintahan nasional, dan satu konstitusi.',
                            'Makna negara kesatuan penting dipahami untuk membedakannya dari bentuk negara federal. Daerah memang memiliki kewenangan otonomi, tetapi tetap berada dalam kerangka nasional yang sama dan tidak berdiri sebagai negara tersendiri.',
                            'Dalam TWK, NKRI biasanya dikaitkan dengan persatuan wilayah, semangat kebangsaan, dan kepentingan nasional. Karena itu, jawaban yang tepat umumnya mendukung integrasi, hukum nasional, dan stabilitas negara.',
                        ], 'Halaman ini menekankan bahwa NKRI adalah bentuk negara yang menjaga kesatuan wilayah dan arah kebijakan nasional.'),
                        self::page('Menjaga Keutuhan NKRI', [
                            'Menjaga keutuhan NKRI bukan hanya tugas aparat, tetapi juga tanggung jawab seluruh warga negara. Bentuk nyatanya antara lain menaati hukum, menjaga kerukunan, tidak mudah terprovokasi, dan ikut memperkuat persatuan dalam ruang sosial maupun digital.',
                            'Ancaman terhadap NKRI dapat muncul dalam bentuk disintegrasi, konflik horizontal, penyebaran kebencian, atau tindakan yang melemahkan kepercayaan terhadap negara. Karena itu, sikap bela negara tidak selalu berbentuk militer, tetapi juga mencakup disiplin, tanggung jawab, dan kontribusi positif bagi bangsa.',
                            'Dalam soal TWK, pilihan yang baik biasanya menunjukkan ketegasan menjaga persatuan, namun tetap konstitusional dan tidak melanggar hak warga. Keutuhan negara harus dijaga melalui hukum, pendidikan kebangsaan, dan partisipasi yang sehat.',
                        ], 'Pegangan akhirnya: menjaga NKRI berarti menjaga persatuan, kedaulatan, dan ketertiban nasional secara konstitusional.'),
                    ]),
                ],
            ];
        }

        if ($code === 'tiu') {
            return self::wrapPagesAsTopics([
                self::page('Peta TIU', [
                    'TIU mengukur kemampuan verbal, numerik, logika, dan analitis.',
                    'Kelompokkan tipe soal: sinonim, antonim, analogi, silogisme, deret, aritmetika, dan figural.',
                    'Catat tipe yang paling menghabiskan waktu agar latihan bisa lebih terarah.',
                ], 'TIU bukan hanya rumus, tetapi kebiasaan memilih pola dan metode yang tepat.'),
                self::page('Verbal dan Logika', [
                    'Pada verbal, cari hubungan makna yang paling spesifik, bukan sekadar kata yang terasa mirip.',
                    'Pada silogisme, ubah premis menjadi diagram atau pernyataan himpunan sederhana.',
                    'Jangan menarik kesimpulan dari informasi yang tidak disebutkan pada premis.',
                ], 'Kunci logika adalah disiplin pada data yang tersedia di soal.'),
                self::page('Numerik dan Deret', [
                    'Cek pola tambah, kurang, kali, bagi, kuadrat, dan pola selang-seling.',
                    'Pada persen dan rasio, ubah angka ke bentuk yang mudah dihitung mental.',
                    'Gunakan estimasi untuk menyingkirkan opsi yang terlalu jauh dari jawaban wajar.',
                ], 'Tujuan latihan numerik adalah cepat memilih metode, bukan menghitung paling panjang.'),
                self::page('Strategi Mengerjakan TIU', [
                    'Kerjakan tipe yang paling stabil lebih dulu jika navigasi soal bebas.',
                    'Tandai soal panjang untuk kembali setelah poin mudah aman.',
                    'Gunakan mini test TIU untuk mengecek akurasi saat waktu dibatasi.',
                ], 'Milestone TIU selesai setelah materi dibaca dan mini test subtest dikerjakan.'),
            ]);
        }

        if ($code === 'tkp') {
            return self::wrapPagesAsTopics([
                self::page('Peta TKP', [
                    'TKP mengukur pelayanan publik, jejaring kerja, sosial budaya, profesionalisme, dan teknologi informasi.',
                    'Jawaban terbaik biasanya aktif, etis, komunikatif, dan tetap mengikuti prosedur.',
                    'Hindari respons pasif, emosional, menyalahkan orang lain, atau mengambil jalan pintas.',
                ], 'TKP mencari kualitas respons, bukan benar-salah tunggal seperti TIU.'),
                self::page('Pelayanan Publik', [
                    'Utamakan kebutuhan masyarakat sambil tetap menjaga aturan dan kewenangan.',
                    'Dalam konflik layanan, pilih komunikasi jelas, bukti yang rapi, dan eskalasi sesuai prosedur.',
                    'Jawaban yang baik membantu menyelesaikan masalah tanpa melanggar integritas.',
                ], 'Bayangkan posisi ASN yang tenang, akuntabel, dan solutif.'),
                self::page('Kerja Sama dan Sosial Budaya', [
                    'Sikap inklusif lebih kuat daripada memaksa keseragaman.',
                    'Kolaborasi yang matang membagi peran, menjaga tujuan bersama, dan menghargai perbedaan.',
                    'Pada dilema tim, pilih opsi yang memperbaiki koordinasi tanpa mempermalukan pihak lain.',
                ], 'TKP sering menguji kedewasaan sikap dalam situasi tidak ideal.'),
                self::page('Strategi Mengerjakan TKP', [
                    'Urutkan opsi dari paling pasif sampai paling proaktif dan etis.',
                    'Bandingkan dua opsi terbaik dari sisi dampak, aturan, dan komunikasi.',
                    'Gunakan mini test TKP untuk membiasakan diri membaca nuansa pilihan jawaban.',
                ], 'Selesaikan materi lalu mini test agar milestone TKP tercentang.'),
            ]);
        }

        if (strpos($haystack, 'literasi') !== false || strpos($haystack, 'ppu') !== false || strpos($haystack, 'pbm') !== false) {
            return self::wrapPagesAsTopics([
                self::page('Peta ' . $name, [
                    'Literasi menguji gagasan utama, detail, inferensi, sikap penulis, dan hubungan antarparagraf.',
                    'Baca pertanyaan dulu jika teks panjang agar perhatian tertuju pada informasi yang dicari.',
                    'Jawaban harus didukung teks, bukan hanya terasa benar menurut pengetahuan umum.',
                ], 'Pegangan utama literasi selalu kembali ke bukti dalam teks.'),
                self::page('Gagasan dan Detail', [
                    'Gagasan utama menjawab topik besar dan arah pembahasan teks.',
                    'Detail pendukung harus cocok dengan isi teks, bukan sekadar memakai kata yang sama.',
                    'Untuk bahasa Inggris, pahami konteks kalimat sebelum menebak arti kata.',
                ], 'Jangan memilih opsi yang benar sebagian tetapi mengubah maksud teks.'),
                self::page('Inferensi dan Sikap Penulis', [
                    'Inferensi adalah kesimpulan wajar dari teks, bukan spekulasi baru.',
                    'Sikap penulis terlihat dari pilihan kata, struktur argumen, dan penekanan paragraf.',
                    'Hubungan paragraf bisa berupa sebab-akibat, contoh, pertentangan, atau penjelasan ulang.',
                ], 'Latih membaca bukti kecil yang menentukan arah jawaban.'),
                self::page('Strategi Subtest', [
                    'Cari lokasi paragraf untuk soal detail sebelum membaca ulang seluruh teks.',
                    'Coret opsi yang terlalu umum, terlalu sempit, atau tidak didukung teks.',
                    'Gunakan mini test untuk melatih stamina membaca dan akurasi pilihan.',
                ], 'Milestone literasi selesai setelah materi dan mini test beres.'),
            ]);
        }

        if (strpos($haystack, 'matematika') !== false || strpos($haystack, 'kuantitatif') !== false || strpos($haystack, 'pk') !== false) {
            return self::wrapPagesAsTopics([
                self::page('Peta ' . $name, [
                    'Materi ini menekankan aljabar dasar, rasio, statistika, pola bilangan, dan interpretasi data.',
                    'Tuliskan apa yang diketahui dan yang ditanya sebelum memilih rumus.',
                    'Banyak soal menguji penalaran dari konteks, bukan substitusi angka mentah.',
                ], 'Matematika UTBK perlu rapi membaca konteks dan hemat langkah.'),
                self::page('Model dan Data', [
                    'Ubah cerita menjadi persamaan, tabel kecil, atau diagram sederhana.',
                    'Pada grafik, cek satuan, interval, tren, dan nilai ekstrem.',
                    'Pada statistika, pahami beda rata-rata, median, modus, jangkauan, dan perubahan data.',
                ], 'Representasi yang tepat biasanya memangkas separuh kerja hitung.'),
                self::page('Strategi Hitung', [
                    'Pilih angka mudah untuk mengecek pola jika soal berbentuk umum.',
                    'Gunakan estimasi ketika opsi berjauhan.',
                    'Jangan lanjut hitungan panjang sebelum yakin model matematikanya benar.',
                ], 'Akurasi naik saat langkah awal tidak buru-buru.'),
                self::page('Strategi Subtest', [
                    'Pisahkan soal cepat, sedang, dan panjang sejak membaca pertama.',
                    'Kembalikan semua jawaban ke konteks: satuan, rentang, dan logika hasil.',
                    'Akhiri dengan mini test subtest untuk menutup milestone.',
                ], 'Milestone selesai saat materi dibaca dan mini test subtest dikerjakan.'),
            ]);
        }

        return self::wrapPagesAsTopics([
            self::page('Peta ' . $name, [
                'Subtest ini mengukur kemampuan melihat pola, hubungan informasi, dan konsistensi kesimpulan.',
                'Pisahkan fakta, asumsi, dan inferensi sebelum memilih jawaban.',
                'Perhatikan kata kunci seperti semua, sebagian, selalu, hanya jika, dan tidak mungkin.',
            ], 'Penalaran kuat dimulai dari membaca struktur soal, bukan memburu jawaban cepat.'),
            self::page('Membaca Pola', [
                'Cari hubungan sebab-akibat, perbandingan, urutan, atau kategori.',
                'Buat notasi singkat agar informasi penting tidak hilang saat membaca opsi.',
                'Eliminasi opsi yang menambahkan informasi baru di luar soal.',
            ], 'Jawaban yang sah harus lahir dari data yang tersedia.'),
            self::page('Mengelola Waktu', [
                'Jangan terpaku di satu soal yang panjang.',
                'Tandai jebakan berupa kata mutlak seperti selalu, pasti, semua, dan tidak ada.',
                'Gunakan estimasi dan eliminasi saat opsi memiliki jarak yang jelas.',
            ], 'Latihan terbaik adalah memilih strategi tercepat untuk tipe yang sama.'),
            self::page('Strategi Subtest', [
                'Kerjakan soal yang polanya langsung terlihat lebih dulu.',
                'Baca ulang premis jika dua opsi terlihat sama kuat.',
                'Akhiri dengan mini test subtest untuk mengunci ritme pengerjaan.',
            ], 'Milestone subtest selesai setelah bacaan dan mini test selesai.'),
        ]);
    }

    public static function defaultMaterialPages(array $section, string $mode = ''): array {
        $payload = self::defaultMaterialContent($section, $mode);
        return self::flattenTopics(is_array($payload['topics'] ?? null) ? $payload['topics'] : []);
    }

    public static function isLegacySimpleTwkContent($payload): bool {
        if (!is_array($payload)) {
            return false;
        }

        $topics = [];
        if (array_key_exists('topics', $payload) && is_array($payload['topics'])) {
            $topics = $payload['topics'];
        } elseif (array_values($payload) === $payload) {
            foreach ($payload as $page) {
                if (!is_array($page)) {
                    continue;
                }
                $topics[] = [
                    'title' => (string) ($page['title'] ?? ''),
                    'pages' => [$page],
                ];
            }
        }

        if (count($topics) !== 4) {
            return false;
        }

        $expectedTitles = [
            'Pancasila',
            'Undang-Undang Dasar 1945',
            'Bhinneka Tunggal Ika',
            'NKRI',
        ];
        $actualTitles = array_map(static function (array $topic): string {
            return trim((string) ($topic['title'] ?? ''));
        }, $topics);

        if ($actualTitles !== $expectedTitles) {
            return false;
        }

        foreach ($topics as $topic) {
            if (count($topic['pages'] ?? []) !== 1) {
                return false;
            }
        }

        return true;
    }

    public static function defaultSectionQuestions(array $section, string $mode = ''): array {
        $code = (string) ($section['code'] ?? 'general');
        $name = (string) ($section['name'] ?? 'Subtest');
        $haystack = strtolower($code . ' ' . $name . ' ' . $mode);

        if ($code === 'twk') {
            $items = [
                ['Nilai Pancasila yang paling tepat untuk menyelesaikan perbedaan pendapat dalam rapat warga adalah...', ['Musyawarah untuk mufakat', 'Mengikuti suara paling keras', 'Menunda keputusan tanpa batas', 'Menyerahkan semua keputusan ke satu orang'], 'A'],
                ['Sikap yang paling sesuai dengan prinsip Bhinneka Tunggal Ika adalah...', ['Membatasi kerja sama pada kelompok sendiri', 'Menghargai perbedaan dan tetap bekerja untuk tujuan bersama', 'Menghindari semua orang yang berbeda pendapat', 'Menghapus identitas budaya daerah'], 'B'],
                ['Contoh perilaku yang mencerminkan nasionalisme di lingkungan kerja adalah...', ['Mengutamakan kepentingan pribadi', 'Menjaga kualitas kerja untuk pelayanan publik', 'Menolak kritik dari rekan kerja', 'Membagikan data kantor sembarangan'], 'B'],
                ['Dalam konteks UUD 1945, hak warga negara sebaiknya dipahami bersama dengan...', ['Kewajiban warga negara dan aturan hukum', 'Keinginan pribadi tanpa batas', 'Kepentingan kelompok tertentu saja', 'Kebiasaan yang tidak tertulis'], 'A'],
                ['Saat menemukan praktik yang berpotensi melanggar integritas, tindakan awal yang paling tepat adalah...', ['Membiarkan karena bukan urusan pribadi', 'Mengumpulkan informasi dan melapor sesuai prosedur', 'Menyebarkan tuduhan di media sosial', 'Ikut terlibat agar tidak dikucilkan'], 'B'],
            ];
        } elseif ($code === 'tiu') {
            $items = [
                ['Antonim dari kata "efisien" adalah...', ['Hemat', 'Tepat guna', 'Boros', 'Produktif'], 'C'],
                ['Jika semua A adalah B dan sebagian B adalah C, kesimpulan yang pasti benar adalah...', ['Semua A adalah C', 'Sebagian C adalah A', 'Belum tentu ada A yang C', 'Semua B adalah A'], 'C'],
                ['Deret berikutnya dari 3, 6, 12, 24, ... adalah...', ['30', '36', '42', '48'], 'D'],
                ['Jika harga Rp80.000 naik 25%, maka harga baru adalah...', ['Rp90.000', 'Rp95.000', 'Rp100.000', 'Rp105.000'], 'C'],
                ['Hubungan "dokter : pasien" paling mirip dengan...', ['guru : murid', 'buku : rak', 'jalan : kendaraan', 'pintu : kunci'], 'A'],
            ];
        } elseif ($code === 'tkp') {
            $items = [
                ['Warga mengeluh karena layanan antrean berjalan lambat. Respons terbaik adalah...', ['Meminta warga menunggu tanpa penjelasan', 'Mengecek kendala, memberi informasi, dan membantu sesuai prosedur', 'Menyalahkan petugas lain', 'Menutup layanan lebih awal'], 'B'],
                ['Rekan kerja melakukan kesalahan dalam laporan tim. Sikap yang tepat adalah...', ['Membicarakannya di luar tim', 'Membantu memperbaiki dan memberi masukan secara profesional', 'Menghapus nama rekan dari laporan', 'Mengabaikannya agar cepat selesai'], 'B'],
                ['Ketika mendapat tugas baru yang belum dikuasai, tindakan paling tepat adalah...', ['Menolak karena belum pernah', 'Belajar, bertanya pada pihak terkait, dan menyusun rencana kerja', 'Menunggu sampai ada teguran', 'Mengerjakan asal cepat'], 'B'],
                ['Jika ada perbedaan budaya dalam tim, sikap yang paling produktif adalah...', ['Menyamakan semua kebiasaan', 'Menghargai perbedaan dan menyepakati cara kerja bersama', 'Menghindari anggota yang berbeda', 'Mengutamakan kelompok mayoritas'], 'B'],
                ['Dalam penggunaan teknologi kantor, tindakan yang tepat adalah...', ['Membagikan password agar pekerjaan cepat', 'Mengikuti aturan keamanan data dan memakai akses sesuai kewenangan', 'Mengunduh semua aplikasi tanpa izin', 'Menyimpan data publik dan rahasia di tempat yang sama'], 'B'],
            ];
        } elseif (strpos($haystack, 'literasi') !== false || strpos($haystack, 'ppu') !== false || strpos($haystack, 'pbm') !== false) {
            $items = [
                ['Dalam bacaan argumentatif, gagasan utama biasanya dapat ditemukan dari...', ['Contoh paling panjang saja', 'Topik dan arah pembahasan keseluruhan', 'Kata yang paling sering muncul tanpa konteks', 'Kalimat terakhir setiap paragraf saja'], 'B'],
                ['Opsi inferensi yang baik adalah opsi yang...', ['Menambahkan fakta baru', 'Didukung oleh informasi dalam teks', 'Bertentangan dengan paragraf utama', 'Paling panjang kalimatnya'], 'B'],
                ['Jika pertanyaan meminta detail, langkah paling efisien adalah...', ['Membaca semua opsi lalu menebak', 'Menemukan lokasi informasi dalam teks', 'Mengabaikan kata kunci', 'Memilih jawaban yang terdengar umum'], 'B'],
                ['Sikap penulis dalam teks dapat dikenali dari...', ['Pilihan kata dan cara menyusun argumen', 'Jumlah paragraf saja', 'Panjang judul', 'Nama penerbit'], 'A'],
                ['Dalam soal sinonim konteks, arti kata sebaiknya ditentukan berdasarkan...', ['Kamus pertama yang diingat', 'Hubungan kata dengan kalimat tempatnya muncul', 'Kemiripan bunyi', 'Jumlah huruf'], 'B'],
            ];
        } elseif (strpos($haystack, 'matematika') !== false || strpos($haystack, 'kuantitatif') !== false || strpos($haystack, 'pk') !== false) {
            $items = [
                ['Rata-rata 5 bilangan adalah 12. Jumlah kelima bilangan tersebut adalah...', ['48', '50', '60', '72'], 'C'],
                ['Jika perbandingan A:B = 2:3 dan A = 10, maka B = ...', ['12', '15', '18', '20'], 'B'],
                ['Nilai x yang memenuhi 2x + 5 = 17 adalah...', ['5', '6', '7', '8'], 'B'],
                ['Data 4, 6, 6, 8, 10 memiliki median...', ['6', '7', '8', '10'], 'A'],
                ['Sebuah barang didiskon 20% dari Rp150.000. Harga setelah diskon adalah...', ['Rp110.000', 'Rp120.000', 'Rp125.000', 'Rp130.000'], 'B'],
            ];
        } else {
            $items = [
                ['Jika semua peserta yang hadir mengisi daftar hadir, maka kesimpulan yang tepat ketika Rani hadir adalah...', ['Rani mengisi daftar hadir', 'Rani tidak mengisi daftar hadir', 'Rani pasti panitia', 'Tidak ada peserta yang hadir'], 'A'],
                ['Pola berikutnya dari 2, 5, 8, 11, ... adalah...', ['13', '14', '15', '16'], 'B'],
                ['Pernyataan "sebagian siswa membaca buku" berarti...', ['Semua siswa membaca buku', 'Tidak ada siswa membaca buku', 'Ada siswa yang membaca buku', 'Semua siswa tidak membaca buku'], 'C'],
                ['Jika A lebih tinggi dari B dan B lebih tinggi dari C, maka...', ['C lebih tinggi dari A', 'A lebih tinggi dari C', 'B lebih tinggi dari A', 'A sama tinggi dengan C'], 'B'],
                ['Pilihan terbaik saat dua opsi tampak benar adalah...', ['Memilih yang paling panjang', 'Mencocokkan kembali dengan informasi di soal', 'Memilih acak', 'Mengabaikan kata kunci'], 'B'],
            ];
        }

        return array_map(static function (array $item, int $index): array {
            $letters = ['A', 'B', 'C', 'D'];
            return [
                'question_text' => $item[0],
                'difficulty' => $index < 2 ? 'easy' : 'medium',
                'question_order' => $index + 1,
                'options' => array_map(static function (string $text, int $optionIndex) use ($letters, $item): array {
                    return [
                        'letter' => $letters[$optionIndex],
                        'text' => $text,
                        'is_correct' => $letters[$optionIndex] === $item[2] ? 1 : 0,
                    ];
                }, $item[1], array_keys($item[1])),
            ];
        }, $items, array_keys($items));
    }
}
