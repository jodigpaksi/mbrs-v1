<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Building;
use Illuminate\Http\Request;

class BuildingController extends Controller
{
    public function index()
    {
        return Building::with(['rooms', 'location'])->orderBy('name')->get();
    }

    public function show(Building $building)
    {
        return $building->load(['rooms', 'location']);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'        => 'required|string|max:255',
            'code'        => 'nullable|string|max:20',
            'address'     => 'nullable|string|max:500',
            'location_id' => 'nullable|exists:locations,id',
            'floors'      => 'nullable|integer|min:1|max:200',
            'photo'       => 'nullable|string|max:500',
            'notes'       => 'nullable|string',
            'is_active'   => 'nullable|boolean',
        ]);

        return Building::create($data)->load('location');
    }

    public function update(Request $request, Building $building)
    {
        $data = $request->validate([
            'name'        => 'sometimes|string|max:255',
            'code'        => 'nullable|string|max:20',
            'address'     => 'nullable|string|max:500',
            'location_id' => 'nullable|exists:locations,id',
            'floors'      => 'nullable|integer|min:1|max:200',
            'photo'       => 'nullable|string|max:500',
            'notes'       => 'nullable|string',
            'is_active'   => 'nullable|boolean',
        ]);

        $building->update($data);
        return $building->fresh(['rooms', 'location']);
    }

    public function destroy(Building $building)
    {
        if ($building->rooms()->count() > 0) {
            return response()->json(['message' => 'Cannot delete a building that still has rooms.'], 422);
        }
        $building->delete();
        return response()->noContent();
    }
}
