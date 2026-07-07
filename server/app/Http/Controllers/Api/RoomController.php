<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Booking;
use App\Models\Building;
use App\Models\Room;
use App\Models\RoomView;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class RoomController extends Controller
{
    /**
     * building_admin is scoped to their assigned buildings (admin_buildings pivot);
     * admin/receptionist are unrestricted. Returns a 403 response if not allowed, else null.
     */
    private function authorizeRoomBuilding(Request $request, ?int $buildingId): ?JsonResponse
    {
        $user = $request->user();
        if ($user->role === 'building_admin' && !$user->canManageBuilding((int) $buildingId)) {
            return response()->json(['message' => 'You do not manage this building.'], 403);
        }
        return null;
    }

    public function index(): JsonResponse
    {
        $rooms = Room::with('building')->where('is_active', true)->orderBy('sort_order')->orderBy('id')->get();
        return response()->json($rooms);
    }

    public function show(Room $room): JsonResponse
    {
        return response()->json($room->load('building'));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'building_id'      => 'nullable|exists:buildings,id',
            'name'             => [
                'required', 'string',
                \Illuminate\Validation\Rule::unique('rooms', 'name')->where(fn ($q) => $q->where('building_id', $request->input('building_id'))),
            ],
            'capacity'         => 'required|integer|min:1',
            'floor'            => 'required|string',
            'facilities'       => 'nullable|array',
            'photos'           => 'nullable|array',
            'notes'            => 'nullable|string',
            'requires_contact' => 'nullable|boolean',
        ], [
            'name.unique' => 'A room with that name already exists in this building.',
        ]);

        if ($err = $this->authorizeRoomBuilding($request, $data['building_id'] ?? null)) return $err;

        // Auto-set sort_order to max within the building + 1
        $maxOrder = Room::where('building_id', $data['building_id'] ?? null)->max('sort_order') ?? 0;
        $data['sort_order']   = $maxOrder + 1;
        $data['sensor_code']  = Str::random(16);

        $room = Room::create($data);
        return response()->json($room->load('building'), 201);
    }

    public function update(Request $request, Room $room): JsonResponse
    {
        $effectiveBuildingId = $request->has('building_id') ? $request->input('building_id') : $room->building_id;
        $data = $request->validate([
            'building_id'      => 'nullable|exists:buildings,id',
            'name'             => [
                'sometimes', 'string',
                \Illuminate\Validation\Rule::unique('rooms', 'name')->where(fn ($q) => $q->where('building_id', $effectiveBuildingId))->ignore($room->id),
            ],
            'capacity'         => 'sometimes|integer|min:1',
            'floor'            => 'sometimes|string',
            'facilities'       => 'nullable|array',
            'photos'           => 'nullable|array',
            'notes'            => 'nullable|string',
            'is_active'        => 'sometimes|boolean',
            'status'           => 'sometimes|in:active,maintenance',
            'requires_contact' => 'sometimes|boolean',
        ], [
            'name.unique' => 'A room with that name already exists in this building.',
        ]);

        if ($err = $this->authorizeRoomBuilding($request, $room->building_id)) return $err;
        if (isset($data['building_id']) && $err = $this->authorizeRoomBuilding($request, $data['building_id'])) return $err;

        $room->update($data);
        return response()->json($room->fresh('building'));
    }

    public function updateStatus(Request $request, Room $room): JsonResponse
    {
        $role = $request->user()->role;
        if (!in_array($role, ['admin', 'receptionist', 'building_admin'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        if ($err = $this->authorizeRoomBuilding($request, $room->building_id)) return $err;

        $data = $request->validate([
            'status' => 'required|in:active,maintenance',
        ]);

        $room->update($data);
        return response()->json($room);
    }

    public function updateSpecial(Request $request, Room $room): JsonResponse
    {
        $role = $request->user()->role;
        if (!in_array($role, ['admin', 'receptionist', 'building_admin'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        if ($err = $this->authorizeRoomBuilding($request, $room->building_id)) return $err;

        $data = $request->validate([
            'requires_contact' => 'required|boolean',
        ]);

        $room->update($data);
        return response()->json($room);
    }

    public function reorder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'rooms'            => 'required|array',
            'rooms.*.id'       => 'required|integer|exists:rooms,id',
            'rooms.*.sort_order' => 'required|integer|min:1',
        ]);

        if ($request->user()->role === 'building_admin') {
            $roomIds = collect($data['rooms'])->pluck('id');
            $buildingIds = Room::whereIn('id', $roomIds)->pluck('building_id')->unique();
            foreach ($buildingIds as $bId) {
                if ($err = $this->authorizeRoomBuilding($request, $bId)) return $err;
            }
        }

        foreach ($data['rooms'] as $item) {
            Room::where('id', $item['id'])->update(['sort_order' => $item['sort_order']]);
        }

        return response()->json(['ok' => true]);
    }

    public function uploadPhoto(Request $request, Room $room): JsonResponse
    {
        if ($err = $this->authorizeRoomBuilding($request, $room->building_id)) return $err;
        $request->validate(['photo' => 'required|image|max:5120']);
        $path = $request->file('photo')->store('room-photos', 'public');
        $url  = Storage::disk('public')->url($path);
        $photos = $room->photos ?? [];
        $photos[] = $url;
        $room->update(['photos' => $photos]);
        return response()->json(['url' => $url, 'photos' => $photos]);
    }

    public function deletePhoto(Request $request, Room $room): JsonResponse
    {
        if ($err = $this->authorizeRoomBuilding($request, $room->building_id)) return $err;
        $request->validate(['url' => 'required|string']);
        $url    = $request->url;
        $photos = array_values(array_filter($room->photos ?? [], fn ($p) => $p !== $url));
        $room->update(['photos' => $photos]);
        // Remove file from storage if it's a local upload
        $path = str_replace('/storage/', '', parse_url($url, PHP_URL_PATH));
        if ($path && Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
        }
        return response()->json(['photos' => $photos]);
    }

    public function destroy(Request $request, Room $room): JsonResponse
    {
        if ($err = $this->authorizeRoomBuilding($request, $room->building_id)) return $err;
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

        $conflicts = $query->with('user.department')->get();

        return response()->json([
            'available'      => $conflicts->isEmpty(),
            'conflicts'      => $conflicts,
            'other_viewers'  => $otherViewers,
        ]);
    }

    public function available(Request $request): JsonResponse
    {
        $request->validate([
            'start_at'    => 'required|date',
            'end_at'      => 'required|date|after:start_at',
            'building_id' => 'nullable|exists:buildings,id',
        ]);

        $searchStart = \Carbon\Carbon::parse($request->start_at);
        $searchEnd   = \Carbon\Carbon::parse($request->end_at);
        $minMinutes  = 30;

        $query = Room::with('building')
            ->where('is_active', true)
            ->where('status', 'active')
            ->orderBy('sort_order');

        if ($request->filled('building_id')) {
            $query->where('building_id', $request->building_id);
        }

        $result = $query->get()->map(function (Room $room) use ($searchStart, $searchEnd, $minMinutes) {
            $bookings = Booking::where('room_id', $room->id)
                ->where('status', '!=', 'cancelled')
                ->where('start_at', '<', $searchEnd)
                ->where('end_at',   '>', $searchStart)
                ->orderBy('start_at')
                ->get(['start_at', 'end_at']);

            $slots  = [];
            $cursor = $searchStart->copy();

            foreach ($bookings as $booking) {
                $bStart = \Carbon\Carbon::parse($booking->start_at)->max($searchStart);
                $bEnd   = \Carbon\Carbon::parse($booking->end_at)->min($searchEnd);

                if ($cursor->lt($bStart) && $cursor->diffInMinutes($bStart) >= $minMinutes) {
                    $slots[] = [
                        'start' => $cursor->format('Y-m-d\TH:i:s'),
                        'end'   => $bStart->format('Y-m-d\TH:i:s'),
                    ];
                }

                if ($bEnd->gt($cursor)) {
                    $cursor = $bEnd->copy();
                }
            }

            if ($cursor->lt($searchEnd) && $cursor->diffInMinutes($searchEnd) >= $minMinutes) {
                $slots[] = [
                    'start' => $cursor->format('Y-m-d\TH:i:s'),
                    'end'   => $searchEnd->format('Y-m-d\TH:i:s'),
                ];
            }

            if (empty($slots)) {
                return null; // fully booked, exclude
            }

            $data                   = $room->toArray();
            $data['available_slots'] = $slots;
            $data['is_fully_free']   = count($slots) === 1
                && $slots[0]['start'] === $searchStart->format('Y-m-d\TH:i:s')
                && $slots[0]['end']   === $searchEnd->format('Y-m-d\TH:i:s');

            return $data;
        })->filter()->values();

        return response()->json($result);
    }

    public function clearView(Room $room): JsonResponse
    {
        DB::table('room_views')
            ->where('room_id', $room->id)
            ->where('user_id', auth()->id())
            ->delete();

        return response()->json(['ok' => true]);
    }

    public function regenerateSensorCode(Request $request, Room $room): JsonResponse
    {
        if ($err = $this->authorizeRoomBuilding($request, $room->building_id)) return $err;
        $code = Str::random(16);
        $room->update(['sensor_code' => $code]);
        return response()->json($room->fresh('building'));
    }

    public function export(Request $request): JsonResponse
    {
        $query = Room::with('building')->orderBy('sort_order')->orderBy('id');
        if ($request->user()->role === 'building_admin') {
            $query->whereIn('building_id', $request->user()->managedBuildingIds());
        }
        $rows = $query->get();
        ActivityLog::record(
            'data.exported',
            "Exported {$rows->count()} room records",
            null,
            ['type' => 'rooms', 'count' => $rows->count()],
        );

        return response()->json($rows->map(fn (Room $r) => [
            'name'             => $r->name,
            'building'         => $r->building?->name ?? '',
            'capacity'         => (string) $r->capacity,
            'floor'            => $r->floor,
            'facilities'       => collect($r->facilities ?? [])->pluck('name')->implode(', '),
            'notes'            => $r->notes ?? '',
            'is_active'        => $r->is_active ? 'yes' : 'no',
            'status'           => $r->status,
            'requires_contact' => $r->requires_contact ? 'yes' : 'no',
        ]));
    }

    public function importRooms(Request $request): JsonResponse
    {
        if ($request->user()->role === 'building_admin') {
            return response()->json(['message' => 'Bulk import is admin-only.'], 403);
        }
        $request->validate(['rooms' => 'required|array|min:1|max:500']);

        $created = 0;
        $errors  = [];
        $buildingCache = Building::all()->keyBy(fn ($b) => strtolower($b->name));
        $sortOrderCache = [];

        foreach ($request->rooms as $i => $row) {
            $rowNum = $i + 1;
            if (empty($row['name']) || empty($row['capacity']) || empty($row['floor'])) {
                $errors[] = "Row {$rowNum}: name, capacity, and floor are required.";
                continue;
            }
            try {
                $buildingId = null;
                $buildingName = trim($row['building'] ?? '');
                if ($buildingName !== '') {
                    $b = $buildingCache[strtolower($buildingName)] ?? null;
                    if ($b) $buildingId = $b->id;
                    else { $errors[] = "Row {$rowNum}: building \"{$buildingName}\" not found."; continue; }
                }

                $facilities = collect(explode(',', $row['facilities'] ?? ''))
                    ->map(fn ($f) => trim($f))
                    ->filter()
                    ->map(fn ($f) => ['name' => $f, 'icon' => 'devices'])
                    ->values()
                    ->all();

                $isActive = !in_array(strtolower(trim($row['is_active'] ?? 'yes')), ['no', 'false', '0', '']);
                $status = strtolower(trim($row['status'] ?? 'active'));
                if (!in_array($status, ['active', 'maintenance'])) $status = 'active';
                $requiresContact = in_array(strtolower(trim($row['requires_contact'] ?? 'no')), ['yes', 'true', '1']);

                if (!array_key_exists($buildingId, $sortOrderCache)) {
                    $sortOrderCache[$buildingId] = Room::where('building_id', $buildingId)->max('sort_order') ?? 0;
                }
                $sortOrderCache[$buildingId]++;

                Room::create([
                    'building_id'      => $buildingId,
                    'name'             => trim($row['name']),
                    'capacity'         => (int) $row['capacity'],
                    'floor'            => trim($row['floor']),
                    'facilities'       => $facilities,
                    'notes'            => trim($row['notes'] ?? '') ?: null,
                    'is_active'        => $isActive,
                    'status'           => $status,
                    'requires_contact' => $requiresContact,
                    'sort_order'       => $sortOrderCache[$buildingId],
                    'sensor_code'      => Str::random(16),
                ]);
                $created++;
            } catch (\Exception $e) {
                $errors[] = "Row {$rowNum}: " . $e->getMessage();
            }
        }

        return response()->json(['created' => $created, 'errors' => $errors]);
    }
}
