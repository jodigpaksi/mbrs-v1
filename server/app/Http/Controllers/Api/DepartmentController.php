<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use Illuminate\Http\Request;

class DepartmentController extends Controller
{
    public function index()
    {
        return Department::withCount('users')->orderBy('name')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255|unique:departments,name',
            'code' => 'nullable|string|max:20',
        ]);

        return Department::create($data);
    }

    public function update(Request $request, Department $department)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255|unique:departments,name,' . $department->id,
            'code' => 'sometimes|nullable|string|max:20',
        ]);

        $department->update($data);
        return $department->loadCount('users');
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
