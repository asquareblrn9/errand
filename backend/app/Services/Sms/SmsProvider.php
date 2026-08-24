<?php

declare(strict_types=1);

namespace App\Services\Sms;

/**
 * SmsProvider — contract for an outbound SMS provider (smsgate, termii, twilio).
 */
interface SmsProvider
{
    /**
     * The provider name, as used in the SMS_PROVIDER / SMS_FAILOVER env vars.
     */
    public function name(): string;

    /**
     * Whether enough credentials are present to attempt a send.
     */
    public function isConfigured(): bool;

    /**
     * Send an SMS message.
     *
     * @param  string  $phone  Recipient in +234..., 234..., or 0... format
     * @return bool Whether the provider accepted the message
     */
    public function send(string $phone, string $message): bool;
}
