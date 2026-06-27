<?php

namespace App\Console\Commands;

use App\Events\BookingChanged;
use App\Models\ActivityLog;
use App\Models\Booking;
use App\Models\Setting;
use Carbon\Carbon;
use Illuminate\Console\Command;

class ReleaseGhostBookings extends Command
{
    protected $signature   = 'bookings:release-ghosts';
    protected $description = 'Auto-cancel bookings that missed the kiosk presence-confirmation window';

    private const BUSINESS_TZ = 'Asia/Jakarta';

    private function localNow(): Carbon
    {
        return Carbon::parse(Carbon::now(self::BUSINESS_TZ)->format('Y-m-d H:i:s'));
    }

    public function handle(): void
    {
        if (Setting::where('key', 'anti_ghost_enabled')->value('value') !== 'true') return;
        if (Setting::where('key', 'anti_ghost_mode')->value('value') !== 'kiosk')   return;

        $windowAfter = (int) (Setting::where('key', 'anti_ghost_window_after')->value('value') ?? 10);

        $now      = $this->localNow();
        $cutoff   = $now->copy()->subMinutes($windowAfter);
        $today    = $now->toDateString();

        $ghosts = Booking::whereIn('status', ['confirmed', 'tentative'])
            ->whereNull('presence_confirmed_at')
            ->whereNull('archived_at')
            ->whereDate('start_at', $today)
            ->where('start_at', '<=', $cutoff)
            ->get();

        $count = 0;
        foreach ($ghosts as $booking) {
            $booking->update(['status' => 'cancelled', 'cancelled_at' => $now]);
            ActivityLog::record(
                'booking.ghost_released',
                "Ghost booking auto-cancelled: #{$booking->id} — {$booking->title}",
                $booking,
                ['room_id' => $booking->room_id, 'start_at' => $booking->start_at],
            );
            $count++;
        }

        if ($count > 0) {
            $this->info("Released {$count} ghost booking(s).");
            event(new BookingChanged('ghost_released', null, $today));
        }
    }
}
