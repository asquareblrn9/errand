<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\PlatformSetting;
use Illuminate\Http\JsonResponse;

class SettingsController extends Controller
{
    /**
     * Public platform settings used by clients (fees, currency).
     *
     * GET /settings/public
     */
    public function public(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'platform_name' => PlatformSetting::get('platform_name', 'Errand Boy'),
                'currency' => PlatformSetting::get('currency', 'NGN'),
                'platform_commission_pct' => (float) PlatformSetting::get('platform_commission_pct', config('errandboy.platform_fee_percentage', 5)),
                'urgent_fee' => (float) PlatformSetting::get('urgent_fee', 1500),
                'withdrawal_fee_pct' => (float) PlatformSetting::get('withdrawal_fee_pct', 1.5),
                'withdrawal_fee_cap' => (float) PlatformSetting::get('withdrawal_fee_cap', 200),
                'min_withdrawal' => (float) PlatformSetting::get('min_withdrawal', 1000),
                'min_service_fee' => 500,
            ],
        ]);
    }
}
