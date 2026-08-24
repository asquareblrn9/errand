<?php

declare(strict_types=1);

namespace App\Services\Sms;

/**
 * NormalizesPhone — shared phone-number formatting for SMS providers.
 *
 * Handles +2348012345678, 2348012345678, and 08012345678 inputs.
 */
trait NormalizesPhone
{
    /**
     * National format without the leading plus: 234XXXXXXXXXX.
     */
    protected function toNational(string $phone): string
    {
        $digits = preg_replace('/\D/', '', $phone) ?? '';

        if (str_starts_with($digits, '0')) {
            $digits = '234'.substr($digits, 1);
        }

        return $digits;
    }

    /**
     * E.164 format with the leading plus: +234XXXXXXXXXX.
     */
    protected function toE164(string $phone): string
    {
        return '+'.$this->toNational($phone);
    }
}
