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

// Activity log auto-export — always registered; enabled/disabled checked inside the command at runtime
Schedule::command('logs:export-activity')->everyMinute()->withoutOverlapping();
