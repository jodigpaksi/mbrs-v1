<?php

namespace App\Console\Commands;

use App\Mail\BookingReminder;
use App\Models\Booking;
use App\Models\Setting;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

class SendBookingReminders extends Command
{
    protected $signature   = 'bookings:send-reminders';
    protected $description = 'Send email reminders for bookings starting soon';

    private static function businessTz(): string { return Setting::businessTz(); }

    private function localNow(): Carbon
    {
        return Carbon::parse(Carbon::now(self::businessTz())->format('Y-m-d H:i:s'));
    }

    public function handle(): void
    {
        $reminderMinutes = (int) (Setting::where('key', 'reminder_minutes')->value('value')
            ?? env('BOOKING_REMINDER_MINUTES', 10));

        $now      = $this->localNow();
        $windowEnd = $now->copy()->addMinutes($reminderMinutes);

        $bookings = Booking::whereIn('status', ['confirmed', 'tentative'])
            ->where('reminder_sent', false)
            ->whereNull('archived_at')
            ->whereNull('cancelled_at')
            ->where('start_at', '>', $now)
            ->where('start_at', '<=', $windowEnd)
            ->with(['user', 'bookedForUser', 'room.building'])
            ->get();

        $count = 0;
        foreach ($bookings as $booking) {
            $recipient = $booking->bookedForUser ?? $booking->user;

            if (!$recipient || !$recipient->email) {
                $booking->update(['reminder_sent' => true]);
                continue;
            }

            try {
                Mail::to($recipient->email)->send(new BookingReminder($booking, $recipient));
                $booking->update(['reminder_sent' => true]);
                $count++;
            } catch (\Throwable $e) {
                $this->error("Failed to send reminder for booking #{$booking->id}: {$e->getMessage()}");
            }
        }

        if ($count > 0) {
            $this->info("Sent {$count} booking reminder(s).");
        }
    }
}
