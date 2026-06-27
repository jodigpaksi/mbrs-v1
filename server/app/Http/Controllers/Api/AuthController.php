<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        $user->load('department');
        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'user'  => $this->userPayload($user),
            'token' => $token,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out']);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load('department');
        return response()->json($this->userPayload($user));
    }

    private function userPayload(User $user): array
    {
        $user->loadMissing('adminBuildings');
        return [
            'id'            => $user->id,
            'name'          => $user->name,
            'email'         => $user->email,
            'role'          => $user->role,
            'department'    => $user->department?->name ?? '',
            'department_id' => $user->department_id,
            'ext'           => $user->ext ?? '',
            'avatar'        => $user->avatar,
            'on_duty'             => (bool) $user->on_duty,
            'can_book_special'    => (bool) $user->can_book_special,
            'buildings'           => $user->adminBuildings->map(fn ($b) => ['id' => $b->id, 'name' => $b->name])->values(),
            'preferences'         => $user->preferences ?? (object) [],
            'default_building_id' => $user->default_building_id,
        ];
    }

    public function updatePreferences(Request $request): JsonResponse
    {
        $allowed = ['defaultView', 'defaultType', 'language', 'darkMode', 'startDay', 'showBarTitle', 'defaultBuilding'];
        $data = $request->validate([
            'preferences' => 'required|array',
        ]);

        $incoming = array_intersect_key($data['preferences'], array_flip($allowed));
        $user = $request->user();
        $merged = array_merge($user->preferences ?? [], $incoming);
        $user->update(['preferences' => $merged]);

        return response()->json(['preferences' => $merged]);
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => 'required',
            'password'         => 'required|min:8|confirmed',
        ]);

        $user = $request->user();
        if (!Hash::check($request->current_password, $user->password)) {
            return response()->json(['message' => 'Current password is incorrect.'], 422);
        }

        $user->update(['password' => $request->password]);
        return response()->json(['message' => 'Password updated.']);
    }

    public function updateOnDuty(Request $request): JsonResponse
    {
        $request->validate(['on_duty' => 'required|boolean']);
        $user = $request->user();
        $user->update(['on_duty' => $request->on_duty]);
        return response()->json(['on_duty' => $user->on_duty]);
    }

    public function updateAvatar(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user->role !== 'superadmin') {
            $allowed = \App\Models\Setting::where('key', 'allow_avatar_upload')->value('value') ?? 'true';
            if ($allowed === 'false') {
                return response()->json(['message' => 'Avatar upload is disabled by the administrator.'], 403);
            }
        }
        $request->validate(['avatar' => 'required|image|max:2048']);
        $path = $request->file('avatar')->store('avatars', 'public');
        $user->update(['avatar' => Storage::url($path)]);
        return response()->json($user);
    }

    public function removeAvatar(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->update(['avatar' => null]);
        return response()->json(array_merge($user->fresh()->toArray(), ['avatar' => null]));
    }
}
