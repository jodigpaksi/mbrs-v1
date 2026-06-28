<?php

namespace App\Console\Commands;

use App\Events\BookingChanged;
use App\Models\ActivityLog;
use App\Models\Booking;
use App\Models\Notification;
use App\Models\Setting;
use Carbon\Carbon;
use Illuminate\Console\Command;

class ReleaseGhostBookings extends Command
{
    protected $signature   = 'bookings:release-ghosts';
    protected $description = 'Auto-cancel bookings that missed the kiosk presence-confirmation window';

    private static function businessTz(): string { return \App\Models\Setting::businessTz(); }

    private function localNow(): Carbon
    {
        return Carbon::parse(Carbon::now(self::businessTz())->format('Y-m-d H:i:s'));
    }

    public function handle(): void
    {
        if (Setting::where('key', 'anti_ghost_enabled')->value('value') !== 'true') return;

        $windowAfter = (int) (Setting::where('key', 'anti_ghost_window_after')->value('value') ?? 10);

        $now      = $this->localNow();
        $cutoff   = $now->copy()->subMinutes($windowAfter);
        $today    = $now->toDateString();

        $ghosts = Booking::whereIn('status', ['confirmed', 'tentative'])
            ->whereNull('presence_confirmed_at')
            ->whereNull('archived_at')
            ->whereDate('start_at', $today)
            ->where('start_at', '<=', $cutoff)
            ->where(fn ($q) => $q->whereNull('dispute_status')->orWhere('dispute_status', '!=', 'approved'))
            ->get();

        $count = 0;
        foreach ($ghosts as $booking) {
            $booking->load('room');
            $booking->update(['status' => 'cancelled', 'cancelled_at' => $now, 'cancel_reason' => 'ghost_release']);

            ActivityLog::record(
                'booking.ghost_released',
                "Ghost booking auto-cancelled: #{$booking->id} — {$booking->title}",
                $booking,
                ['room_id' => $booking->room_id, 'start_at' => $booking->start_at],
            );

            // Notify the relevant user (booked_for target if set, otherwise creator)
            $notifyUserId = $booking->booked_for_user_id ?? $booking->user_id;
            $roomName     = $booking->room?->name ?? 'the room';
            $timeStr      = Carbon::parse($booking->start_at)->format('H:i');
            Notification::create([
                'user_id'    => $notifyUserId,
                'booking_id' => $booking->id,
                'type'       => 'ghost_released',
                'message'    => "Your booking \"{$booking->title}\" at {$roomName} ({$timeStr}) was auto-cancelled — presence not confirmed in time.",
            ]);

            $count++;
        }

        if ($count > 0) {
            $this->info("Released {$count} ghost booking(s).");
            event(new BookingChanged('ghost_released', null, $today));
        }
    }
}
