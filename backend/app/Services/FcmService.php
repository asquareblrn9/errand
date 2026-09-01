<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\DeviceToken;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * FcmService — Firebase Cloud Messaging
 *
 * Sends push notifications to mobile devices via FCM HTTP v1 API.
 */
class FcmService
{
    private string $serverKey;

    private string $fcmUrl = 'https://fcm.googleapis.com/fcm/send';

    public function __construct()
    {
        $this->serverKey = (string) config('services.fcm.server_key', '');
    }

    /**
     * Send a notification to specific device tokens.
     *
     * @param  string[]  $tokens  FCM registration tokens
     * @param  string  $title  Notification title
     * @param  string  $body  Notification body
     * @param  array<string, string>  $data  Custom data payload
     * @param  string  $sound  Sound to play ('default' or custom sound filename)
     * @return array{success: int, failure: int}
     */
    public function sendToDevices(
        array $tokens,
        string $title,
        string $body,
        array $data = [],
        string $sound = 'default',
    ): array {
        if (empty($tokens) || empty($this->serverKey)) {
            return ['success' => 0, 'failure' => 0];
        }

        $payload = [
            'registration_ids' => $tokens,
            'notification' => [
                'title' => $title,
                'body' => $body,
                'sound' => $sound,
                'android_channel_id' => 'errand_boy_requests',
            ],
            'data' => $data,
            'android' => [
                'priority' => 'high',
                'notification' => [
                    'sound' => $sound,
                    'channel_id' => 'errand_boy_requests',
                    'default_sound' => true,
                ],
            ],
            'apns' => [
                'payload' => [
                    'aps' => [
                        'sound' => $sound === 'default' ? 'default' : $sound,
                        'badge' => 1,
                    ],
                ],
            ],
        ];

        $response = Http::withHeaders([
            'Authorization' => 'key='.$this->serverKey,
            'Content-Type' => 'application/json',
        ])->timeout(10)->post($this->fcmUrl, $payload);

        if (! $response->successful()) {
            Log::error('FCM: Notification send failed', [
                'status' => $response->status(),
                'body' => $response->body(),
                'token_count' => count($tokens),
            ]);

            return ['success' => 0, 'failure' => count($tokens)];
        }

        $result = $response->json();

        Log::info('FCM: Notifications sent', [
            'success' => $result['success'] ?? 0,
            'failure' => $result['failure'] ?? 0,
            'title' => $title,
        ]);

        return [
            'success' => $result['success'] ?? 0,
            'failure' => $result['failure'] ?? 0,
        ];
    }

    /**
     * Send a notification to a specific user's active device tokens.
     *
     * @return array{success: int, failure: int}
     */
    public function notifyUser(
        string $userId,
        string $title,
        string $body,
        array $data = [],
        string $sound = 'default',
    ): array {
        $tokens = DeviceToken::where('user_id', $userId)
            ->active()
            ->pluck('token')
            ->toArray();

        if (empty($tokens)) {
            return ['success' => 0, 'failure' => 0];
        }

        return $this->sendToDevices($tokens, $title, $body, $data, $sound);
    }

    /**
     * Send a notification to all erranders with active device tokens.
     *
     * @return array{success: int, failure: int}
     */
    public function notifyErranders(
        string $title,
        string $body,
        array $data = [],
        string $sound = 'default',
    ): array {
        $tokens = DeviceToken::whereHas('user', function ($q) {
            $q->where('role', 'errander')->where('status', 'active');
        })
            ->active()
            ->pluck('token')
            ->toArray();

        if (empty($tokens)) {
            Log::info('FCM: No active errander device tokens found.');

            return ['success' => 0, 'failure' => 0];
        }

        // FCM supports up to 1000 tokens per request
        $chunks = array_chunk($tokens, 1000);
        $totalSuccess = 0;
        $totalFailure = 0;

        foreach ($chunks as $chunk) {
            $result = $this->sendToDevices($chunk, $title, $body, $data, $sound);
            $totalSuccess += $result['success'];
            $totalFailure += $result['failure'];
        }

        return ['success' => $totalSuccess, 'failure' => $totalFailure];
    }
}
