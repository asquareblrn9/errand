<?php

declare(strict_types=1);

namespace App\Events;

use App\Models\Dispute;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DisputeOpened
{
    use Dispatchable, SerializesModels;

    public function __construct(public readonly Dispute $dispute) {}
}
