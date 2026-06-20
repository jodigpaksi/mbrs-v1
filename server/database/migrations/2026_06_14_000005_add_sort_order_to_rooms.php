<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->unsignedInteger('sort_order')->default(0)->after('building_id');
        });

        // Seed initial sort_order per building based on current id order
        $rooms = DB::table('rooms')->orderBy('building_id')->orderBy('id')->get();
        $counter = [];
        foreach ($rooms as $room) {
            $bid = $room->building_id ?? 0;
            $counter[$bid] = ($counter[$bid] ?? 0) + 1;
            DB::table('rooms')->where('id', $room->id)->update(['sort_order' => $counter[$bid]]);
        }
    }

    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->dropColumn('sort_order');
        });
    }
};
