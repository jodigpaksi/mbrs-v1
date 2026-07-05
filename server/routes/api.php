<?php

use App\Http\Controllers\Api\AnalyticsController;
use App\Http\Controllers\Api\ArchiveController;
use App\Http\Controllers\Api\KioskController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\BuildingController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\LocationController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\RoomController;
use App\Http\Controllers\Api\SensorController;
use App\Http\Controllers\Api\SettingController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

// Auth
Route::post('/login', [AuthController::class, 'login']);
Route::post('/login/guest', [AuthController::class, 'loginAsGuest']);

// Public branding (no auth)
Route::get('/settings/branding', [SettingController::class, 'branding']);

// Sensor — ESP32 presence ping (no user auth, token validated in controller)
Route::post('/sensor/ping', [SensorController::class, 'ping']);

// Kiosk — public (no auth required)
Route::prefix('kiosk')->group(function () {
    Route::get('{id}/config', [KioskController::class, 'publicConfig']);
    Route::post('{id}/verify', [KioskController::class, 'verifyPin']);
    Route::get('{id}/status', [KioskController::class, 'publicStatus']);
    Route::post('{id}/confirm', [KioskController::class, 'confirmPresence']);
});

Route::middleware(['auth:sanctum', 'guest.readonly'])->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/me/avatar', [AuthController::class, 'updateAvatar']);
    Route::delete('/me/avatar', [AuthController::class, 'removeAvatar']);
    Route::patch('/me/password', [AuthController::class, 'updatePassword']);
    Route::patch('/me/on-duty', [AuthController::class, 'updateOnDuty']);
    Route::patch('/me/preferences', [AuthController::class, 'updatePreferences']);

    // Settings (read: all auth)
    Route::get('/settings/booking-hours', [SettingController::class, 'bookingHours']);
    Route::get('/settings/weekend', [SettingController::class, 'weekendSettings']);
    Route::get('/settings/general', [SettingController::class, 'generalSettings']);
    Route::get('/settings/after-hours-contacts', [SettingController::class, 'afterHoursContacts']);
    Route::get('/settings/special-room-contacts', [SettingController::class, 'specialRoomContacts']);

    // Receptionist-level settings (admin + receptionist)
    Route::middleware('can:receptionist')->group(function () {
        Route::patch('/settings/after-hours-contacts', [SettingController::class, 'updateAfterHoursContacts']);
        Route::patch('/settings/special-room-contacts', [SettingController::class, 'updateSpecialRoomContacts']);
    });

    // Locations (read: all auth)
    Route::get('/locations', [LocationController::class, 'index']);

    // Buildings (read: all auth)
    Route::get('/buildings', [BuildingController::class, 'index']);
    Route::get('/buildings/{building}', [BuildingController::class, 'show'])->where('building', '[0-9]+');

    // Rooms (read: all auth)
    Route::get('/rooms', [RoomController::class, 'index']);
    Route::get('/rooms/available', [RoomController::class, 'available']);
    Route::get('/rooms/{room}', [RoomController::class, 'show'])->where('room', '[0-9]+');
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
    Route::post('/bookings/{booking}/confirm-presence', [BookingController::class, 'confirmPresenceWeb']);
    Route::post('/bookings/{booking}/transfer', [BookingController::class, 'transfer'])->middleware('can:receptionist');
    Route::post('/bookings/{booking}/dispute', [BookingController::class, 'submitDispute']);

    // Disputes — accessible to admin, receptionist, building_admin (controller enforces role)
    Route::get('/disputes', [BookingController::class, 'disputeIndex']);
    Route::post('/disputes/{booking}/resolve', [BookingController::class, 'resolveDispute']);

    // Building admin: manage rooms within their buildings
    Route::middleware('can:building_admin')->group(function () {
        Route::post('/rooms', [RoomController::class, 'store']);
        Route::post('/rooms/reorder', [RoomController::class, 'reorder']);
        Route::patch('/rooms/{room}', [RoomController::class, 'update']);
        Route::delete('/rooms/{room}', [RoomController::class, 'destroy']);
        Route::post('/rooms/{room}/photo', [RoomController::class, 'uploadPhoto']);
        Route::delete('/rooms/{room}/photo', [RoomController::class, 'deletePhoto']);
        Route::post('/rooms/{room}/sensor-code/regenerate', [RoomController::class, 'regenerateSensorCode']);
        Route::get('/rooms/export', [RoomController::class, 'export']);
        Route::post('/rooms/import', [RoomController::class, 'importRooms']);
    });

    // Analytics (all authenticated)
    Route::get('/analytics/overview', [AnalyticsController::class, 'overview']);
    Route::get('/analytics/report',   [AnalyticsController::class, 'report']);
    Route::get('/analytics/export',   [AnalyticsController::class, 'export']);

    // Super admin only: locations + buildings CRUD + user management + departments + settings
    Route::middleware('can:admin')->group(function () {
        Route::patch('/settings/booking-hours', [SettingController::class, 'updateBookingHours']);
        Route::patch('/settings/weekend', [SettingController::class, 'updateWeekendSettings']);
        Route::patch('/settings/general', [SettingController::class, 'updateGeneralSettings']);
        Route::post('/settings/logo', [SettingController::class, 'uploadLogo']);
        Route::delete('/settings/logo', [SettingController::class, 'deleteLogo']);
        Route::post('/settings/login-photo', [SettingController::class, 'uploadLoginPhoto']);
        Route::delete('/settings/login-photo', [SettingController::class, 'deleteLoginPhoto']);
        Route::get('/settings/m365', [SettingController::class, 'm365Settings']);
        Route::patch('/settings/m365', [SettingController::class, 'updateM365Settings']);
        Route::post('/settings/m365/test', [SettingController::class, 'testM365Connection']);
        Route::post('/settings/m365/test-email', [SettingController::class, 'sendM365TestEmail']);
        Route::patch('/users/{user}/special-access', [UserController::class, 'toggleSpecialAccess']);
        Route::get('/archive', [ArchiveController::class, 'index']);
        Route::post('/archive/run', [ArchiveController::class, 'run']);
        Route::patch('/archive/{booking}/restore', [ArchiveController::class, 'restore']);
        Route::post('/archive/restore-all', [ArchiveController::class, 'restoreAll']);
        Route::delete('/archive/purge', [ArchiveController::class, 'purge']);
        Route::post('/archive/import', [ArchiveController::class, 'import']);
        Route::post('/backup/export', [\App\Http\Controllers\Api\BackupController::class, 'runExport']);
        Route::get('/backups', [\App\Http\Controllers\Api\BackupController::class, 'listExports']);
        Route::get('/backups/download', [\App\Http\Controllers\Api\BackupController::class, 'downloadExport']);
        Route::delete('/backups/all', [\App\Http\Controllers\Api\BackupController::class, 'deleteAllExports']);
        Route::post('/departments', [DepartmentController::class, 'store']);
        Route::patch('/departments/{department}', [DepartmentController::class, 'update']);
        Route::delete('/departments/{department}', [DepartmentController::class, 'destroy']);
        Route::post('/locations', [LocationController::class, 'store']);
        Route::patch('/locations/{location}', [LocationController::class, 'update']);
        Route::delete('/locations/{location}', [LocationController::class, 'destroy']);
        // Activity log export/clear (admin only) — reading the list is also allowed for building_admin, scoped, see below
        Route::get('/activity-logs/export', [\App\Http\Controllers\Api\ActivityLogController::class, 'export']);
        Route::delete('/activity-logs/all', [\App\Http\Controllers\Api\ActivityLogController::class, 'clearAll']);

        // Kiosk CRUD (admin only)
        Route::get('/kiosk-configs', [KioskController::class, 'index']);
        Route::post('/kiosk-configs', [KioskController::class, 'store']);
        Route::patch('/kiosk-configs/{id}', [KioskController::class, 'update']);
        Route::delete('/kiosk-configs/{id}', [KioskController::class, 'destroy']);

        Route::post('/buildings', [BuildingController::class, 'store']);
        Route::patch('/buildings/{building}', [BuildingController::class, 'update']);
        Route::delete('/buildings/{building}', [BuildingController::class, 'destroy']);
        Route::get('/buildings/export', [BuildingController::class, 'export']);
        Route::post('/buildings/import', [BuildingController::class, 'importBuildings']);
        Route::get('/users/export', function () {
            $rows = \App\Models\User::with('department.location', 'defaultBuilding', 'adminBuildings')->orderBy('role')->orderBy('name')->get();
            \App\Models\ActivityLog::record(
                'data.exported',
                "Exported {$rows->count()} user records (incl. credentials)",
                null,
                ['type' => 'users', 'count' => $rows->count()],
            );
            return response()->json(
                $rows->map(fn ($u) => [
                    'name'                => $u->name,
                    'email'               => $u->email,
                    'alias'               => $u->alias ?? '',
                    'password'            => $u->password,
                    'department'          => $u->department?->name ?? '',
                    'department_location' => $u->department?->location?->name ?? '',
                    'role'                => $u->role,
                    'ext'                 => $u->ext ?? '',
                    'default_building'    => $u->defaultBuilding?->name ?? '',
                    'assigned_buildings'  => $u->adminBuildings->pluck('name')->implode(', '),
                ])
            );
        });
        Route::post('/users', [UserController::class, 'store']);
        Route::post('/users/import', [UserController::class, 'importUsers']);
        Route::patch('/users/{user}', [UserController::class, 'update']);
        Route::patch('/users/{user}/role', [UserController::class, 'updateRole']);
        Route::put('/users/{user}/buildings', [UserController::class, 'assignBuildings']);
        Route::delete('/users/{user}', [UserController::class, 'destroy']);
    });

    // Read-only, building-scoped for building_admin; unrestricted for admin
    Route::middleware('can:building_admin')->group(function () {
        Route::get('/users', [UserController::class, 'index']);
        Route::get('/activity-logs', [\App\Http\Controllers\Api\ActivityLogController::class, 'index']);
    });
});
