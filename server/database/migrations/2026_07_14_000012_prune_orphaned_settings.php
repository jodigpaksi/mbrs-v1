<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Removes Setting rows left behind by features that were replaced/removed:
 * the old per-schedule "Export Schedule" / "Activity Log Export" toggles
 * (backup_export_*, export_*, log_auto_export_*) were superseded by the
 * unified Auto Backup batch (backup_enabled/backup_include_*), and
 * m365_mail_enabled was folded into the single active_mailer picker.
 * None of these keys are read anywhere in the current codebase (verified
 * via a full grep of server/app and client/src before writing this).
 */
return new class extends Migration {
    private const ORPHANED_KEYS = [
        'backup_export_enabled', 'backup_export_frequency', 'backup_export_time',
        'backup_export_day_of_week', 'backup_export_day_of_month', 'backup_export_formats',
        'export_enabled', 'export_frequency', 'export_time', 'export_day_of_week', 'export_formats',
        'log_auto_export_enabled', 'log_auto_export_interval', 'log_auto_export_time',
        'm365_mail_enabled',
    ];

    public function up(): void
    {
        DB::table('settings')->whereIn('key', self::ORPHANED_KEYS)->delete();
    }

    public function down(): void
    {
        // Deliberately no-op — these were dead values with no code path reading them,
        // nothing meaningful to restore.
    }
};
