<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    protected $fillable = ['key', 'value'];

    public static function businessTz(): string
    {
        return static::where('key', 'business_timezone')->value('value')
            ?? config('app.business_timezone', 'Asia/Jakarta');
    }
}
