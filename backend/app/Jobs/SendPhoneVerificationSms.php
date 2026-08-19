<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Services\SmsService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendPhoneVerificationSms implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     */
    public int $tries = 3;

    /**
     * The number of seconds the job may run before timing out.
     */
    public int $timeout = 30;

    /**
     * Create a new job instance.
     *
     * @param  string  $phone  Recipient in international format (e.g., +2348012345678)
     */
    public function __construct(
        public readonly string $phone,
        public readonly string $code,
    ) {}

    /**
     * Execute the job.
     */
    public function handle(SmsService $sms): void
    {
        $sms->send(
            $this->phone,
            "Your Errand Boy verification code is {$this->code}. It expires in 30 minutes."
        );
    }
}
