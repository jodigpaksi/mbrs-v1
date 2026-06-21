<?php

namespace App\Console\Commands;

use App\Models\Booking;
use App\Models\Setting;
use Carbon\Carbon;
use Illuminate\Console\Command;

class ArchiveBookings extends Command
{
    protected $signature   = 'bookings:archive';
    protected $description = 'Archive old bookings and purge bookings past the delete threshold';

    public function handle(): void
    {
        $result = app(\App\Http\Controllers\Api\ArchiveController::class)->run();
        $data   = json_decode($result->getContent(), true);
        $this->info("Archived: {$data['archived']} bookings. Purged: {$data['purged']} bookings.");
    }
}
