<?php
// Midtrans Payment Handler
class MidtransHandler {
    public static function createTransaction($orderId, $grossAmount, $customerDetails, $itemDetails) {
        require_once __DIR__ . '/../config/Database.php';

        $params = [
            'transaction_details' => [
                'order_id' => $orderId,
                'gross_amount' => $grossAmount
            ],
            'customer_details' => $customerDetails,
            'item_details' => $itemDetails
        ];

        $curl = curl_init();
        curl_setopt_array($curl, [
            CURLOPT_URL => MIDTRANS_CORE_API_URL . '/charge',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_ENCODING => '',
            CURLOPT_MAXREDIRS => 10,
            CURLOPT_TIMEOUT => 0,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
            CURLOPT_CUSTOMREQUEST => 'POST',
            CURLOPT_POSTFIELDS => json_encode($params),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Basic ' . base64_encode(MIDTRANS_SERVER_KEY . ':')
            ],
        ]);

        $response = curl_exec($curl);
        if ($response === false) {
            $errorMessage = curl_error($curl) ?: 'Curl request gagal';
            curl_close($curl);

            return [
                'status' => 'error',
                'message' => $errorMessage,
                'error_messages' => [$errorMessage],
            ];
        }
        curl_close($curl);

        $decoded = json_decode($response, true);
        if (!is_array($decoded)) {
            return [
                'status' => 'error',
                'message' => 'Respons Midtrans tidak valid',
                'raw_response' => $response,
            ];
        }

        return $decoded;
    }

    public static function checkTransactionStatus($transactionId) {
        $curl = curl_init();
        curl_setopt_array($curl, [
            CURLOPT_URL => MIDTRANS_CORE_API_URL . '/' . $transactionId . '/status',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_ENCODING => '',
            CURLOPT_MAXREDIRS => 10,
            CURLOPT_TIMEOUT => 0,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
            CURLOPT_CUSTOMREQUEST => 'GET',
            CURLOPT_HTTPHEADER => [
                'Authorization: Basic ' . base64_encode(MIDTRANS_SERVER_KEY . ':')
            ],
        ]);

        $response = curl_exec($curl);
        if ($response === false) {
            $errorMessage = curl_error($curl) ?: 'Curl request gagal';
            curl_close($curl);

            return [
                'status' => 'error',
                'message' => $errorMessage,
                'error_messages' => [$errorMessage],
            ];
        }
        curl_close($curl);

        $decoded = json_decode($response, true);
        if (!is_array($decoded)) {
            return [
                'status' => 'error',
                'message' => 'Respons Midtrans tidak valid',
                'raw_response' => $response,
            ];
        }

        return $decoded;
    }

    public static function getSnapToken($orderId, $grossAmount, $customerDetails, $itemDetails) {
        require_once __DIR__ . '/../config/Database.php';

        $params = [
            'transaction_details' => [
                'order_id' => $orderId,
                'gross_amount' => $grossAmount
            ],
            'customer_details' => $customerDetails,
            'item_details' => $itemDetails,
            'enabled_payments' => ['credit_card', 'bank_transfer', 'echannel', 'gopay', 'qris', 'permata']
        ];

        $curl = curl_init();
        curl_setopt_array($curl, [
            CURLOPT_URL => MIDTRANS_SNAP_API_URL,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_ENCODING => '',
            CURLOPT_MAXREDIRS => 10,
            CURLOPT_TIMEOUT => 0,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
            CURLOPT_CUSTOMREQUEST => 'POST',
            CURLOPT_POSTFIELDS => json_encode($params),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Basic ' . base64_encode(MIDTRANS_SERVER_KEY . ':')
            ],
        ]);

        $response = curl_exec($curl);
        if ($response === false) {
            $errorMessage = curl_error($curl) ?: 'Curl request gagal';
            curl_close($curl);

            return [
                'status' => 'error',
                'message' => $errorMessage,
                'error_messages' => [$errorMessage],
            ];
        }
        curl_close($curl);

        $decoded = json_decode($response, true);
        if (!is_array($decoded)) {
            return [
                'status' => 'error',
                'message' => 'Respons Midtrans tidak valid',
                'raw_response' => $response,
            ];
        }

        return $decoded;
    }
}
