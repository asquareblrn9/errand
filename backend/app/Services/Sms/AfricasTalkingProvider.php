<?php

declare(strict_types=1);

namespace App\Services\Sms;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * AfricasTalkingProvider — outbound SMS via the Africa's Talking API
 * (https://developers.africastalking.com/docs/sms/sending).
 *
 * Sends a form POST to /version1/messaging with the API key in the `apiKey`
 * header; success is an HTTP 201 whose recipient entry carries status code
 * 100 (processed), 101 (sent), or 102 (queued). The "sandbox" username
 * targets the sandbox host automatically.
 */
class AfricasTalkingProvider implements SmsProvider
{
    use NormalizesPhone;

    private const SUCCESS_CODES = [100, 101, 102];

    private string $baseUrl;

    private string $username;

    private string $apiKey;

    private string $senderId;

    public function __construct()
    {
        $this->username = (string) config('services.sms.africastalking.username', '');
        $this->apiKey = (string) config('services.sms.africastalking.api_key', '');
        $this->senderId = (string) config('services.sms.africastalking.sender_id', '');
        $this->baseUrl = (string) (config('services.sms.africastalking.base_url') ?: ($this->username === 'sandbox'
            ? 'https://api.sandbox.africastalking.com'
            : 'https://api.africastalking.com'));
    }

    public function name(): string
    {
        return 'africastalking';
    }

    public function isConfigured(): bool
    {
        return $this->username !== '' && $this->apiKey !== '';
    }

    public function send(string $phone, string $message): bool
    {
        if (!$this->isConfigured()) {
            Log::warning('SMS [africastalking]: Provider not configured — message not sent.', [
                'phone' => $this->toE164($phone),
            ]);

            return false;
        }

        $payload = [
            'username' => $this->username,
            'to' => $this->toE164($phone),
            'message' => $message,
        ];

        if ($this->senderId !== '') {
            $payload['from'] = $this->senderId;
        }

        try {
            $response = Http::asForm()
                ->acceptJson()
                ->withHeaders(['apiKey' => $this->apiKey])
                ->timeout(15)
                ->post($this->baseUrl . '/version1/messaging', $payload);
        } catch (\Throwable $e) {
            Log::error('SMS [africastalking]: Send request failed.', [
                'phone' => $this->toE164($phone),
                'error' => $e->getMessage(),
            ]);

            return false;
        }

        $statusCode = (int) $response->json('SMSMessageData.Recipients.0.statusCode');

        if (!$response->successful() || !in_array($statusCode, self::SUCCESS_CODES, true)) {
            Log::error('SMS [africastalking]: Provider rejected message.', [
                'phone' => $this->toE164($phone),
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return false;
        }

        return true;
    }
}
