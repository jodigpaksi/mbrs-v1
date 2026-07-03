<?php

namespace App\Mail;

use App\Models\Booking;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class BookingReminder extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly Booking $booking,
        public readonly User $recipient,
    ) {}

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
