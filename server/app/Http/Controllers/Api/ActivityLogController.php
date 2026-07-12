<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

class ActivityLogController extends Controller
{
    private function buildQuery(Request $request)
    {
        $query = ActivityLog::with('user:id,name,role')->latest('created_at');

        if ($cat = $request->query('category')) $query->where('category', $cat);
        if ($userId = $request->query('user_id'))  $query->where('user_id', $userId);
        if ($from = $request->query('from'))        $query->whereDate('created_at', '>=', $from);
        if ($to   = $request->query('to'))          $query->whereDate('created_at', '<=', $to);
        if ($q    = $request->query('q'))           $query->where('description', 'like', "%{$q}%");

        return $query;
    }

    public function clearAll(): JsonResponse
    {
        $count = ActivityLog::count();
        ActivityLog::query()->delete();
        return response()->json(['deleted' => $count]);
    }

    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->query('per_page', 25), 10), 500);
        $logs = $this->buildQuery($request)->paginate($perPage);

        return response()->json([
            'data' => $logs->getCollection()->map(fn (ActivityLog $l) => [
                'id'          => $l->id,
                'action'      => $l->action,
                'category'    => $l->category,
                'description' => $l->description,
                'metadata'    => $l->metadata,
                'ip_address'  => $l->ip_address,
                'created_at'  => $l->created_at,
                'actor'       => $l->user ? ['id' => $l->user->id, 'name' => $l->user->name, 'role' => $l->user->role] : null,
            ]),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page'    => $logs->lastPage(),
                'total'        => $logs->total(),
            ],
        ]);
    }

    public function export(Request $request)
    {
        $format   = $request->query('format', 'excel'); // excel | pdf | txt
        $logs     = $this->buildQuery($request)->limit(5000)->get();
        $catLabel = $request->query('category') ? ucfirst($request->query('category')) : 'All';
        $filename = 'activity-log-' . now()->format('Ymd-His');

        if ($format === 'pdf') return $this->exportPdf($logs, $catLabel, $filename);
        if ($format === 'txt') return $this->exportTxt($logs, $catLabel, $filename);
        return $this->exportExcel($logs, $catLabel, $filename);
    }

    public static function generateTxtContent($logs, string $catLabel): string
    {
        $lines   = [];
        $lines[] = "Activity Log — {$catLabel}";
        $lines[] = str_repeat('-', 72);
        $lines[] = 'Generated : ' . now()->format('Y-m-d H:i:s');
        $lines[] = 'Entries   : ' . count($logs);
        $lines[] = str_repeat('-', 72);
        $lines[] = '';
        foreach ($logs as $l) {
            $actor = $l->user ? "{$l->user->name} ({$l->user->role})" : 'System';
            $ip    = $l->ip_address ? " [{$l->ip_address}]" : '';
            $lines[] = "[{$l->created_at->format('Y-m-d H:i:s')}] [{$l->category}] {$l->action}{$ip}";
            $lines[] = "  {$l->description}";
            $lines[] = "  — {$actor}";
            $lines[] = '';
        }
        return implode("\n", $lines);
    }

    private function exportTxt($logs, string $catLabel, string $filename)
    {
        $content = self::generateTxtContent($logs, $catLabel);
        return response($content, 200, [
            'Content-Type'        => 'text/plain; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}.txt\"",
        ]);
    }

    private function exportExcel($logs, string $catLabel, string $filename)
    {
        $ss = new Spreadsheet();
        $ws = $ss->getActiveSheet();
        $ws->setTitle('Activity Log');

        // Header
        $headers = ['Date / Time', 'Category', 'Action', 'Description', 'Actor', 'Role', 'IP Address'];
        $cols    = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
        foreach ($cols as $i => $col) {
            $ws->setCellValue("{$col}1", $headers[$i]);
            $ws->getStyle("{$col}1")->applyFromArray([
                'font'      => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '111827']],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT],
            ]);
        }

        // Rows
        foreach ($logs as $i => $l) {
            $row = $i + 2;
            $ws->setCellValue("A{$row}", $l->created_at?->format('Y-m-d H:i:s'));
            $ws->setCellValue("B{$row}", ucfirst($l->category));
            $ws->setCellValue("C{$row}", $l->action);
            $ws->setCellValue("D{$row}", $l->description);
            $ws->setCellValue("E{$row}", $l->user?->name ?? 'System');
            $ws->setCellValue("F{$row}", $l->user?->role ?? '—');
            $ws->setCellValue("G{$row}", $l->ip_address ?? '—');

            if ($i % 2 === 1) {
                $ws->getStyle("A{$row}:G{$row}")->applyFromArray([
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'F9FAFB']],
                ]);
            }
        }

        foreach ($cols as $col) {
            $ws->getColumnDimension($col)->setAutoSize(true);
        }

        $writer = new Xlsx($ss);
        return response()->streamDownload(function () use ($writer) {
            $writer->save('php://output');
        }, "{$filename}.xlsx", [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    private function exportPdf($logs, string $catLabel, string $filename)
    {
        $html = view('exports.activity-log', [
            'logs'     => $logs,
            'catLabel' => $catLabel,
            'generatedAt' => now()->format('Y-m-d H:i:s'),
        ])->render();

        $pdf = Pdf::loadHTML($html)->setPaper('a4', 'landscape');

        return $pdf->download("{$filename}.pdf");
    }
}
