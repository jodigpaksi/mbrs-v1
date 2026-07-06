<?php

namespace App\Console\Commands;

use App\Http\Controllers\Api\BackupController;
use App\Models\Setting;
use Carbon\Carbon;
use Illuminate\Console\Command;

class BackupExportData extends Command
{
    protected $signature   = 'backup:export-data';
    protected $description = 'Export a single backup batch (archive, activity log, and/or users/buildings/rooms) based on schedule settings';

    public function handle(): void
    {
        $s = BackupController::getSettings();

        if (!$s['backup_enabled']) {
            $this->info('Auto backup is disabled.');
            return;
        }

        $include = [
            'archive' => $s['backup_include_archive'],
            'log'     => $s['backup_include_log'],
            'data'    => $s['backup_include_data'],
        ];
        if (!array_filter($include)) {
            $this->info('No content types selected, skipping.');
            return;
        }

        $now = Carbon::now(Setting::businessTz());
        if ($now->format('H:i') !== $s['backup_time']) {
            $this->info("Not scheduled time ({$s['backup_time']}), skipping.");
            return;
        }

        $shouldRun = match ($s['backup_frequency']) {
            'weekly'  => $now->dayOfWeek === $s['backup_day_of_week'],
            'monthly' => $now->day       === $s['backup_day_of_month'],
            default   => true, // daily
        };

        if (!$shouldRun) {
            $this->info('Not the scheduled day, skipping.');
            return;
        }

        $files = BackupController::generateExports($s['backup_formats'], $include);
        $this->info('Backed up ' . count($files) . ' file(s) to storage.');
    }
}
