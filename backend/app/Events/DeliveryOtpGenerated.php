<?php

declare(strict_types=1);

namespace App\Events;

use App\Models\Delivery;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DeliveryOtpGenerated
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly Delivery $delivery,
        public readonly string $otp, // Plain OTP for notification — never logged
    ) {}
}
