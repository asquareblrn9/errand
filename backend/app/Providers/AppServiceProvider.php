<?php

declare(strict_types=1);

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureRateLimiting();
        $this->configureSanctum();
        $this->configureEvents();
    }

    /**
     * Use our custom UUID-based PersonalAccessToken model.
     */
    private function configureSanctum(): void
    {
        \Laravel\Sanctum\Sanctum::usePersonalAccessTokenModel(
            \App\Models\PersonalAccessToken::class
        );
    }

    /**
     * Register event listeners.
     */
    private function configureEvents(): void
    {
        \Illuminate\Support\Facades\Event::listen(
            \App\Events\RequestPosted::class,
            \App\Listeners\NotifyErrandersOfNewRequest::class,
        );
        \Illuminate\Support\Facades\Event::listen(
            \App\Events\BidPlaced::class,
            \App\Listeners\NotifyRequesterOfBid::class,
        );
        \Illuminate\Support\Facades\Event::listen(
            \App\Events\BidAccepted::class,
            \App\Listeners\NotifyErranderBidAccepted::class,
        );
        \Illuminate\Support\Facades\Event::listen(
            \App\Events\DeliveryConfirmed::class,
            \App\Listeners\NotifyOnDeliveryConfirmed::class,
        );
    }

    /**
     * Configure API rate limiting.
     *
     * - 'api': 60 requests/min per authenticated user
     * - 'auth': 5 requests/min per IP (for login/register/password reset)
     * - 'otp': 3 requests/min per user (for OTP verification attempts)
     */
    private function configureRateLimiting(): void
    {
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(60)->by(
                $request->user()?->id ?: $request->ip()
            );
        });

        RateLimiter::for('auth', function (Request $request) {
            return Limit::perMinute(5)->by($request->ip());
        });

        RateLimiter::for('otp', function (Request $request) {
            return Limit::perMinute(3)->by(
                $request->user()?->id ?: $request->ip()
            );
        });

        RateLimiter::for('payment', function (Request $request) {
            return Limit::perMinute(5)->by(
                $request->user()?->id ?: $request->ip()
            );
        });

        RateLimiter::for('webhook', function (Request $request) {
            return Limit::perMinute(30)->by($request->ip());
        });
    }
}
