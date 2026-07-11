<?php

declare(strict_types=1);

namespace App\Enums;

enum KycVerificationType: string
{
    case Identity = 'identity';
    case Selfie = 'selfie';
    case Bank = 'bank';
    case EmergencyContact = 'emergency_contact';

    public function label(): string
    {
        return match ($this) {
            self::Identity => 'Identity Verification',
            self::Selfie => 'Selfie Verification',
            self::Bank => 'Bank Verification',
            self::EmergencyContact => 'Emergency Contact',
        };
    }
}
