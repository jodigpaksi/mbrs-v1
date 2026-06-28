<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Setting;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    public function bookingHours(): JsonResponse
    {
        return response()->json([
            'start' => Setting::where('key', 'booking_start_time')->value('value') ?? '07:00',
            'end'   => Setting::where('key', 'booking_end_time')->value('value')   ?? '19:00',
        ]);
    }

    public function weekendSettings(): JsonResponse
    {
        return response()->json([
            'saturday' => Setting::where('key', 'weekend_saturday')->value('value') !== 'false',
            'sunday'   => Setting::where('key', 'weekend_sunday')->value('value')   !== 'false',
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

    public function generalSettings(): JsonResponse
    {
        $get = fn(string $key, mixed $default) => Setting::where('key', $key)->value('value') ?? $default;

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
            'export_enabled'             => $get('export_enabled', 'false') === 'true',
            'export_frequency'           => $get('export_frequency', 'daily'),
            'export_time'                => $get('export_time', '06:00'),
            'export_day_of_week'         => (int) $get('export_day_of_week', '1'),
            'export_day_of_month'        => (int) $get('export_day_of_month', '1'),
            'export_formats'             => $get('export_formats', 'excel,csv'),
            'chart_peak_hour_from'       => (int) $get('chart_peak_hour_from', '0'),
            'chart_peak_hour_to'         => (int) $get('chart_peak_hour_to', '23'),
            'chart_colors'               => $get('chart_colors', '{}'),
            'anti_ghost_enabled'         => $get('anti_ghost_enabled', 'false') === 'true',
            'anti_ghost_mode'            => $get('anti_ghost_mode', 'kiosk'),
            'anti_ghost_window_before'   => (int) $get('anti_ghost_window_before', '5'),
            'anti_ghost_window_after'    => (int) $get('anti_ghost_window_after', '10'),
            'web_confirm_enabled'        => $get('web_confirm_enabled', 'false') === 'true',
            'sensor_api_token'           => $this->getOrCreateSensorToken(),
        ]);
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
            'export_enabled'            => 'sometimes|boolean',
            'export_frequency'          => 'sometimes|in:daily,weekly,monthly',
            'export_time'               => 'sometimes|date_format:H:i',
            'export_day_of_week'        => 'sometimes|integer|min:0|max:6',
            'export_day_of_month'       => 'sometimes|integer|min:1|max:31',
            'export_formats'            => 'sometimes|string',
            'chart_peak_hour_from'      => 'sometimes|integer|min:0|max:23',
            'chart_peak_hour_to'        => 'sometimes|integer|min:0|max:23',
            'chart_colors'              => 'sometimes|string',
            'anti_ghost_enabled'          => 'sometimes|boolean',
            'anti_ghost_mode'            => ['sometimes', 'string', function ($attr, $val, $fail) {
                $valid = ['kiosk', 'sensor'];
                foreach (array_filter(explode(',', $val)) as $m) {
                    if (!in_array(trim($m), $valid)) $fail("Invalid mode: $m");
                }
            }],
            'anti_ghost_window_before'   => 'sometimes|integer|min:0|max:20',
            'anti_ghost_window_after'    => 'sometimes|integer|min:0|max:20',
            'web_confirm_enabled'        => 'sometimes|boolean',
            'sensor_api_token'           => 'sometimes|string|max:64',
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

    private function getOrCreateSensorToken(): string
    {
        $token = Setting::where('key', 'sensor_api_token')->value('value');
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
