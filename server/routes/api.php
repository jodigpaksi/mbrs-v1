<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\RoomController;
use Illuminate\Support\Facades\Route;

// Auth
Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/me/avatar', [AuthController::class, 'updateAvatar']);
    Route::patch('/me/password', [AuthController::class, 'updatePassword']);

    // Rooms
    Route::get('/rooms', [RoomController::class, 'index']);
    Route::get('/rooms/{room}', [RoomController::class, 'show']);
    Route::get('/rooms/{room}/availability', [RoomController::class, 'availability']);
    Route::delete('/rooms/{room}/view', [RoomController::class, 'clearView']);
    Route::get('/rooms/{room}/stats', [RoomController::class, 'stats']);
    Route::patch('/rooms/{room}/status', [RoomController::class, 'updateStatus']);

    // Users (receptionists list for contact popup)
    Route::get('/users/receptionists', function () {
        return response()->json(\App\Models\User::where('role', 'receptionist')->get(['id', 'name', 'department', 'ext', 'avatar']));
    });

    // Bookings
    Route::get('/bookings', [BookingController::class, 'index']);
    Route::get('/bookings/my', [BookingController::class, 'myBookings']);
    Route::post('/bookings', [BookingController::class, 'store']);
    Route::delete('/bookings/clear-cancelled', [BookingController::class, 'clearCancelled']);
    Route::get('/bookings/{booking}', [BookingController::class, 'show']);
    Route::patch('/bookings/{booking}', [BookingController::class, 'update']);
    Route::delete('/bookings/{booking}', [BookingController::class, 'destroy']);

    // Admin only
    Route::middleware('can:admin')->group(function () {
        Route::post('/rooms', [RoomController::class, 'store']);
        Route::patch('/rooms/{room}', [RoomController::class, 'update']);
        Route::delete('/rooms/{room}', [RoomController::class, 'destroy']);
    });
});
