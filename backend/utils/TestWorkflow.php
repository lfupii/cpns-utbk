<?php

class TestWorkflow {
    public const MODE_STANDARD = 'standard';
    public const MODE_CPNS_CAT = 'cpns_cat';
    public const MODE_UTBK_SECTIONED = 'utbk_sectioned';

    public static function detectMode(array $package): string {
        $rawMode = trim((string) ($package['test_mode'] ?? ''));
        $allowedModes = [
            self::MODE_STANDARD,
            self::MODE_CPNS_CAT,
            self::MODE_UTBK_SECTIONED,
        ];

        if (in_array($rawMode, $allowedModes, true)) {
            return $rawMode;
        }

        $haystack = strtolower(
            trim((string) ($package['name'] ?? '')) . ' ' . trim((string) ($package['category_name'] ?? ''))
        );

        if (strpos($haystack, 'utbk') !== false) {
            return self::MODE_UTBK_SECTIONED;
        }

        if (strpos($haystack, 'cpns') !== false || strpos($haystack, 'skd') !== false) {
            return self::MODE_CPNS_CAT;
        }

        return self::MODE_STANDARD;
    }

    public static function defaultWorkflow(string $mode, int $fallbackMinutes = 0): array {
        if ($mode === self::MODE_CPNS_CAT) {
            return [
                'label' => 'CPNS CAT',
                'allow_random_navigation' => true,
                'save_behavior' => 'manual_next',
                'manual_finish' => true,
                'total_duration_minutes' => 100,
                'sections' => [
                    [
                        'code' => 'twk',
                        'name' => 'TWK',
                        'order' => 1,
                        'duration_minutes' => null,
                        'target_question_count' => 30,
                    ],
                    [
                        'code' => 'tiu',
                        'name' => 'TIU',
                        'order' => 2,
                        'duration_minutes' => null,
                        'target_question_count' => 35,
                    ],
                    [
                        'code' => 'tkp',
                        'name' => 'TKP',
                        'order' => 3,
                        'duration_minutes' => null,
                        'target_question_count' => 45,
                    ],
                ],
            ];
        }

        if ($mode === self::MODE_UTBK_SECTIONED) {
            return [
                'label' => 'UTBK Bertahap',
                'allow_random_navigation' => false,
                'save_behavior' => 'auto',
                'manual_finish' => false,
                'total_duration_minutes' => 195,
                'sections' => [
                    [
                        'code' => 'tps_penalaran_induktif',
                        'name' => 'Penalaran Induktif',
                        'session_name' => 'Tes Potensi Skolastik (TPS)',
                        'session_order' => 1,
                        'order' => 1,
                        'duration_minutes' => 10,
                        'target_question_count' => 10,
                    ],
                    [
                        'code' => 'tps_penalaran_deduktif',
                        'name' => 'Penalaran Deduktif',
                        'session_name' => 'Tes Potensi Skolastik (TPS)',
                        'session_order' => 1,
                        'order' => 2,
                        'duration_minutes' => 10,
                        'target_question_count' => 10,
                    ],
                    [
                        'code' => 'tps_penalaran_kuantitatif',
                        'name' => 'Penalaran Kuantitatif',
                        'session_name' => 'Tes Potensi Skolastik (TPS)',
                        'session_order' => 1,
                        'order' => 3,
                        'duration_minutes' => 10,
                        'target_question_count' => 10,
                    ],
                    [
                        'code' => 'tps_ppu',
                        'name' => 'Pengetahuan dan Pemahaman Umum',
                        'session_name' => 'Tes Potensi Skolastik (TPS)',
                        'session_order' => 1,
                        'order' => 4,
                        'duration_minutes' => 15,
                        'target_question_count' => 20,
                    ],
                    [
                        'code' => 'tps_pbm',
                        'name' => 'Pemahaman Bacaan dan Menulis',
                        'session_name' => 'Tes Potensi Skolastik (TPS)',
                        'session_order' => 1,
                        'order' => 5,
                        'duration_minutes' => 25,
                        'target_question_count' => 20,
                    ],
                    [
                        'code' => 'tps_pk',
                        'name' => 'Pengetahuan Kuantitatif',
                        'session_name' => 'Tes Potensi Skolastik (TPS)',
                        'session_order' => 1,
                        'order' => 6,
                        'duration_minutes' => 20,
                        'target_question_count' => 20,
                    ],
                    [
                        'code' => 'literasi_indonesia',
                        'name' => 'Literasi dalam Bahasa Indonesia',
                        'session_name' => 'Tes Literasi',
                        'session_order' => 2,
                        'order' => 7,
                        'duration_minutes' => 42.5,
                        'target_question_count' => 30,
                    ],
                    [
                        'code' => 'literasi_inggris',
                        'name' => 'Literasi dalam Bahasa Inggris',
                        'session_name' => 'Tes Literasi',
                        'session_order' => 2,
                        'order' => 8,
                        'duration_minutes' => 20,
                        'target_question_count' => 20,
                    ],
                    [
                        'code' => 'penalaran_matematika',
                        'name' => 'Penalaran Matematika',
                        'session_name' => 'Tes Literasi',
                        'session_order' => 2,
                        'order' => 9,
                        'duration_minutes' => 42.5,
                        'target_question_count' => 20,
                    ],
                ],
            ];
        }

        return [
            'label' => 'Standard',
            'allow_random_navigation' => true,
            'save_behavior' => 'manual_next',
            'manual_finish' => true,
            'total_duration_minutes' => $fallbackMinutes > 0 ? $fallbackMinutes : 90,
            'sections' => [
                [
                    'code' => 'general',
                    'name' => 'Semua Soal',
                    'order' => 1,
                    'duration_minutes' => null,
                ],
            ],
        ];
    }

    public static function buildPackageWorkflow(array $package): array {
        $mode = self::detectMode($package);
        $default = self::defaultWorkflow($mode, (int) ($package['time_limit'] ?? 0));
        $custom = json_decode((string) ($package['workflow_config'] ?? ''), true);
        if (!is_array($custom)) {
            $custom = [];
        }

        $workflow = [
            'mode' => $mode,
            'label' => trim((string) ($custom['label'] ?? $default['label'])),
            'allow_random_navigation' => array_key_exists('allow_random_navigation', $custom)
                ? (bool) $custom['allow_random_navigation']
                : (bool) $default['allow_random_navigation'],
            'save_behavior' => trim((string) ($custom['save_behavior'] ?? $default['save_behavior'])),
            'manual_finish' => array_key_exists('manual_finish', $custom)
                ? (bool) $custom['manual_finish']
                : (bool) $default['manual_finish'],
            'total_duration_minutes' => (float) ($custom['total_duration_minutes'] ?? $default['total_duration_minutes']),
            'sections' => self::normalizeSections($custom['sections'] ?? $default['sections']),
        ];

        if ($workflow['mode'] === self::MODE_UTBK_SECTIONED) {
            $sectionTotalMinutes = 0.0;
            foreach ($workflow['sections'] as $section) {
                $sectionTotalMinutes += (float) ($section['duration_minutes'] ?? 0);
            }

            if ($sectionTotalMinutes > 0) {
                $workflow['total_duration_minutes'] = $sectionTotalMinutes;
            }
        }

        return $workflow;
    }

    public static function computeAttemptState(array $attempt, array $workflow, ?int $nowTimestamp = null): array {
        $now = $nowTimestamp ?? time();
        $startTime = strtotime((string) ($attempt['start_time'] ?? 'now'));
        if ($startTime === false) {
            $startTime = $now;
        }

        $elapsedSeconds = max(0, $now - $startTime);
        $totalSeconds = max(0, (int) round((float) ($workflow['total_duration_minutes'] ?? 0) * 60));
        $remainingSeconds = max(0, $totalSeconds - $elapsedSeconds);
        $isExpired = $totalSeconds > 0 && $remainingSeconds <= 0;

        $state = [
            'mode' => $workflow['mode'],
            'started_at' => date(DATE_ATOM, $startTime),
            'server_time' => date(DATE_ATOM, $now),
            'elapsed_seconds' => $elapsedSeconds,
            'remaining_seconds' => $remainingSeconds,
            'total_duration_seconds' => $totalSeconds,
            'is_expired' => $isExpired,
            'active_section_code' => null,
            'active_section_name' => null,
            'active_section_order' => null,
            'active_section_remaining_seconds' => $remainingSeconds,
            'available_section_codes' => array_values(array_map(
                static function (array $section): string {
                    return (string) $section['code'];
                },
                $workflow['sections']
            )),
            'completed_section_codes' => [],
            'locked_section_codes' => [],
        ];

        if ($workflow['mode'] !== self::MODE_UTBK_SECTIONED || count($workflow['sections']) === 0) {
            return $state;
        }

        $cursor = 0;
        $activeSection = null;
        $completed = [];
        $locked = [];
        $sections = $workflow['sections'];

        foreach ($sections as $index => $section) {
            $durationSeconds = max(0, (int) round((float) ($section['duration_minutes'] ?? 0) * 60));
            $sectionEnd = $cursor + $durationSeconds;

            if (!$isExpired && $elapsedSeconds < $sectionEnd) {
                $activeSection = $section;
                $state['active_section_remaining_seconds'] = max(0, $sectionEnd - $elapsedSeconds);
                foreach ($sections as $futureIndex => $futureSection) {
                    if ($futureIndex > $index) {
                        $locked[] = (string) $futureSection['code'];
                    }
                }
                break;
            }

            $completed[] = (string) $section['code'];
            $cursor = $sectionEnd;
        }

        if ($isExpired) {
            $activeSection = $sections[count($sections) - 1];
            $locked = [];
        } elseif ($activeSection === null) {
            $activeSection = $sections[count($sections) - 1];
        }

        $state['active_section_code'] = (string) ($activeSection['code'] ?? '');
        $state['active_section_name'] = (string) ($activeSection['name'] ?? '');
        $state['active_section_order'] = (int) ($activeSection['order'] ?? 1);
        $state['available_section_codes'] = $isExpired
            ? []
            : [$state['active_section_code']];
        $state['completed_section_codes'] = $isExpired
            ? array_values(array_map(static function (array $section): string {
                return (string) $section['code'];
            }, $sections))
            : $completed;
        $state['locked_section_codes'] = $locked;

        return $state;
    }

    public static function allocateQuestionsToSections(int $totalQuestions, array $sections): array {
        $sectionCount = count($sections);
        if ($totalQuestions <= 0 || $sectionCount === 0) {
            return [];
        }

        $weights = [];
        $sumWeights = 0.0;
        foreach ($sections as $section) {
            $weight = (float) ($section['target_question_count'] ?? 0);
            if ($weight <= 0) {
                $weight = (float) ($section['duration_minutes'] ?? 0);
            }
            if ($weight <= 0) {
                $weight = 1.0;
            }

            $weights[] = $weight;
            $sumWeights += $weight;
        }

        if ($sumWeights <= 0) {
            $sumWeights = (float) $sectionCount;
            $weights = array_fill(0, $sectionCount, 1.0);
        }

        $allocation = [];
        $remainders = [];
        $allocated = 0;

        foreach ($weights as $index => $weight) {
            $raw = ($totalQuestions * $weight) / $sumWeights;
            $base = (int) floor($raw);
            $allocation[$index] = $base;
            $remainders[$index] = $raw - $base;
            $allocated += $base;
        }

        $remaining = $totalQuestions - $allocated;
        arsort($remainders);
        foreach (array_keys($remainders) as $index) {
            if ($remaining <= 0) {
                break;
            }

            $allocation[$index]++;
            $remaining--;
        }

        return $allocation;
    }

    private static function normalizeSections(array $sections): array {
        $normalized = [];

        foreach ($sections as $index => $section) {
            if (!is_array($section)) {
                continue;
            }

            $code = trim((string) ($section['code'] ?? ''));
            $name = trim((string) ($section['name'] ?? ''));
            if ($code === '' || $name === '') {
                continue;
            }

            $normalized[] = [
                'code' => $code,
                'name' => $name,
                'session_name' => trim((string) ($section['session_name'] ?? '')),
                'session_order' => max(1, (int) ($section['session_order'] ?? 1)),
                'order' => max(1, (int) ($section['order'] ?? ($index + 1))),
                'duration_minutes' => isset($section['duration_minutes']) && $section['duration_minutes'] !== null
                    ? max(0, (float) $section['duration_minutes'])
                    : null,
                'target_question_count' => isset($section['target_question_count']) && $section['target_question_count'] !== null
                    ? max(0, (int) $section['target_question_count'])
                    : null,
            ];
        }

        usort($normalized, static function (array $left, array $right): int {
            $leftSession = (int) ($left['session_order'] ?? 1);
            $rightSession = (int) ($right['session_order'] ?? 1);
            if ($leftSession !== $rightSession) {
                return $leftSession <=> $rightSession;
            }

            return ((int) $left['order']) <=> ((int) $right['order']);
        });

        return array_values($normalized);
    }
}
