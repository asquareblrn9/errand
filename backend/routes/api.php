<?php

declare(strict_types=1);

use App\Http\Controllers\AddressController;
use App\Http\Controllers\Admin\AdminDashboardController;
use App\Http\Controllers\Admin\AdminKycController;
use App\Http\Controllers\Admin\AdminSettingController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\KycController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\Admin\AdminUserController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\CompanyController;
use App\Http\Controllers\DeliveryController;
use App\Http\Controllers\DisputeController;
use App\Http\Controllers\ErranderController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\RatingController;
use App\Http\Controllers\PaymentWebhookController;
use App\Http\Controllers\SubscriptionController;
use App\Http\Controllers\WalletController;
use App\Http\Controllers\Auth\EmailVerificationController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\Auth\PhoneVerificationController;
use App\Http\Controllers\Auth\SessionController;
use App\Http\Controllers\Auth\TwoFactorController;
use App\Http\Controllers\BidController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\PublicProfileController;
use App\Http\Controllers\RequestController;
use App\Http\Controllers\RequesterController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Errand Boy API — v1
|--------------------------------------------------------------------------
|
| Base URL: http://localhost:8000/api/v1
| Authentication: Bearer token via Sanctum
|
*/

// ── Health (no auth, outside v1) ──────────────────────
Route::get('/health', [HealthController::class, 'basic']);
Route::get('/health/detailed', [HealthController::class, 'detailed']);

Route::prefix('v1')->group(function (): void {

    /*
    |--------------------------------------------------------------------------
    | Public Routes
    |--------------------------------------------------------------------------
    */

    // ── Auth ─────────────────────────────────────────────
    Route::middleware(['throttle:auth'])->group(function (): void {
        Route::post('/auth/register', [AuthController::class, 'register']);
        Route::post('/auth/login', [AuthController::class, 'login']);
        Route::post('/auth/login-2fa', [AuthController::class, 'login2FA']);
        Route::post('/auth/forgot-password', [PasswordResetController::class, 'forgot']);
        Route::post('/auth/reset-password', [PasswordResetController::class, 'reset']);
        Route::post('/auth/refresh', [AuthController::class, 'refresh']);
        Route::post('/auth/google', [AuthController::class, 'googleLogin']);
    });

    // ── Public Profiles ──────────────────────────────────
    Route::get('/users/{id}/profile', [PublicProfileController::class, 'show']);

    // ── Categories ───────────────────────────────────────
    Route::get('/categories', [CategoryController::class, 'index']);
    Route::get('/categories/{id}', [CategoryController::class, 'show']);

    // ── Public Ratings ────────────────────────────────────
    Route::get('/users/{id}/ratings', [RatingController::class, 'userRatings']);

    // ── Plans ─────────────────────────────────────────────
    Route::get('/plans', [SubscriptionController::class, 'index']);

    Route::get('/settings/public', [\App\Http\Controllers\SettingsController::class, 'public']);

    // ── Payment Redirect (no auth) ──────────────────────
    Route::get('/payments/complete/{providerRef}', [\App\Http\Controllers\PaymentRedirectController::class, 'complete']);

    // ── Payment Webhooks (no auth, signature-verified, rate-limited) ──
    Route::post('/payments/webhook/flutterwave', [PaymentWebhookController::class, 'flutterwave'])
        ->middleware('throttle:webhook');
    Route::post('/payments/webhook/paystack', [PaymentWebhookController::class, 'paystack'])
        ->middleware('throttle:webhook');

    /*
    |--------------------------------------------------------------------------
    | Authenticated Routes
    |--------------------------------------------------------------------------
    */
    Route::middleware(['auth:sanctum', 'throttle:api'])->group(function (): void {

        // ── Auth ─────────────────────────────────────────
        Route::post('/auth/logout', [AuthController::class, 'logout']);

        // ── Profile ──────────────────────────────────────
        Route::get('/me', [AuthController::class, 'me']);
        Route::put('/me', [AuthController::class, 'updateProfile']);
        Route::delete('/me', [AuthController::class, 'deleteAccount']);
        Route::post('/me/avatar', [AuthController::class, 'uploadAvatar']);

        // ── Addresses ────────────────────────────────────
        Route::get('/me/addresses', [AddressController::class, 'index']);
        Route::post('/me/addresses', [AddressController::class, 'store']);
        Route::get('/me/addresses/{id}', [AddressController::class, 'show']);
        Route::put('/me/addresses/{id}', [AddressController::class, 'update']);
        Route::delete('/me/addresses/{id}', [AddressController::class, 'destroy']);

        // ── Email Verification ───────────────────────────
        Route::post('/auth/verify-email', [EmailVerificationController::class, 'verify'])->middleware('throttle:otp');
        Route::post('/auth/verify-email/send', [EmailVerificationController::class, 'send'])->middleware('throttle:otp');

        // ── Phone Verification ───────────────────────────
        Route::post('/auth/verify-phone/send', [PhoneVerificationController::class, 'send'])->middleware('throttle:otp');
        Route::post('/auth/verify-phone', [PhoneVerificationController::class, 'verify']);

        // ── Notifications ────────────────────────────────
        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::get('/notifications/count', [NotificationController::class, 'count']);
        Route::post('/notifications/mark-read', [NotificationController::class, 'markRead']);

        // ── Two-Factor Authentication ────────────────────
        Route::post('/auth/enable-2fa', [TwoFactorController::class, 'enable']);
        Route::post('/auth/verify-2fa', [TwoFactorController::class, 'verify']);
        Route::post('/auth/disable-2fa', [TwoFactorController::class, 'disable']);

        // ── KYC Verification ──────────────────────────────
        Route::get('/kyc/status', [KycController::class, 'status']);
        Route::put('/kyc/profile', [KycController::class, 'updateProfile']);
        Route::post('/kyc/identity', [KycController::class, 'submitIdentity']);
        Route::post('/kyc/selfie', [KycController::class, 'submitSelfie']);
        Route::post('/kyc/bank-account', [KycController::class, 'saveBankAccount']);
        Route::post('/kyc/emergency-contact', [KycController::class, 'saveEmergencyContact']);
        Route::post('/kyc/submit', [KycController::class, 'submit']);

        // ── Session Management ───────────────────────────
        Route::get('/auth/sessions', [SessionController::class, 'index']);
        Route::delete('/auth/sessions/{id}', [SessionController::class, 'destroy']);

        // ── Requests ────────────────────────────────────
        Route::get('/requests', [RequestController::class, 'index']);
        Route::post('/requests', [RequestController::class, 'store']);
        Route::get('/requests/{id}', [RequestController::class, 'show']);
        Route::put('/requests/{id}', [RequestController::class, 'update']);
        Route::delete('/requests/{id}', [RequestController::class, 'destroy']);
        Route::get('/my/requests', [RequestController::class, 'myRequests']);

        // ── Bids ─────────────────────────────────────────
        Route::post('/requests/{requestId}/bids', [BidController::class, 'store']);
        Route::get('/requests/{requestId}/bids', [BidController::class, 'index']);
        Route::post('/bids/{id}/accept', [BidController::class, 'accept']);
        Route::delete('/bids/{id}', [BidController::class, 'destroy']);
        Route::get('/my/bids', [BidController::class, 'myBids']);

        // ── Errander ──────────────────────────────────────
        Route::middleware('role:errander')->group(function (): void {
            Route::get('/errander/home', [ErranderController::class, 'home']);
            Route::get('/errander/trust-score', [ErranderController::class, 'trustScore']);
            Route::post('/errander/availability', [ErranderController::class, 'toggleAvailability']);
            Route::get('/errander/earnings', [ErranderController::class, 'earningsSummary']);
        });

        // ── Requester ─────────────────────────────────────
        Route::middleware('role:requester')->group(function (): void {
            Route::get('/requester/home', [RequesterController::class, 'home']);
        });

        // ── Wallet ────────────────────────────────────────
        Route::get('/wallet', [WalletController::class, 'show']);
        Route::get('/wallet/banks', [WalletController::class, 'banks']);
        Route::post('/wallet/resolve-account', [WalletController::class, 'resolveAccount']);
        Route::post('/wallet/fund', [WalletController::class, 'fund']);
        Route::post('/wallet/verify-payment', [WalletController::class, 'verifyPayment']);
        Route::get('/wallet/transactions', [WalletController::class, 'transactions']);
        Route::post('/wallet/withdraw', [WalletController::class, 'withdraw']);

        // ── Payments (rate-limited) ────────────────────────
        Route::middleware('throttle:payment')->group(function (): void {
            Route::get('/payments/providers', [\App\Http\Controllers\API\PaymentProviderController::class, 'index']);
            Route::post('/payments/initiate', [PaymentController::class, 'initiate']);
            Route::get('/payments/verify/{providerRef}', [PaymentController::class, 'verifyByRef']);
            Route::get('/payments/{id}', [PaymentController::class, 'show']);
            Route::get('/my/payments', [PaymentController::class, 'myPayments']);
        });

        // ── Deliveries ────────────────────────────────────
        Route::post('/deliveries/{bidId}/start', [DeliveryController::class, 'start']);
        Route::post('/deliveries/{bidId}/generate-otp', [DeliveryController::class, 'generateOtp']);
        Route::post('/deliveries/{bidId}/confirm', [DeliveryController::class, 'confirm']);
        Route::get('/deliveries/{bidId}', [DeliveryController::class, 'show']);
        Route::get('/deliveries/{bidId}/timeline', [DeliveryController::class, 'timeline']);
        Route::post('/deliveries/{bidId}/updates', [DeliveryController::class, 'postUpdate']);
        Route::post('/deliveries/{bidId}/extensions', [DeliveryController::class, 'requestExtension']);
        Route::post('/deliveries/extensions/{extensionId}/decide', [DeliveryController::class, 'decideExtension']);
        Route::post('/deliveries/{bidId}/cancel', [DeliveryController::class, 'cancel']);

        // ── Location ───────────────────────────────────────
        Route::get('/places/autocomplete', [\App\Http\Controllers\LocationController::class, 'autocomplete']);
        Route::get('/places/details', [\App\Http\Controllers\LocationController::class, 'details']);

        // ── Chat ──────────────────────────────────────────
        Route::get('/conversations', [ChatController::class, 'index']);
        Route::get('/conversations/{id}/messages', [ChatController::class, 'messages']);
        Route::post('/conversations/{id}/messages', [ChatController::class, 'send']);
        Route::post('/conversations/{id}/read', [ChatController::class, 'markRead']);

        // ── Disputes ──────────────────────────────────────
        Route::post('/disputes', [DisputeController::class, 'store']);
        Route::get('/disputes/{id}', [DisputeController::class, 'show']);
        Route::get('/my/disputes', [DisputeController::class, 'myDisputes']);
        Route::post('/disputes/{id}/respond', [DisputeController::class, 'respond']);
        Route::post('/disputes/{id}/resolve', [DisputeController::class, 'resolve']);
        Route::post('/disputes/{id}/request-evidence', [DisputeController::class, 'requestEvidence']);

        // ── Ratings ───────────────────────────────────────
        Route::post('/ratings', [RatingController::class, 'store']);

        // ── Companies ─────────────────────────────────────
        Route::post('/companies', [CompanyController::class, 'store']);
        Route::get('/companies/{id}', [CompanyController::class, 'show']);
        Route::get('/companies/{id}/members', [CompanyController::class, 'members']);
        Route::post('/companies/{id}/invite', [CompanyController::class, 'invite']);

        // ── Subscriptions ─────────────────────────────────
        Route::post('/subscriptions', [SubscriptionController::class, 'subscribe']);
        Route::get('/my/subscription', [SubscriptionController::class, 'current']);
        Route::post('/subscriptions/cancel', [SubscriptionController::class, 'cancel']);

        // ── Admin ─────────────────────────────────────────
        Route::middleware('role:admin|super_admin')->prefix('admin')->group(function (): void {
            Route::get('/dashboard', [AdminDashboardController::class, 'index']);
            Route::get('/analytics', [\App\Http\Controllers\Admin\AdminAnalyticsController::class, 'index']);
            Route::get('/errands', [AdminDashboardController::class, 'errands']);
            Route::get('/errander-earnings', [AdminDashboardController::class, 'erranderEarnings']);
            Route::get('/payments', [\App\Http\Controllers\Admin\AdminPaymentController::class, 'index']);
            Route::post('/notifications/send', [\App\Http\Controllers\Admin\AdminNotificationController::class, 'send']);
            Route::post('/jobs/{id}/force-cancel', [\App\Http\Controllers\Admin\AdminJobController::class, 'forceCancel']);
            Route::get('/jobs/{id}/timeline', [\App\Http\Controllers\Admin\AdminJobController::class, 'timeline']);
            Route::post('/users/{id}/reset-password', [AdminUserController::class, 'resetPassword']);
            Route::get('/transactions', [\App\Http\Controllers\Admin\AdminTransactionController::class, 'index']);
            Route::get('/transactions/{id}', [\App\Http\Controllers\Admin\AdminTransactionController::class, 'show']);
            Route::get('/escrow', [\App\Http\Controllers\Admin\AdminEscrowController::class, 'index']);
            Route::get('/disputes', [\App\Http\Controllers\Admin\AdminDisputeController::class, 'index']);
            Route::post('/notifications/resend', [\App\Http\Controllers\NotificationController::class, 'resend']);
            Route::get('/users', [AdminUserController::class, 'index']);
            Route::get('/categories', [CategoryController::class, 'index']);
            Route::post('/categories', [CategoryController::class, 'store']);
            Route::put('/categories/{id}', [CategoryController::class, 'update']);
            Route::delete('/categories/{id}', [CategoryController::class, 'destroy']);
            Route::get('/settings', [AdminSettingController::class, 'index']);
            Route::put('/settings', [AdminSettingController::class, 'update']);
            Route::get('/users/{id}', [AdminUserController::class, 'show']);
            Route::put('/users/{id}/suspend', [AdminUserController::class, 'suspend']);
            Route::put('/users/{id}/activate', [AdminUserController::class, 'activate']);
            Route::put('/users/{id}/ban', [AdminUserController::class, 'ban']);
            Route::get('/kyc/pending', [AdminKycController::class, 'index']);
            Route::get('/kyc/{userId}', [AdminKycController::class, 'show']);
            Route::post('/kyc/{verificationId}/approve', [AdminKycController::class, 'approve']);
            Route::post('/kyc/{verificationId}/reject', [AdminKycController::class, 'reject']);
            Route::post('/kyc/{verificationId}/request-resubmission', [AdminKycController::class, 'requestResubmission']);
        });
    });
});
