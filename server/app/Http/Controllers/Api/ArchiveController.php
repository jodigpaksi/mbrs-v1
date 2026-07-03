<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Setting;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\IOFactory;

class ArchiveController extends Controller
{
    // ── Helpers ──────────────────────────────────────────────────────────────

    public static function getSettings(): array
    {
        $get = fn(string $key, string $default) => Setting::where('key', $key)->value('value') ?? $default;
        return [
            'archive_after_days'        => (int)  $get('archive_after_days', '30'),
            'archive_delete_after_days' => (int)  $get('archive_delete_after_days', '90'),
        ];
    }

    public static function bookingColumns(): array
    {
        return [
            'ID', 'Title', 'Description', 'Status', 'Type',
            'Start Date', 'Start Time', 'End Time',
            'Room', 'Floor', 'Building',
            'Booked By', 'Booked By Email', 'Booked For',
            'Series ID', 'Archived At',
        ];
    }

    public static function bookingRow(Booking $b): array
    {
        return [
            $b->id,
            $b->title,
            $b->description ?? '',
            $b->status,
            $b->type ?? '',
            $b->start_at?->toDateString(),
            $b->start_at?->format('H:i'),
            $b->end_at?->format('H:i'),
            $b->room?->name ?? '',
            $b->room?->floor ?? '',
            $b->room?->building?->name ?? '',
            $b->user?->name ?? '',
            $b->user?->email ?? '',
            $b->booked_for ?? '',
            $b->series_id ?? '',
            $b->archived_at?->toDateString() ?? '',
        ];
    }

    // ── CRUD ─────────────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $query = Booking::with(['user', 'room.building'])
            ->whereNotNull('archived_at')
            ->orderBy('start_at', 'desc');

        if ($request->date_from) $query->whereDate('start_at', '>=', $request->date_from);
        if ($request->date_to)   $query->whereDate('start_at', '<=', $request->date_to);
        if ($request->search) {
            $s = '%' . $request->search . '%';
            $query->where(fn($q) => $q
                ->where('title', 'like', $s)
                ->orWhereHas('user', fn($q) => $q->where('name', 'like', $s))
                ->orWhereHas('room', fn($q) => $q->where('name', 'like', $s))
            );
        }

        $settings = self::getSettings();
        $total    = (clone $query)->count();
        $bookings = $query->paginate(50);
        $oldest   = Booking::whereNotNull('archived_at')->min('start_at');

        return response()->json([
            'data'       => $bookings->items(),
            'total'      => $total,
            'last_page'  => $bookings->lastPage(),
            'page'       => $bookings->currentPage(),
            'oldest'     => $oldest,
            'purge_date' => $oldest
                ? Carbon::parse($oldest)->addDays($settings['archive_delete_after_days'])->toDateString()
                : null,
            'settings'   => $settings,
        ]);
    }

    public function run(): JsonResponse
    {
        $settings      = self::getSettings();
        $archiveCutoff = Carbon::now()->subDays($settings['archive_after_days'])->startOfDay();
        $deleteCutoff  = Carbon::now()->subDays($settings['archive_delete_after_days'])->startOfDay();

        $purged   = Booking::whereNotNull('archived_at')->where('archived_at', '<', $deleteCutoff)->delete();
        $archived = Booking::whereNull('archived_at')->where('end_at', '<', $archiveCutoff)
            ->update(['archived_at' => Carbon::now()]);

        return response()->json(['archived' => $archived, 'purged' => $purged]);
    }

    public function restore(Booking $booking): JsonResponse
    {
        $booking->update(['archived_at' => null]);
        return response()->json(['success' => true]);
    }

    public function restoreAll(): JsonResponse
    {
        $count = Booking::whereNotNull('archived_at')->update(['archived_at' => null]);
        return response()->json(['restored' => $count]);
    }

    public function purge(): JsonResponse
    {
        $deleted = Booking::whereNotNull('archived_at')->delete();
        return response()->json(['deleted' => $deleted]);
    }

    // ── Import ───────────────────────────────────────────────────────────────

    public function import(Request $request): JsonResponse
    {
        $request->validate(['file' => 'required|file|mimes:xlsx,xls,csv|max:10240']);

        $path = $request->file('file')->store('tmp');
        $full = Storage::path($path);
        $ext  = strtolower($request->file('file')->getClientOriginalExtension());

        $rows = [];
        if ($ext === 'csv') {
            $handle = fopen($full, 'r');
            $header = fgetcsv($handle);
            while (($line = fgetcsv($handle)) !== false) {
                $rows[] = array_combine($header, $line);
            }
            fclose($handle);
        } else {
            $spreadsheet = IOFactory::load($full);
            $sheet       = $spreadsheet->getActiveSheet()->toArray(null, true, true, false);
            $header      = array_shift($sheet);
            foreach ($sheet as $line) {
                $rows[] = array_combine($header, $line);
            }
        }

        Storage::delete($path);

        $created = 0;
        $errors  = [];

        foreach ($rows as $i => $row) {
            $rowNum = $i + 2;
            try {
                // Resolve room by name + building
                $room = \App\Models\Room::where('name', trim($row['Room'] ?? ''))
                    ->when($row['Building'] ?? null, fn($q, $b) =>
                        $q->whereHas('building', fn($q) => $q->where('name', $b))
                    )->first();

                if (!$room) { $errors[] = "Row {$rowNum}: Room \"{$row['Room']}\" not found."; continue; }

                $user = \App\Models\User::where('email', trim($row['Booked By Email'] ?? ''))->first();
                if (!$user) { $errors[] = "Row {$rowNum}: User \"{$row['Booked By Email']}\" not found."; continue; }

                $date     = trim($row['Start Date'] ?? '');
                $startAt  = Carbon::parse("{$date} {$row['Start Time']}");
                $endAt    = Carbon::parse("{$date} {$row['End Time']}");

                Booking::create([
                    'title'       => $row['Title'] ?? 'Imported',
                    'description' => $row['Description'] ?? null,
                    'status'      => in_array($row['Status'], ['confirmed','pending','tentative','cancelled']) ? $row['Status'] : 'confirmed',
                    'type'        => $row['Type'] ?? null,
                    'start_at'    => $startAt,
                    'end_at'      => $endAt,
                    'room_id'     => $room->id,
                    'user_id'     => $user->id,
                    'booked_for'  => $row['Booked For'] ?? null,
                    'series_id'   => $row['Series ID'] ?? null,
                    'archived_at' => null,
                ]);
                $created++;
            } catch (\Exception $e) {
                $errors[] = "Row {$rowNum}: " . $e->getMessage();
            }
        }

        return response()->json(['created' => $created, 'errors' => $errors]);
    }

}
