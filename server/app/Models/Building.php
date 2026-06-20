<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Building extends Model
{
    protected $fillable = [
        'name', 'code', 'address', 'floors', 'photo', 'notes', 'is_active', 'location_id',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'floors'    => 'integer',
    ];

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function rooms(): HasMany
    {
        return $this->hasMany(Room::class);
    }
}
