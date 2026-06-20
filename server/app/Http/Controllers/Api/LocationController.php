<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Location;
use Illuminate\Http\Request;

class LocationController extends Controller
{
    public function index()
    {
        return Location::withCount('buildings')->orderBy('name')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:100|unique:locations,name',
            'code' => 'nullable|string|max:10',
        ]);
        return Location::create($data);
    }

    public function update(Request $request, Location $location)
    {
        $data = $request->validate([
            'name' => "sometimes|string|max:100|unique:locations,name,{$location->id}",
            'code' => 'nullable|string|max:10',
        ]);
        $location->update($data);
        return $location;
    }

    public function destroy(Location $location)
    {
        // Detach buildings (set location_id = null) before deleting
        $location->buildings()->update(['location_id' => null]);
        $location->delete();
        return response()->noContent();
    }
}
