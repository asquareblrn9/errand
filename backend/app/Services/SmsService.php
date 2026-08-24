<?php

declare(strict_types=1);

namespace App\Services;

use App\Services\Sms\SmsgateProvider;
use App\Services\Sms\SmsProvider;
use App\Services\Sms\TermiiProvider;
use App\Services\Sms\TwilioProvider;
use Illuminate\Support\Facades\Log;

/**
 * SmsService — routes outbound SMS to the configured provider.
 *
 * The active provider is chosen with SMS_PROVIDER (smsgate, termii, or
 * twilio). Any names listed in SMS_FAILOVER (comma-separated) are tried in
 * order when the primary fails. Credentials live under config('services.sms.*').
 */
class SmsService
{
    /** @var array<string, class-string<SmsProvider>> */
    private const PROVIDER_MAP = [
        'smsgate' => SmsgateProvider::class,
        'termii' => TermiiProvider::class,
        'twilio' => TwilioProvider::class,
    ];

    /**
     * Providers to try, in order.
     *
     * @var list<SmsProvider>
     */
    private array $providers;

    public function __construct()
    {
        $primary = (string) config('services.sms.provider', 'smsgate');
        $failover = (array) config('services.sms.failover', []);

        $this->providers = $this->resolveProviders(array_unique([$primary, ...$failover]));
    }

    /**
     * Send an SMS message.
     *
     * @param  string  $phone  Recipient in +234..., 234..., or 0... format
     * @return bool Whether any configured provider accepted the message
     */
    public function send(string $phone, string $message): bool
    {
        if ($this->providers === []) {
            Log::warning('SMS: No known provider configured — message not sent.', [
                'phone' => $phone,
            ]);

            return false;
        }

        foreach ($this->providers as $provider) {
            if (! $provider->isConfigured()) {
                Log::debug('SMS: Provider skipped (not configured).', [
                    'provider' => $provider->name(),
                    'phone' => $phone,
                ]);

                continue;
            }

            if ($provider->send($phone, $message)) {
                Log::debug('SMS: Message sent.', [
                    'provider' => $provider->name(),
                    'phone' => $phone,
                ]);

                return true;
            }

            Log::warning('SMS: Provider failed, trying next in chain.', [
                'provider' => $provider->name(),
                'phone' => $phone,
            ]);
        }

        Log::error('SMS: Every configured provider failed — message not sent.', [
            'phone' => $phone,
        ]);

        return false;
    }

    /**
     * Resolve provider names to instances, ignoring unknown names.
     *
     * @param  array<int, string>  $names
     * @return list<SmsProvider>
     */
    private function resolveProviders(array $names): array
    {
        $providers = [];

        foreach ($names as $name) {
            if (! isset(self::PROVIDER_MAP[$name])) {
                Log::warning('SMS: Unknown provider name ignored.', ['provider' => $name]);

                continue;
            }

            $providers[] = app(self::PROVIDER_MAP[$name]);
        }

        return $providers;
    }
}
