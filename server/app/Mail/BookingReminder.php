<?php

namespace App\Mail;

use App\Models\Booking;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class BookingReminder extends Mailable
{
    use Queueable, SerializesModels;

    public readonly string $actionUrl;
    public readonly bool $showActions;

    public function __construct(
        public readonly Booking $booking,
        public readonly User $recipient,
    ) {
        $this->actionUrl = $booking->publicActionUrl();
        $antiGhostEnabled = Setting::where('key', 'anti_ghost_enabled')->value('value') === 'true';
        $emailMethodEnabled = Setting::where('key', 'anti_ghost_email_enabled')->value('value') === 'true';
        $this->showActions = $booking->room->requires_contact || ($antiGhostEnabled && $emailMethodEnabled);
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Reminder: ' . $this->booking->title . ' starts soon',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.booking-reminder',
        );
    }
}
