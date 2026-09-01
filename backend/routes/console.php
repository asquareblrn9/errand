<?php

use App\Console\Commands\ReleaseExpiredEscrow;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Escrow settlement — pays erranders once the dispute window closes.
// NOTE: in Laravel 11+ schedules live here, NOT in Console Kernel::schedule().
Schedule::command(ReleaseExpiredEscrow::class)->everyMinute();
