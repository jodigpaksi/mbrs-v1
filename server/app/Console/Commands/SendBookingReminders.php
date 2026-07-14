<?php

namespace App\Console\Commands;

use App\Mail\BookingReminder;
use App\Models\Booking;
use App\Models\Setting;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

class SendBookingReminders extends Command
{
    protected $signature   = 'bookings:send-reminders';
    protected $description = 'Send email reminders for bookings starting soon';

    public function handle(): void
    {
        $settings = Setting::getMany(['reminder_enabled', 'reminder_minutes']);

        // Default enabled (missing key = never configured yet, not explicitly disabled) so
        // reminders keep working for existing installs after this setting was introduced.
        if (($settings['reminder_enabled'] ?? null) === 'false') {
            return;
        }

        $reminderMinutes = (int) ($settings['reminder_minutes'] ?? env('BOOKING_REMINDER_MINUTES', 10));

        $now      = Setting::localNow();
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
