<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::statement("ALTER TABLE bookings MODIFY COLUMN type ENUM('internal','external','maintenance','repairment') NOT NULL DEFAULT 'internal'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE bookings MODIFY COLUMN type ENUM('internal','external') NOT NULL DEFAULT 'internal'");
    }
};
