<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('locations', function (Blueprint $table) {
            $table->id();
            $table->string('name');        // e.g. Jakarta, Anyer
            $table->string('code')->nullable(); // e.g. JKT, ANY
            $table->timestamps();
        });

        Schema::table('buildings', function (Blueprint $table) {
            $table->foreignId('location_id')->nullable()->after('id')->constrained('locations')->nullOnDelete();
        });

        // Migrate existing address values → create location records
        $seen = [];
        foreach (DB::table('buildings')->whereNotNull('address')->get() as $b) {
            $addr = trim($b->address);
            if (!$addr) continue;
            if (!isset($seen[$addr])) {
                $seen[$addr] = DB::table('locations')->insertGetId(['name' => $addr, 'created_at' => now(), 'updated_at' => now()]);
            }
            DB::table('buildings')->where('id', $b->id)->update(['location_id' => $seen[$addr]]);
        }
    }

    public function down(): void
    {
        Schema::table('buildings', function (Blueprint $table) {
            $table->dropForeign(['location_id']);
            $table->dropColumn('location_id');
        });
        Schema::dropIfExists('locations');
    }
};
