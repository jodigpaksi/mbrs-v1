<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // MySQL: change enum column to nullable string to drop type requirement
        DB::statement("ALTER TABLE rooms MODIFY COLUMN `type` VARCHAR(20) NULL");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE rooms MODIFY COLUMN `type` ENUM('Ballroom','Executive','Focus') NOT NULL");
    }
};
