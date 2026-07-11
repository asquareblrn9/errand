<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Types of verification codes used in the platform.
 */
enum VerificationCodeType: string
{
    case EmailVerification = 'email_verification';
    case PhoneVerification = 'phone_verification';
    case PasswordReset = 'password_reset';
    case TwoFactorAuth = 'two_factor_auth';

    /**
     * How long the code is valid (in minutes).
     */
    public function expiryMinutes(): int
    {
        return match ($this) {
            self::EmailVerification => 60,
            self::PhoneVerification => 30,
            self::PasswordReset => 60,
            self::TwoFactorAuth => 10,
        };
    }

    /**
     * How many digits the code contains.
     */
    public function codeLength(): int
    {
        return 6;
    }
}
