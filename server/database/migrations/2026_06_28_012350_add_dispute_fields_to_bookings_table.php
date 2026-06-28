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
            $table->string('dispute_status')->nullable()->after('cancel_reason'); // pending|approved|rejected
            $table->text('dispute_note')->nullable()->after('dispute_status');
            $table->timestamp('disputed_at')->nullable()->after('dispute_note');
            $table->timestamp('dispute_resolved_at')->nullable()->after('disputed_at');
            $table->foreignId('dispute_resolved_by')->nullable()->constrained('users')->nullOnDelete()->after('dispute_resolved_at');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropForeign(['dispute_resolved_by']);
            $table->dropColumn(['dispute_status', 'dispute_note', 'disputed_at', 'dispute_resolved_at', 'dispute_resolved_by']);
        });
    }
};
