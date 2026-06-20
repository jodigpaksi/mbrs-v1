<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AssetUnit extends Model
{
    protected $fillable = ['asset_id', 'room_id', 'unit_code', 'status', 'notes'];

    public function asset()
    {
        return $this->belongsTo(Asset::class);
    }

    public function room()
    {
        return $this->belongsTo(Room::class)->with('building');
    }
}
