<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Asset extends Model
{
    protected $fillable = ['name', 'category', 'icon', 'notes'];

    public function units()
    {
        return $this->hasMany(AssetUnit::class)->with('room');
    }
}
