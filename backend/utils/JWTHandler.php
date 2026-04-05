<?php
// JWT Token Handler
class JWTHandler {
    private static function base64UrlEncode(string $value): string {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $value): string {
        $normalized = strtr($value, '-_', '+/');
        $padding = strlen($normalized) % 4;

        if ($padding > 0) {
            $normalized .= str_repeat('=', 4 - $padding);
        }

        return base64_decode($normalized);
    }

    public static function generateToken($userId, $role = 'user') {
        $header = self::base64UrlEncode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $payload = self::base64UrlEncode(json_encode([
            'userId' => $userId,
            'role' => $role,
            'iat' => time(),
            'exp' => time() + TOKEN_EXPIRY
        ]));
        
        $signature = hash_hmac(
            'sha256',
            "$header.$payload",
            JWT_SECRET_KEY,
            true
        );
        $signature = self::base64UrlEncode($signature);
        
        return "$header.$payload.$signature";
    }

    public static function verifyToken($token) {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return false;
        }

        $header = $parts[0];
        $payload = $parts[1];
        $signature = $parts[2];

        // Verify signature
        $expectedSignature = self::base64UrlEncode(
            hash_hmac(
                'sha256',
                "$header.$payload",
                JWT_SECRET_KEY,
                true
            )
        );
        $legacySignature = base64_encode(
            hash_hmac(
                'sha256',
                "$header.$payload",
                JWT_SECRET_KEY,
                true
            )
        );

        if (!hash_equals($signature, $expectedSignature) && !hash_equals($signature, $legacySignature)) {
            return false;
        }

        // Decode payload
        $decodedPayload = json_decode(self::base64UrlDecode($payload), true);
        if (!is_array($decodedPayload) || !isset($decodedPayload['exp'])) {
            return false;
        }
        
        // Check expiry
        if ($decodedPayload['exp'] < time()) {
            return false;
        }

        return $decodedPayload;
    }
}
