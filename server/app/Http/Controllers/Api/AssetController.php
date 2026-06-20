<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\AssetUnit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AssetController extends Controller
{
    // ── Asset types (master registry) ────────────────────────────────────────

    public function index()
    {
        $buildingIds = Auth::user()->managedBuildingIds();

        return Asset::with(['units.room.building'])
            ->when($buildingIds, fn ($q) =>
                $q->whereHas('units', fn ($q2) =>
                    $q2->whereHas('room', fn ($q3) =>
                        $q3->whereIn('building_id', $buildingIds)
                    )
                )
            )
            ->orderBy('category')
            ->orderBy('name')
            ->get()
            ->map(function (Asset $asset) use ($buildingIds) {
                // Scope units to managed buildings only
                if ($buildingIds) {
                    $asset->setRelation('units', $asset->units->filter(
                        fn ($u) => $u->room && in_array($u->room->building_id, $buildingIds)
                    )->values());
                }
                return $asset;
            });
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'     => 'required|string|max:255',
            'category' => 'nullable|string|max:100',
            'icon'     => 'nullable|string|max:100',
            'notes'    => 'nullable|string',
        ]);

        return Asset::create($data)->load('units.room.building');
    }

    public function update(Request $request, Asset $asset)
    {
        $data = $request->validate([
            'name'     => 'sometimes|string|max:255',
            'category' => 'nullable|string|max:100',
            'icon'     => 'nullable|string|max:100',
            'notes'    => 'nullable|string',
        ]);

        $asset->update($data);
        return $asset->load('units.room.building');
    }

    public function destroy(Asset $asset)
    {
        $asset->delete(); // cascades to asset_units
        return response()->noContent();
    }

    // ── Asset units (individual physical units) ───────────────────────────────

    public function storeUnit(Request $request, Asset $asset)
    {
        $data = $request->validate([
            'room_id'   => 'nullable|exists:rooms,id',
            'unit_code' => 'nullable|string|max:100',
            'status'    => 'in:active,rusak,service,hilang,indent',
            'notes'     => 'nullable|string',
        ]);

        if ($data['room_id'] ?? null) {
            $room = \App\Models\Room::findOrFail($data['room_id']);
            abort_unless(Auth::user()->canManageBuilding($room->building_id), 403, 'Building not in your scope.');
        }

        $unit = $asset->units()->create($data);
        return $unit->load('room.building');
    }

    public function updateUnit(Request $request, Asset $asset, AssetUnit $unit)
    {
        abort_if($unit->asset_id !== $asset->id, 404);

        $data = $request->validate([
            'room_id'   => 'nullable|exists:rooms,id',
            'unit_code' => 'nullable|string|max:100',
            'status'    => 'sometimes|in:active,rusak,service,hilang,indent',
            'notes'     => 'nullable|string',
        ]);

        $unit->update($data);
        return $unit->load('room.building');
    }

    public function destroyUnit(Asset $asset, AssetUnit $unit)
    {
        abort_if($unit->asset_id !== $asset->id, 404);
        $unit->delete();
        return response()->noContent();
    }
}
