<?php

declare(strict_types=1);

namespace App\Services\Sms;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * ArkeselProvider — outbound SMS via the Arkesel v2 API
 * (https://developers.arkesel.com).
 *
 * Sends a JSON POST to /api/v2/sms/send with the API key in the `api-key`
 * header; success is an HTTP 200 whose body carries status "success".
 */
class ArkeselProvider implements SmsProvider
{
    use NormalizesPhone;

    private string $baseUrl;

    private string $apiKey;

    private string $senderId;

    public function __construct()
    {
        $this->baseUrl = (string) config('services.sms.arkesel.base_url', 'https://sms.arkesel.com');
        $this->apiKey = (string) config('services.sms.arkesel.api_key', '');
        $this->senderId = (string) config('services.sms.arkesel.sender_id', 'ErrandBoy');
    }

    public function name(): string
    {
        return 'arkesel';
    }

    public function isConfigured(): bool
    {
        return $this->apiKey !== '';
    }

    public function send(string $phone, string $message): bool
    {
        if (!$this->isConfigured()) {
            Log::warning('SMS [arkesel]: Provider not configured — message not sent.', [
                'phone' => $this->toNational($phone),
            ]);

            return false;
        }

        try {
            $response = Http::asJson()
                ->withHeaders(['api-key' => $this->apiKey])
                ->timeout(15)
                ->post($this->baseUrl . '/api/v2/sms/send', [
                    'sender' => $this->senderId,
                    'message' => $message,
                    'recipients' => [$this->toNational($phone)],
                ]);
        } catch (\Throwable $e) {
            Log::error('SMS [arkesel]: Send request failed.', [
                'phone' => $this->toNational($phone),
                'error' => $e->getMessage(),
            ]);

            return false;
        }

        if (!$response->successful() || $response->json('status') !== 'success') {
            Log::error('SMS [arkesel]: Provider rejected message.', [
                'phone' => $this->toNational($phone),
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return false;
        }

        return true;
    }
}
