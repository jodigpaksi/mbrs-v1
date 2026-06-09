<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BookingController extends Controller
{
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
            'room_id' => 'required|exists:rooms,id',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'start_at' => 'required|date',
            'end_at' => 'required|date|after:start_at',
            'status' => 'in:confirmed,tentative',
            'type' => 'in:internal,external',
        ]);

        // Check for conflicts
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
            'status' => $data['status'] ?? 'confirmed',
            'type' => $data['type'] ?? 'internal',
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
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'start_at' => 'sometimes|date',
            'end_at' => 'sometimes|date|after:start_at',
            'status' => 'sometimes|in:confirmed,tentative,cancelled',
            'type' => 'sometimes|in:internal,external',
        ]);

        $booking->update($data);
        return response()->json($booking->load(['user', 'room']));
    }

    public function destroy(Request $request, Booking $booking): JsonResponse
    {
        if ($booking->user_id !== $request->user()->id && $request->user()->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $booking->update(['status' => 'cancelled']);
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
