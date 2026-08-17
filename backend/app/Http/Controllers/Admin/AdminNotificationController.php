<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\FcmService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class AdminNotificationController extends Controller
{
    /** POST /admin/notifications/send — broadcast push or email */
    public function send(Request $request, FcmService $fcm): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'message' => ['required', 'string', 'max:1000'],
            'channel' => ['required', 'string', 'in:push,email,both'],
            'target' => ['required', 'string', 'in:all,requesters,erranders,individual'],
            'user_id' => ['required_if:target,individual', 'uuid', 'exists:users,id'],
        ]);

        $users = match ($validated['target']) {
            'all' => User::whereIn('role', ['requester', 'errander'])->get(),
            'requesters' => User::where('role', 'requester')->get(),
            'erranders' => User::where('role', 'errander')->get(),
            'individual' => User::where('id', $validated['user_id'])->get(),
        };

        $sent = 0;
        foreach ($users as $user) {
            if (in_array($validated['channel'], ['push', 'both'])) {
                $fcm->notifyUser(
                    userId: $user->id,
                    title: $validated['title'],
                    body: $validated['message'],
                    data: ['type' => 'admin_broadcast'],
                );
            }
            if (in_array($validated['channel'], ['email', 'both']) && $user->email) {
                Mail::to($user)->queue(new \App\Mail\AdminBroadcastMail(
                    user: $user,
                    title: $validated['title'],
                    message: $validated['message'],
                ));
            }
            $sent++;
        }

        \App\Models\AuditLog::log('admin.broadcast', $request->user(), null, null, null, [
            'target' => $validated['target'],
            'channel' => $validated['channel'],
            'sent_to' => $sent,
        ]);

        return response()->json([
            'success' => true,
            'message' => "Notification sent to {$sent} users via {$validated['channel']}.",
            'data' => ['sent' => $sent],
        ]);
    }
}
