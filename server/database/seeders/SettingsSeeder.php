<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingsSeeder extends Seeder
{
    /**
     * Every Setting key the app reads (see SettingController::GENERAL_KEYS plus the
     * Mailer/M365 group) paired with its fallback default. Kept in sync manually —
     * when adding a new admin-configurable Setting, add its default here too so a
     * fresh install and `php artisan db:seed` produce a fully-configured app instead
     * of relying on inline `?? default` fallbacks scattered across controllers.
     */
    private const DEFAULTS = [
        // Booking rules
        'max_advance_days'                => '30',
        'allow_book_for_others'           => 'true',
        'allow_password_change'           => 'true',
        'allow_avatar_upload'             => 'true',
        'restrict_after_hours'            => 'false',
        'working_hours_end'               => '17:00',
        'feature_ai_chat'                 => 'true',
        'rooms_grid_cols'                 => '3',
        'booking_title_max_length'        => '45',
        'booking_description_max_length'  => '65',
        'booking_start_time'              => '07:00',
        'booking_end_time'                => '19:00',
        'weekend_saturday'                => 'true',
        'weekend_sunday'                  => 'true',

        // Archive
        'archive_after_days'              => '30',
        'archive_delete_after_days'       => '90',

        // Analytics chart
        'chart_peak_hour_from'            => '0',
        'chart_peak_hour_to'              => '23',
        'chart_colors'                    => '{}',

        // Anti-ghost
        'anti_ghost_enabled'              => 'false',
        'anti_ghost_mode'                 => 'kiosk',
        'anti_ghost_window_before'        => '5',
        'anti_ghost_window_after'         => '10',
        'web_confirm_enabled'             => 'false',
        'anti_ghost_email_enabled'        => 'false',
        'ghost_cancel_email_enabled'      => 'true',

        // Reminders
        'reminder_enabled'                => 'true',
        'reminder_minutes'                => '10',

        // Auto Backup (unified batch)
        'backup_enabled'                  => 'false',
        'backup_frequency'                => 'weekly',
        'backup_time'                     => '02:00',
        'backup_day_of_week'              => '1',
        'backup_day_of_month'             => '1',
        'backup_formats'                  => 'excel,csv',
        'backup_include_archive'          => 'true',
        'backup_include_log'              => 'true',
        'backup_include_data'             => 'true',

        // Branding / Login page
        'business_timezone'               => 'Asia/Jakarta',
        'app_name'                        => 'RoomSync Pro',
        'app_full_name'                   => '',
        'login_photo_pos_x'               => '50',
        'login_photo_pos_y'               => '50',
        'login_headline'                  => 'Booking made easy',
        'login_subheadline'               => 'Book meeting rooms without the back-and-forth',
        'login_footer_text'               => '',

        // Mailer group (secrets/from-address left unset on purpose — admin must configure)
        'active_mailer'                   => 'default',
    ];

    public function run(): void
    {
        $now = now();
        $existing = Setting::pluck('key')->all();

        $rows = collect(self::DEFAULTS)
            ->filter(fn ($value, $key) => !in_array($key, $existing, true))
            ->map(fn ($value, $key) => ['key' => $key, 'value' => $value, 'created_at' => $now, 'updated_at' => $now])
            ->values()
            ->all();

        if ($rows) {
            Setting::insert($rows);
        }
    }
}
