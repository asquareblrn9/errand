<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\RequestStatus;
use App\Events\DeliveryConfirmed;
use App\Events\DeliveryOtpGenerated;
use App\Models\Bid;
use App\Models\Delivery;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class DeliveryOtpService
{
    private const OTP_TTL_MINUTES = 30;
    private const OTP_LENGTH = 6;
    private const MAX_ATTEMPTS = 3;

    /**
     * Generate a delivery OTP for an in-progress request.
     * Only the assigned errander can generate the OTP.
     */
    public function generate(Bid $bid, User $errander): array
    {
        if ($bid->errander_id !== $errander->id) {
            throw new \InvalidArgumentException('Only the assigned errander can generate a delivery OTP.');
        }

        $request = $bid->request;
        if ($request->status !== RequestStatus::InProgress) {
            throw new \InvalidArgumentException('Delivery OTP can only be generated for in-progress requests.');
        }

        $delivery = Delivery::where('bid_id', $bid->id)->first();

        if ($delivery?->confirmed) {
            throw new \InvalidArgumentException('This delivery has already been confirmed.');
        }

        $otp = str_pad((string) random_int(0, 999999), self::OTP_LENGTH, '0', STR_PAD_LEFT);

        $delivery = Delivery::updateOrCreate(
            ['bid_id' => $bid->id],
            [
                'request_id' => $bid->request_id,
                'errander_id' => $errander->id,
                'otp_hash' => \Illuminate\Support\Facades\Hash::make($otp),
                'otp_generated_at' => now(),
                'otp_expires_at' => now()->addMinutes(self::OTP_TTL_MINUTES),
                'otp_attempts' => 0,
                'max_otp_attempts' => self::MAX_ATTEMPTS,
                'dispute_window_hours' => $request->category->dispute_window_hours ?? 24,
            ]
        );

        // Store OTP in cache for fast verification
        Cache::put("delivery:{$bid->id}:otp", $otp, now()->addMinutes(self::OTP_TTL_MINUTES));
        Cache::put("delivery:{$bid->id}:attempts", 0, now()->addMinutes(self::OTP_TTL_MINUTES));

        // Transition request to delivered
        $request->transitionTo(RequestStatus::Delivered);

        event(new DeliveryOtpGenerated($delivery, $otp));

        return [
            'otp' => $otp,
            'expires_in_minutes' => self::OTP_TTL_MINUTES,
            'expires_at' => $delivery->otp_expires_at->toISOString(),
        ];
    }

    /**
     * Confirm delivery by verifying the OTP entered by the requester.
     */
    public function confirm(Bid $bid, User $requester, string $otp): Delivery
    {
        $delivery = Delivery::where('bid_id', $bid->id)->firstOrFail();

        if ($delivery->confirmed) {
            throw new \InvalidArgumentException('Delivery already confirmed.');
        }

        // Check DB-level expiry first (authoritative)
        if ($delivery->otp_expires_at?->isPast()) {
            Cache::forget("delivery:{$bid->id}:otp");
            Cache::forget("delivery:{$bid->id}:attempts");
            throw new \InvalidArgumentException('OTP has expired. Please request a new one.');
        }

        $attempts = (int) Cache::get("delivery:{$bid->id}:attempts", 0);
        if ($attempts >= self::MAX_ATTEMPTS) {
            throw new \InvalidArgumentException('Maximum OTP attempts exceeded. Please request a new OTP.');
        }

        $cachedOtp = Cache::get("delivery:{$bid->id}:otp");

        if (! $cachedOtp || $cachedOtp !== $otp) {
            Cache::increment("delivery:{$bid->id}:attempts");
            $remaining = self::MAX_ATTEMPTS - $attempts - 1;
            throw new \InvalidArgumentException("Invalid OTP. {$remaining} attempts remaining.");
        }

        return DB::transaction(function () use ($delivery, $requester, $bid): Delivery {
            // Clear OTP from cache
            Cache::forget("delivery:{$bid->id}:otp");
            Cache::forget("delivery:{$bid->id}:attempts");

            $disputeWindowHours = $delivery->dispute_window_hours;

            $delivery->update([
                'confirmed' => true,
                'confirmed_at' => now(),
                'confirmed_by' => $requester->id,
                'dispute_window_closes_at' => now()->addHours($disputeWindowHours),
            ]);

            event(new DeliveryConfirmed($delivery));

            return $delivery;
        });
    }
}
