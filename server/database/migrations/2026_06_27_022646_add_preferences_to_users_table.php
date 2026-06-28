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
        Schema::table('users', function (Blueprint $table) {
            $table->json('preferences')->nullable()->after('can_book_special');
            $table->unsignedBigInteger('default_building_id')->nullable()->after('preferences');
            $table->foreign('default_building_id')->references('id')->on('buildings')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['default_building_id']);
            $table->dropColumn(['preferences', 'default_building_id']);
        });
    }
};
