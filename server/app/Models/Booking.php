<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Booking extends Model
{
    protected $fillable = [
        'user_id',
        'room_id',
        'title',
        'description',
        'start_at',
        'end_at',
        'status',
        'type',
        'cancelled_at',
        'cancel_reason',
        'dispute_status',
        'dispute_note',
        'disputed_at',
        'dispute_resolved_at',
        'dispute_resolved_by',
        'series_id',
        'series_skipped_dates',
        'resolves_series_id',
        'resolves_skipped_date',
        'booked_for',
        'booked_for_user_id',
        'archived_at',
        'reminder_sent',
        'presence_confirmed_at',
        'm365_event_id',
    ];

    protected function casts(): array
    {
        return [
            'start_at'              => 'datetime',
            'end_at'                => 'datetime',
            'cancelled_at'          => 'datetime',
            'disputed_at'           => 'datetime',
            'dispute_resolved_at'   => 'datetime',
            'archived_at'           => 'datetime',
            'presence_confirmed_at' => 'datetime',
            'series_skipped_dates'  => 'array',
            'resolves_skipped_date' => 'date:Y-m-d',
            'reminder_sent'         => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function bookedForUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'booked_for_user_id');
    }

    /**
     * A signed, expiring link to the public booking-action page (view details,
     * confirm presence, cancel) — safe to put in an email since the signature
     * itself is the authorization, not a guessable numeric id.
     */
    public function publicActionUrl(int $hours = 48): string
    {
        $signed = \Illuminate\Support\Facades\URL::temporarySignedRoute(
            'public.bookings.show',
            now()->addHours($hours),
            ['booking' => $this->id],
        );
        $query = parse_url($signed, PHP_URL_QUERY);
        $frontendUrl = rtrim(env('FRONTEND_URL', 'http://localhost:5173'), '/');
        return "{$frontendUrl}/booking/{$this->id}?{$query}";
    }
}
