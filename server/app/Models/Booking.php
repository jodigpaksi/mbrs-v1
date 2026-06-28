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
        'booked_for',
        'booked_for_user_id',
        'archived_at',
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
            'series_skipped_dates'  => 'array',
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


}
