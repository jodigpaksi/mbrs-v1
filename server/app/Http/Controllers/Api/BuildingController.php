<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Building;
use App\Models\Location;
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

    public function export()
    {
        $rows = Building::with('location')->orderBy('name')->get();
        ActivityLog::record(
            'data.exported',
            "Exported {$rows->count()} building records",
            null,
            ['type' => 'buildings', 'count' => $rows->count()],
        );

        return response()->json($rows->map(fn (Building $b) => [
            'name'      => $b->name,
            'code'      => $b->code ?? '',
            'location'  => $b->location?->name ?? '',
            'address'   => $b->address ?? '',
            'floors'    => (string) $b->floors,
            'photo'     => $b->photo ?? '',
            'notes'     => $b->notes ?? '',
            'is_active' => $b->is_active ? 'yes' : 'no',
        ]));
    }

    public function importBuildings(Request $request)
    {
        $request->validate(['buildings' => 'required|array|min:1|max:500']);

        $created = 0;
        $errors  = [];
        $locationCache = Location::all()->keyBy(fn ($l) => strtolower($l->name));

        foreach ($request->buildings as $i => $row) {
            $rowNum = $i + 1;
            if (empty($row['name'])) {
                $errors[] = "Row {$rowNum}: name is required.";
                continue;
            }
            try {
                $locationId = null;
                $locName = trim($row['location'] ?? '');
                if ($locName !== '') {
                    $key = strtolower($locName);
                    if (!isset($locationCache[$key])) {
                        $locationCache[$key] = Location::create(['name' => $locName]);
                    }
                    $locationId = $locationCache[$key]->id;
                }

                $isActive = !in_array(strtolower(trim($row['is_active'] ?? 'yes')), ['no', 'false', '0', '']);

                Building::create([
                    'name'        => trim($row['name']),
                    'code'        => trim($row['code'] ?? '') ?: null,
                    'address'     => trim($row['address'] ?? '') ?: null,
                    'location_id' => $locationId,
                    'floors'      => is_numeric($row['floors'] ?? null) ? (int) $row['floors'] : 1,
                    'photo'       => trim($row['photo'] ?? '') ?: null,
                    'notes'       => trim($row['notes'] ?? '') ?: null,
                    'is_active'   => $isActive,
                ]);
                $created++;
            } catch (\Exception $e) {
                $errors[] = "Row {$rowNum}: " . $e->getMessage();
            }
        }

        return response()->json(['created' => $created, 'errors' => $errors]);
    }
}
