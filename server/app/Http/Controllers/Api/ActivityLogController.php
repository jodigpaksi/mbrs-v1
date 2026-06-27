<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = ActivityLog::with('user:id,name,role')
            ->latest('created_at');

        if ($cat = $request->query('category')) {
            $query->where('category', $cat);
        }
        if ($userId = $request->query('user_id')) {
            $query->where('user_id', $userId);
        }
        if ($from = $request->query('from')) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->query('to')) {
            $query->whereDate('created_at', '<=', $to);
        }
        if ($q = $request->query('q')) {
            $query->where('description', 'like', "%{$q}%");
        }

        $logs = $query->paginate(40);

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
}
