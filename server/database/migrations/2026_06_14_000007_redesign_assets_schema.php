<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Redesign assets → master registry only (no room, no unit-level fields)
        Schema::table('assets', function (Blueprint $table) {
            $table->dropForeign(['room_id']);
            $table->dropColumn(['room_id', 'serial_number', 'quantity', 'status']);
            $table->string('icon')->nullable()->after('category');
        });

        // Individual units — each unit can be in one room (or unassigned)
        Schema::create('asset_units', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();
            $table->foreignId('room_id')->nullable()->constrained()->nullOnDelete();
            $table->string('unit_code')->nullable();
            $table->enum('status', ['active', 'rusak', 'service', 'hilang', 'indent'])->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_units');
        Schema::table('assets', function (Blueprint $table) {
            $table->dropColumn(['icon']);
            $table->foreignId('room_id')->nullable()->constrained()->nullOnDelete();
            $table->string('serial_number')->nullable();
            $table->integer('quantity')->default(1);
            $table->enum('status', ['active', 'rusak', 'service', 'hilang', 'indent'])->default('active');
        });
    }
};
