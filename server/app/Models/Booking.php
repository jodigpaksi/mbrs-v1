<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

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
        'series_id',
        'booked_for',
        'booked_for_user_id',
        'archived_at',
    ];

    protected function casts(): array
    {
        return [
            'start_at'     => 'datetime',
            'end_at'       => 'datetime',
            'cancelled_at' => 'datetime',
            'archived_at'  => 'datetime',
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

    public function pantryOrder(): HasOne
    {
        return $this->hasOne(PantryOrder::class);
    }
}
