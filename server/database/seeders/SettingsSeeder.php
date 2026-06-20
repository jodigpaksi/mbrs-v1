<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingsSeeder extends Seeder
{
    public function run(): void
    {
        Setting::upsert([
            ['key' => 'booking_start_time', 'value' => '07:00', 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'booking_end_time',   'value' => '19:00', 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'weekend_saturday',   'value' => 'true',  'created_at' => now(), 'updated_at' => now()],
            ['key' => 'weekend_sunday',     'value' => 'true',  'created_at' => now(), 'updated_at' => now()],
        ], ['key'], ['value', 'updated_at']);
    }
}
