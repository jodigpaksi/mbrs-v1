<?php

namespace App\Http\Controllers\Api;

use App\Events\BookingChanged;
use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Room;
use App\Models\Setting;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SensorController extends Controller
{
    private const BUSINESS_TZ = 'Asia/Jakarta';

    public function ping(Request $request): JsonResponse
    {
        // Authenticate via header token
        $token = Setting::where('key', 'sensor_api_token')->value('value');
        if (!$token || $request->header('X-Sensor-Token') !== $token) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        // Check anti-ghost sensor mode is active
        if (Setting::where('key', 'anti_ghost_enabled')->value('value') !== 'true') {
            return response()->json(['message' => 'Anti-ghost not enabled'], 403);
        }
        $mode = Setting::where('key', 'anti_ghost_mode')->value('value') ?? '';
        if (!in_array('sensor', explode(',', $mode))) {
            return response()->json(['message' => 'Sensor mode not enabled'], 403);
        }

        // Find room by sensor_code
        $sensorCode = $request->input('sensor_code');
        if (!$sensorCode) {
            return response()->json(['message' => 'sensor_code required'], 422);
        }
        $room = Room::where('sensor_code', $sensorCode)->first();
        if (!$room) {
            return response()->json(['message' => 'Unknown sensor_code'], 404);
        }

        // Find active booking in the confirmation window
        $windowBefore = (int) (Setting::where('key', 'anti_ghost_window_before')->value('value') ?? 5);
        $windowAfter  = (int) (Setting::where('key', 'anti_ghost_window_after')->value('value')  ?? 10);

        $now      = Carbon::parse(Carbon::now(self::BUSINESS_TZ)->format('Y-m-d H:i:s'));
        $winOpen  = $now->copy()->subMinutes($windowAfter);   // earliest start we care about
        $winClose = $now->copy()->addMinutes($windowBefore);  // latest start we care about

        $booking = Booking::where('room_id', $room->id)
            ->whereIn('status', ['confirmed', 'tentative'])
            ->whereNull('presence_confirmed_at')
            ->whereNull('archived_at')
            ->where('start_at', '>=', $winOpen)
            ->where('start_at', '<=', $winClose)
            ->orderBy('start_at')
            ->first();

        if (!$booking) {
            return response()->json(['confirmed' => false]);
        }

        $booking->update(['presence_confirmed_at' => $now]);
        event(new BookingChanged('sensor_confirmed', $booking->user_id, $now->toDateString()));

        return response()->json(['confirmed' => true, 'booking_id' => $booking->id]);
    }
}
