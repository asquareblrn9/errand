<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * Get recent notifications for the authenticated user.
     *
     * GET /notifications
     */
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $query = AuditLog::where('user_id', $user->id)
            ->whereIn('action', $this->notifiableEvents());

        // Only show unread notifications (created after last read)
        if ($user->notifications_read_at) {
            $query->where('created_at', '>', $user->notifications_read_at);
        }

        $notifications = $query->orderBy('created_at', 'desc')
            ->limit(50)
            ->get()
            ->map(fn (AuditLog $log) => [
                'id' => $log->id,
                'action' => $log->action,
                'message' => $this->formatMessage($log),
                'read' => $user->notifications_read_at
                    ? $log->created_at <= $user->notifications_read_at
                    : false,
                'created_at' => $log->created_at->toISOString(),
            ]);

        return response()->json([
            'success' => true,
            'data' => $notifications,
        ]);
    }

    /**
     * Get unread notification count (since last read).
     *
     * GET /notifications/count
     */
    public function count(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $query = AuditLog::where('user_id', $user->id)
            ->whereIn('action', $this->notifiableEvents());

        if ($user->notifications_read_at) {
            $query->where('created_at', '>', $user->notifications_read_at);
        }

        $count = $query->count();

        return response()->json([
            'success' => true,
            'data' => ['count' => $count],
        ]);
    }

    /**
     * Mark all notifications as read.
     *
     * POST /notifications/mark-read
     */
    public function markRead(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $user->update(['notifications_read_at' => now()]);

        return response()->json([
            'success' => true,
            'message' => 'Notifications marked as read.',
            'data' => ['count' => 0],
        ]);
    }

    /**
     * Admin: Resend a notification/email for a specific event.
     *
     * POST /admin/notifications/resend
     */
    public function resend(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if (! $user->role?->isStaff()) {
            return response()->json(['success' => false, 'message' => 'Unauthorized.'], 403);
        }

        $validated = $request->validate([
            'audit_log_id' => ['required', 'uuid', 'exists:audit_logs,id'],
            'channel' => ['required', 'string', 'in:email,push,both'],
        ]);

        $log = \App\Models\AuditLog::findOrFail($validated['audit_log_id']);
        $targetUser = \App\Models\User::find($log->user_id);

        if (! $targetUser) {
            return response()->json(['success' => false, 'message' => 'Target user not found.'], 404);
        }

        $sent = [];

        if (in_array($validated['channel'], ['push', 'both'])) {
            app(\App\Services\FcmService::class)->notifyUser(
                userId: $targetUser->id,
                title: $this->formatMessage($log),
                body: $this->formatMessage($log),
                data: ['type' => $log->action, 'resend' => true],
            );
            $sent[] = 'push';
        }

        if (in_array($validated['channel'], ['email', 'both'])) {
            \Illuminate\Support\Facades\Mail::to($targetUser)->queue(
                new \App\Mail\NotificationResendMail(
                    user: $targetUser,
                    action: $log->action,
                    message: $this->formatMessage($log),
                )
            );
            $sent[] = 'email';
        }

        return response()->json([
            'success' => true,
            'message' => "Notification resent via: " . implode(', ', $sent),
            'data' => ['channels' => $sent],
        ]);
    }

    // ── Private ───────────────────────────────────────────────

    private function notifiableEvents(): array
    {
        return [
            'bid.placed',
            'bid.accepted',
            'bid.rejected',
            'request.assigned',
            'payment.required',
            'payment.received',
            'delivery.started',
            'delivery.extension_requested',
            'delivery.extension_approved',
            'delivery.extension_rejected',
            'delivery.cancelled',
            'delivery.confirmed',
            'payment.released',
            'dispute.opened',
            'dispute.resolved',
            'kyc.verification_approved',
            'kyc.verification_rejected',
        ];
    }

    private function formatMessage(AuditLog $log): string
    {
        return match ($log->action) {
            'bid.placed' => 'A new bid was placed on your request.',
            'bid.accepted' => 'Your bid was accepted!',
            'bid.rejected' => 'Your bid was rejected.',
            'request.assigned' => 'Your request has been assigned to an errander.',
            'payment.required' => 'Please complete payment to proceed.',
            'payment.received' => 'Payment received! New work is available.',
            'delivery.started' => 'The errander has started your errand.',
            'delivery.extension_requested' => 'A time extension was requested for your errand.',
            'delivery.extension_approved' => 'Your time extension was approved.',
            'delivery.extension_rejected' => 'Your time extension was rejected.',
            'delivery.cancelled' => 'An errand was cancelled.',
            'delivery.confirmed' => 'Delivery has been confirmed.',
            'payment.released' => 'Your earnings have been released to your wallet.',
            'dispute.opened' => 'A dispute has been opened.',
            'dispute.resolved' => 'A dispute has been resolved.',
            'kyc.verification_approved' => 'Your KYC verification was approved.',
            'kyc.verification_rejected' => 'Your KYC verification was rejected.',
            default => 'You have a new notification.',
        };
    }
}
