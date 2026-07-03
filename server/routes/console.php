<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('bookings:archive')->dailyAt('02:00');
Schedule::command('bookings:release-ghosts')->everyMinute();

// Email reminders for bookings starting soon (window configured via 'reminder_minutes' setting, default 10)
Schedule::command('bookings:send-reminders')->everyMinute()->withoutOverlapping();

// Auto backup (archive, activity log, users/buildings/rooms — one bundled batch) — always registered; enabled/disabled checked inside the command at runtime
Schedule::command('backup:export-data')->everyMinute()->withoutOverlapping();
