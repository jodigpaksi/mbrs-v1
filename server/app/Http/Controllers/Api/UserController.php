<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Building;
use App\Models\Department;
use App\Models\Location;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $query = User::with('department.location', 'adminBuildings.location')
            ->orderBy('role')
            ->orderBy('name');

        // building_admin is scoped to users whose default building is one they manage (view-only — see routes/api.php)
        if ($request->user()->role === 'building_admin') {
            $query->whereIn('default_building_id', $request->user()->managedBuildingIds());
        }

        return $query->get()
            ->map(fn ($u) => [
                'id'                   => $u->id,
                'name'                 => $u->name,
                'email'                => $u->email,
                'alias'                => $u->alias,
                'department'           => $u->department?->name ?? '',
                'department_id'        => $u->department_id,
                'department_location'  => $u->department?->location
                    ? ['id' => $u->department->location->id, 'name' => $u->department->location->name, 'code' => $u->department->location->code]
                    : null,
                'role'                 => $u->role,
                'ext'                  => $u->ext,
                'avatar'               => $u->avatar,
                'can_book_special'     => (bool) $u->can_book_special,
                'default_building_id'  => $u->default_building_id,
                'admin_buildings'      => $u->adminBuildings->map(fn ($b) => [
                    'id'       => $b->id,
                    'name'     => $b->name,
                    'address'  => $b->address,
                    'location' => $b->location ? ['id' => $b->location->id, 'name' => $b->location->name] : null,
                ]),
            ]);
    }

    public function directory()
    {
        return User::with('department', 'adminBuildings')
            ->orderBy('name')
            ->get()
            ->map(fn ($u) => [
                'id'         => $u->id,
                'name'       => $u->name,
                'email'      => $u->email,
                'alias'      => $u->alias,
                'ext'        => $u->ext,
                'role'       => $u->role,
                'avatar'     => $u->avatar,
                'department' => $u->department?->name ?? '',
                'buildings'  => $u->adminBuildings->map(fn ($b) => [
                    'id'   => $b->id,
                    'name' => $b->name,
                    'code' => $b->code,
                ])->values(),
            ]);
    }

    public function updateRole(Request $request, User $user)
    {
        $data = $request->validate([
            'role' => 'required|in:user,admin,receptionist,building_admin',
        ]);

        // Prevent demoting the last Super Admin
        if ($user->role === 'admin' && $data['role'] !== 'admin') {
            $adminCount = User::where('role', 'admin')->count();
            if ($adminCount <= 1) {
                return response()->json([
                    'message' => 'Cannot demote the last Super Admin. Promote another user to Super Admin first.',
                ], 422);
            }
        }

        // Clear building assignments only when promoted to Super Admin (unrestricted access)
        if ($data['role'] === 'admin') {
            $user->adminBuildings()->detach();
        }

        $oldRole = $user->role;
        $user->update($data);

        if ($oldRole !== $data['role']) {
            \App\Models\ActivityLog::record(
                'user.role_changed',
                "Changed role of {$user->name} from {$oldRole} to {$data['role']}",
                $user,
                ['old' => $oldRole, 'new' => $data['role']],
            );
        }

        return $user->load('adminBuildings.location');
    }

    public function toggleSpecialAccess(User $user)
    {
        $user->update(['can_book_special' => !$user->can_book_special]);
        return response()->json(['can_book_special' => $user->can_book_special]);
    }

    public function assignBuildings(Request $request, User $user)
    {
        $data = $request->validate([
            'building_ids'        => 'present|array',
            'building_ids.*'      => 'exists:buildings,id',
            'default_building_id' => 'sometimes|nullable|exists:buildings,id',
        ]);

        $user->adminBuildings()->sync($data['building_ids']);

        if (array_key_exists('default_building_id', $data)) {
            $user->update(['default_building_id' => $data['default_building_id']]);
        }

        return $user->load('adminBuildings');
    }

    public function update(Request $request, User $user)
    {
        if ($request->alias === '') $request->merge(['alias' => null]);

        $data = $request->validate([
            'name'          => 'sometimes|string|max:255|unique:users,name,' . $user->id,
            'email'         => 'sometimes|email|unique:users,email,' . $user->id,
            'alias'         => 'sometimes|nullable|string|max:100|regex:/^[a-zA-Z0-9._-]+$/|unique:users,alias,' . $user->id,
            'department_id' => 'sometimes|nullable|exists:departments,id',
            'ext'           => 'sometimes|nullable|string|max:20',
            'password'      => 'sometimes|nullable|string|min:8',
            'avatar'        => 'sometimes|nullable|string|max:1000',
        ], [
            'name.unique' => 'A user with that name already exists.',
        ]);

        if (array_key_exists('password', $data) && $data['password'] === null) {
            unset($data['password']);
        }
        if (array_key_exists('alias', $data)) {
            $data['alias'] = $data['alias'] !== null ? trim($data['alias']) : null;
            if ($data['alias'] === '') $data['alias'] = null;
        }

        $user->update($data);
        return $user->load('adminBuildings.location', 'department');
    }

    public function store(Request $request)
    {
        if ($request->alias === '') $request->merge(['alias' => null]);

        $data = $request->validate([
            'name'          => 'required|string|max:255|unique:users,name',
            'email'         => 'required|email|unique:users,email',
            'alias'         => 'nullable|string|max:100|regex:/^[a-zA-Z0-9._-]+$/|unique:users,alias',
            'password'      => 'required|string|min:8',
            'department_id' => 'nullable|exists:departments,id',
            'role'          => 'nullable|in:user,admin,receptionist,building_admin',
            'ext'           => 'nullable|string|max:20',
        ], [
            'name.unique' => 'A user with that name already exists.',
        ]);

        $data['alias'] = $this->resolveAlias($data['alias'] ?? null, $data['email']);

        $user = User::create([
            ...$data,
            'role' => $data['role'] ?? 'user',
        ]);

        \App\Models\ActivityLog::record(
            'user.created',
            "Created user {$user->name} ({$user->email}) as {$user->role}",
            $user,
            ['email' => $user->email, 'role' => $user->role],
        );

        return $user->load('adminBuildings.location', 'department');
    }

    /** Derive an alias from the email local-part when none was given, deduping against existing aliases. */
    private function resolveAlias(?string $alias, string $email): string
    {
        $base = $alias !== null && trim($alias) !== ''
            ? trim($alias)
            : strtolower(strstr($email, '@', true) ?: $email);

        $candidate = $base;
        $i = 1;
        while (User::where('alias', $candidate)->exists()) {
            $candidate = $base . $i;
            $i++;
        }

        return $candidate;
    }

    public function importUsers(Request $request)
    {
        $request->validate(['users' => 'required|array|min:1|max:500']);

        $created = 0;
        $errors  = [];

        // Cache departments/locations/buildings by name (case-insensitive) for lookup
        $deptCache     = Department::all()->keyBy(fn ($d) => strtolower($d->name));
        $locationCache = Location::all()->keyBy(fn ($l) => strtolower($l->name));
        $buildingCache = Building::all()->keyBy(fn ($b) => strtolower($b->name));

        foreach ($request->users as $i => $row) {
            $rowNum = $i + 1;
            if (empty($row['name']) || empty($row['email']) || empty($row['password'])) {
                $errors[] = "Row {$rowNum}: name, email, and password are required.";
                continue;
            }
            if (User::where('email', $row['email'])->exists()) {
                $errors[] = "Row {$rowNum}: email \"{$row['email']}\" already exists.";
                continue;
            }
            try {
                $role = in_array($row['role'] ?? '', ['user', 'admin', 'receptionist', 'building_admin'])
                    ? $row['role'] : 'user';

                // Resolve department string → id (create if new; attach location if given)
                $deptId = null;
                $deptName = trim($row['department'] ?? '');
                if ($deptName !== '') {
                    $key = strtolower($deptName);
                    if (!isset($deptCache[$key])) {
                        $locName = trim($row['department_location'] ?? '');
                        $locId = null;
                        if ($locName !== '') {
                            $locKey = strtolower($locName);
                            if (!isset($locationCache[$locKey])) {
                                $locationCache[$locKey] = Location::create(['name' => $locName]);
                            }
                            $locId = $locationCache[$locKey]->id;
                        }
                        $dept = Department::create(['name' => $deptName, 'location_id' => $locId]);
                        $deptCache[$key] = $dept;
                    }
                    $deptId = $deptCache[$key]->id;
                }

                // Resolve default building + assigned buildings by name (must already exist)
                $defaultBuildingId = null;
                $defaultBuildingName = trim($row['default_building'] ?? '');
                if ($defaultBuildingName !== '') {
                    $b = $buildingCache[strtolower($defaultBuildingName)] ?? null;
                    if ($b) $defaultBuildingId = $b->id;
                    else $errors[] = "Row {$rowNum}: default building \"{$defaultBuildingName}\" not found, skipped.";
                }

                $assignedBuildingIds = [];
                foreach (explode(',', $row['assigned_buildings'] ?? '') as $bName) {
                    $bName = trim($bName);
                    if ($bName === '') continue;
                    $b = $buildingCache[strtolower($bName)] ?? null;
                    if ($b) $assignedBuildingIds[] = $b->id;
                    else $errors[] = "Row {$rowNum}: assigned building \"{$bName}\" not found, skipped.";
                }

                $email = trim($row['email']);
                $alias = $this->resolveAlias(
                    isset($row['alias']) && trim($row['alias']) !== '' ? trim($row['alias']) : null,
                    $email,
                );

                $pw = $row['password'];
                $alreadyHashed = password_get_info($pw)['algoName'] !== 'unknown';

                if ($alreadyHashed) {
                    $userId = DB::table('users')->insertGetId([
                        'name'                => trim($row['name']),
                        'email'               => $email,
                        'alias'               => $alias,
                        'password'            => $pw,
                        'department_id'       => $deptId,
                        'role'                => $role,
                        'ext'                 => $row['ext'] ?? null,
                        'default_building_id' => $defaultBuildingId,
                        'created_at'          => now(),
                        'updated_at'          => now(),
                    ]);
                } else {
                    $userId = User::create([
                        'name'                => trim($row['name']),
                        'email'               => $email,
                        'alias'               => $alias,
                        'password'            => $pw,
                        'department_id'       => $deptId,
                        'role'                => $role,
                        'ext'                 => $row['ext'] ?? null,
                        'default_building_id' => $defaultBuildingId,
                    ])->id;
                }

                if (!empty($assignedBuildingIds)) {
                    User::find($userId)->adminBuildings()->sync($assignedBuildingIds);
                }

                $created++;
            } catch (\Exception $e) {
                $errors[] = "Row {$rowNum}: " . $e->getMessage();
            }
        }

        return response()->json(['created' => $created, 'errors' => $errors]);
    }

    public function destroy(User $user)
    {
        if (auth()->id() === $user->id) {
            return response()->json(['message' => 'Cannot delete your own account.'], 422);
        }

        // Prevent deleting the last Super Admin
        if ($user->role === 'admin') {
            $adminCount = User::where('role', 'admin')->count();
            if ($adminCount <= 1) {
                return response()->json([
                    'message' => 'Cannot delete the last Super Admin. Promote another user to Super Admin first.',
                ], 422);
            }
        }

        \App\Models\ActivityLog::record(
            'user.deleted',
            "Deleted user {$user->name} ({$user->email}, {$user->role})",
            $user,
            ['email' => $user->email, 'role' => $user->role],
        );

        $user->adminBuildings()->detach();
        $user->delete();
        return response()->noContent();
    }
}
