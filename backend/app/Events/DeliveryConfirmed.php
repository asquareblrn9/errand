<?php

declare(strict_types=1);

namespace App\Events;

use App\Models\Delivery;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DeliveryConfirmed
{
    use Dispatchable, SerializesModels;

    public function __construct(public readonly Delivery $delivery) {}
}
