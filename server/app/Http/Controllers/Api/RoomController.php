<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Room;
use App\Models\RoomView;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RoomController extends Controller
{
    public function index(): JsonResponse
    {
        $rooms = Room::where('is_active', true)->get();
        return response()->json($rooms);
    }

    public function show(Room $room): JsonResponse
    {
        return response()->json($room);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string',
            'type' => 'required|in:Ballroom,Executive,Focus',
            'capacity' => 'required|integer|min:1',
            'floor' => 'required|string',
            'facilities' => 'nullable|array',
            'photos' => 'nullable|array',
            'notes' => 'nullable|string',
        ]);

        $room = Room::create($data);
        return response()->json($room, 201);
    }

    public function update(Request $request, Room $room): JsonResponse
    {
        $data = $request->validate([
            'name' => 'sometimes|string',
            'type' => 'sometimes|in:Ballroom,Executive,Focus',
            'capacity' => 'sometimes|integer|min:1',
            'floor' => 'sometimes|string',
            'facilities' => 'nullable|array',
            'photos' => 'nullable|array',
            'notes' => 'nullable|string',
            'is_active' => 'sometimes|boolean',
        ]);

        $room->update($data);
        return response()->json($room);
    }

    public function destroy(Room $room): JsonResponse
    {
        $room->update(['is_active' => false]);
        return response()->json(['message' => 'Room deactivated']);
    }

    public function stats(Room $room): JsonResponse
    {
        $now = now();
        $monthStart = $now->copy()->startOfMonth();
        $monthEnd   = $now->copy()->endOfMonth();
        $thirtyAgo  = $now->copy()->subDays(30);

        $monthlyBookings = Booking::where('room_id', $room->id)
            ->where('status', '!=', 'cancelled')
            ->whereBetween('start_at', [$monthStart, $monthEnd])
            ->get();

        $usedMinutes = $monthlyBookings->sum(fn ($b) =>
            (strtotime($b->end_at) - strtotime($b->start_at)) / 60
        );
        $totalWorkingMinutes = 22 * 12 * 60;
        $utilization = $totalWorkingMinutes > 0
            ? min(100, (int) round(($usedMinutes / $totalWorkingMinutes) * 100))
            : 0;

        $historical = Booking::where('room_id', $room->id)
            ->where('status', '!=', 'cancelled')
            ->where('start_at', '>=', $thirtyAgo)
            ->get();

        $hourCounts = array_fill(0, 12, 0);
        foreach ($historical as $b) {
            $startH = (int) date('H', strtotime($b->start_at));
            $endH   = (int) date('H', strtotime($b->end_at));
            $endM   = (int) date('i', strtotime($b->end_at));
            if ($endM > 0) $endH++;
            for ($h = max(7, $startH); $h < min(19, $endH); $h++) {
                $idx = $h - 7;
                if ($idx >= 0 && $idx < 12) $hourCounts[$idx]++;
            }
        }
        $maxCount = max($hourCounts) ?: 1;
        $peakHours = array_map(fn ($v) => (int) round($v / $maxCount * 100), $hourCounts);

        return response()->json([
            'bookings_this_month' => $monthlyBookings->count(),
            'utilization'         => $utilization,
            'peak_hours'          => array_values($peakHours),
        ]);
    }

    public function availability(Request $request, Room $room): JsonResponse
    {
        $request->validate([
            'start_at' => 'required|date',
            'end_at' => 'required|date|after:start_at',
            'exclude_booking_id' => 'nullable|integer',
        ]);

        $userId = auth()->id();

        // Track this user as viewing this slot (upsert, TTL via updated_at)
        DB::table('room_views')->upsert(
            [['room_id' => $room->id, 'user_id' => $userId, 'start_at' => $request->start_at, 'end_at' => $request->end_at, 'updated_at' => now()]],
            ['room_id', 'user_id'],
            ['start_at', 'end_at', 'updated_at'],
        );

        // Count other users actively viewing overlapping slot (active = seen within last 60s)
        $otherViewers = DB::table('room_views')
            ->where('room_id', $room->id)
            ->where('user_id', '!=', $userId)
            ->where('updated_at', '>=', now()->subSeconds(60))
            ->where('start_at', '<', $request->end_at)
            ->where('end_at', '>', $request->start_at)
            ->count();

        $query = Booking::where('room_id', $room->id)
            ->where('status', '!=', 'cancelled')
            ->where('start_at', '<', $request->end_at)
            ->where('end_at', '>', $request->start_at);

        if ($request->exclude_booking_id) {
            $query->where('id', '!=', $request->exclude_booking_id);
        }

        $conflicts = $query->with('user')->get();

        return response()->json([
            'available'      => $conflicts->isEmpty(),
            'conflicts'      => $conflicts,
            'other_viewers'  => $otherViewers,
        ]);
    }

    public function clearView(Room $room): JsonResponse
    {
        DB::table('room_views')
            ->where('room_id', $room->id)
            ->where('user_id', auth()->id())
            ->delete();

        return response()->json(['ok' => true]);
    }
}
