<?php

namespace App\Http\Controllers\Concerns;

use App\Events\BookingChanged;
use App\Models\ActivityLog;
use App\Models\Booking;
use Carbon\Carbon;

/**
 * Shared by any controller that mutates bookings and needs to broadcast the
 * change to connected clients and/or log a cancellation — used by both the
 * authenticated BookingController and the public signed-link PublicBookingController.
 */
trait BroadcastsBookingChanges
{
    /**
     * Broadcast a booking change to connected clients. Wrapped so a Reverb
     * outage never breaks the booking request itself.
     */
    private function broadcastChange(string $action, ?Booking $booking = null): void
    {
        try {
            $date = $booking ? Carbon::parse($booking->start_at)->format('Y-m-d') : null;
            BookingChanged::dispatch($action, $booking?->id, $date);
        } catch (\Throwable $e) {
            report($e);
        }
    }

    private function logCancellation(Booking $booking, string $suffix = ''): void
    {
        $room = $booking->room?->name ?? $booking->load('room')->room?->name ?? 'a room';
        ActivityLog::record(
            'booking.cancelled',
            "Cancelled \"{$booking->title}\" in {$room} (" . Carbon::parse($booking->start_at)->format('d M, H:i') . ')' . $suffix,
            $booking,
            ['room' => $room, 'title' => $booking->title, 'start_at' => (string) $booking->start_at],
        );
    }
}
