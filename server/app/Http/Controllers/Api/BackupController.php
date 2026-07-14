<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Booking;
use App\Models\Building;
use App\Models\Room;
use App\Models\Setting;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

class BackupController extends Controller
{
    public static function getSettings(): array
    {
        $m = Setting::getMany([
            'backup_enabled', 'backup_frequency', 'backup_time', 'backup_day_of_week',
            'backup_day_of_month', 'backup_formats', 'backup_include_archive',
            'backup_include_log', 'backup_include_data',
        ]);
        $get = fn(string $key, string $default) => $m[$key] ?? $default;
        return [
            'backup_enabled'         =>        $get('backup_enabled', 'false') === 'true',
            'backup_frequency'       =>        $get('backup_frequency', 'weekly'),
            'backup_time'            =>        $get('backup_time', '02:00'),
            'backup_day_of_week'     => (int)  $get('backup_day_of_week', '1'),
            'backup_day_of_month'    => (int)  $get('backup_day_of_month', '1'),
            'backup_formats'         => array_filter(explode(',', $get('backup_formats', 'excel,csv'))),
            'backup_include_archive' =>        $get('backup_include_archive', 'true') === 'true',
            'backup_include_log'     =>        $get('backup_include_log', 'true') === 'true',
            'backup_include_data'    =>        $get('backup_include_data', 'true') === 'true',
        ];
    }

    private static function userColumns(): array
    {
        return ['Name', 'Email', 'Alias', 'Department', 'Department Location', 'Role', 'Ext', 'Default Building', 'Assigned Buildings'];
    }

    private static function userRow(User $u): array
    {
        return [
            $u->name,
            $u->email,
            $u->alias ?? '',
            $u->department?->name ?? '',
            $u->department?->location?->name ?? '',
            $u->role,
            $u->ext ?? '',
            $u->defaultBuilding?->name ?? '',
            $u->adminBuildings->pluck('name')->implode(', '),
        ];
    }

    private static function buildingColumns(): array
    {
        return ['Name', 'Code', 'Location', 'Address', 'Floors', 'Notes', 'Active'];
    }

    private static function buildingRow(Building $b): array
    {
        return [
            $b->name,
            $b->code ?? '',
            $b->location?->name ?? '',
            $b->address ?? '',
            (string) $b->floors,
            $b->notes ?? '',
            $b->is_active ? 'yes' : 'no',
        ];
    }

    private static function roomColumns(): array
    {
        return ['Name', 'Building', 'Capacity', 'Floor', 'Facilities', 'Notes', 'Active', 'Status', 'Requires Contact'];
    }

    private static function roomRow(Room $r): array
    {
        return [
            $r->name,
            $r->building?->name ?? '',
            (string) $r->capacity,
            $r->floor,
            collect($r->facilities ?? [])->pluck('name')->implode(', '),
            $r->notes ?? '',
            $r->is_active ? 'yes' : 'no',
            $r->status,
            $r->requires_contact ? 'yes' : 'no',
        ];
    }

    private static function writeCsv(string $path, array $cols, iterable $rows, callable $rowFn): void
    {
        $handle = fopen(Storage::path($path), 'w');
        fputcsv($handle, $cols);
        foreach ($rows as $row) fputcsv($handle, $rowFn($row));
        fclose($handle);
    }

    private static function writeExcel(string $path, array $cols, iterable $rows, callable $rowFn): void
    {
        $spreadsheet = new Spreadsheet();
        $sheet       = $spreadsheet->getActiveSheet();
        $sheet->fromArray([$cols], null, 'A1');
        $rowIdx = 2;
        foreach ($rows as $row) {
            $sheet->fromArray([$rowFn($row)], null, "A{$rowIdx}");
            $rowIdx++;
        }
        $sheet->getStyle('A1:' . $sheet->getHighestColumn() . '1')->getFont()->setBold(true);
        (new Xlsx($spreadsheet))->save(Storage::path($path));
    }

    // ── Scheduled export (called by command + manual) — one batch, multiple content types ──

    public static function generateExports(array $formats, array $include, string $label = ''): array
    {
        if (!$label) $label = Carbon::now()->format('Y-m-d_His');
        $dir = "exports/backup/{$label}";
        Storage::makeDirectory($dir);

        $files = [];

        if ($include['archive'] ?? false) {
            $bookings = Booking::with(['user', 'room.building'])
                ->whereNotNull('archived_at')
                ->orderBy('start_at', 'desc')
                ->get();
            $cols  = ArchiveController::bookingColumns();
            $rowFn = fn (Booking $b) => ArchiveController::bookingRow($b);

            if (in_array('csv', $formats)) {
                $path = "{$dir}/archive_{$label}.csv";
                self::writeCsv($path, $cols, $bookings, $rowFn);
                $files[] = $path;
            }
            if (in_array('excel', $formats)) {
                $path = "{$dir}/archive_{$label}.xlsx";
                self::writeExcel($path, $cols, $bookings, $rowFn);
                $files[] = $path;
            }
            if (in_array('pdf', $formats)) {
                $path = "{$dir}/archive_{$label}.pdf";
                $rows = $bookings->map($rowFn)->toArray();
                Pdf::loadView('exports.archive', ['cols' => $cols, 'rows' => $rows, 'label' => $label])
                    ->setPaper('a4', 'landscape')
                    ->save(Storage::path($path));
                $files[] = $path;
            }
        }

        if ($include['log'] ?? false) {
            $logs = ActivityLog::with('user:id,name,role')->latest('created_at')->get();
            $path = "{$dir}/activity-log_{$label}.txt";
            Storage::put($path, ActivityLogController::generateTxtContent($logs, 'All'));
            $files[] = $path;
        }

        if ($include['data'] ?? false) {
            $entities = [
                'users'     => [self::userColumns(),     User::with('department.location', 'defaultBuilding', 'adminBuildings')->orderBy('role')->orderBy('name')->get(),  fn (User $u) => self::userRow($u)],
                'buildings' => [self::buildingColumns(), Building::with('location')->orderBy('name')->get(),                                                              fn (Building $b) => self::buildingRow($b)],
                'rooms'     => [self::roomColumns(),     Room::with('building')->orderBy('sort_order')->orderBy('id')->get(),                                             fn (Room $r) => self::roomRow($r)],
            ];

            foreach ($entities as $name => [$cols, $rows, $rowFn]) {
                if (in_array('csv', $formats)) {
                    $path = "{$dir}/{$name}_{$label}.csv";
                    self::writeCsv($path, $cols, $rows, $rowFn);
                    $files[] = $path;
                }
                if (in_array('excel', $formats)) {
                    $path = "{$dir}/{$name}_{$label}.xlsx";
                    self::writeExcel($path, $cols, $rows, $rowFn);
                    $files[] = $path;
                }
            }
        }

        ActivityLog::record(
            'data.exported',
            'Auto backup exported (' . implode(', ', array_keys(array_filter($include))) . ')',
            null,
            ['type' => 'backup', 'label' => $label, 'files' => count($files)],
        );

        return $files;
    }

    // ── Exports listing + download ──────────────────────────────────────────

    public function listExports(): JsonResponse
    {
        $dirs = Storage::directories('exports/backup');
        $exports = [];
        foreach ($dirs as $dir) {
            $files = Storage::files($dir);
            if (empty($files)) continue;
            $label = basename($dir);
            $exports[] = [
                'label'      => $label,
                'files'      => array_map(fn ($f) => [
                    'path' => $f,
                    'name' => basename($f),
                    'size' => Storage::size($f),
                ], $files),
                'created_at' => Storage::lastModified($files[0]),
            ];
        }
        usort($exports, fn ($a, $b) => $b['created_at'] - $a['created_at']);
        return response()->json($exports);
    }

    public function deleteAllExports(): JsonResponse
    {
        $dirs = Storage::directories('exports/backup');
        foreach ($dirs as $dir) {
            Storage::deleteDirectory($dir);
        }
        return response()->json(['deleted' => count($dirs)]);
    }

    public function downloadExport(Request $request): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $path = $request->query('path');
        abort_unless($path && str_starts_with($path, 'exports/backup/') && Storage::exists($path), 404);
        return Storage::download($path, basename($path));
    }

    public function runExport(Request $request): JsonResponse
    {
        $formats = $request->input('formats', ['excel', 'csv']);
        $include = $request->input('include', ['archive' => true, 'log' => true, 'data' => true]);
        $files   = self::generateExports($formats, $include);
        return response()->json(['files' => count($files)]);
    }
}
