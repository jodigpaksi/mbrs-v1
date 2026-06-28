<?php

namespace App\Console\Commands;

use App\Http\Controllers\Api\ActivityLogController;
use App\Models\ActivityLog;
use App\Models\Setting;
use Carbon\Carbon;
use Illuminate\Console\Command;

class ExportActivityLog extends Command
{
    protected $signature   = 'logs:export-activity {--force : Skip time/day check and export immediately}';
    protected $description = 'Auto-export activity log to .txt file based on settings';

    public function handle(): void
    {
        $enabled = Setting::where('key', 'log_auto_export_enabled')->value('value');
        if ($enabled !== 'true') return;

        $frequency = Setting::where('key', 'log_auto_export_interval')->value('value') ?? 'daily';
        $time      = Setting::where('key', 'log_auto_export_time')->value('value')     ?? '00:00';

        // Check if now matches the configured schedule (use local business TZ, same as rest of app)
        $now = Carbon::now(\App\Models\Setting::businessTz());
        [$hh, $mm] = explode(':', $time);
        $scheduledHour   = (int) $hh;
        $scheduledMinute = (int) $mm;

        $timeMatch = $now->hour === $scheduledHour && $now->minute === $scheduledMinute;
        $dayMatch  = match ($frequency) {
            'weekly'  => $now->dayOfWeek === 1, // Monday
            'monthly' => $now->day === 1,
            default   => true,                  // daily — any day is fine if time matches
        };

        if (!$this->option('force') && (!$timeMatch || !$dayMatch)) return;

        $logs = ActivityLog::with('user:id,name,role')->latest('created_at')->get();

        $dir = storage_path('logs/activity-exports');
        if (!is_dir($dir)) mkdir($dir, 0755, true);

        $filename = $dir . '/activity-log-' . now()->format('Ymd-His') . '.txt';
        file_put_contents($filename, ActivityLogController::generateTxtContent($logs, 'All'));

        // Keep only last 30 files to avoid disk bloat
        $files = glob($dir . '/activity-log-*.txt');
        if ($files && count($files) > 30) {
            sort($files);
            foreach (array_slice($files, 0, count($files) - 30) as $old) {
                unlink($old);
            }
        }

        $this->info("Exported {$logs->count()} entries to {$filename}");
    }
}
