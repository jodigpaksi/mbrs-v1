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
