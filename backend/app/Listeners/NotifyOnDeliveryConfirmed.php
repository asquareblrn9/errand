<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Events\DeliveryConfirmed;
use App\Models\AuditLog;
use App\Services\FcmService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Mail;

class NotifyOnDeliveryConfirmed implements ShouldQueue
{
    public function __construct(
        private readonly FcmService $fcm,
    ) {}

    public function handle(DeliveryConfirmed $event): void
    {
        $delivery = $event->delivery;
        $errander = $delivery->errander;
        $requester = $delivery->request?->requester;

        // Notify errander
        if ($errander) {
            AuditLog::log('delivery.confirmed', $errander, $delivery);

            $this->fcm->notifyUser(
                userId: $errander->id,
                title: 'Delivery Confirmed ✅',
                body: 'The requester confirmed the delivery. Funds will be released after the dispute window.',
                data: ['type' => 'delivery_confirmed', 'delivery_id' => $delivery->id],
            );

            Mail::to($errander)->queue(
                new \App\Mail\DeliveryConfirmedMail(
                    user: $errander,
                    disputeWindowHours: (string) $delivery->dispute_window_hours,
                )
            );
        }

        // Notify requester
        if ($requester) {
            AuditLog::log('delivery.confirmed', $requester, $delivery);

            $this->fcm->notifyUser(
                userId: $requester->id,
                title: 'Delivery Confirmed ✅',
                body: "You confirmed the delivery. A {$delivery->dispute_window_hours}h dispute window is now open.",
                data: ['type' => 'delivery_confirmed', 'delivery_id' => $delivery->id],
            );

            Mail::to($requester)->queue(
                new \App\Mail\DeliveryConfirmedMail(
                    user: $requester,
                    disputeWindowHours: (string) $delivery->dispute_window_hours,
                )
            );
        }
    }
}
