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
        Schema::table('bookings', function (Blueprint $table) {
            // Day/week/month listing (BookingController::index) filters on start_at alone (no
            // room_id) for the common "all rooms on this date" case.
            $table->index('start_at');
            // Conflict checks (RoomController::availability, BookingController::store/update) always
            // filter by room_id first, then the start_at/end_at overlap range.
            $table->index(['room_id', 'start_at', 'end_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropIndex(['start_at']);
            $table->dropIndex(['room_id', 'start_at', 'end_at']);
        });
    }
};
