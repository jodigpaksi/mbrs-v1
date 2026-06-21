<?php

namespace App\Console\Commands;

use App\Http\Controllers\Api\ArchiveController;
use Carbon\Carbon;
use Illuminate\Console\Command;

class ExportArchive extends Command
{
    protected $signature   = 'bookings:export-archive';
    protected $description = 'Export archive bookings to server storage based on schedule settings';

    public function handle(): void
    {
        $s = ArchiveController::getSettings();

        if (!$s['export_enabled']) {
            $this->info('Export scheduler is disabled.');
            return;
        }

        $nowTime  = Carbon::now()->format('H:i');
        if ($nowTime !== $s['export_time']) {
            $this->info("Not scheduled time ({$s['export_time']}), skipping.");
            return;
        }

        $now       = Carbon::now();
        $shouldRun = match ($s['export_frequency']) {
            'weekly'  => $now->dayOfWeek === $s['export_day_of_week'],
            'monthly' => $now->day       === $s['export_day_of_month'],
            default   => true,
        };

        if (!$shouldRun) {
            $this->info('Not the scheduled day, skipping.');
            return;
        }

        $files = ArchiveController::generateExports($s['export_formats']);
        $this->info('Exported ' . count($files) . ' file(s) to storage.');
    }
}
