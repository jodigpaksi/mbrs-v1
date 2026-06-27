<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\KioskConfig;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class KioskController extends Controller
{
    /**
     * Bookings are stored as naive local wall-clock times (the browser's local
     * time at booking). app.timezone is UTC, so Carbon::now() is offset from the
     * stored wall-clock and a currently-running booking looks "upcoming".
     * This returns "now" as the business-local wall-clock, reinterpreted in the
     * default tz so it lines up with the stored start_at/end_at values.
     */
    private const BUSINESS_TZ = 'Asia/Jakarta';

    private function localNow(): Carbon
    {
        return Carbon::parse(Carbon::now(self::BUSINESS_TZ)->format('Y-m-d H:i:s'));
    }

    // ── Public (no auth) ───────────────────────────────────────────────────────

    public function publicConfig(string $id): JsonResponse
    {
        $kiosk = KioskConfig::with('room.building')->findOrFail($id);
        if (! $kiosk->active) abort(404);

        return response()->json([
            'id'      => $kiosk->id,
            'name'    => $kiosk->name,
            'has_pin' => ! empty($kiosk->pin),
            'theme'   => $kiosk->theme,
            'layout'  => $kiosk->layout,
            'resolution' => $kiosk->resolution,
            'room'    => $kiosk->room ? [
                'id'       => $kiosk->room->id,
                'name'     => $kiosk->room->name,
                'capacity' => $kiosk->room->capacity,
                'floor'    => $kiosk->room->floor,
                'building' => $kiosk->room->building?->name ?? '',
                'photos'   => $kiosk->room->photos ?? [],
            ] : null,
        ]);
    }

    public function verifyPin(Request $request, string $id): JsonResponse
    {
        $kiosk = KioskConfig::findOrFail($id);
        if (! $kiosk->active) abort(404);

        if ($kiosk->pin && $request->input('pin') !== $kiosk->pin) {
            return response()->json(['error' => 'Invalid PIN'], 401);
        }
        return response()->json(['ok' => true]);
    }

    public function publicStatus(string $id): JsonResponse
    {
        $kiosk = KioskConfig::with('room')->findOrFail($id);
        if (! $kiosk->active) abort(404);

        $room = $kiosk->room;
        if (! $room) {
            return response()->json(['room' => null, 'current' => null, 'upcoming' => [], 'server_time' => now()->toIso8601String()]);
        }

        $now        = $this->localNow();
        $todayStart = $now->copy()->startOfDay();
        $todayEnd   = $now->copy()->endOfDay();

        $bookings = Booking::where('room_id', $room->id)
            ->whereIn('status', ['confirmed', 'tentative'])
            ->whereBetween('start_at', [$todayStart, $todayEnd])
            ->with(['user:id,name,department_id', 'user.department:id,name'])
            ->orderBy('start_at')
            ->get();

        $current = $bookings->first(
            fn ($b) => Carbon::parse($b->start_at) <= $now && Carbon::parse($b->end_at) > $now
        );

        $upcoming = $bookings->filter(
            fn ($b) => Carbon::parse($b->start_at) > $now
        )->values();

        $formatBooking = fn ($b) => [
            'id'                    => $b->id,
            'title'                 => $b->title,
            'start_at'              => $b->start_at,
            'end_at'                => $b->end_at,
            'user'                  => $b->user?->name,
            'department'            => $b->user?->department_name ?: null,
            'type'                  => $b->type,
            'status'                => $b->status,
            'presence_confirmed_at' => $b->presence_confirmed_at,
        ];

        return response()->json([
            'room' => [
                'id'       => $room->id,
                'name'     => $room->name,
                'status'   => $room->status,
                'capacity' => $room->capacity,
                'floor'    => $room->floor,
            ],
            'current'     => $current ? $formatBooking($current) : null,
            'upcoming'    => $upcoming->take(6)->map($formatBooking)->values(),
            'free_until'  => (! $current && $upcoming->isNotEmpty()) ? $upcoming->first()->start_at : null,
            'free_from'   => ($current && $upcoming->isNotEmpty()) ? $current->end_at : null,
            'server_time' => $now->toIso8601String(),
        ]);
    }

    public function confirmPresence(Request $request, string $id): JsonResponse
    {
        $kiosk = KioskConfig::with('room')->findOrFail($id);
        if (! $kiosk->active) abort(404);

        $bookingId = $request->input('booking_id');
        $booking   = Booking::findOrFail($bookingId);

        // Verify this booking belongs to the kiosk's room and is currently active
        if ($kiosk->room_id && $booking->room_id !== $kiosk->room_id) {
            return response()->json(['error' => 'Booking does not match this kiosk room'], 422);
        }

        $now = $this->localNow();
        if (Carbon::parse($booking->start_at) > $now || Carbon::parse($booking->end_at) <= $now) {
            return response()->json(['error' => 'Booking is not currently active'], 422);
        }

        if (! $booking->presence_confirmed_at) {
            $booking->update(['presence_confirmed_at' => $now]);
        }

        return response()->json(['presence_confirmed_at' => $booking->presence_confirmed_at]);
    }

    // ── Admin CRUD (can:admin) ─────────────────────────────────────────────────

    public function index(): JsonResponse
    {
        $configs = KioskConfig::with('room:id,name,floor,building_id')->get();
        return response()->json($configs);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'              => 'required|string|max:255',
            'room_id'           => 'nullable|exists:rooms,id',
            'pin'               => 'nullable|string|max:20',
            'theme'             => 'nullable|array',
            'layout'            => 'nullable|array',
            'resolution'        => 'nullable|array',
            'active'            => 'boolean',
        ]);

        $kiosk = KioskConfig::create($data);
        return response()->json($kiosk->load('room:id,name,floor'), 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $kiosk = KioskConfig::findOrFail($id);
        $data  = $request->validate([
            'name'              => 'sometimes|string|max:255',
            'room_id'           => 'sometimes|nullable|exists:rooms,id',
            'pin'               => 'sometimes|nullable|string|max:20',
            'theme'             => 'sometimes|nullable|array',
            'layout'            => 'sometimes|nullable|array',
            'resolution'        => 'sometimes|nullable|array',
            'active'            => 'sometimes|boolean',
        ]);

        $kiosk->update($data);
        return response()->json($kiosk->fresh()->load('room:id,name,floor'));
    }

    public function destroy(string $id): JsonResponse
    {
        KioskConfig::findOrFail($id)->delete();
        return response()->json(null, 204);
    }
}
