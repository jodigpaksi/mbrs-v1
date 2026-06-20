<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Notification;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BookingController extends Controller
{
    private function validateTimeBounds(string $startAt, string $endAt): ?JsonResponse
    {
        $s = Carbon::parse($startAt);
        $e = Carbon::parse($endAt);

        $sMin = $s->hour * 60 + $s->minute;
        $eMin = $e->hour * 60 + $e->minute;

        if ($sMin < 420 || $sMin > 1110 || $sMin % 30 !== 0) {
            return response()->json(['message' => 'Start time must be between 07:00–18:30 in 30-minute increments.'], 422);
        }
        if ($eMin < 450 || $eMin > 1140 || $eMin % 30 !== 0) {
            return response()->json(['message' => 'End time must be between 07:30–19:00 in 30-minute increments.'], 422);
        }
        return null;
    }

    public function index(Request $request): JsonResponse
    {
        $query = Booking::with(['user.department', 'room.building', 'pantryOrder'])
            ->orderBy('start_at');

        if ($request->date_from && $request->date_to) {
            $query->whereDate('start_at', '>=', $request->date_from)
                  ->whereDate('start_at', '<=', $request->date_to);
        } elseif ($request->date) {
            $query->whereDate('start_at', $request->date);
        }

        if ($request->room_id) {
            $query->where('room_id', $request->room_id);
        }

        if ($request->user_id) {
            $query->where('user_id', $request->user_id);
        }

        $results = $query->get();
        $results->each(fn($b) => $b->user?->makeHidden('department'));
        return response()->json($results);
    }

    public function myBookings(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $bookings = Booking::with(['room.building', 'user.department'])
            ->where(function ($q) use ($userId) {
                $q->where('user_id', $userId)
                  ->orWhere('booked_for_user_id', $userId);
            })
            ->where('status', '!=', 'cancelled')
            ->orderBy('start_at')
            ->get()
            ->map(function ($b) use ($userId) {
                $b->is_recipient = ($b->booked_for_user_id === $userId && $b->user_id !== $userId);
                $b->user?->makeHidden('department');
                return $b;
            });

        return response()->json($bookings);
    }

    public function store(Request $request): JsonResponse
    {
        $role = $request->user()->role;
        $isPrivileged = in_array($role, ['admin', 'receptionist']);

        $data = $request->validate([
            'room_id'     => 'required|exists:rooms,id',
            'title'       => 'required|string|max:255',
            'description' => 'nullable|string',
            'start_at'    => 'required|date',
            'end_at'      => 'required|date|after:start_at',
            'status'      => 'in:confirmed,tentative',
            'type'        => $isPrivileged
                ? 'in:internal,external,maintenance,repairment'
                : 'in:internal,external',
            'series_id'          => 'nullable|string|max:36',
            'booked_for'         => 'nullable|string|max:100',
            'booked_for_user_id' => 'nullable|exists:users,id',
        ]);

        $room = \App\Models\Room::findOrFail($data['room_id']);
        if ($room->status === 'maintenance' && !$isPrivileged) {
            return response()->json(['message' => 'This room is currently under maintenance.'], 422);
        }

        if ($err = $this->validateTimeBounds($data['start_at'], $data['end_at'])) {
            return $err;
        }

        $conflict = Booking::where('room_id', $data['room_id'])
            ->where('status', '!=', 'cancelled')
            ->where('start_at', '<', $data['end_at'])
            ->where('end_at', '>', $data['start_at'])
            ->exists();

        if ($conflict) {
            return response()->json(['message' => 'Room is not available at this time.'], 422);
        }

        $booking = Booking::create([
            ...$data,
            'user_id'   => $request->user()->id,
            'status'    => $data['status'] ?? 'confirmed',
            'type'      => $data['type'] ?? 'internal',
            'series_id' => $data['series_id'] ?? null,
        ]);

        if (!empty($data['booked_for_user_id'])) {
            Notification::create([
                'user_id'    => $data['booked_for_user_id'],
                'booking_id' => $booking->id,
                'type'       => 'booked_for',
                'message'    => $request->user()->name . ' booked ' . $room->name . ' for you on '
                                . Carbon::parse($booking->start_at)->format('d M, H:i'),
            ]);
        }

        return response()->json($booking->load(['user', 'room']), 201);
    }

    public function show(Booking $booking): JsonResponse
    {
        return response()->json($booking->load(['user', 'room', 'pantryOrder']));
    }

    public function update(Request $request, Booking $booking): JsonResponse
    {
        $role = $request->user()->role;
        $isPrivileged = in_array($role, ['admin', 'receptionist']);

        if ($booking->user_id !== $request->user()->id && !$isPrivileged) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'title'       => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'start_at'    => 'sometimes|date',
            'end_at'      => 'sometimes|date|after:start_at',
            'status'      => 'sometimes|in:confirmed,tentative,cancelled',
            'type'        => $isPrivileged
                ? 'sometimes|in:internal,external,maintenance,repairment'
                : 'sometimes|in:internal,external',
            'booked_for'         => 'sometimes|nullable|string|max:100',
            'booked_for_user_id' => 'sometimes|nullable|exists:users,id',
        ]);

        $roomId  = $data['room_id']  ?? $booking->room_id;
        $startAt = $data['start_at'] ?? $booking->start_at;
        $endAt   = $data['end_at']   ?? $booking->end_at;

        if (isset($data['start_at']) || isset($data['end_at'])) {
            if ($err = $this->validateTimeBounds((string) $startAt, (string) $endAt)) {
                return $err;
            }
        }

        $conflict = Booking::where('room_id', $roomId)
            ->where('id', '!=', $booking->id)
            ->where('status', '!=', 'cancelled')
            ->where('start_at', '<', $endAt)
            ->where('end_at', '>', $startAt)
            ->exists();

        if ($conflict) {
            return response()->json(['message' => 'Room is not available at this time.'], 422);
        }

        if (isset($data['status']) && $data['status'] === 'cancelled') {
            $data['cancelled_at'] = now();
        }

        $booking->update($data);
        return response()->json($booking->load(['user', 'room']));
    }

    public function destroy(Request $request, Booking $booking): JsonResponse
    {
        if ($booking->user_id !== $request->user()->id && $request->user()->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $booking->update(['status' => 'cancelled', 'cancelled_at' => now()]);
        return response()->json(['message' => 'Booking cancelled']);
    }

    public function seriesUpdate(Request $request, string $seriesId): JsonResponse
    {
        $role = $request->user()->role;
        $isPrivileged = in_array($role, ['admin', 'receptionist']);

        $bookings = Booking::where('series_id', $seriesId)
            ->where('status', '!=', 'cancelled')
            ->get();

        if ($bookings->isEmpty()) {
            return response()->json(['message' => 'Series not found'], 404);
        }

        $first = $bookings->first();
        if ($first->user_id !== $request->user()->id && !$isPrivileged) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'title'       => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'status'      => 'sometimes|in:confirmed,tentative',
            'type'        => $isPrivileged
                ? 'sometimes|in:internal,external,maintenance,repairment'
                : 'sometimes|in:internal,external',
        ]);

        foreach ($bookings as $booking) {
            $booking->update($data);
        }

        return response()->json(['updated' => $bookings->count()]);
    }

    public function seriesDestroy(Request $request, string $seriesId): JsonResponse
    {
        $bookings = Booking::where('series_id', $seriesId)
            ->where('status', '!=', 'cancelled')
            ->get();

        if ($bookings->isEmpty()) {
            return response()->json(['message' => 'Series not found'], 404);
        }

        $first = $bookings->first();
        if ($first->user_id !== $request->user()->id && $request->user()->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $now = now();
        foreach ($bookings as $booking) {
            $booking->update(['status' => 'cancelled', 'cancelled_at' => $now]);
        }

        return response()->json(['cancelled' => $bookings->count()]);
    }

    public function clearCancelled(Request $request): JsonResponse
    {
        Booking::where('user_id', $request->user()->id)
            ->where('status', 'cancelled')
            ->delete();

        return response()->json(['message' => 'Cleared successfully']);
    }
}
