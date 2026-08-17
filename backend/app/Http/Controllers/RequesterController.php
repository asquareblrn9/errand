<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\RequestStatus;
use App\Models\Delivery;
use App\Models\EscrowTransaction;
use App\Models\Payment;
use App\Models\Rating;
use App\Models\Request as ErrandRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request as HttpRequest;
use Illuminate\Support\Carbon;

class RequesterController extends Controller
{
    /**
     * States in which a requester's errand is still in flight.
     *
     * @var array<RequestStatus>
     */
    private const ACTIVE_STATUSES = [
        RequestStatus::Assigned,
        RequestStatus::InProgress,
        RequestStatus::Delivered,
        RequestStatus::Confirmed,
        RequestStatus::EscrowHold,
        RequestStatus::DisputeWindow,
    ];

    /**
     * Aggregate payload for the requester home screen.
     *
     * GET /requester/home
     */
    public function home(HttpRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'success' => true,
            'data' => [
                'stats' => $this->stats($user),
                'chart_week' => $this->weeklySpendChart($user),
                'category_breakdown' => $this->categoryBreakdown($user),
                'active_errands' => $this->activeErrands($user),
            ],
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Sections
    |--------------------------------------------------------------------------
    */

    /**
     * Headline stats: active errands, arrivals today, spend, completion, rating.
     */
    private function stats(User $user): array
    {
        $now = Carbon::now();

        $activeErrands = (int) ErrandRequest::where('user_id', $user->id)
            ->whereIn('status', self::ACTIVE_STATUSES)
            ->count();

        $arrivingToday = (int) Delivery::whereBetween('deadline_at', [
            $now->copy()->startOfDay(),
            $now->copy()->endOfDay(),
        ])->whereHas('request', function ($query) use ($user): void {
            $query->where('user_id', $user->id)
                ->whereIn('status', self::ACTIVE_STATUSES);
        })->count();

        $spentThisMonth = (float) Payment::where('user_id', $user->id)
            ->where('status', 'successful')
            ->whereBetween('paid_at', [$now->copy()->startOfMonth(), $now->copy()->endOfMonth()])
            ->sum('amount');

        $spentLastMonth = (float) Payment::where('user_id', $user->id)
            ->where('status', 'successful')
            ->whereBetween('paid_at', [
                $now->copy()->subMonthNoOverflow()->startOfMonth(),
                $now->copy()->subMonthNoOverflow()->endOfMonth(),
            ])
            ->sum('amount');

        $spentChangePct = $spentLastMonth > 0
            ? round((($spentThisMonth - $spentLastMonth) / $spentLastMonth) * 100, 1)
            : ($spentThisMonth > 0 ? 100.0 : 0.0);

        $spentLifetime = (float) Payment::where('user_id', $user->id)
            ->where('status', 'successful')
            ->sum('amount');

        $completed = (int) ErrandRequest::where('user_id', $user->id)
            ->where('status', RequestStatus::Completed)
            ->count();

        $avgRating = round((float) (Rating::where('reviewee_id', $user->id)->visible()->avg('rating') ?? 0), 2);

        $totalRatings = (int) Rating::where('reviewee_id', $user->id)->visible()->count();

        return [
            'active_errands' => $activeErrands,
            'arriving_today' => $arrivingToday,
            'spent_this_month' => $spentThisMonth,
            'spent_change_pct' => $spentChangePct,
            'spent_lifetime' => $spentLifetime,
            'completed' => $completed,
            'avg_rating' => $avgRating,
            'total_ratings' => $totalRatings,
        ];
    }

    /**
     * Weekly spend series for the last 8 weeks (oldest first, current week last).
     */
    private function weeklySpendChart(User $user): array
    {
        $chartWeek = [];
        for ($i = 7; $i >= 0; $i--) {
            $weekStart = Carbon::now()->copy()->subWeeks($i)->startOfWeek();
            $weekEnd = Carbon::now()->copy()->subWeeks($i)->endOfWeek();
            $amount = (float) Payment::where('user_id', $user->id)
                ->where('status', 'successful')
                ->whereBetween('paid_at', [$weekStart, $weekEnd])
                ->sum('amount');
            $chartWeek[] = [
                'label' => 'Wk' . (8 - $i),
                'amount' => $amount,
            ];
        }

        return $chartWeek;
    }

    /**
     * Month-to-date spend grouped by category.
     */
    private function categoryBreakdown(User $user): array
    {
        $now = Carbon::now();

        $rows = Payment::where('payments.user_id', $user->id)
            ->where('payments.status', 'successful')
            ->whereBetween('payments.paid_at', [$now->copy()->startOfMonth(), $now->copy()->endOfMonth()])
            ->join('requests', 'requests.id', '=', 'payments.request_id')
            ->join('categories', 'categories.id', '=', 'requests.category_id')
            ->selectRaw('categories.name AS category_name, SUM(payments.amount) AS amount')
            ->groupBy('categories.id', 'categories.name')
            ->orderByDesc('amount')
            ->get();

        return $rows->map(fn ($row): array => [
            'category_name' => $row->category_name,
            'amount' => round((float) $row->amount, 2),
        ])->values()->all();
    }

    /**
     * The requester's in-flight errands (latest five).
     */
    private function activeErrands(User $user): array
    {
        $items = ErrandRequest::where('user_id', $user->id)
            ->whereIn('status', self::ACTIVE_STATUSES)
            ->with(['category', 'acceptedBid.errander', 'delivery'])
            ->orderByDesc('updated_at')
            ->limit(5)
            ->get();

        return $items->map(function (ErrandRequest $r): array {
            $escrowAmount = (float) ($r->acceptedBid
                ? (EscrowTransaction::where('bid_id', $r->acceptedBid->id)
                    ->where('status', 'held')
                    ->value('amount') ?? $r->acceptedBid->total_amount)
                : 0.0);

            return [
                'id' => $r->id,
                'title' => $r->title,
                'status' => $r->status->value,
                'category_name' => $r->category?->name,
                'errander_name' => $r->acceptedBid?->errander?->name,
                'escrow_amount' => $escrowAmount,
                'deadline_at' => $r->delivery?->deadline_at?->toISOString(),
                'minutes_remaining' => $r->delivery?->deadline_at
                    ? $r->delivery->minutesRemaining()
                    : null,
            ];
        })->values()->all();
    }
}
