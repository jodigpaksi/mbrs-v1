<?php

namespace App\Console\Commands;

use App\Http\Controllers\Api\ActivityLogController;
use App\Models\ActivityLog;
use App\Models\Setting;
use Illuminate\Console\Command;

class ExportActivityLog extends Command
{
    protected $signature   = 'logs:export-activity';
    protected $description = 'Auto-export activity log to .txt file based on settings';

    public function handle(): void
    {
        $enabled = Setting::where('key', 'log_auto_export_enabled')->value('value');
        if (!$enabled || $enabled === '0') {
            $this->info('Activity log auto-export is disabled.');
            return;
        }

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
