<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add FK column
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('department_id')->nullable()->after('department')->constrained('departments')->nullOnDelete();
        });

        // Seed departments from distinct existing values
        $names = DB::table('users')
            ->select('department')
            ->distinct()
            ->whereNotNull('department')
            ->where('department', '!=', '')
            ->pluck('department');

        foreach ($names as $name) {
            $id = DB::table('departments')->insertGetId([
                'name'       => $name,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            DB::table('users')->where('department', $name)->update(['department_id' => $id]);
        }

        // Drop old free-text column
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('department');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('department')->default('')->after('email');
        });

        // Re-populate from join
        DB::table('users')
            ->join('departments', 'users.department_id', '=', 'departments.id')
            ->update(['users.department' => DB::raw('departments.name')]);

        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['department_id']);
            $table->dropColumn('department_id');
        });
    }
};
