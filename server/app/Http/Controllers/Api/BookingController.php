<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
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
        $query = Booking::with(['user', 'room', 'pantryOrder'])
            ->orderBy('start_at');

        if ($request->date) {
            $query->whereDate('start_at', $request->date);
        }

        if ($request->room_id) {
            $query->where('room_id', $request->room_id);
        }

        if ($request->user_id) {
            $query->where('user_id', $request->user_id);
        }

        return response()->json($query->get());
    }

    public function myBookings(Request $request): JsonResponse
    {
        $bookings = Booking::with(['room'])
            ->where('user_id', $request->user()->id)
            ->where('status', '!=', 'cancelled')
            ->orderBy('start_at')
            ->get();

        return response()->json($bookings);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'room_id'     => 'required|exists:rooms,id',
            'title'       => 'required|string|max:255',
            'description' => 'nullable|string',
            'start_at'    => 'required|date',
            'end_at'      => 'required|date|after:start_at',
            'status'      => 'in:confirmed,tentative',
            'type'        => 'in:internal,external',
        ]);

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
            'user_id' => $request->user()->id,
            'status'  => $data['status'] ?? 'confirmed',
            'type'    => $data['type'] ?? 'internal',
        ]);

        return response()->json($booking->load(['user', 'room']), 201);
    }

    public function show(Booking $booking): JsonResponse
    {
        return response()->json($booking->load(['user', 'room', 'pantryOrder']));
    }

    public function update(Request $request, Booking $booking): JsonResponse
    {
        if ($booking->user_id !== $request->user()->id && $request->user()->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'title'       => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'start_at'    => 'sometimes|date',
            'end_at'      => 'sometimes|date|after:start_at',
            'status'      => 'sometimes|in:confirmed,tentative,cancelled',
            'type'        => 'sometimes|in:internal,external',
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

    public function clearCancelled(Request $request): JsonResponse
    {
        Booking::where('user_id', $request->user()->id)
            ->where('status', 'cancelled')
            ->delete();

        return response()->json(['message' => 'Cleared successfully']);
    }
}
