<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('department')->default('GAA')->after('email');
            $table->enum('role', ['user', 'admin'])->default('user')->after('department');
            $table->string('ext')->nullable()->after('role');
            $table->string('avatar')->nullable()->after('ext');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['department', 'role', 'ext', 'avatar']);
        });
    }
};
