<?php

declare(strict_types=1);

namespace App\Events;

use App\Models\Request;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class RequestPosted
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(public readonly Request $request) {}
}
