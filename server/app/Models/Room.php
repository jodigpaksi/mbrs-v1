<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Room extends Model
{
    protected $fillable = [
        'name',
        'type',
        'capacity',
        'floor',
        'facilities',
        'photos',
        'notes',
        'is_active',
        'status',
        'requires_contact',
    ];

    protected function casts(): array
    {
        return [
            'facilities' => 'array',
            'photos' => 'array',
            'is_active' => 'boolean',
            'requires_contact' => 'boolean',
        ];
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }
}
