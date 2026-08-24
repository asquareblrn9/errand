<?php

declare(strict_types=1);

namespace App\Services\Sms;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * SmsgateProvider — outbound SMS via the generic username/password HTTP
 * gateway (SMS_GATEWAY_URL / SMS_GATEWAY_USERNAME / SMS_GATEWAY_PASSWORD).
 *
 * The exact request format (field names, method, success detection) varies
 * between bulk SMS resellers; it lives entirely in send()/gatewaySucceeded()
 * so adapting to a specific gateway touches only this class.
 */
class SmsgateProvider implements SmsProvider
{
    use NormalizesPhone;

    private string $url;

    private string $username;

    private string $password;

    private string $senderId;

    public function __construct()
    {
        $this->url = (string) config('services.sms.smsgate.url', '');
        $this->username = (string) config('services.sms.smsgate.username', '');
        $this->password = (string) config('services.sms.smsgate.password', '');
        $this->senderId = (string) config('services.sms.sender_id', 'ErrandBoy');
    }

    public function name(): string
    {
        return 'smsgate';
    }

    public function isConfigured(): bool
    {
        return $this->url !== '' && $this->username !== '' && $this->password !== '';
    }

    public function send(string $phone, string $message): bool
    {
        if (! $this->isConfigured()) {
            Log::warning('SMS [smsgate]: Gateway not configured — message not sent.', [
                'phone' => $this->toNational($phone),
            ]);

            return false;
        }

        try {
            $response = Http::asForm()
                ->timeout(15)
                ->post($this->url, [
                    'username' => $this->username,
                    'password' => $this->password,
                    'sender' => $this->senderId,
                    'to' => $this->toNational($phone),
                    'message' => $message,
                ]);
        } catch (\Throwable $e) {
            Log::error('SMS [smsgate]: Send request failed.', [
                'phone' => $this->toNational($phone),
                'error' => $e->getMessage(),
            ]);

            return false;
        }

        if (! $this->gatewaySucceeded($response)) {
            Log::error('SMS [smsgate]: Gateway rejected message.', [
                'phone' => $this->toNational($phone),
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return false;
        }

        return true;
    }

    /**
     * Whether the gateway accepted the message.
     *
     * Gateway-specific: most resellers return HTTP 200 with a status code
     * inside the body; adjust here once the gateway's response format is known.
     */
    private function gatewaySucceeded(Response $response): bool
    {
        return $response->successful();
    }
}
