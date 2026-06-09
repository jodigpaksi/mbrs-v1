<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PantryOrder extends Model
{
    protected $fillable = [
        'booking_id',
        'items',
        'special_request',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'items' => 'array',
        ];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }
}
