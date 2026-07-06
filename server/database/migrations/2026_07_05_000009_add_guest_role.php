<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::statement("ALTER TABLE users MODIFY role ENUM('user','admin','receptionist','building_admin','guest') NOT NULL DEFAULT 'user'");
    }

    public function down(): void
    {
        DB::table('users')->where('role', 'guest')->delete();
        DB::statement("ALTER TABLE users MODIFY role ENUM('user','admin','receptionist','building_admin') NOT NULL DEFAULT 'user'");
    }
};
