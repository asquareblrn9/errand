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

    // ── Private ───────────────────────────────────────────────

    private function notifiableEvents(): array
    {
        return [
            'bid.placed',
            'bid.accepted',
            'bid.rejected',
            'request.assigned',
            'delivery.confirmed',
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
            'delivery.confirmed' => 'Delivery has been confirmed.',
            'dispute.opened' => 'A dispute has been opened.',
            'dispute.resolved' => 'A dispute has been resolved.',
            'kyc.verification_approved' => 'Your KYC verification was approved.',
            'kyc.verification_rejected' => 'Your KYC verification was rejected.',
            default => 'You have a new notification.',
        };
    }
}
