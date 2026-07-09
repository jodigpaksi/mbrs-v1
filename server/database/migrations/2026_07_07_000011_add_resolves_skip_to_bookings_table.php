<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->string('resolves_series_id', 36)->nullable()->after('series_skipped_dates');
            $table->date('resolves_skipped_date')->nullable()->after('resolves_series_id');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn(['resolves_series_id', 'resolves_skipped_date']);
        });
    }
};
