<?php
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../middleware/Response.php';

class NewsController {
    private $mysqli;

    public function __construct($mysqli) {
        $this->mysqli = $mysqli;
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

    private function buildFeedStory(array $article): array {
        $publishedAt = $article['published_at'] ?? $article['updated_at'] ?? $article['created_at'] ?? null;

        return [
            'id' => (int) $article['id'],
            'slug' => (string) $article['slug'],
            'category' => (string) $article['category'],
            'title' => (string) $article['title'],
            'excerpt' => (string) $article['excerpt'],
            'image' => (string) $article['cover_image_url'],
            'author' => (string) $article['author_name'],
            'age' => $this->formatRelativeTime($publishedAt),
            'readTime' => max(1, (int) ($article['read_time_minutes'] ?? 4)) . ' min',
            'published_at' => $publishedAt,
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

    public function getFeed(): void {
        $articles = $this->fetchPublishedArticles();

        if ($articles === []) {
            sendResponse('success', 'Feed berita kosong', [
                'featured_tabs' => [],
                'featured_stories' => [],
                'popular_stories' => [],
                'latest_filters' => ['Semua'],
                'latest_stories' => [],
                'editorial_stories' => [],
            ]);
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

        $featuredPool = count($featuredArticles) > 0
            ? array_slice($featuredArticles, 0, 6)
            : array_slice($articles, 0, 6);
        $featuredStories = array_map(fn (array $article): array => $this->buildFeedStory($article), $featuredPool);
        $featuredTabs = array_map(static function (array $story): array {
            return [
                'slug' => $story['slug'],
                'label' => $story['category'],
            ];
        }, $featuredStories);

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

        $popularPool = count($popularArticles) > 0
            ? array_slice($popularArticles, 0, 5)
            : array_slice($articles, 0, 5);

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

        $editorialPool = count($editorialArticles) > 0
            ? array_slice($editorialArticles, 0, 5)
            : array_slice($articles, 0, 5);

        $latestStories = array_map(
            fn (array $article): array => $this->buildFeedStory($article),
            array_slice($this->sortByPublishedAtDesc($articles), 0, 8)
        );
        $latestCategories = ['Semua'];
        foreach ($latestStories as $story) {
            if (!in_array($story['category'], $latestCategories, true)) {
                $latestCategories[] = $story['category'];
            }
        }

        sendResponse('success', 'Feed berita berhasil diambil', [
            'featured_tabs' => $featuredTabs,
            'featured_stories' => $featuredStories,
            'popular_stories' => array_map(fn (array $article): array => $this->buildFeedStory($article), $popularPool),
            'latest_filters' => $latestCategories,
            'latest_stories' => $latestStories,
            'editorial_stories' => array_map(fn (array $article): array => $this->buildFeedStory($article), $editorialPool),
        ]);
    }
}

$requestMethod = $_SERVER['REQUEST_METHOD'];
$requestPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

$controller = new NewsController($mysqli);

if (strpos($requestPath, '/api/news/feed') !== false && $requestMethod === 'GET') {
    $controller->getFeed();
} else {
    sendResponse('error', 'Endpoint berita tidak ditemukan', null, 404);
}
