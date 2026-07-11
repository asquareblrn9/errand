<?php

declare(strict_types=1);

namespace App\Events;

use App\Models\Bid;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class BidPlaced
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(public readonly Bid $bid) {}
}
