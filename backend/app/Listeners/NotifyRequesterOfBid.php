<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Events\BidPlaced;
use App\Models\AuditLog;
use App\Services\FcmService;
use Illuminate\Support\Facades\Log;

class NotifyRequesterOfBid
{
    public function __construct(
        private readonly FcmService $fcm,
    ) {}

    public function handle(BidPlaced $event): void
    {
        $bid = $event->bid;
        $request = $bid->request;
        $requester = $request->requester;

        // Create audit log (shows as notification for the requester)
        AuditLog::log(
            action: 'bid.placed',
            actor: $bid->errander,
            model: $bid,
            oldValues: null,
            newValues: $bid->toArray(),
            metadata: [
                'request_id' => $request->id,
                'request_title' => $request->title,
                'bid_amount' => $bid->total_amount,
            ]
        );

        // Send push notification to requester's devices
        if ($requester) {
            $this->fcm->notifyUser(
                userId: $requester->id,
                title: 'New Bid Received',
                body: "{$bid->errander->name} bid ₦{$bid->total_amount} on \"{$request->title}\"",
                data: [
                    'type' => 'bid_placed',
                    'request_id' => $request->id,
                    'bid_id' => $bid->id,
                ],
            );
        }

        Log::info('Bid placed on request — requester notified', [
            'bid_id' => $bid->id,
            'request_id' => $request->id,
        ]);
    }
}
