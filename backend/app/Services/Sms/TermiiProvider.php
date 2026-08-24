<?php

declare(strict_types=1);

namespace App\Services\Sms;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * TermiiProvider — outbound SMS via the Termii API
 * (https://developers.termii.com/messaging).
 *
 * Sends a JSON POST to /api/sms/send with the API key in the body; success is
 * an HTTP 200 whose body carries a message_id.
 */
class TermiiProvider implements SmsProvider
{
    use NormalizesPhone;

    private string $baseUrl;

    private string $apiKey;

    private string $senderId;

    private string $channel;

    public function __construct()
    {
        $this->baseUrl = (string) config('services.sms.termii.base_url', 'https://v4.api.termii.com');
        $this->apiKey = (string) config('services.sms.termii.api_key', '');
        $this->senderId = (string) config('services.sms.termii.sender_id', 'ErrandBoy');
        $this->channel = (string) config('services.sms.termii.channel', 'generic');
    }

    public function name(): string
    {
        return 'termii';
    }

    public function isConfigured(): bool
    {
        return $this->apiKey !== '';
    }

    public function send(string $phone, string $message): bool
    {
        if (!$this->isConfigured()) {
            Log::warning('SMS [termii]: Provider not configured — message not sent.', [
                'phone' => $this->toNational($phone),
            ]);

            return false;
        }

        try {
            $response = Http::asJson()
                ->timeout(15)
                ->post($this->baseUrl . '/api/sms/send', [
                    'api_key' => $this->apiKey,
                    'to' => $this->toNational($phone),
                    'from' => $this->senderId,
                    'sms' => $message,
                    'type' => 'plain',
                    'channel' => $this->channel,
                ]);
        } catch (\Throwable $e) {
            Log::error('SMS [termii]: Send request failed.', [
                'phone' => $this->toNational($phone),
                'error' => $e->getMessage(),
            ]);

            return false;
        }

        if (!$response->successful() || !$response->json('message_id')) {
            Log::error('SMS [termii]: Provider rejected message.', [
                'phone' => $this->toNational($phone),
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return false;
        }

        return true;
    }
}