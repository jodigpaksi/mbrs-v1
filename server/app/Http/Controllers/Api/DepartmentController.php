<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use Illuminate\Http\Request;

class DepartmentController extends Controller
{
    public function index()
    {
        return Department::with('location')->withCount('users')->orderBy('name')->get()
            ->map(fn ($d) => [
                'id'          => $d->id,
                'name'        => $d->name,
                'code'        => $d->code,
                'location_id' => $d->location_id,
                'location'    => $d->location ? ['id' => $d->location->id, 'name' => $d->location->name, 'code' => $d->location->code] : null,
                'users_count' => $d->users_count,
            ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'        => 'required|string|max:255|unique:departments,name',
            'code'        => 'nullable|string|max:20',
            'location_id' => 'nullable|exists:locations,id',
        ]);

        $dept = Department::create($data);
        return $dept->load('location')->loadCount('users');
    }

    public function update(Request $request, Department $department)
    {
        $data = $request->validate([
            'name'        => 'sometimes|string|max:255|unique:departments,name,' . $department->id,
            'code'        => 'sometimes|nullable|string|max:20',
            'location_id' => 'sometimes|nullable|exists:locations,id',
        ]);

        $department->update($data);
        return $department->fresh()->load('location')->loadCount('users');
    }

    public function destroy(Department $department)
    {
        if ($department->users()->exists()) {
            return response()->json([
                'message' => 'Cannot delete a department that still has users assigned. Reassign or remove the users first.',
            ], 422);
        }

        $department->delete();
        return response()->noContent();
    }
}
