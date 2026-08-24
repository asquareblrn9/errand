<?php

declare(strict_types=1);

namespace App\Services\Sms;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * TwilioProvider — outbound SMS via the Twilio REST API
 * (https://www.twilio.com/docs/messaging/api/message-resource).
 *
 * Posts form params to the account's Messages.json endpoint with basic auth
 * (account SID / auth token); success is HTTP 201 Created.
 */
class TwilioProvider implements SmsProvider
{
    use NormalizesPhone;

    private string $accountSid;

    private string $authToken;

    private string $from;

    public function __construct()
    {
        $this->accountSid = (string) config('services.sms.twilio.account_sid', '');
        $this->authToken = (string) config('services.sms.twilio.auth_token', '');
        $this->from = (string) config('services.sms.twilio.from', '');
    }

    public function name(): string
    {
        return 'twilio';
    }

    public function isConfigured(): bool
    {
        return $this->accountSid !== '' && $this->authToken !== '' && $this->from !== '';
    }

    public function send(string $phone, string $message): bool
    {
        if (! $this->isConfigured()) {
            Log::warning('SMS [twilio]: Provider not configured — message not sent.', [
                'phone' => $this->toE164($phone),
            ]);

            return false;
        }

        try {
            $response = Http::asForm()
                ->withBasicAuth($this->accountSid, $this->authToken)
                ->timeout(15)
                ->post(
                    'https://api.twilio.com/2010-04-01/Accounts/'.$this->accountSid.'/Messages.json',
                    [
                        'To' => $this->toE164($phone),
                        'From' => $this->from,
                        'Body' => $message,
                    ]
                );
        } catch (\Throwable $e) {
            Log::error('SMS [twilio]: Send request failed.', [
                'phone' => $this->toE164($phone),
                'error' => $e->getMessage(),
            ]);

            return false;
        }

        if (! $response->successful()) {
            Log::error('SMS [twilio]: Provider rejected message.', [
                'phone' => $this->toE164($phone),
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return false;
        }

        return true;
    }
}
