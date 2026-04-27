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
            'active_section_elapsed_seconds' => 0,
            'active_section_duration_seconds' => 0,
            'active_section_remaining_seconds' => $remainingSeconds,
            'active_section_started_at' => null,
            'available_section_codes' => array_values(array_map(
                static function (array $section): string {
                    return (string) $section['code'];
                },
                $workflow['sections']
            )),
            'completed_section_codes' => [],
            'locked_section_codes' => [],
            'has_next_section' => false,
            'next_section_code' => null,
            'next_section_name' => null,
            'is_last_section' => true,
        ];

        if ($workflow['mode'] !== self::MODE_UTBK_SECTIONED || count($workflow['sections']) === 0) {
            return $state;
        }

        $sections = array_values($workflow['sections']);
        $sectionDurations = array_map([self::class, 'getSectionDurationSeconds'], $sections);
        $activeIndex = self::findSectionIndexByOrder(
            $sections,
            max(1, (int) ($attempt['active_section_order'] ?? ($sections[0]['order'] ?? 1)))
        );
        $sectionStartedAt = strtotime((string) ($attempt['active_section_started_at'] ?? ''));
        if ($sectionStartedAt === false) {
            $sectionStartedAt = $startTime;
        }
        if ($sectionStartedAt < $startTime) {
            $sectionStartedAt = $startTime;
        }

        $consumedSeconds = 0;
        $completed = [];
        $locked = [];

        for ($index = 0; $index < $activeIndex; $index++) {
            $completed[] = (string) ($sections[$index]['code'] ?? '');
            $consumedSeconds += (int) ($sectionDurations[$index] ?? 0);
        }

        $activeSection = $sections[$activeIndex] ?? $sections[0];
        $activeSectionStart = $sectionStartedAt;

        while ($activeIndex < count($sections)) {
            $activeSection = $sections[$activeIndex];
            $durationSeconds = (int) ($sectionDurations[$activeIndex] ?? 0);
            $elapsedInSection = max(0, $now - $activeSectionStart);

            if ($durationSeconds > 0 && $elapsedInSection < $durationSeconds) {
                $remainingSeconds = max(0, $totalSeconds - ($consumedSeconds + $elapsedInSection));
                $state['elapsed_seconds'] = max(0, $totalSeconds - $remainingSeconds);
                $state['remaining_seconds'] = $remainingSeconds;
                $state['total_duration_seconds'] = $totalSeconds;
                $state['is_expired'] = false;
                $state['active_section_code'] = (string) ($activeSection['code'] ?? '');
                $state['active_section_name'] = (string) ($activeSection['name'] ?? '');
                $state['active_section_order'] = (int) ($activeSection['order'] ?? ($activeIndex + 1));
                $state['active_section_elapsed_seconds'] = $elapsedInSection;
                $state['active_section_duration_seconds'] = $durationSeconds;
                $state['active_section_remaining_seconds'] = max(0, $durationSeconds - $elapsedInSection);
                $state['active_section_started_at'] = date(DATE_ATOM, $activeSectionStart);
                $state['available_section_codes'] = [$state['active_section_code']];
                $state['completed_section_codes'] = $completed;

                foreach ($sections as $futureIndex => $futureSection) {
                    if ($futureIndex > $activeIndex) {
                        $locked[] = (string) ($futureSection['code'] ?? '');
                    }
                }

                $nextSection = $sections[$activeIndex + 1] ?? null;
                $state['locked_section_codes'] = $locked;
                $state['has_next_section'] = $nextSection !== null;
                $state['next_section_code'] = $nextSection['code'] ?? null;
                $state['next_section_name'] = $nextSection['name'] ?? null;
                $state['is_last_section'] = $nextSection === null;

                return $state;
            }

            $consumedSeconds += $durationSeconds;
            $completed[] = (string) ($activeSection['code'] ?? '');
            $activeSectionStart += $durationSeconds;
            $activeIndex++;
        }

        $lastSection = $sections[count($sections) - 1];
        $state['elapsed_seconds'] = $totalSeconds;
        $state['remaining_seconds'] = 0;
        $state['total_duration_seconds'] = $totalSeconds;
        $state['is_expired'] = $totalSeconds > 0;
        $state['active_section_code'] = (string) ($lastSection['code'] ?? '');
        $state['active_section_name'] = (string) ($lastSection['name'] ?? '');
        $state['active_section_order'] = (int) ($lastSection['order'] ?? count($sections));
        $state['active_section_elapsed_seconds'] = (int) self::getSectionDurationSeconds($lastSection);
        $state['active_section_duration_seconds'] = (int) self::getSectionDurationSeconds($lastSection);
        $state['active_section_remaining_seconds'] = 0;
        $state['active_section_started_at'] = date(DATE_ATOM, max($startTime, $activeSectionStart));
        $state['available_section_codes'] = [];
        $state['completed_section_codes'] = array_values(array_map(static function (array $section): string {
            return (string) ($section['code'] ?? '');
        }, $sections));
        $state['locked_section_codes'] = [];
        $state['has_next_section'] = false;
        $state['next_section_code'] = null;
        $state['next_section_name'] = null;
        $state['is_last_section'] = true;

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
                'mini_test_duration_minutes' => isset($section['mini_test_duration_minutes']) && $section['mini_test_duration_minutes'] !== null
                    ? max(0, (float) $section['mini_test_duration_minutes'])
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

    private static function getSectionDurationSeconds(array $section): int {
        return max(0, (int) round((float) ($section['duration_minutes'] ?? 0) * 60));
    }

    private static function findSectionIndexByOrder(array $sections, int $targetOrder): int {
        foreach ($sections as $index => $section) {
            if ((int) ($section['order'] ?? ($index + 1)) === $targetOrder) {
                return $index;
            }
        }

        return 0;
    }
}
