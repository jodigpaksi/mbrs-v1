<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    protected $fillable = ['key', 'value'];

    /**
     * Fetch many keys in a single query instead of one Setting::where() per key.
     * Returns a plain array keyed by the requested key; missing keys are simply
     * absent (use `$map[$key] ?? $default` at the call site).
     */
    public static function getMany(array $keys): array
    {
        return static::whereIn('key', $keys)->pluck('value', 'key')->all();
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        return static::where('key', $key)->value('value') ?? $default;
    }

    public static function businessTz(): string
    {
        return static::get('business_timezone') ?? config('app.business_timezone', 'Asia/Jakarta');
    }
}
