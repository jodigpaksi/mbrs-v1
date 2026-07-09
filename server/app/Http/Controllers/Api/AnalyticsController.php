<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Booking;
use App\Models\Room;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\Chart\Chart;
use PhpOffice\PhpSpreadsheet\Chart\DataSeries;
use PhpOffice\PhpSpreadsheet\Chart\DataSeriesValues;
use PhpOffice\PhpSpreadsheet\Chart\Legend;
use PhpOffice\PhpSpreadsheet\Chart\PlotArea;
use PhpOffice\PhpSpreadsheet\Chart\Title;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

class AnalyticsController extends Controller
{
    public function overview(Request $request): JsonResponse
    {
        $period = (int) ($request->query('period', 7));
        if (!in_array($period, [7, 30])) $period = 7;

        $statusPeriod = $request->query('status_period', 'month');
        $roomsPeriod  = $request->query('rooms_period',  'month');
        $hoursPeriod  = $request->query('hours_period',  'month');
        $buildingId   = $request->query('building_id') ? (int) $request->query('building_id') : null;

        $tz    = \App\Models\Setting::businessTz();
        $today = now($tz)->toDateString();
        $weekStart  = now($tz)->startOfWeek()->toDateTimeString();
        $monthStart = now($tz)->startOfMonth()->toDateTimeString();

        // Closure to scope bookings by building when needed
        $byBuilding = fn ($q) => $q->when($buildingId, fn ($q2) => $q2->whereHas('room', fn ($r) => $r->where('building_id', $buildingId)));

        $statusCounts = $byBuilding(Booking::query())
            ->selectRaw("COUNT(*) as total, SUM(status = 'confirmed') as confirmed, SUM(status = 'tentative') as tentative, SUM(status = 'cancelled') as cancelled")
            ->first();

        // Unique-visitor counts are always global (not per building) — one query with
        // conditional date buckets instead of 4 separate distinct-count queries.
        $visitorCounts = ActivityLog::whereNotNull('user_id')
            ->selectRaw(
                'COUNT(DISTINCT CASE WHEN created_at >= ? THEN user_id END) as today,
                 COUNT(DISTINCT CASE WHEN created_at >= ? THEN user_id END) as week,
                 COUNT(DISTINCT CASE WHEN created_at >= ? THEN user_id END) as month,
                 COUNT(DISTINCT user_id) as all_time',
                [$today . ' 00:00:00', $weekStart, $monthStart]
            )->first();

        $stats = [
            'total_bookings' => (int) $statusCounts->total,
            'confirmed'      => (int) $statusCounts->confirmed,
            'tentative'      => (int) $statusCounts->tentative,
            'cancelled'      => (int) $statusCounts->cancelled,
            'active_rooms'   => Room::where('is_active', true)
                ->when($buildingId, fn ($q) => $q->where('building_id', $buildingId))
                ->count(),
            'total_users'    => User::count(),

            'unique_visitors_today' => (int) $visitorCounts->today,
            'unique_visitors_week'  => (int) $visitorCounts->week,
            'unique_visitors_month' => (int) $visitorCounts->month,
            'unique_visitors_all'   => (int) $visitorCounts->all_time,

            // Storage: always global
            'storage' => $this->storageStats(),
        ];

        $trend = $byBuilding(Booking::query())
            ->selectRaw('DATE(start_at) as date, COUNT(*) as count')
            ->where('start_at', '>=', now()->subDays($period))
            ->groupByRaw('DATE(start_at)')
            ->orderBy('date')
            ->get()
            ->map(fn ($r) => ['date' => $r->date, 'count' => (int) $r->count]);

        $topRooms = $byBuilding(Booking::query())
            ->selectRaw('rooms.name as room, COUNT(*) as count')
            ->join('rooms', 'bookings.room_id', '=', 'rooms.id')
            ->when($roomsPeriod === 'month', fn ($q) => $q->where('bookings.start_at', '>=', $monthStart))
            ->groupBy('rooms.id', 'rooms.name')
            ->orderByDesc('count')
            ->limit(5)
            ->get()
            ->map(fn ($r) => ['room' => $r->room, 'count' => (int) $r->count]);

        $statusBreakdown = $byBuilding(Booking::query())
            ->selectRaw('status, COUNT(*) as count')
            ->when($statusPeriod === 'month', fn ($q) => $q->where('start_at', '>=', $monthStart))
            ->groupBy('status')
            ->get()
            ->map(fn ($r) => ['status' => $r->status, 'count' => (int) $r->count]);

        $peakHours = $byBuilding(Booking::query())
            ->selectRaw('HOUR(start_at) as hour, COUNT(*) as count')
            ->when($hoursPeriod === 'month', fn ($q) => $q->where('start_at', '>=', $monthStart))
            ->groupByRaw('HOUR(start_at)')
            ->orderBy('hour')
            ->get()
            ->map(fn ($r) => ['hour' => (int) $r->hour, 'count' => (int) $r->count]);

        return response()->json([
            'stats'            => $stats,
            'trend'            => $trend,
            'top_rooms'        => $topRooms,
            'status_breakdown' => $statusBreakdown,
            'peak_hours'       => $peakHours,
        ]);
    }

    private function storageStats(): array
    {
        // DB size (MySQL) — excludes activity_logs, which is broken out separately as "Logs"
        // below so the Admin Overview chart tracks what "Clear All" on the Activity Log actually affects.
        $dbRow = DB::selectOne("
            SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS mb
            FROM information_schema.tables
            WHERE table_schema = DATABASE() AND table_name != 'activity_logs'
        ");
        $dbMb = (float) ($dbRow->mb ?? 0);

        // Activity log table size (MySQL) — reflects Activity Log "Clear All", unlike the
        // old measurement which read storage/logs/*.log files that Clear All never touched.
        $logsRow = DB::selectOne("
            SELECT ROUND((data_length + index_length) / 1024 / 1024, 2) AS mb
            FROM information_schema.tables
            WHERE table_schema = DATABASE() AND table_name = 'activity_logs'
        ");
        $logsMb = (float) ($logsRow->mb ?? 0);

        // File storage folders
        $disk       = Storage::disk('public');
        $basePath   = $disk->path('');

        $roomMb   = $this->folderMb($basePath . DIRECTORY_SEPARATOR . 'room-photos');
        $avatarMb = $this->folderMb($basePath . DIRECTORY_SEPARATOR . 'avatars');
        $totalUploadsMb = $this->folderMb($basePath);

        return [
            'db_mb'           => $dbMb,
            'room_photos_mb'  => $roomMb,
            'avatars_mb'      => $avatarMb,
            'uploads_mb'      => $totalUploadsMb,
            'logs_mb'         => $logsMb,
        ];
    }

    private function folderMb(string $path): float
    {
        if (! is_dir($path)) return 0.0;
        $bytes = 0;
        $it = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($path, \FilesystemIterator::SKIP_DOTS)
        );
        foreach ($it as $file) {
            if ($file->isFile()) $bytes += $file->getSize();
        }
        return round($bytes / 1024 / 1024, 2);
    }

    public function report(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from'        => 'nullable|date',
            'to'          => 'nullable|date',
            'room_id'     => 'nullable|integer|exists:rooms,id',
            'building_id' => 'nullable|integer|exists:buildings,id',
            'dept_id'     => 'nullable|integer|exists:departments,id',
            'page'        => 'nullable|integer|min:1',
        ]);

        $q = Booking::with(['room', 'user'])
            ->when($data['from'] ?? null, fn ($q, $v) => $q->whereDate('start_at', '>=', $v))
            ->when($data['to'] ?? null, fn ($q, $v) => $q->whereDate('start_at', '<=', $v))
            ->when($data['room_id'] ?? null, fn ($q, $v) => $q->where('room_id', $v))
            ->when($data['building_id'] ?? null, fn ($q, $v) => $q->whereHas('room', fn ($r) => $r->where('building_id', $v)))
            ->when($data['dept_id'] ?? null, fn ($q, $v) => $q->whereHas('user', fn ($u) => $u->where('department_id', $v)))
            ->orderByDesc('start_at');

        $summaryRow = (clone $q)->reorder()->selectRaw(
            "COUNT(*) as total, SUM(status = 'confirmed') as confirmed, SUM(status = 'cancelled') as cancelled, COUNT(DISTINCT user_id) as unique_users, COUNT(DISTINCT room_id) as unique_rooms"
        )->first();
        $summary = [
            'total'        => (int) $summaryRow->total,
            'confirmed'    => (int) $summaryRow->confirmed,
            'cancelled'    => (int) $summaryRow->cancelled,
            'unique_users' => (int) $summaryRow->unique_users,
            'unique_rooms' => (int) $summaryRow->unique_rooms,
        ];

        $page      = max(1, (int) ($data['page'] ?? 1));
        $paginated = $q->paginate(50, ['*'], 'page', $page);

        return response()->json([
            'summary' => $summary,
            'data'    => collect($paginated->items())->map(fn ($b) => [
                'id'       => $b->id,
                'title'    => $b->title,
                'status'   => $b->status,
                'type'     => $b->type,
                'start_at' => $b->start_at,
                'end_at'   => $b->end_at,
                'room'     => $b->room ? ['id' => $b->room->id, 'name' => $b->room->name] : null,
                'user'     => $b->user ? ['id' => $b->user->id, 'name' => $b->user->name, 'department_name' => $b->user->department_name] : null,
            ]),
            'meta'    => [
                'current_page' => $paginated->currentPage(),
                'last_page'    => $paginated->lastPage(),
                'total'        => $paginated->total(),
            ],
        ]);
    }

    public function export(Request $request): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $data = $request->validate([
            'from'          => 'nullable|date',
            'to'            => 'nullable|date',
            'building_ids'  => 'nullable|array',
            'building_ids.*'=> 'integer',
        ]);

        $from        = $data['from'] ?? null;
        $to          = $data['to']   ?? null;
        $buildingIds = !empty($data['building_ids']) ? $data['building_ids'] : null;

        $baseQ = fn () => Booking::query()
            ->when($from, fn ($q) => $q->whereDate('start_at', '>=', $from))
            ->when($to,   fn ($q) => $q->whereDate('start_at', '<=', $to))
            ->when($buildingIds, fn ($q) => $q->whereHas('room', fn ($r) => $r->whereIn('building_id', $buildingIds)));

        // ── Summary (one query instead of six) ──────────────────────────────────────
        $summaryRow = (clone $baseQ())->selectRaw(
            "COUNT(*) as total, SUM(status = 'confirmed') as confirmed, SUM(status = 'tentative') as tentative, SUM(status = 'cancelled') as cancelled, COUNT(DISTINCT room_id) as unique_rooms, COUNT(DISTINCT user_id) as unique_users"
        )->first();
        $total       = (int) $summaryRow->total;
        $confirmed   = (int) $summaryRow->confirmed;
        $tentative   = (int) $summaryRow->tentative;
        $cancelled   = (int) $summaryRow->cancelled;
        $uniqueRooms = (int) $summaryRow->unique_rooms;
        $uniqueUsers = (int) $summaryRow->unique_users;

        // ── Daily trend ───────────────────────────────────────────────────────────
        $trend = (clone $baseQ())
            ->selectRaw('DATE(start_at) as date, COUNT(*) as count')
            ->groupByRaw('DATE(start_at)')
            ->orderBy('date')
            ->get();

        // ── Status breakdown ──────────────────────────────────────────────────────
        $statusBreakdown = (clone $baseQ())
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->get();

        // ── Top rooms ─────────────────────────────────────────────────────────────
        $topRooms = (clone $baseQ())
            ->selectRaw('rooms.name as room, COUNT(*) as count')
            ->join('rooms', 'bookings.room_id', '=', 'rooms.id')
            ->groupBy('rooms.id', 'rooms.name')
            ->orderByDesc('count')
            ->limit(10)
            ->get();

        // ── Peak hours ────────────────────────────────────────────────────────────
        $peakHourSettings = Setting::getMany(['chart_peak_hour_from', 'chart_peak_hour_to']);
        $peakHourFrom = (int) ($peakHourSettings['chart_peak_hour_from'] ?? 0);
        $peakHourTo   = (int) ($peakHourSettings['chart_peak_hour_to'] ?? 23);
        $peakHours = (clone $baseQ())
            ->selectRaw('HOUR(start_at) as hour, COUNT(*) as count')
            ->groupByRaw('HOUR(start_at)')
            ->orderBy('hour')
            ->get()
            ->keyBy('hour');

        // ── Raw bookings ──────────────────────────────────────────────────────────
        $bookings = (clone $baseQ())
            ->with(['room', 'user'])
            ->orderByDesc('start_at')
            ->get();

        // ── Build spreadsheet ─────────────────────────────────────────────────────
        $spreadsheet  = new Spreadsheet();
        $periodLabel  = ($from ? "{$from} to {$to}" : 'All Time')
            . ($buildingIds ? ' · Building filter applied' : '');

        // ── Sheet 1: Summary ─────────────────────────────────────────────────────
        $s1 = $spreadsheet->getActiveSheet()->setTitle('Summary');
        $s1->setCellValue('A1', 'Analytics Export');
        $s1->getStyle('A1')->getFont()->setBold(true)->setSize(13);
        $s1->setCellValue('A2', "Period: {$periodLabel}");
        $s1->getStyle('A2')->getFont()->setItalic(true);
        $s1->setCellValue('A4', 'Metric');
        $s1->getStyle('A4')->getFont()->setBold(true);
        $s1->setCellValue('B4', 'Value');
        $s1->getStyle('B4')->getFont()->setBold(true);
        foreach ([
            ['Total Bookings', $total],
            ['Confirmed',      $confirmed],
            ['Tentative',      $tentative],
            ['Cancelled',      $cancelled],
            ['Unique Rooms',   $uniqueRooms],
            ['Unique Users',   $uniqueUsers],
        ] as $i => [$metric, $value]) {
            $r = $i + 5;
            $s1->setCellValue("A{$r}", $metric);
            $s1->setCellValue("B{$r}", $value);
        }
        $s1->getColumnDimension('A')->setWidth(20);
        $s1->getColumnDimension('B')->setWidth(12);

        // ── Sheet 2: Daily Trend ──────────────────────────────────────────────────
        $s2 = $spreadsheet->createSheet()->setTitle('Daily Trend');
        $s2->setCellValue('A1', 'Date');
        $s2->getStyle('A1')->getFont()->setBold(true);
        $s2->setCellValue('B1', 'Bookings');
        $s2->getStyle('B1')->getFont()->setBold(true);
        foreach ($trend as $i => $row) {
            $r = $i + 2;
            $s2->setCellValue("A{$r}", $row->date);
            $s2->setCellValue("B{$r}", (int) $row->count);
        }
        $s2->getColumnDimension('A')->setWidth(14);
        $s2->getColumnDimension('B')->setWidth(12);
        // Chart: line chart for trend
        $trendCount = count($trend);
        if ($trendCount > 0) {
            $series = new DataSeries(
                DataSeries::TYPE_LINECHART,
                DataSeries::GROUPING_STANDARD,
                [0],
                [new DataSeriesValues(DataSeriesValues::DATASERIES_TYPE_STRING,  "'Daily Trend'!\$B\$1", null, 1)],
                [new DataSeriesValues(DataSeriesValues::DATASERIES_TYPE_STRING,  "'Daily Trend'!\$A\$2:\$A\$" . ($trendCount + 1), null, $trendCount)],
                [new DataSeriesValues(DataSeriesValues::DATASERIES_TYPE_NUMBER,  "'Daily Trend'!\$B\$2:\$B\$" . ($trendCount + 1), null, $trendCount)],
            );
            $chart = new Chart('trendChart', new Title('Daily Booking Trend'), null, new PlotArea(null, [$series]));
            $chart->setTopLeftPosition('D1')->setBottomRightPosition('P20');
            $s2->addChart($chart);
        }

        // ── Sheet 3: Status Breakdown ─────────────────────────────────────────────
        $s3 = $spreadsheet->createSheet()->setTitle('Status Breakdown');
        $s3->setCellValue('A1', 'Status');
        $s3->getStyle('A1')->getFont()->setBold(true);
        $s3->setCellValue('B1', 'Count');
        $s3->getStyle('B1')->getFont()->setBold(true);
        foreach ($statusBreakdown as $i => $row) {
            $r = $i + 2;
            $s3->setCellValue("A{$r}", ucfirst($row->status));
            $s3->setCellValue("B{$r}", (int) $row->count);
        }
        $s3->getColumnDimension('A')->setWidth(14);
        $s3->getColumnDimension('B')->setWidth(10);
        // Chart: pie chart for status breakdown
        $statusCount = count($statusBreakdown);
        if ($statusCount > 0) {
            $series = new DataSeries(
                DataSeries::TYPE_PIECHART,
                null,
                [0],
                [],
                [new DataSeriesValues(DataSeriesValues::DATASERIES_TYPE_STRING, "'Status Breakdown'!\$A\$2:\$A\$" . ($statusCount + 1), null, $statusCount)],
                [new DataSeriesValues(DataSeriesValues::DATASERIES_TYPE_NUMBER, "'Status Breakdown'!\$B\$2:\$B\$" . ($statusCount + 1), null, $statusCount)],
            );
            $chart = new Chart('statusChart', new Title('Status Breakdown'), new Legend(Legend::POSITION_RIGHT, null, false), new PlotArea(null, [$series]));
            $chart->setTopLeftPosition('D1')->setBottomRightPosition('P18');
            $s3->addChart($chart);
        }

        // ── Sheet 4: Top Rooms ────────────────────────────────────────────────────
        $s4 = $spreadsheet->createSheet()->setTitle('Top Rooms');
        $s4->setCellValue('A1', 'Room');
        $s4->getStyle('A1')->getFont()->setBold(true);
        $s4->setCellValue('B1', 'Bookings');
        $s4->getStyle('B1')->getFont()->setBold(true);
        foreach ($topRooms as $i => $row) {
            $r = $i + 2;
            $s4->setCellValue("A{$r}", $row->room);
            $s4->setCellValue("B{$r}", (int) $row->count);
        }
        $s4->getColumnDimension('A')->setWidth(24);
        $s4->getColumnDimension('B')->setWidth(12);
        // Chart: bar chart for top rooms
        $roomsCount = count($topRooms);
        if ($roomsCount > 0) {
            $series = new DataSeries(
                DataSeries::TYPE_BARCHART,
                DataSeries::GROUPING_CLUSTERED,
                [0],
                [new DataSeriesValues(DataSeriesValues::DATASERIES_TYPE_STRING, "'Top Rooms'!\$B\$1", null, 1)],
                [new DataSeriesValues(DataSeriesValues::DATASERIES_TYPE_STRING, "'Top Rooms'!\$A\$2:\$A\$" . ($roomsCount + 1), null, $roomsCount)],
                [new DataSeriesValues(DataSeriesValues::DATASERIES_TYPE_NUMBER, "'Top Rooms'!\$B\$2:\$B\$" . ($roomsCount + 1), null, $roomsCount)],
            );
            $chart = new Chart('roomsChart', new Title('Top Rooms by Bookings'), null, new PlotArea(null, [$series]));
            $chart->setTopLeftPosition('D1')->setBottomRightPosition('P22');
            $s4->addChart($chart);
        }

        // ── Sheet 5: Peak Hours ───────────────────────────────────────────────────
        $s5 = $spreadsheet->createSheet()->setTitle('Peak Hours');
        $s5->setCellValue('A1', 'Hour');
        $s5->getStyle('A1')->getFont()->setBold(true);
        $s5->setCellValue('B1', 'Bookings');
        $s5->getStyle('B1')->getFont()->setBold(true);
        $peakRowCount = 0;
        for ($h = $peakHourFrom; $h <= $peakHourTo; $h++) {
            $r        = $peakRowCount + 2;
            $hourStr  = str_pad($h, 2, '0', STR_PAD_LEFT) . ':00';
            $s5->setCellValue("A{$r}", $hourStr);
            $s5->setCellValue("B{$r}", (int) ($peakHours->get($h)?->count ?? 0));
            $peakRowCount++;
        }
        $s5->getColumnDimension('A')->setWidth(10);
        $s5->getColumnDimension('B')->setWidth(12);
        // Chart: bar chart for peak hours
        if ($peakRowCount > 0) {
            $peakEndRow = $peakRowCount + 1;
            $series = new DataSeries(
                DataSeries::TYPE_BARCHART,
                DataSeries::GROUPING_CLUSTERED,
                [0],
                [new DataSeriesValues(DataSeriesValues::DATASERIES_TYPE_STRING, "'Peak Hours'!\$B\$1", null, 1)],
                [new DataSeriesValues(DataSeriesValues::DATASERIES_TYPE_STRING, "'Peak Hours'!\$A\$2:\$A\${$peakEndRow}", null, $peakRowCount)],
                [new DataSeriesValues(DataSeriesValues::DATASERIES_TYPE_NUMBER, "'Peak Hours'!\$B\$2:\$B\${$peakEndRow}", null, $peakRowCount)],
            );
            $chart = new Chart('hoursChart', new Title('Booking Peak Hours'), null, new PlotArea(null, [$series]));
            $chart->setTopLeftPosition('D1')->setBottomRightPosition('P30');
            $s5->addChart($chart);
        }

        // ── Sheet 6: All Bookings ─────────────────────────────────────────────────
        $s6   = $spreadsheet->createSheet()->setTitle('All Bookings');
        $hdrs = ['#', 'Title', 'Room', 'User', 'Department', 'Date', 'Start', 'End', 'Status', 'Type'];
        foreach ($hdrs as $i => $hdr) {
            $col = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($i + 1);
            $s6->setCellValue("{$col}1", $hdr);
            $s6->getStyle("{$col}1")->getFont()->setBold(true);
        }
        foreach ($bookings as $i => $b) {
            $r = $i + 2;
            $s6->setCellValue("A{$r}", $b->id);
            $s6->setCellValue("B{$r}", $b->title);
            $s6->setCellValue("C{$r}", $b->room?->name ?? '');
            $s6->setCellValue("D{$r}", $b->user?->name ?? '');
            $s6->setCellValue("E{$r}", $b->user?->department_name ?? '');
            $s6->setCellValue("F{$r}", date('Y-m-d', strtotime($b->start_at)));
            $s6->setCellValue("G{$r}", date('H:i', strtotime($b->start_at)));
            $s6->setCellValue("H{$r}", date('H:i', strtotime($b->end_at)));
            $s6->setCellValue("I{$r}", $b->status);
            $s6->setCellValue("J{$r}", $b->type);
        }
        foreach (['A' => 6, 'B' => 28, 'C' => 22, 'D' => 22, 'E' => 18, 'F' => 12, 'G' => 8, 'H' => 8, 'I' => 12, 'J' => 12] as $col => $width) {
            $s6->getColumnDimension($col)->setWidth($width);
        }

        $spreadsheet->setActiveSheetIndex(0);

        $writer = new Xlsx($spreadsheet);
        $writer->setIncludeCharts(true);
        $filename = 'analytics-' . date('Y-m-d') . '.xlsx';

        return response()->streamDownload(function () use ($writer) {
            $writer->save('php://output');
        }, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }
}
