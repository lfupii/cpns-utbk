<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/vendor/autoload.php';

if (class_exists(Dotenv\Dotenv::class) && file_exists(dirname(__DIR__) . '/.env')) {
    Dotenv\Dotenv::createImmutable(dirname(__DIR__))->safeLoad();
}

require_once dirname(__DIR__) . '/config/Database.php';

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

function fetchSingleValue(mysqli $mysqli, string $sql, string $types = '', array $params = []) {
    $stmt = $mysqli->prepare($sql);
    if ($types !== '') {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_row();

    return $row[0] ?? null;
}

function ensureCategory(mysqli $mysqli, string $name, string $description): int
{
    $existingId = fetchSingleValue(
        $mysqli,
        'SELECT id FROM test_categories WHERE name = ? LIMIT 1',
        's',
        [$name]
    );

    if ($existingId) {
        $stmt = $mysqli->prepare('UPDATE test_categories SET description = ? WHERE id = ?');
        $stmt->bind_param('si', $description, $existingId);
        $stmt->execute();

        return (int) $existingId;
    }

    $stmt = $mysqli->prepare('INSERT INTO test_categories (name, description) VALUES (?, ?)');
    $stmt->bind_param('ss', $name, $description);
    $stmt->execute();

    return (int) $stmt->insert_id;
}

function ensurePackage(mysqli $mysqli, array $package): int
{
    $existingId = fetchSingleValue(
        $mysqli,
        'SELECT id FROM test_packages WHERE name = ? LIMIT 1',
        's',
        [$package['name']]
    );

    if ($existingId) {
        $stmt = $mysqli->prepare(
            'UPDATE test_packages
             SET category_id = ?, description = ?, price = ?, duration_days = ?, max_attempts = ?, question_count = ?, time_limit = ?
             WHERE id = ?'
        );
        $stmt->bind_param(
            'isiiiiii',
            $package['category_id'],
            $package['description'],
            $package['price'],
            $package['duration_days'],
            $package['max_attempts'],
            $package['question_count'],
            $package['time_limit'],
            $existingId
        );
        $stmt->execute();

        return (int) $existingId;
    }

    $stmt = $mysqli->prepare(
        'INSERT INTO test_packages (category_id, name, description, price, duration_days, max_attempts, question_count, time_limit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->bind_param(
        'issiiiii',
        $package['category_id'],
        $package['name'],
        $package['description'],
        $package['price'],
        $package['duration_days'],
        $package['max_attempts'],
        $package['question_count'],
        $package['time_limit']
    );
    $stmt->execute();

    return (int) $stmt->insert_id;
}

function questionCount(mysqli $mysqli, int $packageId): int
{
    return (int) fetchSingleValue(
        $mysqli,
        'SELECT COUNT(*) FROM questions WHERE package_id = ?',
        'i',
        [$packageId]
    );
}

function findSourcePackageWithQuestions(mysqli $mysqli, string $categoryName, int $excludePackageId): ?int
{
    $stmt = $mysqli->prepare(
        'SELECT tp.id, COUNT(q.id) AS total
         FROM test_packages tp
         JOIN test_categories tc ON tc.id = tp.category_id
         LEFT JOIN questions q ON q.package_id = tp.id
         WHERE tc.name = ? AND tp.id != ?
         GROUP BY tp.id
         HAVING total > 0
         ORDER BY total DESC, tp.id ASC
         LIMIT 1'
    );
    $stmt->bind_param('si', $categoryName, $excludePackageId);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();

    return $row ? (int) $row['id'] : null;
}

function copyQuestionBank(mysqli $mysqli, int $sourcePackageId, int $targetPackageId): int
{
    if ($sourcePackageId === $targetPackageId || questionCount($mysqli, $targetPackageId) > 0) {
        return questionCount($mysqli, $targetPackageId);
    }

    $questionStmt = $mysqli->prepare(
        'SELECT id, question_text, question_type, difficulty
         FROM questions
         WHERE package_id = ?
         ORDER BY id ASC'
    );
    $questionStmt->bind_param('i', $sourcePackageId);
    $questionStmt->execute();
    $questions = $questionStmt->get_result()->fetch_all(MYSQLI_ASSOC);

    $insertQuestionStmt = $mysqli->prepare(
        'INSERT INTO questions (package_id, question_text, question_type, difficulty)
         VALUES (?, ?, ?, ?)'
    );
    $optionStmt = $mysqli->prepare(
        'SELECT option_letter, option_text, is_correct
         FROM question_options
         WHERE question_id = ?
         ORDER BY id ASC'
    );
    $insertOptionStmt = $mysqli->prepare(
        'INSERT INTO question_options (question_id, option_letter, option_text, is_correct)
         VALUES (?, ?, ?, ?)'
    );

    foreach ($questions as $question) {
        $insertQuestionStmt->bind_param(
            'isss',
            $targetPackageId,
            $question['question_text'],
            $question['question_type'],
            $question['difficulty']
        );
        $insertQuestionStmt->execute();
        $newQuestionId = (int) $insertQuestionStmt->insert_id;

        $optionStmt->bind_param('i', $question['id']);
        $optionStmt->execute();
        $options = $optionStmt->get_result()->fetch_all(MYSQLI_ASSOC);

        foreach ($options as $option) {
            $isCorrect = (int) $option['is_correct'];
            $insertOptionStmt->bind_param(
                'issi',
                $newQuestionId,
                $option['option_letter'],
                $option['option_text'],
                $isCorrect
            );
            $insertOptionStmt->execute();
        }
    }

    return questionCount($mysqli, $targetPackageId);
}

function insertQuestionWithOptions(mysqli $mysqli, int $packageId, array $question): void
{
    $insertQuestionStmt = $mysqli->prepare(
        'INSERT INTO questions (package_id, question_text, question_type, difficulty)
         VALUES (?, ?, ?, ?)'
    );
    $insertQuestionStmt->bind_param(
        'isss',
        $packageId,
        $question['text'],
        $question['type'],
        $question['difficulty']
    );
    $insertQuestionStmt->execute();
    $questionId = (int) $insertQuestionStmt->insert_id;

    $insertOptionStmt = $mysqli->prepare(
        'INSERT INTO question_options (question_id, option_letter, option_text, is_correct)
         VALUES (?, ?, ?, ?)'
    );

    foreach ($question['options'] as $option) {
        $isCorrect = $option['is_correct'] ? 1 : 0;
        $insertOptionStmt->bind_param(
            'issi',
            $questionId,
            $option['letter'],
            $option['text'],
            $isCorrect
        );
        $insertOptionStmt->execute();
    }
}

function ensureUtbkQuestionBank(mysqli $mysqli, int $packageId): int
{
    if (questionCount($mysqli, $packageId) > 0) {
        return questionCount($mysqli, $packageId);
    }

    $questionBank = [
        [
            'text' => 'Jika rata-rata 4 bilangan adalah 18 dan tiga bilangan pertama berjumlah 50, maka bilangan keempat adalah...',
            'type' => 'single_choice',
            'difficulty' => 'easy',
            'options' => [
                ['letter' => 'A', 'text' => '18', 'is_correct' => false],
                ['letter' => 'B', 'text' => '20', 'is_correct' => false],
                ['letter' => 'C', 'text' => '22', 'is_correct' => true],
                ['letter' => 'D', 'text' => '24', 'is_correct' => false],
                ['letter' => 'E', 'text' => '26', 'is_correct' => false],
            ],
        ],
        [
            'text' => 'Semua peserta tryout disiplin. Sebagian peserta tryout mengikuti kelas malam. Kesimpulan yang pasti benar adalah...',
            'type' => 'single_choice',
            'difficulty' => 'medium',
            'options' => [
                ['letter' => 'A', 'text' => 'Sebagian yang mengikuti kelas malam disiplin.', 'is_correct' => true],
                ['letter' => 'B', 'text' => 'Semua yang disiplin mengikuti kelas malam.', 'is_correct' => false],
                ['letter' => 'C', 'text' => 'Tidak ada yang mengikuti kelas malam.', 'is_correct' => false],
                ['letter' => 'D', 'text' => 'Sebagian peserta tidak disiplin.', 'is_correct' => false],
                ['letter' => 'E', 'text' => 'Semua peserta mengikuti kelas malam.', 'is_correct' => false],
            ],
        ],
        [
            'text' => 'Pilih pasangan kata yang hubungannya paling mirip: "arsip : dokumen" ...',
            'type' => 'single_choice',
            'difficulty' => 'medium',
            'options' => [
                ['letter' => 'A', 'text' => 'perpustakaan : buku', 'is_correct' => true],
                ['letter' => 'B', 'text' => 'kursi : duduk', 'is_correct' => false],
                ['letter' => 'C', 'text' => 'pena : menulis', 'is_correct' => false],
                ['letter' => 'D', 'text' => 'layar : cahaya', 'is_correct' => false],
                ['letter' => 'E', 'text' => 'meja : kayu', 'is_correct' => false],
            ],
        ],
        [
            'text' => 'Nilai x yang memenuhi 3x - 7 = 20 adalah...',
            'type' => 'single_choice',
            'difficulty' => 'easy',
            'options' => [
                ['letter' => 'A', 'text' => '7', 'is_correct' => false],
                ['letter' => 'B', 'text' => '8', 'is_correct' => false],
                ['letter' => 'C', 'text' => '9', 'is_correct' => true],
                ['letter' => 'D', 'text' => '10', 'is_correct' => false],
                ['letter' => 'E', 'text' => '11', 'is_correct' => false],
            ],
        ],
        [
            'text' => 'Kalimat yang paling efektif adalah...',
            'type' => 'single_choice',
            'difficulty' => 'medium',
            'options' => [
                ['letter' => 'A', 'text' => 'Para siswa-siswa sedang belajar bersama.', 'is_correct' => false],
                ['letter' => 'B', 'text' => 'Kami membahas rencana itu secara bersama-sama.', 'is_correct' => false],
                ['letter' => 'C', 'text' => 'Panitia segera mengumumkan hasil seleksi.', 'is_correct' => true],
                ['letter' => 'D', 'text' => 'Mereka naik ke atas panggung utama.', 'is_correct' => false],
                ['letter' => 'E', 'text' => 'Dia adalah merupakan juara umum.', 'is_correct' => false],
            ],
        ],
        [
            'text' => 'The best synonym for "precise" is...',
            'type' => 'single_choice',
            'difficulty' => 'easy',
            'options' => [
                ['letter' => 'A', 'text' => 'accurate', 'is_correct' => true],
                ['letter' => 'B', 'text' => 'careless', 'is_correct' => false],
                ['letter' => 'C', 'text' => 'ordinary', 'is_correct' => false],
                ['letter' => 'D', 'text' => 'uncertain', 'is_correct' => false],
                ['letter' => 'E', 'text' => 'lengthy', 'is_correct' => false],
            ],
        ],
        [
            'text' => 'Deret berikutnya dari 5, 8, 13, 20, 29, ... adalah...',
            'type' => 'single_choice',
            'difficulty' => 'medium',
            'options' => [
                ['letter' => 'A', 'text' => '36', 'is_correct' => false],
                ['letter' => 'B', 'text' => '38', 'is_correct' => false],
                ['letter' => 'C', 'text' => '40', 'is_correct' => true],
                ['letter' => 'D', 'text' => '42', 'is_correct' => false],
                ['letter' => 'E', 'text' => '44', 'is_correct' => false],
            ],
        ],
        [
            'text' => 'Jika 2p + q = 19 dan p = 7, maka nilai q adalah...',
            'type' => 'single_choice',
            'difficulty' => 'easy',
            'options' => [
                ['letter' => 'A', 'text' => '3', 'is_correct' => false],
                ['letter' => 'B', 'text' => '4', 'is_correct' => false],
                ['letter' => 'C', 'text' => '5', 'is_correct' => true],
                ['letter' => 'D', 'text' => '6', 'is_correct' => false],
                ['letter' => 'E', 'text' => '7', 'is_correct' => false],
            ],
        ],
        [
            'text' => 'Bacalah pernyataan berikut: "Semua data valid tersimpan rapi. Sebagian data tersimpan rapi dapat diakses publik." Kesimpulan yang benar adalah...',
            'type' => 'single_choice',
            'difficulty' => 'hard',
            'options' => [
                ['letter' => 'A', 'text' => 'Semua data valid dapat diakses publik.', 'is_correct' => false],
                ['letter' => 'B', 'text' => 'Sebagian data yang dapat diakses publik tersimpan rapi.', 'is_correct' => true],
                ['letter' => 'C', 'text' => 'Tidak ada data valid yang dapat diakses publik.', 'is_correct' => false],
                ['letter' => 'D', 'text' => 'Semua data tersimpan rapi adalah valid.', 'is_correct' => false],
                ['letter' => 'E', 'text' => 'Sebagian data valid tidak tersimpan rapi.', 'is_correct' => false],
            ],
        ],
        [
            'text' => 'Sebuah buku didiskon 20% sehingga harganya menjadi Rp64.000. Harga awal buku tersebut adalah...',
            'type' => 'single_choice',
            'difficulty' => 'medium',
            'options' => [
                ['letter' => 'A', 'text' => 'Rp76.000', 'is_correct' => false],
                ['letter' => 'B', 'text' => 'Rp78.000', 'is_correct' => false],
                ['letter' => 'C', 'text' => 'Rp80.000', 'is_correct' => true],
                ['letter' => 'D', 'text' => 'Rp82.000', 'is_correct' => false],
                ['letter' => 'E', 'text' => 'Rp84.000', 'is_correct' => false],
            ],
        ],
    ];

    foreach ($questionBank as $question) {
        insertQuestionWithOptions($mysqli, $packageId, $question);
    }

    return questionCount($mysqli, $packageId);
}

function syncQuestionCount(mysqli $mysqli, int $packageId): int
{
    $count = questionCount($mysqli, $packageId);
    $stmt = $mysqli->prepare('UPDATE test_packages SET question_count = ? WHERE id = ?');
    $stmt->bind_param('ii', $count, $packageId);
    $stmt->execute();

    return $count;
}

$mysqli->begin_transaction();

try {
    $cpnsCategoryId = ensureCategory($mysqli, 'CPNS 2026', 'Tryout test untuk CAT CPNS 2026');
    $utbkCategoryId = ensureCategory($mysqli, 'UTBK 2026', 'Tryout test untuk UTBK 2026');

    $cpnsPackageId = ensurePackage($mysqli, [
        'category_id' => $cpnsCategoryId,
        'name' => 'CPNS Intensif',
        'description' => 'Paket demo CPNS dengan simulasi soal dan evaluasi hasil.',
        'price' => 10000,
        'duration_days' => 30,
        'max_attempts' => 1,
        'question_count' => 0,
        'time_limit' => 120,
    ]);

    $utbkPackageId = ensurePackage($mysqli, [
        'category_id' => $utbkCategoryId,
        'name' => 'UTBK Intensif',
        'description' => 'Paket demo UTBK dengan latihan dasar TPS dan penalaran.',
        'price' => 5000,
        'duration_days' => 30,
        'max_attempts' => 1,
        'question_count' => 0,
        'time_limit' => 90,
    ]);

    $cpnsSourcePackageId = findSourcePackageWithQuestions($mysqli, 'CPNS 2026', $cpnsPackageId);
    $cpnsTotal = copyQuestionBank($mysqli, (int) $cpnsSourcePackageId, $cpnsPackageId);
    $utbkTotal = ensureUtbkQuestionBank($mysqli, $utbkPackageId);

    $cpnsTotal = syncQuestionCount($mysqli, $cpnsPackageId);
    $utbkTotal = syncQuestionCount($mysqli, $utbkPackageId);

    $mysqli->commit();

    echo json_encode([
        'status' => 'ok',
        'cpns_package_id' => $cpnsPackageId,
        'cpns_questions' => $cpnsTotal,
        'utbk_package_id' => $utbkPackageId,
        'utbk_questions' => $utbkTotal,
    ], JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . PHP_EOL;
} catch (Throwable $error) {
    $mysqli->rollback();
    fwrite(STDERR, $error->getMessage() . PHP_EOL);
    exit(1);
}
