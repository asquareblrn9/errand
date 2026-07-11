<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\RequestStatus;
use App\Events\DisputeOpened;
use App\Events\DisputeResolved;
use App\Models\Delivery;
use App\Models\Dispute;
use App\Models\DisputeEvidence;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DisputeService
{
    /**
     * Open a dispute on a confirmed delivery.
     */
    public function open(Delivery $delivery, User $requester, array $data): Dispute
    {
        if (! $delivery->confirmed) {
            throw new \InvalidArgumentException('Cannot dispute an unconfirmed delivery.');
        }

        if (! $delivery->isDisputeWindowOpen()) {
            throw new \InvalidArgumentException('The dispute window has closed.');
        }

        $existing = Dispute::where('delivery_id', $delivery->id)
            ->where('status', '!=', 'closed')
            ->first();
        if ($existing) {
            throw new \InvalidArgumentException('A dispute is already open for this delivery.');
        }

        $dispute = DB::transaction(function () use ($delivery, $requester, $data): Dispute {
            $dispute = Dispute::create([
                'delivery_id' => $delivery->id,
                'bid_id' => $delivery->bid_id,
                'request_id' => $delivery->request_id,
                'raised_by' => $requester->id,
                'errander_id' => $delivery->errander_id,
                'reason' => $data['reason'],
                'description' => $data['description'],
                'status' => 'open',
            ]);

            // Transition request to disputed
            $delivery->request->transitionTo(RequestStatus::Disputed);

            event(new DisputeOpened($dispute));

            return $dispute;
        });

        return $dispute->load('raiser', 'errander');
    }

    /**
     * Errander responds to a dispute.
     */
    public function respond(Dispute $dispute, string $response, array $evidenceFiles = []): Dispute
    {
        if ($dispute->status !== 'open') {
            throw new \InvalidArgumentException('Dispute is not in a state that allows response.');
        }

        $dispute->update([
            'errander_response' => $response,
            'status' => 'under_review',
        ]);

        // Upload evidence if provided
        foreach ($evidenceFiles as $file) {
            // In production: $path = Storage::putFile('disputes', $file);
            DisputeEvidence::create([
                'dispute_id' => $dispute->id,
                'uploaded_by' => $dispute->errander_id,
                'type' => 'photo',
                'path' => '/tmp/placeholder',
                'url' => '/tmp/placeholder',
            ]);
        }

        Log::info('Dispute response submitted', ['dispute_id' => $dispute->id]);

        return $dispute->fresh('evidence');
    }

    /**
     * Admin resolves a dispute.
     */
    public function resolve(Dispute $dispute, User $admin, string $resolution, string $note): Dispute
    {
        if (! in_array($dispute->status, ['open', 'errander_response_pending', 'under_review'], true)) {
            throw new \InvalidArgumentException('Dispute is not in a resolvable state.');
        }

        $newStatus = $resolution === 'favour_requester' ? 'resolved_requester' : 'resolved_errander';

        $dispute->update([
            'status' => $newStatus,
            'resolution_note' => $note,
            'resolved_by' => $admin->id,
            'resolved_at' => now(),
        ]);

        // Update request status
        $requestStatus = $resolution === 'favour_requester' ? RequestStatus::Refunded : RequestStatus::Completed;
        $dispute->request->update(['status' => $requestStatus]);

        event(new DisputeResolved($dispute));

        Log::info('Dispute resolved', [
            'dispute_id' => $dispute->id,
            'resolution' => $resolution,
            'resolved_by' => $admin->id,
        ]);

        return $dispute;
    }
}
