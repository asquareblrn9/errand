<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\BidStatus;
use App\Enums\WalletTransactionType;
use App\Models\BankAccount;
use App\Models\Bid;
use App\Models\Delivery;
use App\Models\DeliveryUpdate;
use App\Models\Dispute;
use App\Models\EscrowTransaction;
use App\Models\Rating;
use App\Models\Request as ErrandRequest;
use App\Models\User;
use App\Models\WalletTransaction;
use App\Services\RequestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request as HttpRequest;
use Illuminate\Support\Carbon;

class ErranderController extends Controller
{
    public function __construct(
        private readonly RequestService $requestService,
    ) {}

    /**
     * Aggregate payload for the errander home screen.
     *
     * GET /errander/home
     *
     * @queryParam latitude  numeric  Optional current latitude for nearby requests
     * @queryParam longitude numeric  Optional current longitude for nearby requests
     */
    public function home(HttpRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $nearby = $this->nearby($request);

        return response()->json([
            'success' => true,
            'data' => [
                'availability' => [
                    'is_online' => $user->is_online,
                    'last_location_update' => $user->last_location_update?->toISOString(),
                ],
                'earnings' => $this->earnings($user),
                'active_errand' => $this->activeErrand($user),
                'nearby' => $nearby['items'],
                'nearby_total' => $nearby['total'],
                'performance' => $this->performance($user),
            ],
        ]);
    }

    /**
     * Toggle errander online/offline availability.
     *
     * POST /errander/availability
     *
     * @bodyParam is_online boolean required New availability state
     */
    public function toggleAvailability(HttpRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'is_online' => ['required', 'boolean'],
        ]);

        if ($validated['is_online']) {
            $user->markOnline();
        } else {
            $user->markOffline();
        }

        return response()->json([
            'success' => true,
            'message' => $user->is_online ? 'You are now online.' : 'You are now offline.',
            'data' => [
                'is_online' => $user->is_online,
                'last_location_update' => $user->last_location_update?->toISOString(),
            ],
        ]);
    }

    /**
     * Trust score breakdown for the errander trust-score / earnings screens.
     *
     * GET /errander/trust-score
     */
    public function trustScore(HttpRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $performance = $this->performance($user);
        $trust = $performance['trust_score'];
        $tier = match (true) {
            $trust >= 4.5 => 'Platinum',
            $trust >= 4.0 => 'Gold',
            $trust >= 3.5 => 'Silver',
            $trust >= 2.5 => 'Bronze',
            default => 'At Risk',
        };

        $totalValueHandled = (float) WalletTransaction::where('user_id', $user->id)
            ->where('type', WalletTransactionType::Payout)
            ->where('status', 'completed')
            ->sum('amount');

        return response()->json([
            'success' => true,
            'data' => [
                'trust_score' => $trust,
                'tier' => $tier,
                'completed_orders' => $performance['completed_orders'],
                'average_rating' => $performance['rating'],
                'completion_rate' => $performance['completion_rate'],
                'on_time_percentage' => $performance['on_time_pct'],
                'accept_rate' => $performance['accept_rate'],
                'total_value_handled' => $totalValueHandled,
            ],
        ]);
    }

    /**
     * Lifetime earnings, rating distribution, and payout bank account.
     *
     * GET /errander/earnings
     */
    public function earningsSummary(HttpRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $lifetimeTotal = (float) WalletTransaction::where('user_id', $user->id)
            ->where('type', WalletTransactionType::Payout)
            ->where('status', 'completed')
            ->sum('amount');

        $lifetimeJobs = (int) WalletTransaction::where('user_id', $user->id)
            ->where('type', WalletTransactionType::Payout)
            ->where('status', 'completed')
            ->where('reference', 'not like', 'TIP-%') // tips aren't completed errands
            ->count();

        $counts = Rating::where('reviewee_id', $user->id)
            ->visible()
            ->selectRaw('rating, COUNT(*) AS count')
            ->groupBy('rating')
            ->pluck('count', 'rating');

        $distribution = [];
        for ($stars = 5; $stars >= 1; $stars--) {
            $distribution[] = [
                'stars' => $stars,
                'count' => (int) ($counts[$stars] ?? 0),
            ];
        }

        $averageRating = round((float) (Rating::where('reviewee_id', $user->id)->visible()->avg('rating') ?? 0), 2);
        $totalRatings = (int) Rating::where('reviewee_id', $user->id)->visible()->count();

        $bank = BankAccount::where('user_id', $user->id)
            ->where('is_verified', true)
            ->orderByDesc('is_primary')
            ->orderByDesc('created_at')
            ->first();

        return response()->json([
            'success' => true,
            'data' => [
                'lifetime_earnings' => [
                    'total' => $lifetimeTotal,
                    'jobs_count' => $lifetimeJobs,
                ],
                'rating_breakdown' => [
                    'average_rating' => $averageRating,
                    'total' => $totalRatings,
                    'distribution' => $distribution,
                ],
                'bank_account' => $bank ? [
                    'bank_name' => $bank->bank_name,
                    'account_number' => $bank->maskedAccountNumber(),
                    'account_name' => $bank->account_name,
                ] : null,
            ],
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Sections
    |--------------------------------------------------------------------------
    */

    /**
     * Earnings summary: today vs yesterday, this week, and chart series.
     */
    private function earnings(User $user): array
    {
        $now = Carbon::now();

        $today = (float) WalletTransaction::where('user_id', $user->id)
            ->where('type', WalletTransactionType::Payout)
            ->where('status', 'completed')
            ->whereBetween('created_at', [$now->copy()->startOfDay(), $now->copy()->endOfDay()])
            ->sum('amount');

        $yesterday = (float) WalletTransaction::where('user_id', $user->id)
            ->where('type', WalletTransactionType::Payout)
            ->where('status', 'completed')
            ->whereBetween('created_at', [$now->copy()->subDay()->startOfDay(), $now->copy()->subDay()->endOfDay()])
            ->sum('amount');

        $weekStart = $now->copy()->startOfWeek();
        $thisWeek = (float) WalletTransaction::where('user_id', $user->id)
            ->where('type', WalletTransactionType::Payout)
            ->where('status', 'completed')
            ->whereBetween('created_at', [$weekStart, $now->copy()->endOfWeek()])
            ->sum('amount');

        $thisWeekJobs = (int) WalletTransaction::where('user_id', $user->id)
            ->where('type', WalletTransactionType::Payout)
            ->where('status', 'completed')
            ->where('reference', 'not like', 'TIP-%') // tips aren't completed errands
            ->whereBetween('created_at', [$weekStart, $now->copy()->endOfWeek()])
            ->count();

        // Hourly series for today (sparkline)
        $chartToday = [];
        for ($hour = 0; $hour <= $now->hour; $hour++) {
            $amount = (float) WalletTransaction::where('user_id', $user->id)
                ->where('type', WalletTransactionType::Payout)
                ->where('status', 'completed')
                ->where('created_at', '>=', $now->copy()->startOfDay()->addHours($hour))
                ->where('created_at', '<', $now->copy()->startOfDay()->addHours($hour + 1))
                ->sum('amount');
            $chartToday[] = [
                'label' => $hour === 0 ? '12a' : ($hour < 12 ? "{$hour}a" : ($hour === 12 ? '12p' : ($hour - 12) . 'p')),
                'amount' => $amount,
            ];
        }

        // Daily series for the last 7 days
        $chartWeek = [];
        for ($i = 6; $i >= 0; $i--) {
            $day = $now->copy()->subDays($i);
            $amount = (float) WalletTransaction::where('user_id', $user->id)
                ->where('type', WalletTransactionType::Payout)
                ->where('status', 'completed')
                ->whereBetween('created_at', [$day->copy()->startOfDay(), $day->copy()->endOfDay()])
                ->sum('amount');
            $chartWeek[] = [
                'label' => $day->format('D'),
                'amount' => $amount,
            ];
        }

        $changePct = $yesterday > 0
            ? round((($today - $yesterday) / $yesterday) * 100, 1)
            : ($today > 0 ? 100.0 : 0.0);

        return [
            'today' => $today,
            'yesterday' => $yesterday,
            'change_pct' => $changePct,
            'this_week' => $thisWeek,
            'this_week_jobs' => $thisWeekJobs,
            'chart_today' => $chartToday,
            'chart_week' => $chartWeek,
        ];
    }

    /**
     * The errander's current active errand (latest active bid), if any.
     */
    private function activeErrand(User $user): ?array
    {
        /** @var Bid|null $bid */
        $bid = Bid::where('errander_id', $user->id)
            ->whereIn('status', [
                BidStatus::Accepted, BidStatus::PaymentMade, BidStatus::InProgress,
            ])
            ->with(['request', 'request.requester'])
            ->orderByDesc('updated_at')
            ->first();

        if (! $bid || ! $bid->request) {
            return null;
        }

        $delivery = Delivery::where('bid_id', $bid->id)->first();
        $lastUpdate = $delivery
            ? DeliveryUpdate::where('delivery_id', $delivery->id)->orderByDesc('created_at')->first()
            : null;

        $escrowAmount = (float) (EscrowTransaction::where('bid_id', $bid->id)
            ->where('status', 'held')
            ->value('amount') ?? $bid->total_amount);

        return [
            'bid_id' => $bid->id,
            'request_id' => $bid->request_id,
            'title' => $bid->request->title,
            'requester_name' => $bid->request->requester->name ?? 'Requester',
            'requester_first_name' => $bid->request->requester
                ? ($bid->request->requester->first_name ?? explode(' ', $bid->request->requester->name)[0])
                : 'Requester',
            'total_amount' => (float) $bid->total_amount,
            'escrow_amount' => $escrowAmount,
            'status' => $bid->status->value,
            'progress_pct' => $this->errandProgress($bid, $delivery),
            'state_label' => $this->errandStateLabel($bid, $delivery, $lastUpdate),
            'delivery' => $delivery ? [
                'started_at' => $delivery->started_at?->toISOString(),
                'deadline_at' => $delivery->deadline_at?->toISOString(),
                'otp_generated' => $delivery->otp_generated_at !== null,
                'confirmed' => $delivery->confirmed,
            ] : null,
        ];
    }

    /**
     * Nearby open requests — geo-sorted when coordinates are provided.
     *
     * @return array{items: array, total: int}
     */
    private function nearby(HttpRequest $request): array
    {
        $filters = $request->only(['category_id', 'latitude', 'longitude', 'radius_km', 'budget_min', 'budget_max', 'urgent_only']);
        $paginator = $this->requestService->feed(filters: $filters, perPage: 3);

        $items = collect($paginator->items())->map(function (ErrandRequest $r): array {
            $data = [
                'id' => $r->id,
                'title' => $r->title,
                'category' => $r->category?->name,
                'location' => $r->location,
                'budget_hint' => $r->budget_hint,
                'is_urgent' => $r->is_urgent,
                'urgent_fee' => $r->urgent_fee,
                'status' => $r->status->value,
                'bids_count' => $r->bids()->count(),
                'requester' => $r->relationLoaded('requester') && $r->requester ? [
                    'id' => $r->requester->id,
                    'name' => $r->requester->name,
                    'completed_orders' => $r->requester->completed_orders,
                    'rating' => Rating::where('reviewee_id', $r->requester->id)->visible()->avg('rating'),
                ] : null,
                'created_at' => $r->created_at->toISOString(),
            ];

            if (is_numeric($r->distance ?? null)) {
                $data['distance_km'] = round((float) $r->distance, 1);
            }

            return $data;
        })->values()->all();

        return [
            'items' => $items,
            'total' => $paginator->total(),
        ];
    }

    /**
     * Performance: rating, completion, accept rate, on-time %, trust score.
     */
    private function performance(User $user): array
    {
        $rating = (float) (Rating::where('reviewee_id', $user->id)->visible()->avg('rating') ?? 0);

        $submitted = (int) Bid::where('errander_id', $user->id)
            ->whereNot('status', BidStatus::Withdrawn)->count();
        $accepted = (int) Bid::where('errander_id', $user->id)
            ->whereIn('status', [
                BidStatus::Accepted, BidStatus::PaymentMade,
                BidStatus::InProgress, BidStatus::Completed,
            ])->count();
        $acceptRate = $submitted > 0 ? round(($accepted / $submitted) * 100, 1) : 0.0;

        $endedDeliveries = Delivery::where('errander_id', $user->id)
            ->whereNotNull('completed_at')->get();
        $completedDeliveries = $endedDeliveries->where('confirmed', true);

        $onTime = $completedDeliveries->filter(
            fn (Delivery $d): bool => $d->deadline_at === null || $d->completed_at->lte($d->deadline_at)
        )->count();
        $onTimePct = $completedDeliveries->count() > 0
            ? round(($onTime / $completedDeliveries->count()) * 100, 1)
            : 0.0;

        $completed = max($user->completed_orders, $completedDeliveries->count());
        $completionRate = $endedDeliveries->count() > 0
            ? round(($completedDeliveries->count() / $endedDeliveries->count()) * 100, 1)
            : 0.0;

        $disputes = (int) Dispute::where('errander_id', $user->id)->count();
        $disputeRate = $completed > 0 ? min(100, round(($disputes / $completed) * 100, 1)) : 0.0;

        // Trust score: completion (30%) + rating (25%) + on-time (25%) + dispute record (20%)
        $trustScore = round(
            5 * (
                0.30 * $completionRate / 100
                + 0.25 * min(5, $rating) / 5
                + 0.25 * $onTimePct / 100
                + 0.20 * max(0, 100 - $disputeRate) / 100
            ),
            2
        );

        return [
            'rating' => $rating,
            'completed_orders' => $completed,
            'accept_rate' => $acceptRate,
            'on_time_pct' => $onTimePct,
            'completion_rate' => $completionRate,
            'dispute_rate' => $disputeRate,
            'trust_score' => $trustScore,
        ];
    }

    /**
     * Map bid/delivery state to a 0-100 progress percentage.
     */
    private function errandProgress(Bid $bid, ?Delivery $delivery): int
    {
        return match ($bid->status) {
            BidStatus::Accepted => 15,
            BidStatus::PaymentMade => 30,
            BidStatus::InProgress => $delivery && $delivery->otp_generated_at ? 85 : ($delivery && $delivery->started_at ? 60 : 45),
            default => 0,
        };
    }

    /**
     * Human-readable state label for the active errand card.
     */
    private function errandStateLabel(Bid $bid, ?Delivery $delivery, ?DeliveryUpdate $lastUpdate): string
    {
        if ($lastUpdate && ! empty($lastUpdate->message)) {
            return $lastUpdate->message;
        }

        return match ($bid->status) {
            BidStatus::Accepted => 'Waiting for payment',
            BidStatus::PaymentMade => 'Payment confirmed — ready to start',
            BidStatus::InProgress => $delivery && $delivery->started_at
                ? 'Errand in progress'
                : 'Errand assigned',
            default => $bid->status->label(),
        };
    }
}
