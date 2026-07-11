<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\BidStatus;
use App\Enums\RequestStatus;
use App\Events\BidAccepted;
use App\Events\BidPlaced;
use App\Models\Bid;
use App\Models\Request;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class BidService
{
    /**
     * Submit a bid on an open request.
     *
     * @throws \App\Exceptions\BidAlreadyExistsException
     * @throws \InvalidArgumentException
     */
    public function submit(Request $request, User $errander, array $data): Bid
    {
        if ($request->status !== RequestStatus::Open) {
            throw new \InvalidArgumentException('This request is no longer open for bids.');
        }

        $existing = Bid::where('request_id', $request->id)
            ->where('errander_id', $errander->id)
            ->first();

        if ($existing) {
            throw new \App\Exceptions\BidAlreadyExistsException('You have already submitted a bid on this request.');
        }

        $goodsAmount = (float) $data['goods_amount'];
        $serviceFee = (float) $data['service_fee'];
        $platformFee = round(
            ($goodsAmount + $serviceFee) * (config('errandboy.platform_fee_percentage', 5) / 100),
            2
        );
        $totalAmount = $goodsAmount + $serviceFee + $platformFee;

        $bid = Bid::create([
            'request_id' => $request->id,
            'errander_id' => $errander->id,
            'goods_amount' => $goodsAmount,
            'service_fee' => $serviceFee,
            'platform_fee' => $platformFee,
            'total_amount' => $totalAmount,
            'note' => $data['note'] ?? null,
            'delivery_at' => $data['delivery_at'] ?? null,
            'status' => BidStatus::Pending,
        ]);

        event(new BidPlaced($bid));

        return $bid->load('errander');
    }

    /**
     * Accept a bid. Rejects all other bids on the same request.
     */
    public function accept(Bid $bid): Bid
    {
        return DB::transaction(function () use ($bid): Bid {
            // Mark this bid as accepted
            $bid->update(['status' => BidStatus::Accepted]);

            // Reject all other pending bids on this request
            Bid::where('request_id', $bid->request_id)
                ->where('id', '!=', $bid->id)
                ->where('status', BidStatus::Pending)
                ->update(['status' => BidStatus::Rejected]);

            // Update request
            $bid->request->update([
                'status' => RequestStatus::Assigned,
                'accepted_bid_id' => $bid->id,
            ]);

            event(new BidAccepted($bid));

            return $bid->fresh(['request', 'errander']);
        });
    }

    /**
     * Withdraw a pending bid.
     */
    public function withdraw(Bid $bid): void
    {
        if ($bid->status !== BidStatus::Pending) {
            throw new \InvalidArgumentException('Only pending bids can be withdrawn.');
        }

        $bid->update(['status' => BidStatus::Withdrawn]);
    }

    /**
     * Reject a bid. Used when another bid is accepted.
     */
    public function reject(Bid $bid): void
    {
        if ($bid->status !== BidStatus::Pending) {
            throw new \InvalidArgumentException('Only pending bids can be rejected.');
        }

        $bid->update(['status' => BidStatus::Rejected]);
    }
}
