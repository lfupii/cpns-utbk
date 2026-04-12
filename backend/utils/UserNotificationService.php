<?php
require_once __DIR__ . '/EmailService.php';

class UserNotificationService {
    public static function generateVerificationToken(): string {
        return bin2hex(random_bytes(32));
    }

    public static function sendVerificationEmail(array $user, string $token): array {
        $verificationUrl = rtrim(EMAIL_VERIFICATION_URL, '/') . '?token=' . rawurlencode($token);
        $fullName = trim((string) ($user['full_name'] ?? 'Peserta'));
        $subject = 'Verifikasi Email Akun Ujiin';
        $expiryLabel = EMAIL_VERIFICATION_EXPIRY_HOURS . ' jam';

        $htmlBody = self::wrapTemplate(
            'Verifikasi email akunmu',
            '
                <p>Halo <strong>' . self::escape($fullName) . '</strong>,</p>
                <p>Terima kasih sudah mendaftar di <strong>Ujiin</strong>. Supaya akunmu aktif dan bisa dipakai untuk login, menerima hasil tryout, dan update penting lainnya, silakan verifikasi email terlebih dahulu.</p>
                <p style="margin:24px 0;">
                    <a href="' . self::escape($verificationUrl) . '" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700;">Verifikasi Email</a>
                </p>
                <p>Link ini berlaku selama <strong>' . self::escape($expiryLabel) . '</strong>.</p>
                <p>Kalau tombol di atas tidak bisa diklik, buka link berikut di browser:</p>
                <p style="word-break:break-all;"><a href="' . self::escape($verificationUrl) . '">' . self::escape($verificationUrl) . '</a></p>
                <p>Semoga proses belajarmu dilancarkan dan menjadi langkah baik menuju hasil terbaik yang kamu impikan.</p>
            '
        );

        $textBody = "Halo {$fullName},\n\n"
            . "Terima kasih sudah mendaftar di Ujiin.\n"
            . "Silakan verifikasi email akunmu melalui link berikut:\n{$verificationUrl}\n\n"
            . "Link ini berlaku selama {$expiryLabel}.\n\n"
            . "Setelah email terverifikasi, akunmu bisa dipakai untuk login dan menerima hasil tryout.\n";

        return EmailService::sendEmail(
            (string) ($user['email'] ?? ''),
            $fullName,
            $subject,
            $htmlBody,
            $textBody
        );
    }

    public static function sendTryoutResultEmail(array $payload): array {
        $fullName = trim((string) ($payload['full_name'] ?? 'Peserta'));
        $packageName = trim((string) ($payload['package_name'] ?? 'Tryout'));
        $categoryName = trim((string) ($payload['category_name'] ?? 'Program'));
        $totalQuestions = (int) ($payload['total_questions'] ?? 0);
        $correctAnswers = (int) ($payload['correct_answers'] ?? 0);
        $wrongAnswers = max(0, $totalQuestions - $correctAnswers);
        $percentage = number_format((float) ($payload['percentage'] ?? 0), 2, ',', '.');
        $score = number_format((float) ($payload['score'] ?? 0), 2, ',', '.');
        $completedAt = trim((string) ($payload['completed_at'] ?? ''));
        $timeTaken = self::formatDuration((int) ($payload['time_taken'] ?? 0));
        $prayer = self::resolvePrayer($categoryName, $packageName);

        $htmlBody = self::wrapTemplate(
            'Hasil tryout kamu sudah siap',
            '
                <p>Halo <strong>' . self::escape($fullName) . '</strong>,</p>
                <p>Terima kasih sudah berlatih bersama <strong>Ujiin</strong>. Berikut hasil tryout kamu untuk paket <strong>' . self::escape($packageName) . '</strong>.</p>
                <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f8fafc;border-radius:14px;overflow:hidden;">
                    <tr>
                        <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;"><strong>Kategori</strong></td>
                        <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">' . self::escape($categoryName) . '</td>
                    </tr>
                    <tr>
                        <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;"><strong>Total soal</strong></td>
                        <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">' . $totalQuestions . '</td>
                    </tr>
                    <tr>
                        <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;"><strong>Jawaban benar</strong></td>
                        <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">' . $correctAnswers . '</td>
                    </tr>
                    <tr>
                        <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;"><strong>Jawaban salah / kosong</strong></td>
                        <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">' . $wrongAnswers . '</td>
                    </tr>
                    <tr>
                        <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;"><strong>Skor</strong></td>
                        <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">' . $score . '</td>
                    </tr>
                    <tr>
                        <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;"><strong>Persentase</strong></td>
                        <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">' . $percentage . '%</td>
                    </tr>
                    <tr>
                        <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;"><strong>Waktu pengerjaan</strong></td>
                        <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">' . self::escape($timeTaken) . '</td>
                    </tr>
                    <tr>
                        <td style="padding:12px 16px;"><strong>Selesai pada</strong></td>
                        <td style="padding:12px 16px;">' . self::escape($completedAt !== '' ? $completedAt : '-') . '</td>
                    </tr>
                </table>
                <p>Terima kasih telah mempercayakan proses latihanmu bersama <strong>Ujiin</strong>. Setiap tryout yang kamu kerjakan adalah langkah nyata untuk memperkuat kesiapanmu.</p>
                <p>' . self::escape($prayer) . '</p>
            '
        );

        $textBody = "Halo {$fullName},\n\n"
            . "Terima kasih sudah berlatih bersama Ujiin.\n"
            . "Berikut hasil tryout {$packageName}:\n"
            . "- Kategori: {$categoryName}\n"
            . "- Total soal: {$totalQuestions}\n"
            . "- Jawaban benar: {$correctAnswers}\n"
            . "- Jawaban salah/kosong: {$wrongAnswers}\n"
            . "- Skor: {$score}\n"
            . "- Persentase: {$percentage}%\n"
            . "- Waktu pengerjaan: {$timeTaken}\n"
            . "- Selesai pada: " . ($completedAt !== '' ? $completedAt : '-') . "\n\n"
            . "Terima kasih telah mempercayakan proses latihanmu bersama Ujiin.\n"
            . $prayer . "\n";

        return EmailService::sendEmail(
            (string) ($payload['email'] ?? ''),
            $fullName,
            'Hasil Tryout ' . $packageName . ' - Ujiin',
            $htmlBody,
            $textBody
        );
    }

    private static function wrapTemplate(string $title, string $content): string {
        return '<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>' . self::escape($title) . '</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:640px;margin:0 auto;padding:32px 16px;">
        <div style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 16px 40px rgba(15,23,42,0.08);">
            <div style="background:linear-gradient(135deg,#0f766e,#14b8a6);padding:28px 24px;color:#ffffff;">
                <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.9;">Ujiin</div>
                <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;">' . self::escape($title) . '</h1>
            </div>
            <div style="padding:28px 24px;font-size:15px;line-height:1.7;">
                ' . $content . '
            </div>
        </div>
    </div>
</body>
</html>';
    }

    private static function resolvePrayer(string $categoryName, string $packageName): string {
        $haystack = strtolower($categoryName . ' ' . $packageName);

        if (strpos($haystack, 'utbk') !== false) {
            return 'Kami doakan semoga kamu diberikan ketenangan, ketajaman berpikir, dan hasil terbaik untuk lolos UTBK yang kamu perjuangkan.';
        }

        if (strpos($haystack, 'cpns') !== false) {
            return 'Kami doakan semoga kamu diberikan kelancaran, fokus, dan hasil terbaik sampai benar-benar lolos CPNS yang kamu cita-citakan.';
        }

        return 'Kami doakan semoga setiap ikhtiar belajarmu diberi kemudahan dan berbuah hasil terbaik.';
    }

    private static function formatDuration(int $seconds): string {
        if ($seconds <= 0) {
            return '-';
        }

        $hours = intdiv($seconds, 3600);
        $minutes = intdiv($seconds % 3600, 60);
        $remainingSeconds = $seconds % 60;
        $parts = [];

        if ($hours > 0) {
            $parts[] = $hours . ' jam';
        }

        if ($minutes > 0) {
            $parts[] = $minutes . ' menit';
        }

        if ($remainingSeconds > 0 || count($parts) === 0) {
            $parts[] = $remainingSeconds . ' detik';
        }

        return implode(' ', $parts);
    }

    private static function escape(string $value): string {
        return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
    }
}
