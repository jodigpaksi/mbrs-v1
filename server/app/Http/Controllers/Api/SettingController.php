<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Setting;
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
            'allow_book_for_others' => $get('allow_book_for_others', 'true') !== 'false',
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
        ]);
    }

    public function updateGeneralSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'max_advance_days'      => 'sometimes|integer|min:1|max:365',
            'allow_book_for_others' => 'sometimes|boolean',
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
        ]);

        foreach ($data as $key => $value) {
            $stored = is_bool($value) ? ($value ? 'true' : 'false') : (string) $value;
            Setting::updateOrCreate(['key' => $key], ['value' => $stored]);
        }

        return $this->generalSettings();
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
