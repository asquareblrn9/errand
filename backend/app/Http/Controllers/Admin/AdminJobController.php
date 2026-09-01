<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Enums\RequestStatus;
use App\Http\Controllers\Controller;
use App\Models\Bid;
use App\Models\Request as ErrandRequest;
use App\Services\ErrandStateMachine;
use App\Services\WalletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request as HttpRequest;

class AdminJobController extends Controller
{
    /** POST /admin/jobs/{id}/force-cancel — admin force-cancels a job */
    public function forceCancel(HttpRequest $request, string $id): JsonResponse
    {
        $errand = ErrandRequest::with(['acceptedBid', 'delivery'])->findOrFail($id);

        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:500'],
        ]);

        $stateMachine = app(ErrandStateMachine::class);

        // Refund if payment was made
        $payment = \App\Models\Payment::where('bid_id', $errand->accepted_bid_id)
            ->where('status', 'successful')
            ->first();

        if ($payment) {
            $walletService = app(WalletService::class);
            $requesterWallet = $walletService->getOrCreateWallet($errand->requester);
            // Unlock alone restores the funds to available balance — no extra
            // balance credit needed (that would double-count the refund).
            $walletService->unlock($requesterWallet, (float) $payment->amount, 'ADMIN-REFUND-' . $errand->id);
            $payment->update(['status' => 'refunded']);

            \App\Models\EscrowTransaction::where('bid_id', $errand->accepted_bid_id)
                ->where('status', 'held')
                ->update(['status' => 'released', 'released_at' => now(), 'release_trigger' => 'admin_cancel']);
        }

        // Transition to cancelled (bypassing guards since this is admin)
        if (! $errand->status->isTerminal()) {
            $errand->update([
                'status' => RequestStatus::Cancelled->value,
                'cancelled_at' => now(),
                'cancellation_reason' => '[Admin] ' . $validated['reason'],
            ]);
        }

        // Update bid if exists
        if ($errand->acceptedBid) {
            $errand->acceptedBid->update(['status' => \App\Enums\BidStatus::Rejected]);
        }

        // Notify both parties
        $admin = $request->user();
        foreach ([$errand->requester, $errand->acceptedBid?->errander] as $user) {
            if (! $user) continue;
            \App\Models\AuditLog::log('admin.job_force_cancelled', $user, $errand, null, null, [
                'reason' => $validated['reason'],
                'admin_id' => $admin->id,
            ]);
            app(\App\Services\FcmService::class)->notifyUser(
                userId: $user->id,
                title: 'Job Cancelled by Admin',
                body: $validated['reason'],
                data: ['type' => 'admin_job_cancelled', 'request_id' => $errand->id],
            );
        }

        \App\Models\AuditLog::log('admin.job_force_cancelled', $admin, $errand);

        return response()->json([
            'success' => true,
            'message' => 'Job force-cancelled. Refund processed if applicable.',
        ]);
    }

    /** GET /admin/jobs/{id}/timeline — complete job timeline */
    public function timeline(string $id): JsonResponse
    {
        $errand = ErrandRequest::with([
            'requester', 'bids.errander', 'delivery.updates',
            'delivery.extensions', 'disputes',
        ])->findOrFail($id);

        $events = [];

        $events[] = ['type' => 'created', 'date' => $errand->created_at, 'detail' => "Request created by {$errand->requester?->name}"];

        foreach ($errand->bids as $bid) {
            $events[] = ['type' => 'bid', 'date' => $bid->created_at, 'detail' => "Bid by {$bid->errander?->name} — ₦{$bid->total_amount}", 'status' => $bid->status->value];
        }

        if ($errand->delivery?->started_at) {
            $events[] = ['type' => 'started', 'date' => $errand->delivery->started_at, 'detail' => "Delivery started by errander"];
        }

        foreach ($errand->delivery?->updates ?? [] as $update) {
            $events[] = ['type' => 'update', 'date' => $update->created_at, 'detail' => $update->message, 'update_type' => $update->type];
        }

        foreach ($errand->delivery?->extensions ?? [] as $ext) {
            $events[] = ['type' => 'extension', 'date' => $ext->created_at, 'detail' => "{$ext->additional_minutes}min extension — {$ext->status}"];
        }

        if ($errand->delivery?->confirmed_at) {
            $events[] = ['type' => 'confirmed', 'date' => $errand->delivery->confirmed_at, 'detail' => 'Delivery confirmed via OTP'];
        }

        foreach ($errand->disputes as $dispute) {
            $events[] = ['type' => 'dispute', 'date' => $dispute->created_at, 'detail' => "Dispute: {$dispute->reason} — {$dispute->status}"];
        }

        if ($errand->completed_at) {
            $events[] = ['type' => 'completed', 'date' => $errand->completed_at, 'detail' => 'Job completed'];
        }

        usort($events, fn ($a, $b) => strtotime($a['date']) - strtotime($b['date']));

        return response()->json([
            'success' => true,
            'data' => [
                'job' => ['id' => $errand->id, 'title' => $errand->title, 'status' => $errand->status->value],
                'timeline' => $events,
            ],
        ]);
    }
}
