<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Events\RequestPosted;
use App\Services\FcmService;
use Illuminate\Support\Facades\Log;

class NotifyErrandersOfNewRequest
{
    public function __construct(
        private readonly FcmService $fcm,
    ) {}

    /**
     * Send push notification to all active erranders when a new request is posted.
     */
    public function handle(RequestPosted $event): void
    {
        $request = $event->request;

        $title = $request->is_urgent
            ? '🔴 Urgent Errand Request'
            : 'New Errand Request';

        $body = $request->is_urgent
            ? "{$request->title} — Urgent request in {$request->location}"
            : "{$request->title} — New request in {$request->location}";

        $categoryName = $request->category?->name ?? 'General';

        $result = $this->fcm->notifyErranders(
            title: $title,
            body: $body,
            data: [
                'type' => 'new_request',
                'request_id' => $request->id,
                'title' => $request->title,
                'category' => $categoryName,
                'location' => $request->location,
                'is_urgent' => $request->is_urgent ? '1' : '0',
                'budget_hint' => (string) ($request->budget_hint ?? ''),
            ],
            sound: $request->is_urgent ? 'urgent_alert.wav' : 'default',
        );

        Log::info('Errander notifications sent for request', [
            'request_id' => $request->id,
            'success' => $result['success'],
            'failure' => $result['failure'],
            'is_urgent' => $request->is_urgent,
        ]);
    }
}
