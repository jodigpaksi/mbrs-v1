<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AssetController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\BuildingController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\LocationController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\RoomController;
use App\Http\Controllers\Api\SettingController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

// Auth
Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/me/avatar', [AuthController::class, 'updateAvatar']);
    Route::patch('/me/password', [AuthController::class, 'updatePassword']);
    Route::patch('/me/on-duty', [AuthController::class, 'updateOnDuty']);

    // Settings (read: all auth)
    Route::get('/settings/booking-hours', [SettingController::class, 'bookingHours']);
    Route::get('/settings/weekend', [SettingController::class, 'weekendSettings']);

    // Locations (read: all auth)
    Route::get('/locations', [LocationController::class, 'index']);

    // Buildings (read: all auth)
    Route::get('/buildings', [BuildingController::class, 'index']);
    Route::get('/buildings/{building}', [BuildingController::class, 'show']);

    // Rooms (read: all auth)
    Route::get('/rooms', [RoomController::class, 'index']);
    Route::get('/rooms/available', [RoomController::class, 'available']);
    Route::get('/rooms/{room}', [RoomController::class, 'show']);
    Route::get('/rooms/{room}/availability', [RoomController::class, 'availability']);
    Route::delete('/rooms/{room}/view', [RoomController::class, 'clearView']);
    Route::get('/rooms/{room}/stats', [RoomController::class, 'stats']);
    Route::patch('/rooms/{room}/status', [RoomController::class, 'updateStatus']);
    Route::patch('/rooms/{room}/special', [RoomController::class, 'updateSpecial']);

    // Departments (read: all auth; write: admin only — see below)
    Route::get('/departments', [DepartmentController::class, 'index']);

    // Users
    Route::get('/users/receptionists', fn () =>
        response()->json(
            \App\Models\User::with('department')
                ->where('role', 'receptionist')
                ->where('on_duty', true)
                ->get()
                ->map(fn ($u) => [
                    'id'         => $u->id,
                    'name'       => $u->name,
                    'department' => $u->department?->name ?? '',
                    'ext'        => $u->ext,
                    'email'      => $u->email,
                    'avatar'     => $u->avatar,
                ])
        )
    );

    // User directory (all authenticated roles — minimal fields only)
    Route::get('/users/directory', [UserController::class, 'directory']);

    // Notifications
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::delete('/notifications', [NotificationController::class, 'clearAll']);
    Route::patch('/notifications/{notification}/read', [NotificationController::class, 'markRead']);

    // Bookings
    Route::get('/bookings', [BookingController::class, 'index']);
    Route::get('/bookings/my', [BookingController::class, 'myBookings']);
    Route::post('/bookings', [BookingController::class, 'store']);
    Route::delete('/bookings/clear-cancelled', [BookingController::class, 'clearCancelled']);
    Route::patch('/bookings/series/{seriesId}', [BookingController::class, 'seriesUpdate']);
    Route::delete('/bookings/series/{seriesId}', [BookingController::class, 'seriesDestroy']);
    Route::get('/bookings/{booking}', [BookingController::class, 'show']);
    Route::patch('/bookings/{booking}', [BookingController::class, 'update']);
    Route::delete('/bookings/{booking}', [BookingController::class, 'destroy']);

    // Assets (read scoped to managed buildings; write: building_admin+)
    Route::get('/assets', [AssetController::class, 'index']);

    // Building admin: manage rooms + assets within their buildings
    Route::middleware('can:building_admin')->group(function () {
        Route::post('/rooms', [RoomController::class, 'store']);
        Route::post('/rooms/reorder', [RoomController::class, 'reorder']);
        Route::patch('/rooms/{room}', [RoomController::class, 'update']);
        Route::delete('/rooms/{room}', [RoomController::class, 'destroy']);
        Route::post('/assets', [AssetController::class, 'store']);
        Route::patch('/assets/{asset}', [AssetController::class, 'update']);
        Route::delete('/assets/{asset}', [AssetController::class, 'destroy']);
        Route::post('/assets/{asset}/units', [AssetController::class, 'storeUnit']);
        Route::patch('/assets/{asset}/units/{unit}', [AssetController::class, 'updateUnit']);
        Route::delete('/assets/{asset}/units/{unit}', [AssetController::class, 'destroyUnit']);
    });

    // Super admin only: locations + buildings CRUD + user management + departments + settings
    Route::middleware('can:admin')->group(function () {
        Route::patch('/settings/booking-hours', [SettingController::class, 'updateBookingHours']);
        Route::patch('/settings/weekend', [SettingController::class, 'updateWeekendSettings']);
        Route::post('/departments', [DepartmentController::class, 'store']);
        Route::patch('/departments/{department}', [DepartmentController::class, 'update']);
        Route::delete('/departments/{department}', [DepartmentController::class, 'destroy']);
        Route::post('/locations', [LocationController::class, 'store']);
        Route::patch('/locations/{location}', [LocationController::class, 'update']);
        Route::delete('/locations/{location}', [LocationController::class, 'destroy']);
        Route::post('/buildings', [BuildingController::class, 'store']);
        Route::patch('/buildings/{building}', [BuildingController::class, 'update']);
        Route::delete('/buildings/{building}', [BuildingController::class, 'destroy']);
        Route::get('/users', [UserController::class, 'index']);
        Route::get('/users/export', fn () =>
            response()->json(
                \App\Models\User::with('department')->orderBy('role')->orderBy('name')->get()
                    ->map(fn ($u) => [
                        'name'       => $u->name,
                        'email'      => $u->email,
                        'password'   => $u->password,
                        'department' => $u->department?->name ?? '',
                        'role'       => $u->role,
                        'ext'        => $u->ext ?? '',
                    ])
            )
        );
        Route::post('/users', [UserController::class, 'store']);
        Route::post('/users/import', [UserController::class, 'importUsers']);
        Route::patch('/users/{user}', [UserController::class, 'update']);
        Route::patch('/users/{user}/role', [UserController::class, 'updateRole']);
        Route::put('/users/{user}/buildings', [UserController::class, 'assignBuildings']);
        Route::delete('/users/{user}', [UserController::class, 'destroy']);
    });
});
