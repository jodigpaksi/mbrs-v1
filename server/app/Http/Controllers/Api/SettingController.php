<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Setting;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

class SettingController extends Controller
{
    public function bookingHours(): JsonResponse
    {
        $m = Setting::getMany(['booking_start_time', 'booking_end_time']);
        return response()->json([
            'start' => $m['booking_start_time'] ?? '07:00',
            'end'   => $m['booking_end_time'] ?? '19:00',
        ]);
    }

    public function weekendSettings(): JsonResponse
    {
        $m = Setting::getMany(['weekend_saturday', 'weekend_sunday']);
        return response()->json([
            'saturday' => ($m['weekend_saturday'] ?? null) !== 'false',
            'sunday'   => ($m['weekend_sunday'] ?? null) !== 'false',
        ]);
    }

    public function updateWeekendSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'saturday' => 'required|boolean',
            'sunday'   => 'required|boolean',
        ]);

        Setting::updateOrCreate(['key' => 'weekend_saturday'], ['value' => $data['saturday'] ? 'true' : 'false']);
        Setting::updateOrCreate(['key' => 'weekend_sunday'],   ['value' => $data['sunday']   ? 'true' : 'false']);

        return response()->json(['saturday' => $data['saturday'], 'sunday' => $data['sunday']]);
    }

    private const GENERAL_KEYS = [
        'max_advance_days', 'allow_book_for_others', 'allow_password_change', 'allow_avatar_upload',
        'restrict_after_hours', 'working_hours_end', 'feature_ai_chat', 'rooms_grid_cols',
        'archive_after_days', 'archive_delete_after_days', 'chart_peak_hour_from', 'chart_peak_hour_to',
        'chart_colors', 'anti_ghost_enabled', 'anti_ghost_mode', 'anti_ghost_window_before',
        'anti_ghost_window_after', 'web_confirm_enabled', 'anti_ghost_email_enabled', 'ghost_cancel_email_enabled',
        'reminder_enabled', 'reminder_minutes', 'sensor_api_token', 'backup_enabled', 'backup_frequency',
        'backup_time', 'backup_day_of_week', 'backup_day_of_month', 'backup_formats', 'backup_include_archive',
        'backup_include_log', 'backup_include_data', 'business_timezone', 'app_name', 'app_full_name',
        'app_logo_url', 'login_photo_url', 'login_photo_pos_x', 'login_photo_pos_y', 'login_headline',
        'login_subheadline',
    ];

    public function generalSettings(): JsonResponse
    {
        $m = Setting::getMany(self::GENERAL_KEYS);
        $get = fn(string $key, mixed $default) => $m[$key] ?? $default;

        return response()->json([
            'max_advance_days'      => (int) $get('max_advance_days', '30'),
            'allow_book_for_others'   => $get('allow_book_for_others', 'true') !== 'false',
            'allow_password_change'   => $get('allow_password_change', 'true') !== 'false',
            'allow_avatar_upload'     => $get('allow_avatar_upload', 'true') !== 'false',
            'restrict_after_hours'  => $get('restrict_after_hours', 'false') === 'true',
            'working_hours_end'     => $get('working_hours_end', '17:00'),
            'feature_ai_chat'       => $get('feature_ai_chat', 'true') !== 'false',
            'rooms_grid_cols'            => (int) $get('rooms_grid_cols', '3'),
            'archive_after_days'         => (int) $get('archive_after_days', '30'),
            'archive_delete_after_days'  => (int) $get('archive_delete_after_days', '90'),
            'chart_peak_hour_from'       => (int) $get('chart_peak_hour_from', '0'),
            'chart_peak_hour_to'         => (int) $get('chart_peak_hour_to', '23'),
            'chart_colors'               => $get('chart_colors', '{}'),
            'anti_ghost_enabled'         => $get('anti_ghost_enabled', 'false') === 'true',
            'anti_ghost_mode'            => $get('anti_ghost_mode', 'kiosk'),
            'anti_ghost_window_before'   => (int) $get('anti_ghost_window_before', '5'),
            'anti_ghost_window_after'    => (int) $get('anti_ghost_window_after', '10'),
            'web_confirm_enabled'        => $get('web_confirm_enabled', 'false') === 'true',
            'anti_ghost_email_enabled'   => $get('anti_ghost_email_enabled', 'false') === 'true',
            'ghost_cancel_email_enabled' => $get('ghost_cancel_email_enabled', 'true') !== 'false',
            'reminder_enabled'           => $get('reminder_enabled', 'true') !== 'false',
            'reminder_minutes'           => (int) $get('reminder_minutes', '10'),
            'sensor_api_token'           => $this->getOrCreateSensorToken($m['sensor_api_token'] ?? null),
            'backup_enabled'             => $get('backup_enabled', 'false') === 'true',
            'backup_frequency'           => $get('backup_frequency', 'weekly'),
            'backup_time'                => $get('backup_time', '02:00'),
            'backup_day_of_week'         => (int) $get('backup_day_of_week', '1'),
            'backup_day_of_month'        => (int) $get('backup_day_of_month', '1'),
            'backup_formats'             => $get('backup_formats', 'excel,csv'),
            'backup_include_archive'     => $get('backup_include_archive', 'true') === 'true',
            'backup_include_log'         => $get('backup_include_log', 'true') === 'true',
            'backup_include_data'        => $get('backup_include_data', 'true') === 'true',
            'business_timezone'          => $get('business_timezone', config('app.business_timezone', 'Asia/Jakarta')),
            'app_name'                   => $get('app_name', 'RoomSync Pro'),
            'app_full_name'              => $get('app_full_name', ''),
            'app_logo_url'               => $get('app_logo_url', null),
            'login_photo_url'            => $get('login_photo_url', null),
            'login_photo_pos_x'          => (int) $get('login_photo_pos_x', '50'),
            'login_photo_pos_y'          => (int) $get('login_photo_pos_y', '50'),
            'login_headline'             => $get('login_headline', 'Booking made easy'),
            'login_subheadline'          => $get('login_subheadline', 'Book meeting rooms without the back-and-forth'),
        ]);
    }

    public function branding(): JsonResponse
    {
        $m = Setting::getMany(['app_name', 'app_full_name', 'app_logo_url', 'login_photo_url', 'login_photo_pos_x', 'login_photo_pos_y', 'login_headline', 'login_subheadline']);
        $get = fn(string $key, mixed $default) => $m[$key] ?? $default;
        return response()->json([
            'app_name'           => $get('app_name', 'RoomSync Pro'),
            'app_full_name'      => $get('app_full_name', ''),
            'app_logo_url'       => $get('app_logo_url', null),
            'login_photo_url'    => $get('login_photo_url', null),
            'login_photo_pos_x'  => (int) $get('login_photo_pos_x', '50'),
            'login_photo_pos_y'  => (int) $get('login_photo_pos_y', '50'),
            'login_headline'     => $get('login_headline', 'Booking made easy'),
            'login_subheadline'  => $get('login_subheadline', 'Book meeting rooms without the back-and-forth'),
        ]);
    }

    public function uploadLogo(Request $request): JsonResponse
    {
        $request->validate(['logo' => 'required|image|max:8192']);
        // Remove old logo file if exists
        $old = Setting::where('key', 'app_logo_url')->value('value');
        if ($old) {
            $oldPath = str_replace('/storage/', '', parse_url($old, PHP_URL_PATH) ?? $old);
            Storage::disk('public')->delete($oldPath);
        }
        $path = $request->file('logo')->store('logo', 'public');
        $url = Storage::disk('public')->url($path);
        Setting::updateOrCreate(['key' => 'app_logo_url'], ['value' => $url]);
        \App\Models\ActivityLog::record('settings.updated', 'Updated app logo', null, []);
        return response()->json(['app_logo_url' => $url]);
    }

    public function deleteLogo(): JsonResponse
    {
        $old = Setting::where('key', 'app_logo_url')->value('value');
        if ($old) {
            $oldPath = str_replace('/storage/', '', parse_url($old, PHP_URL_PATH) ?? $old);
            Storage::disk('public')->delete($oldPath);
        }
        Setting::where('key', 'app_logo_url')->delete();
        \App\Models\ActivityLog::record('settings.updated', 'Removed app logo', null, []);
        return response()->json(['app_logo_url' => null]);
    }

    public function uploadLoginPhoto(Request $request): JsonResponse
    {
        $request->validate(['photo' => 'required|image|max:8192']);
        $old = Setting::where('key', 'login_photo_url')->value('value');
        if ($old) {
            $oldPath = str_replace('/storage/', '', parse_url($old, PHP_URL_PATH) ?? $old);
            Storage::disk('public')->delete($oldPath);
        }
        $path = $request->file('photo')->store('login-photo', 'public');
        $url = Storage::disk('public')->url($path);
        Setting::updateOrCreate(['key' => 'login_photo_url'], ['value' => $url]);
        \App\Models\ActivityLog::record('settings.updated', 'Updated login page photo', null, []);
        return response()->json(['login_photo_url' => $url]);
    }

    public function deleteLoginPhoto(): JsonResponse
    {
        $old = Setting::where('key', 'login_photo_url')->value('value');
        if ($old) {
            $oldPath = str_replace('/storage/', '', parse_url($old, PHP_URL_PATH) ?? $old);
            Storage::disk('public')->delete($oldPath);
        }
        Setting::where('key', 'login_photo_url')->delete();
        \App\Models\ActivityLog::record('settings.updated', 'Removed login page photo', null, []);
        return response()->json(['login_photo_url' => null]);
    }

    public function m365Settings(): JsonResponse
    {
        $m = Setting::getMany(['m365_tenant_id', 'm365_client_id', 'm365_sender_email', 'm365_client_secret', 'm365_calendar_sync_enabled']);
        $get = fn(string $key) => $m[$key] ?? null;
        $tenantId = $get('m365_tenant_id');
        $clientId = $get('m365_client_id');
        $senderEmail = $get('m365_sender_email');
        $hasSecret = (bool) $get('m365_client_secret');

        return response()->json([
            'tenant_id' => $tenantId ?? '',
            'client_id' => $clientId ?? '',
            'sender_email' => $senderEmail ?? '',
            'has_secret' => $hasSecret,
            'configured' => (bool) ($tenantId && $clientId && $hasSecret),
            'mail_ready' => (bool) ($tenantId && $clientId && $hasSecret && $senderEmail),
            'calendar_sync_enabled' => $get('m365_calendar_sync_enabled') === 'true',
            'calendar_sync_ready' => (bool) ($tenantId && $clientId && $hasSecret),
        ]);
    }

    public function updateM365Settings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'tenant_id'     => 'sometimes|nullable|string|max:100',
            'client_id'     => 'sometimes|nullable|string|max:100',
            'client_secret' => 'sometimes|nullable|string|max:500',
            'sender_email'  => 'sometimes|nullable|string|max:150',
            'calendar_sync_enabled' => 'sometimes|boolean',
        ]);

        if (array_key_exists('tenant_id', $data)) {
            Setting::updateOrCreate(['key' => 'm365_tenant_id'], ['value' => $data['tenant_id'] ?? '']);
        }
        if (array_key_exists('client_id', $data)) {
            Setting::updateOrCreate(['key' => 'm365_client_id'], ['value' => $data['client_id'] ?? '']);
        }
        if (array_key_exists('sender_email', $data)) {
            Setting::updateOrCreate(['key' => 'm365_sender_email'], ['value' => $data['sender_email'] ?? '']);
        }
        if (array_key_exists('calendar_sync_enabled', $data)) {
            Setting::updateOrCreate(['key' => 'm365_calendar_sync_enabled'], ['value' => $data['calendar_sync_enabled'] ? 'true' : 'false']);
        }
        // Only touch the secret if the client actually sent a new value (empty/omitted keeps the existing one).
        if (!empty($data['client_secret'])) {
            Setting::updateOrCreate(['key' => 'm365_client_secret'], ['value' => Crypt::encryptString($data['client_secret'])]);
        }

        \App\Models\ActivityLog::record('settings.updated', 'Updated Microsoft 365 integration settings', null, []);

        return $this->m365Settings();
    }

    public function testM365Connection(): JsonResponse
    {
        $m = Setting::getMany(['m365_tenant_id', 'm365_client_id', 'm365_client_secret']);
        $tenantId = $m['m365_tenant_id'] ?? null;
        $clientId = $m['m365_client_id'] ?? null;
        $encryptedSecret = $m['m365_client_secret'] ?? null;

        if (!$tenantId || !$clientId || !$encryptedSecret) {
            return response()->json(['success' => false, 'message' => 'Tenant ID, Client ID, and Client Secret must all be set first.'], 422);
        }

        try {
            $clientSecret = Crypt::decryptString($encryptedSecret);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Stored client secret could not be decrypted. Please re-enter it.'], 422);
        }

        try {
            $res = Http::asForm()->post("https://login.microsoftonline.com/{$tenantId}/oauth2/v2.0/token", [
                'client_id'     => $clientId,
                'client_secret' => $clientSecret,
                'scope'         => 'https://graph.microsoft.com/.default',
                'grant_type'    => 'client_credentials',
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Could not reach Microsoft login endpoint: ' . $e->getMessage()], 502);
        }

        if ($res->successful() && $res->json('access_token')) {
            return response()->json(['success' => true, 'message' => 'Connected — Azure AD app credentials are valid and a Graph API token was issued.']);
        }

        $err = $res->json('error_description') ?? $res->json('error') ?? 'Unknown error from Microsoft.';
        return response()->json(['success' => false, 'message' => $err], 200);
    }

    public function sendM365TestEmail(Request $request): JsonResponse
    {
        $m = Setting::getMany(['m365_tenant_id', 'm365_client_id', 'm365_sender_email', 'm365_client_secret']);
        $get = fn(string $key) => $m[$key] ?? null;
        $tenantId = $get('m365_tenant_id');
        $clientId = $get('m365_client_id');
        $senderEmail = $get('m365_sender_email');
        $encryptedSecret = $get('m365_client_secret');

        if (!$tenantId || !$clientId || !$senderEmail || !$encryptedSecret) {
            return response()->json(['success' => false, 'message' => 'Tenant ID, Client ID, Client Secret, and Sender Mailbox must all be set first.'], 422);
        }

        try {
            $clientSecret = Crypt::decryptString($encryptedSecret);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Stored client secret could not be decrypted. Please re-enter it.'], 422);
        }

        $to = $request->user()->email;

        try {
            \Illuminate\Support\Facades\Mail::mailer('graph')->html(
                '<p>This is a test email sent via Microsoft Graph from MRBS Admin Settings. If you received this, the Microsoft 365 mail integration is working.</p>',
                function ($message) use ($to, $senderEmail) {
                    $message->to($to)->from($senderEmail)->subject('MRBS — Microsoft 365 test email');
                }
            );
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 200);
        }

        return response()->json(['success' => true, 'message' => "Test email sent to {$to}. Check your inbox (and spam folder)."]);
    }

    public function mailerSettings(): JsonResponse
    {
        $m = Setting::getMany([
            'm365_tenant_id', 'm365_client_id', 'm365_client_secret', 'm365_sender_email',
            'resend_from_address', 'resend_api_key', 'resend_from_name',
            'brevo_from_address', 'brevo_api_key', 'brevo_from_name',
            'active_mailer',
        ]);
        $get = fn(string $key) => $m[$key] ?? null;

        $m365TenantId = $get('m365_tenant_id');
        $m365ClientId = $get('m365_client_id');
        $m365HasSecret = (bool) $get('m365_client_secret');
        $m365SenderEmail = $get('m365_sender_email');

        $resendFromAddress = $get('resend_from_address');
        $resendHasKey = (bool) $get('resend_api_key');

        $brevoFromAddress = $get('brevo_from_address');
        $brevoHasKey = (bool) $get('brevo_api_key');

        return response()->json([
            'active_mailer' => $get('active_mailer') ?? 'default',
            'm365' => [
                'ready' => (bool) ($m365TenantId && $m365ClientId && $m365HasSecret && $m365SenderEmail),
            ],
            'resend' => [
                'from_address' => $resendFromAddress ?? '',
                'from_name'    => $get('resend_from_name') ?? '',
                'has_key'      => $resendHasKey,
                'ready'        => (bool) ($resendHasKey && $resendFromAddress),
            ],
            'brevo' => [
                'from_address' => $brevoFromAddress ?? '',
                'from_name'    => $get('brevo_from_name') ?? '',
                'has_key'      => $brevoHasKey,
                'ready'        => (bool) ($brevoHasKey && $brevoFromAddress),
            ],
        ]);
    }

    public function updateMailerSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'active_mailer'      => 'sometimes|in:default,m365,resend,brevo',
            'resend_api_key'     => 'sometimes|nullable|string|max:500',
            'resend_from_address' => 'sometimes|nullable|email|max:150',
            'resend_from_name'    => 'sometimes|nullable|string|max:150',
            'brevo_api_key'      => 'sometimes|nullable|string|max:500',
            'brevo_from_address' => 'sometimes|nullable|email|max:150',
            'brevo_from_name'    => 'sometimes|nullable|string|max:150',
        ]);

        if (array_key_exists('active_mailer', $data)) {
            Setting::updateOrCreate(['key' => 'active_mailer'], ['value' => $data['active_mailer']]);
        }
        if (array_key_exists('resend_from_address', $data)) {
            Setting::updateOrCreate(['key' => 'resend_from_address'], ['value' => $data['resend_from_address'] ?? '']);
        }
        if (array_key_exists('resend_from_name', $data)) {
            Setting::updateOrCreate(['key' => 'resend_from_name'], ['value' => $data['resend_from_name'] ?? '']);
        }
        if (!empty($data['resend_api_key'])) {
            Setting::updateOrCreate(['key' => 'resend_api_key'], ['value' => Crypt::encryptString($data['resend_api_key'])]);
        }
        if (array_key_exists('brevo_from_address', $data)) {
            Setting::updateOrCreate(['key' => 'brevo_from_address'], ['value' => $data['brevo_from_address'] ?? '']);
        }
        if (array_key_exists('brevo_from_name', $data)) {
            Setting::updateOrCreate(['key' => 'brevo_from_name'], ['value' => $data['brevo_from_name'] ?? '']);
        }
        if (!empty($data['brevo_api_key'])) {
            Setting::updateOrCreate(['key' => 'brevo_api_key'], ['value' => Crypt::encryptString($data['brevo_api_key'])]);
        }

        \App\Models\ActivityLog::record('settings.updated', 'Updated Mailer settings', null, []);

        return $this->mailerSettings();
    }

    public function sendMailerTestEmail(Request $request): JsonResponse
    {
        $m = Setting::getMany(['active_mailer', 'm365_sender_email', 'resend_from_address', 'brevo_from_address']);
        $get = fn(string $key) => $m[$key] ?? null;
        $activeMailer = $get('active_mailer') ?? 'default';
        $to = $request->user()->email;

        if ($activeMailer === 'default') {
            return response()->json(['success' => false, 'message' => 'No mailer is currently active. Select Microsoft 365, Resend, or Brevo first.'], 422);
        }

        $mailerMap = ['m365' => 'graph', 'resend' => 'resend', 'brevo' => 'brevo'];
        $mailerName = $mailerMap[$activeMailer] ?? null;
        if (!$mailerName) {
            return response()->json(['success' => false, 'message' => 'Unknown active mailer.'], 422);
        }

        $fromAddress = match ($activeMailer) {
            'm365'   => $get('m365_sender_email'),
            'resend' => $get('resend_from_address'),
            'brevo'  => $get('brevo_from_address'),
            default  => null,
        };
        if (!$fromAddress) {
            return response()->json(['success' => false, 'message' => 'The active mailer is missing a From Address — set it first.'], 422);
        }

        try {
            \Illuminate\Support\Facades\Mail::mailer($mailerName)->html(
                "<p>This is a test email sent via {$activeMailer} from RoomSync Pro Admin Settings. If you received this, the mailer is working.</p>",
                function ($message) use ($to, $fromAddress) {
                    $message->to($to)->from($fromAddress)->subject('RoomSync Pro — Mailer test email');
                }
            );
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 200);
        }

        return response()->json(['success' => true, 'message' => "Test email sent to {$to}. Check your inbox (and spam folder)."]);
    }

    public function updateGeneralSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'max_advance_days'      => 'sometimes|integer|min:1|max:365',
            'allow_book_for_others'   => 'sometimes|boolean',
            'allow_password_change'   => 'sometimes|boolean',
            'allow_avatar_upload'     => 'sometimes|boolean',
            'restrict_after_hours'  => 'sometimes|boolean',
            'working_hours_end'     => 'sometimes|date_format:H:i',
            'feature_ai_chat'       => 'sometimes|boolean',
            'rooms_grid_cols'           => 'sometimes|integer|min:2|max:5',
            'archive_after_days'        => 'sometimes|integer|min:1|max:365',
            'archive_delete_after_days' => 'sometimes|integer|min:1|max:730',
            'chart_peak_hour_from'      => 'sometimes|integer|min:0|max:23',
            'chart_peak_hour_to'        => 'sometimes|integer|min:0|max:23',
            'chart_colors'              => 'sometimes|nullable|string',
            'anti_ghost_enabled'          => 'sometimes|boolean',
            'anti_ghost_mode'            => ['sometimes', 'nullable', 'string', function ($attr, $val, $fail) {
                $valid = ['kiosk', 'sensor'];
                foreach (array_filter(explode(',', $val ?? '')) as $m) {
                    if (!in_array(trim($m), $valid)) $fail("Invalid mode: $m");
                }
            }],
            'anti_ghost_window_before'   => 'sometimes|integer|min:0|max:20',
            'anti_ghost_window_after'    => 'sometimes|integer|min:0|max:20',
            'web_confirm_enabled'        => 'sometimes|boolean',
            'anti_ghost_email_enabled'   => 'sometimes|boolean',
            'ghost_cancel_email_enabled' => 'sometimes|boolean',
            'reminder_enabled'           => 'sometimes|boolean',
            'reminder_minutes'           => 'sometimes|integer|min:1|max:120',
            'sensor_api_token'           => 'sometimes|string|max:64',
            'backup_enabled'             => 'sometimes|boolean',
            'backup_frequency'           => 'sometimes|in:daily,weekly,monthly',
            'backup_time'                => 'sometimes|date_format:H:i',
            'backup_day_of_week'         => 'sometimes|integer|min:0|max:6',
            'backup_day_of_month'        => 'sometimes|integer|min:1|max:31',
            'backup_formats'             => 'sometimes|nullable|string',
            'backup_include_archive'     => 'sometimes|boolean',
            'backup_include_log'         => 'sometimes|boolean',
            'backup_include_data'        => 'sometimes|boolean',
            'business_timezone'          => 'sometimes|string|timezone',
            'app_name'                   => 'sometimes|nullable|string|max:100',
            'app_full_name'              => 'sometimes|nullable|string|max:150',
            'login_photo_pos_x'          => 'sometimes|integer|min:0|max:100',
            'login_photo_pos_y'          => 'sometimes|integer|min:0|max:100',
            'login_headline'             => 'sometimes|nullable|string|max:120',
            'login_subheadline'          => 'sometimes|nullable|string|max:200',
        ]);

        $changes = [];
        foreach ($data as $key => $value) {
            $stored = is_bool($value) ? ($value ? 'true' : 'false') : (string) $value;
            $old = Setting::where('key', $key)->value('value');
            if ($old !== $stored) {
                $changes[$key] = ['old' => $old, 'new' => $stored];
            }
            Setting::updateOrCreate(['key' => $key], ['value' => $stored]);
        }

        if ($changes) {
            \App\Models\ActivityLog::record(
                'settings.updated',
                'Updated settings: ' . implode(', ', array_keys($changes)),
                null,
                ['changes' => $changes],
            );
        }

        return $this->generalSettings();
    }

    private function getOrCreateSensorToken(?string $prefetched = null): string
    {
        $token = $prefetched ?? Setting::where('key', 'sensor_api_token')->value('value');
        if (!$token) {
            $token = \Illuminate\Support\Str::random(32);
            Setting::updateOrCreate(['key' => 'sensor_api_token'], ['value' => $token]);
        }
        return $token;
    }

    private function resolveContacts(string $settingKey, ?int $buildingId): \Illuminate\Support\Collection
    {
        $raw = Setting::where('key', $settingKey)->value('value') ?? '[]';
        $ids = json_decode($raw, true) ?? [];

        if (!empty($ids)) {
            $pool = User::with('department', 'adminBuildings')->whereIn('id', $ids);
            if ($buildingId) {
                // Include contacts assigned to this building OR with no building assignments (global)
                $filtered = (clone $pool)->where(function ($q) use ($buildingId) {
                    $q->whereHas('adminBuildings', fn ($q2) => $q2->where('building_id', $buildingId))
                      ->orWhereDoesntHave('adminBuildings');
                })->get();
                if ($filtered->isNotEmpty()) return $filtered;
            }
            return $pool->get();
        }

        $pool = User::with('department', 'adminBuildings')->where('role', 'receptionist')->where('on_duty', true);
        if ($buildingId) {
            $filtered = (clone $pool)->where(function ($q) use ($buildingId) {
                $q->whereHas('adminBuildings', fn ($q2) => $q2->where('building_id', $buildingId))
                  ->orWhereDoesntHave('adminBuildings');
            })->get();
            if ($filtered->isNotEmpty()) return $filtered;
        }
        return $pool->get();
    }

    private function mapContacts(\Illuminate\Support\Collection $users): JsonResponse
    {
        return response()->json($users->map(fn ($u) => [
            'id'         => $u->id,
            'name'       => $u->name,
            'email'      => $u->email,
            'ext'        => $u->ext,
            'role'       => $u->role,
            'avatar'     => $u->avatar,
            'on_duty'    => (bool) $u->on_duty,
            'department' => $u->department?->name ?? null,
            'buildings'  => $u->adminBuildings->map(fn ($b) => [
                'id'   => $b->id,
                'name' => $b->name,
                'code' => $b->code,
            ])->values(),
        ])->values());
    }

    public function afterHoursContacts(Request $request): JsonResponse
    {
        $raw = $request->query('building_id');
        $buildingId = (is_string($raw) && ctype_digit($raw)) ? (int) $raw : null;
        return $this->mapContacts($this->resolveContacts('after_hours_contacts', $buildingId));
    }

    public function specialRoomContacts(Request $request): JsonResponse
    {
        $raw = $request->query('building_id');
        $buildingId = (is_string($raw) && ctype_digit($raw)) ? (int) $raw : null;
        return $this->mapContacts($this->resolveContacts('special_room_contacts', $buildingId));
    }

    public function updateSpecialRoomContacts(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_ids'   => 'required|array',
            'user_ids.*' => 'integer|exists:users,id',
        ]);

        Setting::updateOrCreate(
            ['key' => 'special_room_contacts'],
            ['value' => json_encode($data['user_ids'])]
        );

        return $this->mapContacts($this->resolveContacts('special_room_contacts', null));
    }

    public function updateAfterHoursContacts(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_ids'   => 'required|array',
            'user_ids.*' => 'integer|exists:users,id',
        ]);

        Setting::updateOrCreate(
            ['key' => 'after_hours_contacts'],
            ['value' => json_encode($data['user_ids'])]
        );

        return $this->mapContacts($this->resolveContacts('after_hours_contacts', null));
    }

    public function updateBookingHours(Request $request): JsonResponse
    {
        $data = $request->validate([
            'start' => 'required|date_format:H:i',
            'end'   => 'required|date_format:H:i|after:start',
        ]);

        $newStart = $data['start'];
        $newEnd   = $data['end'];

        $trimmed   = 0;
        $cancelled = 0;

        $futurePending = Booking::where('status', '!=', 'cancelled')
            ->where('end_at', '>', now())
            ->get();

        foreach ($futurePending as $booking) {
            $bStart = Carbon::parse($booking->start_at);
            $bEnd   = Carbon::parse($booking->end_at);
            $date   = $bStart->toDateString();

            $startTime = $bStart->format('H:i');
            $endTime   = $bEnd->format('H:i');

            if ($startTime >= $newEnd || $endTime <= $newStart) {
                $booking->update(['status' => 'cancelled', 'cancelled_at' => now()]);
                $cancelled++;
            } elseif ($endTime > $newEnd || $startTime < $newStart) {
                $newStartAt = $startTime < $newStart
                    ? Carbon::parse("{$date} {$newStart}:00")
                    : $bStart;
                $newEndAt = $endTime > $newEnd
                    ? Carbon::parse("{$date} {$newEnd}:00")
                    : $bEnd;
                $booking->update(['start_at' => $newStartAt, 'end_at' => $newEndAt]);
                $trimmed++;
            }
        }

        Setting::updateOrCreate(['key' => 'booking_start_time'], ['value' => $newStart]);
        Setting::updateOrCreate(['key' => 'booking_end_time'],   ['value' => $newEnd]);

        return response()->json([
            'start'          => $newStart,
            'end'            => $newEnd,
            'trimmed_count'  => $trimmed,
            'cancelled_count' => $cancelled,
        ]);
    }
}
