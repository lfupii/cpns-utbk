<?php
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../middleware/Response.php';

class NewsController {
    private $mysqli;

    public function __construct($mysqli) {
        $this->mysqli = $mysqli;
    }

    private function decodeTags($value): array {
        if (is_string($value) && trim($value) !== '') {
            $decoded = json_decode($value, true);
            if (is_array($decoded)) {
                return array_values(array_filter(array_map('strval', $decoded)));
            }
        }

        if (is_array($value)) {
            return array_values(array_filter(array_map('strval', $value)));
        }

        return [];
    }

    private function buildExcerpt(string $excerpt, string $content): string {
        $cleanExcerpt = trim($excerpt);
        if ($cleanExcerpt !== '') {
            return $cleanExcerpt;
        }

        $plainText = trim(preg_replace('/\s+/', ' ', strip_tags($content)));
        if ($plainText === '') {
            return '';
        }

        return mb_strimwidth($plainText, 0, 180, '...');
    }

    private function normalizeArticle(array $article): array {
        return [
            'id' => (int) ($article['id'] ?? 0),
            'slug' => (string) ($article['slug'] ?? ''),
            'title' => (string) ($article['title'] ?? ''),
            'excerpt' => (string) ($article['excerpt'] ?? ''),
            'content' => (string) ($article['content'] ?? ''),
            'cover_image_url' => (string) ($article['cover_image_url'] ?? ''),
            'category' => (string) ($article['category'] ?? 'Nasional'),
            'author_name' => (string) ($article['author_name'] ?? 'Tim Redaksi'),
            'read_time_minutes' => max(1, (int) ($article['read_time_minutes'] ?? 4)),
            'status' => (string) ($article['status'] ?? 'draft'),
            'visibility' => (string) ($article['visibility'] ?? 'public'),
            'tags' => $this->decodeTags($article['tags_json'] ?? '[]'),
            'focus_keyword' => (string) ($article['focus_keyword'] ?? ''),
            'allow_comments' => (int) ($article['allow_comments'] ?? 1),
            'is_featured' => (int) ($article['is_featured'] ?? 0),
            'featured_order' => (int) ($article['featured_order'] ?? 0),
            'is_popular' => (int) ($article['is_popular'] ?? 0),
            'popular_order' => (int) ($article['popular_order'] ?? 0),
            'is_editor_pick' => (int) ($article['is_editor_pick'] ?? 0),
            'editor_pick_order' => (int) ($article['editor_pick_order'] ?? 0),
            'published_at' => $article['published_at'] ?? null,
            'created_at' => $article['created_at'] ?? null,
            'updated_at' => $article['updated_at'] ?? null,
        ];
    }

    private function formatRelativeTime(?string $dateTimeValue): string {
        if (!$dateTimeValue) {
            return 'Baru saja';
        }

        $timestamp = strtotime($dateTimeValue);
        if ($timestamp === false) {
            return 'Baru saja';
        }

        $delta = max(0, time() - $timestamp);
        if ($delta < 60) {
            return 'Baru saja';
        }

        $minutes = (int) floor($delta / 60);
        if ($minutes < 60) {
            return $minutes . ' menit lalu';
        }

        $hours = (int) floor($minutes / 60);
        if ($hours < 24) {
            return $hours . ' jam lalu';
        }

        $days = (int) floor($hours / 24);
        if ($days < 30) {
            return $days . ' hari lalu';
        }

        $months = (int) floor($days / 30);
        if ($months < 12) {
            return $months . ' bulan lalu';
        }

        $years = (int) floor($months / 12);
        return $years . ' tahun lalu';
    }

    private function buildStoryCard(array $article): array {
        $publishedAt = $article['published_at'] ?? $article['updated_at'] ?? $article['created_at'] ?? null;
        $excerpt = $this->buildExcerpt((string) ($article['excerpt'] ?? ''), (string) ($article['content'] ?? ''));

        return [
            'id' => (int) ($article['id'] ?? 0),
            'slug' => (string) ($article['slug'] ?? ''),
            'category' => (string) ($article['category'] ?? 'Nasional'),
            'title' => (string) ($article['title'] ?? ''),
            'excerpt' => $excerpt,
            'image' => (string) ($article['cover_image_url'] ?? ''),
            'author' => (string) ($article['author_name'] ?? 'Tim Redaksi'),
            'age' => $this->formatRelativeTime($publishedAt),
            'readTime' => max(1, (int) ($article['read_time_minutes'] ?? 4)) . ' min',
            'published_at' => $publishedAt,
            'tags' => $article['tags'] ?? [],
        ];
    }

    private function sortByPublishedAtDesc(array $articles): array {
        usort($articles, static function (array $left, array $right): int {
            $leftTimestamp = strtotime((string) ($left['published_at'] ?? $left['updated_at'] ?? $left['created_at'] ?? '')) ?: 0;
            $rightTimestamp = strtotime((string) ($right['published_at'] ?? $right['updated_at'] ?? $right['created_at'] ?? '')) ?: 0;

            if ($leftTimestamp === $rightTimestamp) {
                return ((int) ($right['id'] ?? 0)) <=> ((int) ($left['id'] ?? 0));
            }

            return $rightTimestamp <=> $leftTimestamp;
        });

        return $articles;
    }

    private function fetchPublishedArticles(): array {
        $query = "SELECT *
                  FROM news_articles
                  WHERE status = 'published'
                    AND visibility = 'public'
                  ORDER BY COALESCE(published_at, created_at) DESC, id DESC";
        $result = $this->mysqli->query($query);

        if (!$result) {
            sendResponse('error', 'Gagal mengambil berita publik', null, 500);
        }

        $articles = [];
        while ($row = $result->fetch_assoc()) {
            $articles[] = $this->normalizeArticle($row);
        }

        return $articles;
    }

    private function fetchPublishedSections(): array {
        $result = $this->mysqli->query(
            "SELECT *
             FROM news_sections
             WHERE is_active = 1
             ORDER BY section_order ASC, id ASC"
        );

        if (!$result) {
            sendResponse('error', 'Gagal mengambil section berita publik', null, 500);
        }

        $sections = [];
        while ($row = $result->fetch_assoc()) {
            $sections[] = [
                'id' => (int) ($row['id'] ?? 0),
                'slug' => (string) ($row['slug'] ?? ''),
                'title' => (string) ($row['title'] ?? ''),
                'description' => (string) ($row['description'] ?? ''),
                'layout_style' => (string) ($row['layout_style'] ?? 'cards'),
                'article_count' => max(1, (int) ($row['article_count'] ?? 5)),
                'section_order' => (int) ($row['section_order'] ?? 0),
            ];
        }

        return $sections;
    }

    private function fetchStoriesForSection(int $sectionId, int $limit): array {
        $query = "SELECT na.*
                  FROM news_section_articles nsa
                  JOIN news_articles na ON na.id = nsa.article_id
                  WHERE nsa.section_id = ?
                    AND na.status = 'published'
                    AND na.visibility = 'public'
                  ORDER BY nsa.article_order ASC, COALESCE(na.published_at, na.created_at) DESC, na.id DESC";
        $stmt = $this->mysqli->prepare($query);
        $stmt->bind_param('i', $sectionId);
        $stmt->execute();
        $result = $stmt->get_result();

        $stories = [];
        while ($row = $result->fetch_assoc()) {
            $stories[] = $this->buildStoryCard($this->normalizeArticle($row));
        }

        return array_slice($stories, 0, $limit);
    }

    private function buildCustomSections(): array {
        $sections = $this->fetchPublishedSections();
        if ($sections === []) {
            return [];
        }

        $payload = [];
        foreach ($sections as $section) {
            $items = $this->fetchStoriesForSection((int) $section['id'], (int) $section['article_count']);
            if ($items === []) {
                continue;
            }

            $payload[] = [
                'id' => (int) $section['id'],
                'slug' => (string) $section['slug'],
                'title' => (string) $section['title'],
                'description' => (string) $section['description'],
                'layout_style' => (string) $section['layout_style'],
                'article_count' => (int) $section['article_count'],
                'section_order' => (int) $section['section_order'],
                'items' => $items,
            ];
        }

        return $payload;
    }

    private function buildFlagFallbackSections(array $articles): array {
        if ($articles === []) {
            return [];
        }

        $featuredArticles = array_values(array_filter($articles, static function (array $article): bool {
            return (int) ($article['is_featured'] ?? 0) === 1;
        }));
        usort($featuredArticles, static function (array $left, array $right): int {
            $leftOrder = (int) ($left['featured_order'] ?? 0);
            $rightOrder = (int) ($right['featured_order'] ?? 0);
            if ($leftOrder === $rightOrder) {
                $leftTimestamp = strtotime((string) ($left['published_at'] ?? $left['created_at'] ?? '')) ?: 0;
                $rightTimestamp = strtotime((string) ($right['published_at'] ?? $right['created_at'] ?? '')) ?: 0;
                return $rightTimestamp <=> $leftTimestamp;
            }

            return $leftOrder <=> $rightOrder;
        });
        $featuredPool = count($featuredArticles) > 0 ? array_slice($featuredArticles, 0, 6) : array_slice($articles, 0, 6);

        $popularArticles = array_values(array_filter($articles, static function (array $article): bool {
            return (int) ($article['is_popular'] ?? 0) === 1;
        }));
        usort($popularArticles, static function (array $left, array $right): int {
            $leftOrder = (int) ($left['popular_order'] ?? 0);
            $rightOrder = (int) ($right['popular_order'] ?? 0);
            if ($leftOrder === $rightOrder) {
                $leftTimestamp = strtotime((string) ($left['published_at'] ?? $left['created_at'] ?? '')) ?: 0;
                $rightTimestamp = strtotime((string) ($right['published_at'] ?? $right['created_at'] ?? '')) ?: 0;
                return $rightTimestamp <=> $leftTimestamp;
            }

            return $leftOrder <=> $rightOrder;
        });
        $popularPool = count($popularArticles) > 0 ? array_slice($popularArticles, 0, 5) : array_slice($articles, 0, 5);

        $editorialArticles = array_values(array_filter($articles, static function (array $article): bool {
            return (int) ($article['is_editor_pick'] ?? 0) === 1;
        }));
        usort($editorialArticles, static function (array $left, array $right): int {
            $leftOrder = (int) ($left['editor_pick_order'] ?? 0);
            $rightOrder = (int) ($right['editor_pick_order'] ?? 0);
            if ($leftOrder === $rightOrder) {
                $leftTimestamp = strtotime((string) ($left['published_at'] ?? $left['created_at'] ?? '')) ?: 0;
                $rightTimestamp = strtotime((string) ($right['published_at'] ?? $right['created_at'] ?? '')) ?: 0;
                return $rightTimestamp <=> $leftTimestamp;
            }

            return $leftOrder <=> $rightOrder;
        });
        $editorialPool = count($editorialArticles) > 0 ? array_slice($editorialArticles, 0, 6) : array_slice($articles, 0, 6);
        $latestPool = array_slice($this->sortByPublishedAtDesc($articles), 0, 6);

        return [
            [
                'id' => 0,
                'slug' => 'sorotan-utama',
                'title' => 'Sorotan Utama',
                'description' => 'Fallback otomatis dari artikel yang ditandai headline.',
                'layout_style' => 'hero',
                'article_count' => count($featuredPool),
                'section_order' => 1,
                'items' => array_map(fn (array $article): array => $this->buildStoryCard($article), $featuredPool),
            ],
            [
                'id' => 0,
                'slug' => 'terpopuler',
                'title' => 'Terpopuler',
                'description' => 'Fallback otomatis dari artikel yang ditandai populer.',
                'layout_style' => 'ranked',
                'article_count' => count($popularPool),
                'section_order' => 2,
                'items' => array_map(fn (array $article): array => $this->buildStoryCard($article), $popularPool),
            ],
            [
                'id' => 0,
                'slug' => 'berita-terbaru',
                'title' => 'Berita Terbaru',
                'description' => 'Fallback otomatis dari artikel terbaru.',
                'layout_style' => 'lead-grid',
                'article_count' => count($latestPool),
                'section_order' => 3,
                'items' => array_map(fn (array $article): array => $this->buildStoryCard($article), $latestPool),
            ],
            [
                'id' => 0,
                'slug' => 'pilihan-redaksi',
                'title' => 'Pilihan Redaksi',
                'description' => 'Fallback otomatis dari artikel pilihan redaksi.',
                'layout_style' => 'cards',
                'article_count' => count($editorialPool),
                'section_order' => 4,
                'items' => array_map(fn (array $article): array => $this->buildStoryCard($article), $editorialPool),
            ],
        ];
    }

    public function getFeed(): void {
        $customSections = $this->buildCustomSections();
        if ($customSections !== []) {
            sendResponse('success', 'Feed berita berhasil diambil', [
                'sections' => $customSections,
                'has_custom_sections' => true,
            ]);
        }

        $articles = $this->fetchPublishedArticles();
        if ($articles === []) {
            sendResponse('success', 'Feed berita kosong', [
                'sections' => [],
                'has_custom_sections' => false,
            ]);
        }

        sendResponse('success', 'Feed berita berhasil diambil', [
            'sections' => $this->buildFlagFallbackSections($articles),
            'has_custom_sections' => false,
        ]);
    }

    public function getArticleDetail(): void {
        $slug = trim((string) ($_GET['slug'] ?? ''));
        if ($slug === '') {
            sendResponse('error', 'Slug berita wajib diisi', null, 422);
        }

        $stmt = $this->mysqli->prepare(
            "SELECT *
             FROM news_articles
             WHERE slug = ?
               AND status = 'published'
               AND visibility = 'public'
             LIMIT 1"
        );
        $stmt->bind_param('s', $slug);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        if (!$row) {
            sendResponse('error', 'Berita tidak ditemukan', null, 404);
        }

        $article = $this->normalizeArticle($row);
        $detail = [
            'id' => (int) $article['id'],
            'slug' => (string) $article['slug'],
            'title' => (string) $article['title'],
            'excerpt' => $this->buildExcerpt((string) ($article['excerpt'] ?? ''), (string) ($article['content'] ?? '')),
            'content' => (string) $article['content'],
            'image' => (string) $article['cover_image_url'],
            'category' => (string) $article['category'],
            'author' => (string) $article['author_name'],
            'age' => $this->formatRelativeTime($article['published_at'] ?? null),
            'readTime' => max(1, (int) $article['read_time_minutes']) . ' min',
            'published_at' => $article['published_at'],
            'tags' => $article['tags'],
            'focus_keyword' => $article['focus_keyword'],
        ];

        $relatedStmt = $this->mysqli->prepare(
            "SELECT *
             FROM news_articles
             WHERE id != ?
               AND category = ?
               AND status = 'published'
               AND visibility = 'public'
             ORDER BY COALESCE(published_at, created_at) DESC, id DESC
             LIMIT 4"
        );
        $relatedStmt->bind_param('is', $article['id'], $article['category']);
        $relatedStmt->execute();
        $relatedResult = $relatedStmt->get_result();

        $relatedStories = [];
        while ($relatedRow = $relatedResult->fetch_assoc()) {
            $relatedStories[] = $this->buildStoryCard($this->normalizeArticle($relatedRow));
        }

        sendResponse('success', 'Detail berita berhasil diambil', [
            'article' => $detail,
            'related_stories' => $relatedStories,
        ]);
    }
}

$requestMethod = $_SERVER['REQUEST_METHOD'];
$requestPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

$controller = new NewsController($mysqli);

if (strpos($requestPath, '/api/news/feed') !== false && $requestMethod === 'GET') {
    $controller->getFeed();
} elseif (strpos($requestPath, '/api/news/article') !== false && $requestMethod === 'GET') {
    $controller->getArticleDetail();
} else {
    sendResponse('error', 'Endpoint berita tidak ditemukan', null, 404);
}
