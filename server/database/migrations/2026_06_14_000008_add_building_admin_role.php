<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Extend role enum to include building_admin
        DB::statement("ALTER TABLE users MODIFY role ENUM('user','admin','receptionist','building_admin') NOT NULL DEFAULT 'user'");

        Schema::create('admin_buildings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('building_id')->constrained()->cascadeOnDelete();
            $table->unique(['user_id', 'building_id']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_buildings');
        DB::statement("ALTER TABLE users MODIFY role ENUM('user','admin','receptionist') NOT NULL DEFAULT 'user'");
    }
};
