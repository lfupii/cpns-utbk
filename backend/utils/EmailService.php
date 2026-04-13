<?php
require_once __DIR__ . '/../config/Database.php';

class EmailService {
    public static function sendEmail(string $toEmail, string $toName, string $subject, string $htmlBody, ?string $textBody = null): array {
        $toEmail = trim(strtolower($toEmail));
        $toName = self::sanitizeHeader($toName);

        if (!filter_var($toEmail, FILTER_VALIDATE_EMAIL)) {
            return [
                'success' => false,
                'transport' => 'validation',
                'message' => 'Alamat email tujuan tidak valid.',
            ];
        }

        $textBody = $textBody !== null && trim($textBody) !== ''
            ? $textBody
            : html_entity_decode(strip_tags(str_replace(['<br>', '<br/>', '<br />'], PHP_EOL, $htmlBody)), ENT_QUOTES, 'UTF-8');

        try {
            return self::sendViaSmtp($toEmail, $toName, $subject, $htmlBody, $textBody);
        } catch (Throwable $error) {
            error_log('SMTP send failed: ' . $error->getMessage());
            return [
                'success' => false,
                'transport' => 'smtp',
                'message' => 'Pengiriman email gagal via SMTP.',
                'debug' => $error->getMessage(),
            ];
        }
    }

    private static function sendViaSmtp(string $toEmail, string $toName, string $subject, string $htmlBody, string $textBody): array {
        $smtpHost = trim((string) SMTP_HOST);
        $smtpUser = trim((string) SMTP_USER);
        $smtpPassword = (string) SMTP_PASSWORD;

        if ($smtpHost === '' || $smtpUser === '' || $smtpPassword === '') {
            throw new RuntimeException('Konfigurasi SMTP belum lengkap.');
        }

        $secure = strtolower(trim((string) SMTP_SECURE));
        $remoteHost = $secure === 'ssl' ? 'ssl://' . $smtpHost : $smtpHost;
        $socket = @stream_socket_client(
            $remoteHost . ':' . SMTP_PORT,
            $errorNumber,
            $errorMessage,
            15,
            STREAM_CLIENT_CONNECT
        );

        if (!is_resource($socket)) {
            throw new RuntimeException('Tidak dapat terhubung ke server SMTP: ' . $errorMessage . ' (' . $errorNumber . ')');
        }

        stream_set_timeout($socket, 15);

        try {
            self::expectResponse($socket, [220]);
            self::sendCommand($socket, 'EHLO ' . self::detectHostname(), [250]);

            if ($secure === 'tls') {
                self::sendCommand($socket, 'STARTTLS', [220]);
                $cryptoEnabled = @stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
                if ($cryptoEnabled !== true) {
                    throw new RuntimeException('Gagal mengaktifkan enkripsi TLS ke server SMTP.');
                }

                self::sendCommand($socket, 'EHLO ' . self::detectHostname(), [250]);
            }

            self::sendCommand($socket, 'AUTH LOGIN', [334]);
            self::sendCommand($socket, base64_encode($smtpUser), [334]);
            self::sendCommand($socket, base64_encode($smtpPassword), [235]);

            self::sendCommand($socket, 'MAIL FROM:<' . FROM_EMAIL . '>', [250]);
            self::sendCommand($socket, 'RCPT TO:<' . $toEmail . '>', [250, 251]);
            self::sendCommand($socket, 'DATA', [354]);

            $message = self::buildMimeMessage($toEmail, $toName, $subject, $htmlBody, $textBody);
            fwrite($socket, self::dotStuff($message) . "\r\n.\r\n");
            self::expectResponse($socket, [250]);
            self::sendCommand($socket, 'QUIT', [221]);
        } finally {
            fclose($socket);
        }

        return [
            'success' => true,
            'transport' => 'smtp',
            'message' => 'Email berhasil dikirim via SMTP.',
        ];
    }

    private static function buildMimeMessage(string $toEmail, string $toName, string $subject, string $htmlBody, string $textBody): string {
        $boundary = 'boundary_' . bin2hex(random_bytes(12));
        $headers = [
            'Date: ' . date(DATE_RFC2822),
            'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . self::detectHostname() . '>',
            'From: ' . self::formatAddress(FROM_EMAIL, FROM_NAME),
            'Reply-To: ' . self::formatAddress(FROM_EMAIL, FROM_NAME),
            'To: ' . self::formatAddress($toEmail, $toName),
            'Subject: ' . self::encodeHeader($subject),
            'MIME-Version: 1.0',
            'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
        ];

        $body = '--' . $boundary . "\r\n"
            . "Content-Type: text/plain; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($textBody))
            . '--' . $boundary . "\r\n"
            . "Content-Type: text/html; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($htmlBody))
            . '--' . $boundary . "--";

        return implode("\r\n", $headers) . "\r\n\r\n" . $body;
    }

    private static function sendCommand($socket, string $command, array $expectedCodes): string {
        fwrite($socket, $command . "\r\n");
        return self::expectResponse($socket, $expectedCodes);
    }

    private static function expectResponse($socket, array $expectedCodes): string {
        $response = '';

        while (($line = fgets($socket, 515)) !== false) {
            $response .= $line;
            if (strlen($line) < 4 || $line[3] !== '-') {
                break;
            }
        }

        if ($response === '') {
            throw new RuntimeException('Server SMTP tidak memberikan respons.');
        }

        $statusCode = (int) substr($response, 0, 3);
        if (!in_array($statusCode, $expectedCodes, true)) {
            throw new RuntimeException('SMTP error [' . $statusCode . ']: ' . trim($response));
        }

        return $response;
    }

    private static function dotStuff(string $message): string {
        $message = str_replace(["\r\n", "\r"], "\n", $message);
        $lines = explode("\n", $message);

        foreach ($lines as &$line) {
            if (strpos($line, '.') === 0) {
                $line = '.' . $line;
            }
        }

        return implode("\r\n", $lines);
    }

    private static function encodeHeader(string $value): string {
        return '=?UTF-8?B?' . base64_encode(self::sanitizeHeader($value)) . '?=';
    }

    private static function formatAddress(string $email, string $name = ''): string {
        $safeEmail = trim(strtolower($email));
        $safeName = self::sanitizeHeader($name);

        if ($safeName === '') {
            return $safeEmail;
        }

        return self::encodeHeader($safeName) . ' <' . $safeEmail . '>';
    }

    private static function sanitizeHeader(string $value): string {
        return trim(str_replace(["\r", "\n"], '', $value));
    }

    private static function detectHostname(): string {
        $host = gethostname();
        if (!$host || trim($host) === '') {
            $host = parse_url(FRONTEND_URL, PHP_URL_HOST) ?: 'localhost';
        }

        return preg_replace('/[^A-Za-z0-9.-]/', '', $host) ?: 'localhost';
    }
}
