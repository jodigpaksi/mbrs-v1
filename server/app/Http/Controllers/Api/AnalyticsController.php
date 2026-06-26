<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Room;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
        $monthStart   = now()->startOfMonth();

        $stats = [
            'total_bookings' => Booking::count(),
            'confirmed'      => Booking::where('status', 'confirmed')->count(),
            'tentative'      => Booking::where('status', 'tentative')->count(),
            'cancelled'      => Booking::where('status', 'cancelled')->count(),
            'active_rooms'   => Room::where('is_active', true)->count(),
            'total_users'    => User::count(),
        ];

        $trend = Booking::selectRaw('DATE(start_at) as date, COUNT(*) as count')
            ->where('start_at', '>=', now()->subDays($period))
            ->groupByRaw('DATE(start_at)')
            ->orderBy('date')
            ->get()
            ->map(fn ($r) => ['date' => $r->date, 'count' => (int) $r->count]);

        $topRooms = Booking::selectRaw('rooms.name as room, COUNT(*) as count')
            ->join('rooms', 'bookings.room_id', '=', 'rooms.id')
            ->when($roomsPeriod === 'month', fn ($q) => $q->where('bookings.start_at', '>=', $monthStart))
            ->groupBy('rooms.id', 'rooms.name')
            ->orderByDesc('count')
            ->limit(5)
            ->get()
            ->map(fn ($r) => ['room' => $r->room, 'count' => (int) $r->count]);

        $statusBreakdown = Booking::selectRaw('status, COUNT(*) as count')
            ->when($statusPeriod === 'month', fn ($q) => $q->where('start_at', '>=', $monthStart))
            ->groupBy('status')
            ->get()
            ->map(fn ($r) => ['status' => $r->status, 'count' => (int) $r->count]);

        $peakHours = Booking::selectRaw('HOUR(start_at) as hour, COUNT(*) as count')
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

        $summary = [
            'total'        => (clone $q)->count(),
            'confirmed'    => (clone $q)->where('status', 'confirmed')->count(),
            'cancelled'    => (clone $q)->where('status', 'cancelled')->count(),
            'unique_users' => (clone $q)->distinct('user_id')->count('user_id'),
            'unique_rooms' => (clone $q)->distinct('room_id')->count('room_id'),
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
            'from'        => 'nullable|date',
            'to'          => 'nullable|date',
            'room_id'     => 'nullable|integer|exists:rooms,id',
            'building_id' => 'nullable|integer|exists:buildings,id',
            'dept_id'     => 'nullable|integer|exists:departments,id',
        ]);

        $bookings = Booking::with(['room', 'user'])
            ->when($data['from'] ?? null, fn ($q, $v) => $q->whereDate('start_at', '>=', $v))
            ->when($data['to'] ?? null, fn ($q, $v) => $q->whereDate('start_at', '<=', $v))
            ->when($data['room_id'] ?? null, fn ($q, $v) => $q->where('room_id', $v))
            ->when($data['building_id'] ?? null, fn ($q, $v) => $q->whereHas('room', fn ($r) => $r->where('building_id', $v)))
            ->when($data['dept_id'] ?? null, fn ($q, $v) => $q->whereHas('user', fn ($u) => $u->where('department_id', $v)))
            ->orderByDesc('start_at')
            ->get();

        $spreadsheet = new Spreadsheet();
        $sheet       = $spreadsheet->getActiveSheet();

        $headers = ['#', 'Title', 'Room', 'User', 'Department', 'Date', 'Start', 'End', 'Status', 'Type'];
        foreach ($headers as $i => $h) {
            $sheet->setCellValueByColumnAndRow($i + 1, 1, $h);
        }

        foreach ($bookings as $i => $b) {
            $row = $i + 2;
            $sheet->setCellValueByColumnAndRow(1,  $row, $b->id);
            $sheet->setCellValueByColumnAndRow(2,  $row, $b->title);
            $sheet->setCellValueByColumnAndRow(3,  $row, $b->room?->name ?? '');
            $sheet->setCellValueByColumnAndRow(4,  $row, $b->user?->name ?? '');
            $sheet->setCellValueByColumnAndRow(5,  $row, $b->user?->department_name ?? '');
            $sheet->setCellValueByColumnAndRow(6,  $row, date('Y-m-d', strtotime($b->start_at)));
            $sheet->setCellValueByColumnAndRow(7,  $row, date('H:i', strtotime($b->start_at)));
            $sheet->setCellValueByColumnAndRow(8,  $row, date('H:i', strtotime($b->end_at)));
            $sheet->setCellValueByColumnAndRow(9,  $row, $b->status);
            $sheet->setCellValueByColumnAndRow(10, $row, $b->type);
        }

        $writer   = new Xlsx($spreadsheet);
        $filename = 'bookings-' . date('Y-m-d') . '.xlsx';

        return response()->streamDownload(function () use ($writer) {
            $writer->save('php://output');
        }, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }
}
