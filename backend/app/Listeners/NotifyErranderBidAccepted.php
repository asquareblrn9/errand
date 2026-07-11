<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Events\BidAccepted;
use App\Models\AuditLog;
use App\Services\FcmService;
use Illuminate\Support\Facades\Log;

class NotifyErranderBidAccepted
{
    public function __construct(
        private readonly FcmService $fcm,
    ) {}

    public function handle(BidAccepted $event): void
    {
        $bid = $event->bid;
        $errander = $bid->errander;
        $request = $bid->request;

        // Create audit log for the errander
        AuditLog::log(
            action: 'bid.accepted',
            actor: $request->requester,
            model: $bid,
            oldValues: $bid->getOriginal(),
            newValues: $bid->toArray(),
            metadata: [
                'request_id' => $request->id,
                'request_title' => $request->title,
                'bid_amount' => $bid->total_amount,
            ]
        );

        // Send push notification to the errander
        if ($errander) {
            $this->fcm->notifyUser(
                userId: $errander->id,
                title: 'Bid Accepted! 🎉',
                body: "Your bid of ₦{$bid->total_amount} on \"{$request->title}\" was accepted.",
                data: [
                    'type' => 'bid_accepted',
                    'request_id' => $request->id,
                    'bid_id' => $bid->id,
                ],
            );
        }

        Log::info('Bid accepted — errander notified', [
            'bid_id' => $bid->id,
            'request_id' => $request->id,
        ]);
    }
}
