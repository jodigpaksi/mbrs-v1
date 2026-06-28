<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('bookings:archive')->dailyAt('02:00');
Schedule::command('bookings:export-archive')->everyMinute();
Schedule::command('bookings:release-ghosts')->everyMinute();

// Activity log auto-export — reads frequency/time from DB settings
(function () {
    $enabled   = \App\Models\Setting::where('key', 'log_auto_export_enabled')->value('value');
    if ($enabled !== 'true') return;

    $frequency = \App\Models\Setting::where('key', 'log_auto_export_interval')->value('value') ?? 'daily';
    $time      = \App\Models\Setting::where('key', 'log_auto_export_time')->value('value')     ?? '00:00';

    $cmd = Schedule::command('logs:export-activity');
    match ($frequency) {
        'weekly'  => $cmd->weekly()->at($time),
        'monthly' => $cmd->monthly()->at($time),
        default   => $cmd->dailyAt($time),
    };
})();
