<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/vendor/autoload.php';

if (class_exists(Dotenv\Dotenv::class) && file_exists(dirname(__DIR__) . '/.env')) {
    Dotenv\Dotenv::createImmutable(dirname(__DIR__))->safeLoad();
}

require_once dirname(__DIR__) . '/config/Database.php';

$tables = [
    'news_articles',
    'news_article_drafts',
    'news_sections',
    'news_section_drafts',
    'news_section_articles',
    'news_section_draft_articles',
];

$counts = [];
foreach ($tables as $tableName) {
    $result = $mysqli->query("SELECT COUNT(*) AS total FROM {$tableName}");
    $row = $result ? $result->fetch_assoc() : ['total' => null];
    $counts[$tableName] = isset($row['total']) ? (int) $row['total'] : null;
}

echo json_encode([
    'status' => 'ok',
    'database' => DB_NAME,
    'counts' => $counts,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
