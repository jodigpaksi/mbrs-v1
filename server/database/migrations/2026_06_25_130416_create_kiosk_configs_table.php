<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('kiosk_configs', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->foreignId('room_id')->nullable()->constrained()->nullOnDelete();
            $table->string('pin', 20)->nullable();
            $table->json('theme')->nullable();    // { mode, accent, bg, surface, text }
            $table->json('layout')->nullable();   // { show_clock, show_bookings, show_book_btn, orientation, book_btn_url }
            $table->json('resolution')->nullable(); // { preset, width, height }
            $table->boolean('active')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('kiosk_configs');
    }
};
