<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\BroadcastsBookingChanges;
use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Notification;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BookingController extends Controller
{
    use BroadcastsBookingChanges;

    private function notifyCancelRecipient(Booking $booking, Request $request): void
    {
        if (!$booking->booked_for_user_id) return;
        if ($booking->booked_for_user_id === $request->user()->id) return;

        $room    = $booking->room ?? $booking->load('room')->room;
        $roomName = $room?->name ?? 'a room';
        $date     = Carbon::parse($booking->start_at)->format('d M, H:i');

        Notification::create([
            'user_id'    => $booking->booked_for_user_id,
            'booking_id' => $booking->id,
            'type'       => 'booking_cancelled',
            'message'    => "{$request->user()->name} cancelled the booking for {$roomName} on {$date}",
        ]);
    }

    public function transfer(Request $request, Booking $booking): JsonResponse
    {
        $role = $request->user()->role;
        if (!in_array($role, ['admin', 'receptionist'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($booking->status === 'cancelled') {
            return response()->json(['message' => 'Cannot transfer a cancelled booking.'], 422);
        }

        $data = $request->validate([
            'booked_for_user_id' => 'required|exists:users,id',
        ]);

        $newUser = \App\Models\User::findOrFail($data['booked_for_user_id']);

        if ($newUser->id === $booking->booked_for_user_id) {
            return response()->json(['message' => 'Booking is already assigned to this person.'], 422);
        }

        $previousUserId = $booking->booked_for_user_id;
        $previousName   = $booking->booked_for;

        $booking->update([
            'booked_for_user_id' => $newUser->id,
            'booked_for'         => $newUser->name,
        ]);

        $room     = $booking->room ?? $booking->load('room')->room;
        $roomName = $room?->name ?? 'a room';
        $date     = Carbon::parse($booking->start_at)->format('d M, H:i');
        $actor    = $request->user();

        if ($newUser->id !== $actor->id) {
            Notification::create([
                'user_id'    => $newUser->id,
                'booking_id' => $booking->id,
                'type'       => 'booking_transferred',
                'message'    => "{$actor->name} transferred the booking for {$roomName} on {$date} to you",
            ]);
        }

        if ($previousUserId && $previousUserId !== $newUser->id && $previousUserId !== $actor->id) {
            Notification::create([
                'user_id'    => $previousUserId,
                'booking_id' => $booking->id,
                'type'       => 'booking_transferred',
                'message'    => "{$actor->name} transferred the booking for {$roomName} on {$date} to someone else",
            ]);
        }

        \App\Models\ActivityLog::record(
            'booking.transferred',
            "Transferred \"{$booking->title}\" in {$roomName} ({$date})" . ($previousName ? " from {$previousName}" : '') . " to {$newUser->name}",
            $booking,
            ['room' => $roomName, 'title' => $booking->title, 'start_at' => (string) $booking->start_at, 'from_user_id' => $previousUserId, 'to_user_id' => $newUser->id],
        );

        $this->broadcastChange('updated', $booking);

        return response()->json($booking->load(['user', 'room', 'bookedForUser']));
    }

    private function validateGeneralRules(array $data, Request $request, bool $isPrivileged, \App\Models\Room $room): ?JsonResponse
    {
        $m = \App\Models\Setting::getMany(['max_advance_days', 'allow_book_for_others', 'restrict_after_hours', 'working_hours_end']);
        $get = fn(string $key, mixed $default) => $m[$key] ?? $default;

        // Max advance days
        $maxDays = (int) $get('max_advance_days', '30');
        $daysAhead = (int) Carbon::now()->startOfDay()->diffInDays(Carbon::parse($data['start_at'])->startOfDay(), false);
        if ($daysAhead > $maxDays) {
            return response()->json(['message' => "Bookings cannot be made more than {$maxDays} days in advance."], 422);
        }

        // Allow book for others
        if (!empty($data['booked_for_user_id']) && !$isPrivileged) {
            if ($get('allow_book_for_others', 'true') === 'false') {
                return response()->json(['message' => 'Booking on behalf of others is currently disabled.'], 422);
            }
        }

        // After-hours restriction
        if (!$isPrivileged && $get('restrict_after_hours', 'false') === 'true') {
            $workEnd = $get('working_hours_end', '17:00');
            if (Carbon::parse($data['start_at'])->format('H:i') >= $workEnd) {
                return response()->json(['message' => "After-hours bookings (after {$workEnd}) must go through a receptionist."], 422);
            }
        }

        // Special room access
        if ($room->requires_contact && !$isPrivileged && !$request->user()->can_book_special) {
            return response()->json(['message' => 'This room requires special access. Please contact a receptionist.'], 422);
        }

        return null;
    }

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
        $query = Booking::with(['user.department', 'room.building'])
            ->whereNull('archived_at')
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

        if ($request->special_rooms) {
            $query->whereHas('room', fn($q) => $q->where('requires_contact', true));
        }

        $results = $query->get();
        $results->each(fn($b) => $b->user?->makeHidden('department'));
        return response()->json($results);
    }

    public function myBookings(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $today = Carbon::now(\App\Models\Setting::businessTz())->toDateString();

        $bookings = Booking::with(['room.building', 'user.department'])
            ->whereNull('archived_at')
            ->where(function ($q) use ($userId) {
                $q->where('user_id', $userId)
                  ->orWhere('booked_for_user_id', $userId);
            })
            ->where(function ($q) use ($today) {
                // Include all non-cancelled bookings + today's cancelled so TodayPanel
                // can show ghost-released / manually cancelled bookings from today
                $q->where('status', '!=', 'cancelled')
                  ->orWhere(function ($q2) use ($today) {
                      $q2->where('status', 'cancelled')
                         ->whereDate('start_at', $today);
                  });
            })
            ->orderBy('start_at')
            ->get()
            ->map(function ($b) use ($userId) {
                $b->is_recipient = ($b->booked_for_user_id === $userId && $b->user_id !== $userId);
                $b->user?->makeHidden('department');
                return $b;
            });

        return response()->json($bookings);
    }

    public function confirmPresenceWeb(Request $request, Booking $booking): JsonResponse
    {
        $userId = $request->user()->id;

        // Confirm target: the booked_for user if set, else the creator
        $confirmerId = $booking->booked_for_user_id ?? $booking->user_id;
        if ($confirmerId !== $userId) {
            return response()->json(['error' => 'You are not the presence-confirmation target for this booking'], 403);
        }

        $now = Carbon::parse(Carbon::now(\App\Models\Setting::businessTz())->format('Y-m-d H:i:s'));
        if (Carbon::parse($booking->start_at) > $now) {
            return response()->json(['error' => 'Booking has not started yet'], 422);
        }
        if (Carbon::parse($booking->end_at) <= $now) {
            return response()->json(['error' => 'Booking has already ended'], 422);
        }

        if (! $booking->presence_confirmed_at) {
            $booking->update(['presence_confirmed_at' => $now]);
            $this->broadcastChange('presence_confirmed', $booking);
        }

        return response()->json(['presence_confirmed_at' => $booking->presence_confirmed_at]);
    }

    public function disputeIndex(Request $request): JsonResponse
    {
        $allowed = ['admin', 'superadmin', 'receptionist', 'building_admin'];
        if (! in_array($request->user()->role, $allowed)) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $status = $request->query('status', 'pending'); // pending|resolved|all

        $q = Booking::with(['user', 'room.building'])
            ->whereNotNull('dispute_status');

        if ($request->user()->role === 'building_admin') {
            $q->whereHas('room', fn ($rq) => $rq->whereIn('building_id', $request->user()->managedBuildingIds()));
        }

        if ($status === 'pending') {
            $q->where('dispute_status', 'pending');
        } elseif ($status === 'resolved') {
            $q->whereIn('dispute_status', ['approved', 'rejected']);
        }

        $bookings = $q->orderByDesc('disputed_at')->get()->map(fn($b) => [
            'id'                   => $b->id,
            'title'                => $b->title,
            'start_at'             => $b->start_at,
            'end_at'               => $b->end_at,
            'status'               => $b->status,
            'cancel_reason'        => $b->cancel_reason,
            'dispute_status'       => $b->dispute_status,
            'dispute_note'         => $b->dispute_note,
            'disputed_at'          => $b->disputed_at,
            'dispute_resolved_at'  => $b->dispute_resolved_at,
            'dispute_resolved_by'  => $b->dispute_resolved_by,
            'room'                 => $b->room ? [
                'id'       => $b->room->id,
                'name'     => $b->room->name,
                'building' => $b->room->building ? ['name' => $b->room->building->name, 'code' => $b->room->building->code] : null,
            ] : null,
            'user'                 => $b->user ? [
                'id'     => $b->user->id,
                'name'   => $b->user->name,
                'email'  => $b->user->email,
                'avatar' => $b->user->avatar,
            ] : null,
        ]);

        return response()->json($bookings);
    }

    public function submitDispute(Request $request, Booking $booking): JsonResponse
    {
        $userId = $request->user()->id;

        // Only the booking owner or the booked_for user can dispute
        $ownerId = $booking->booked_for_user_id ?? $booking->user_id;
        if ($ownerId !== $userId) {
            return response()->json(['error' => 'Not authorised to dispute this booking'], 403);
        }
        if ($booking->cancel_reason !== 'ghost_release') {
            return response()->json(['error' => 'Only auto-released bookings can be disputed'], 422);
        }
        if ($booking->dispute_status) {
            return response()->json(['error' => 'Dispute already submitted'], 422);
        }

        $data = $request->validate(['note' => 'nullable|string|max:500']);
        $now  = Carbon::parse(Carbon::now(\App\Models\Setting::businessTz())->format('Y-m-d H:i:s'));

        $booking->update([
            'dispute_status' => 'pending',
            'dispute_note'   => $data['note'] ?? null,
            'disputed_at'    => $now,
        ]);

        \App\Models\ActivityLog::record(
            'booking.dispute_submitted',
            "Dispute submitted for ghost-released booking #{$booking->id} — {$booking->title}",
            $booking,
            ['user_id' => $userId],
        );

        return response()->json(['dispute_status' => 'pending']);
    }

    public function resolveDispute(Request $request, Booking $booking): JsonResponse
    {
        $admin = $request->user();
        if (! in_array($admin->role, ['admin', 'superadmin', 'receptionist', 'building_admin'])) {
            return response()->json(['error' => 'Forbidden'], 403);
        }
        if ($booking->dispute_status !== 'pending') {
            return response()->json(['error' => 'No pending dispute on this booking'], 422);
        }
        if ($admin->role === 'building_admin' && !$admin->canManageBuilding((int) $booking->load('room')->room?->building_id)) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $data   = $request->validate(['action' => 'required|in:approve,reject']);
        $now    = Carbon::parse(Carbon::now(\App\Models\Setting::businessTz())->format('Y-m-d H:i:s'));
        $approve = $data['action'] === 'approve';

        $updates = [
            'dispute_status'       => $approve ? 'approved' : 'rejected',
            'dispute_resolved_at'  => $now,
            'dispute_resolved_by'  => $admin->id,
        ];

        if ($approve) {
            $updates['status']       = 'confirmed';
            $updates['cancelled_at'] = null;
            $updates['cancel_reason'] = null;
        }

        $booking->update($updates);

        \App\Models\ActivityLog::record(
            $approve ? 'booking.dispute_approved' : 'booking.dispute_rejected',
            ($approve ? 'Dispute approved' : 'Dispute rejected') . " for booking #{$booking->id} — {$booking->title}",
            $booking,
            ['resolved_by' => $admin->id],
        );

        if ($approve) {
            $this->broadcastChange('reinstated', $booking);
        }

        return response()->json(['dispute_status' => $booking->dispute_status]);
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
            'series_id'             => 'nullable|string|max:36',
            'series_skipped_dates'  => 'nullable|array',
            'series_skipped_dates.*'=> 'date_format:Y-m-d',
            'booked_for'            => 'nullable|string|max:100',
            'booked_for_user_id' => 'nullable|exists:users,id',
        ]);

        $room = \App\Models\Room::findOrFail($data['room_id']);
        if ($room->status === 'maintenance' && !$isPrivileged) {
            return response()->json(['message' => 'This room is currently under maintenance.'], 422);
        }

        if ($err = $this->validateTimeBounds($data['start_at'], $data['end_at'])) {
            return $err;
        }

        if ($err = $this->validateGeneralRules($data, $request, $isPrivileged, $room)) {
            return $err;
        }

        $conflict = Booking::where('room_id', $data['room_id'])
            ->where('status', '!=', 'cancelled')
            ->where('start_at', '<', $data['end_at'])
            ->where('end_at', '>', $data['start_at'])
            ->exists();

        if ($conflict) {
            return response()->json(['message' => 'Room is not available at this time. Someone may have just booked it.'], 422);
        }

        $booking = Booking::create([
            ...$data,
            'user_id'   => $request->user()->id,
            'status'    => $data['status'] ?? 'confirmed',
            'type'      => $data['type'] ?? 'internal',
            'series_id'            => $data['series_id'] ?? null,
            'series_skipped_dates' => $data['series_skipped_dates'] ?? null,
        ]);

        if (!empty($data['booked_for_user_id'])) {
            Notification::create([
                'user_id'    => $data['booked_for_user_id'],
                'booking_id' => $booking->id,
                'type'       => 'booked_for',
                'message'    => $request->user()->name . ' booked ' . $room->name . ' for you on '
                                . Carbon::parse($booking->start_at)->format('d M, H:i'),
            ]);

            $forName = \App\Models\User::find($data['booked_for_user_id'])?->name ?? ('user #' . $data['booked_for_user_id']);
            \App\Models\ActivityLog::record(
                'booking.created_for',
                "Booked {$room->name} for {$forName} — \"{$booking->title}\"",
                $booking,
                ['room' => $room->name, 'booked_for' => $forName, 'start_at' => (string) $booking->start_at],
            );
        }

        \App\Services\Microsoft365\GraphCalendarSync::syncCreate($booking->load(['room', 'user', 'bookedForUser']));

        $this->broadcastChange('created', $booking);

        return response()->json($booking->load(['user', 'room']), 201);
    }

    public function show(Booking $booking): JsonResponse
    {
        return response()->json($booking->load(['user', 'room']));
    }

    public function update(Request $request, Booking $booking): JsonResponse
    {
        $role = $request->user()->role;
        $isPrivileged = in_array($role, ['admin', 'receptionist']);
        $isOwner      = $booking->user_id === $request->user()->id;
        $isRecipient  = $booking->booked_for_user_id !== null && $booking->booked_for_user_id === $request->user()->id;

        if (!$isOwner && !$isRecipient && !$isPrivileged) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'room_id'     => 'sometimes|exists:rooms,id',
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

        // A recipient (booking made FOR them, not BY them) can edit the meeting details
        // but cannot reassign who the booking is for — only the owner or a privileged user can.
        if ($isRecipient && !$isOwner && !$isPrivileged) {
            unset($data['booked_for'], $data['booked_for_user_id']);
        }

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
            return response()->json(['message' => 'Room is not available at this time. Someone may have just booked it.'], 422);
        }

        $becomingCancelled = isset($data['status']) && $data['status'] === 'cancelled'
            && $booking->status !== 'cancelled';

        if ($becomingCancelled) {
            $data['cancelled_at'] = now();
        }

        $booking->update($data);

        if ($becomingCancelled) {
            $this->notifyCancelRecipient($booking, $request);
            $this->logCancellation($booking);
        }

        $this->broadcastChange('updated', $booking);

        return response()->json($booking->load(['user', 'room']));
    }

    public function destroy(Request $request, Booking $booking): JsonResponse
    {
        if ($booking->user_id !== $request->user()->id && $request->user()->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $booking->update(['status' => 'cancelled', 'cancelled_at' => now()]);
        $this->notifyCancelRecipient($booking, $request);
        $this->logCancellation($booking);
        $this->broadcastChange('updated', $booking);
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

        $this->broadcastChange('updated');

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
            $this->notifyCancelRecipient($booking, $request);
        }

        \App\Models\ActivityLog::record(
            'booking.cancelled',
            "Cancelled recurring series \"{$first->title}\" ({$bookings->count()} bookings)",
            $first,
            ['series_id' => $seriesId, 'count' => $bookings->count(), 'title' => $first->title],
        );

        $this->broadcastChange('updated');

        return response()->json(['cancelled' => $bookings->count()]);
    }

    public function clearCancelled(Request $request): JsonResponse
    {
        Booking::where('user_id', $request->user()->id)
            ->where('status', 'cancelled')
            ->delete();

        $this->broadcastChange('cleared');

        return response()->json(['message' => 'Cleared successfully']);
    }
}
