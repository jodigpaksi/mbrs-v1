<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KioskConfig extends Model
{
    protected $fillable = ['name', 'slug', 'room_id', 'pin', 'theme', 'layout', 'resolution', 'active'];

    protected $casts = [
        'theme'      => 'array',
        'layout'     => 'array',
        'resolution' => 'array',
        'active'     => 'boolean',
    ];

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function getThemeAttribute($value): array
    {
        $v = $value ? json_decode($value, true) : [];
        return array_merge([
            'mode'    => 'dark',
            'accent'  => '#adee2b',
            'bg'      => '#0a0e1a',
            'surface' => '#141826',
            'text'    => '#ffffff',
        ], $v ?? []);
    }

    public function getLayoutAttribute($value): array
    {
        $v = $value ? json_decode($value, true) : [];
        return array_merge([
            'show_clock'       => true,
            'show_bookings'    => true,
            'show_book_btn'    => true,
            'show_confirm_btn' => false,
            'orientation'      => 'landscape',
            'book_btn_url'     => '',
            'upcoming_count'   => 2,
        ], $v ?? []);
    }

    public function getResolutionAttribute($value): array
    {
        $v = $value ? json_decode($value, true) : [];
        return array_merge([
            'preset' => 'ipad',
            'width'  => 1024,
            'height' => 768,
        ], $v ?? []);
    }
}
