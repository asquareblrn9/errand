<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * SmsService — outbound SMS via a username/password HTTP gateway.
 *
 * Reads gateway credentials from config('services.sms'), supplied via the
 * SMS_GATEWAY_URL / SMS_GATEWAY_USERNAME / SMS_GATEWAY_PASSWORD / SMS_SENDER_ID
 * environment variables.
 *
 * The exact request format (field names, method, success detection) varies
 * between bulk SMS resellers; it lives entirely in send()/gatewaySucceeded()
 * so adapting to a specific gateway touches only this class.
 */
class SmsService
{
    private string $url;

    private string $username;

    private string $password;

    private string $senderId;

    public function __construct()
    {
        $this->url = (string) config('services.sms.url', '');
        $this->username = (string) config('services.sms.username', '');
        $this->password = (string) config('services.sms.password', '');
        $this->senderId = (string) config('services.sms.sender_id', 'ErrandBoy');
    }

    /**
     * Send an SMS message.
     *
     * @param  string  $phone  Recipient in +234..., 234..., or 0... format
     * @return bool Whether the gateway accepted the message
     */
    public function send(string $phone, string $message): bool
    {
        if ($this->url === '' || $this->username === '' || $this->password === '') {
            Log::warning('SMS: Gateway not configured — message not sent.', [
                'phone' => $this->normalizePhone($phone),
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
                    'to' => $this->normalizePhone($phone),
                    'message' => $message,
                ]);
        } catch (\Throwable $e) {
            Log::error('SMS: Send request failed.', [
                'phone' => $this->normalizePhone($phone),
                'error' => $e->getMessage(),
            ]);

            return false;
        }

        if (! $this->gatewaySucceeded($response)) {
            Log::error('SMS: Gateway rejected message.', [
                'phone' => $this->normalizePhone($phone),
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return false;
        }

        Log::debug('SMS: Message sent.', [
            'phone' => $this->normalizePhone($phone),
            'body' => $response->body(),
        ]);

        return true;
    }

    /**
     * Normalize a phone number to the gateway's expected 234XXXXXXXXXX format.
     *
     * Handles +2348012345678, 2348012345678, and 08012345678 inputs.
     */
    private function normalizePhone(string $phone): string
    {
        $digits = preg_replace('/\D/', '', $phone) ?? '';

        if (str_starts_with($digits, '0')) {
            $digits = '234'.substr($digits, 1);
        }

        return $digits;
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
