<?php

namespace App\Http\Controllers\Api;

use App\Events\BookingChanged;
use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Room;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SensorController extends Controller
{
    public function ping(Request $request): JsonResponse
    {
        $settings = Setting::getMany([
            'sensor_api_token', 'anti_ghost_enabled', 'anti_ghost_mode',
            'anti_ghost_window_before', 'anti_ghost_window_after',
        ]);

        // Authenticate via header token
        $token = $settings['sensor_api_token'] ?? null;
        if (!$token || $request->header('X-Sensor-Token') !== $token) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        // Check anti-ghost sensor mode is active
        if (($settings['anti_ghost_enabled'] ?? null) !== 'true') {
            return response()->json(['message' => 'Anti-ghost not enabled'], 403);
        }
        $mode = $settings['anti_ghost_mode'] ?? '';
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
        $windowBefore = (int) ($settings['anti_ghost_window_before'] ?? 5);
        $windowAfter  = (int) ($settings['anti_ghost_window_after']  ?? 10);

        $now      = Setting::localNow();
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
