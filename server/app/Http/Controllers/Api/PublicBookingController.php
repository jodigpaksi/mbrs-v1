<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\BroadcastsBookingChanges;
use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Setting;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Unauthenticated endpoints reached via a signed, expiring link emailed to the
 * booking's recipient (reminder email). The Laravel `signed` route middleware
 * is the only authorization here — there is no login/session involved.
 */
class PublicBookingController extends Controller
{
    use BroadcastsBookingChanges;

    public function show(Booking $booking): JsonResponse
    {
        $booking->load(['room.building', 'user', 'bookedForUser']);
        $recipient = $booking->bookedForUser ?? $booking->user;

        $now = Carbon::parse(Carbon::now(Setting::businessTz())->format('Y-m-d H:i:s'));
        $started = Carbon::parse($booking->start_at) <= $now;
        $ended   = Carbon::parse($booking->end_at) <= $now;

        return response()->json([
            'id'          => $booking->id,
            'title'       => $booking->title,
            'description' => $booking->description,
            'start_at'    => $booking->start_at,
            'end_at'      => $booking->end_at,
            'status'      => $booking->status,
            'recipient_name'        => $recipient?->name,
            'presence_confirmed_at' => $booking->presence_confirmed_at,
            'room' => [
                'name'     => $booking->room?->name,
                'building' => $booking->room?->building?->name,
            ],
            'can_confirm' => $booking->status !== 'cancelled' && !$booking->presence_confirmed_at && $started && !$ended,
            'can_cancel'  => $booking->status !== 'cancelled' && !$ended,
        ]);
    }

    /**
     * Both actions share the exact same signed URI as show() (only the HTTP verb
     * differs) — a signed URL's signature is computed over the path + query only,
     * so confirm/cancel cannot live on separate sub-paths without breaking the
     * signature. The action is picked via a body param instead.
     */
    public function act(Request $request, Booking $booking): JsonResponse
    {
        $action = $request->validate(['action' => 'required|in:confirm,cancel'])['action'];

        return $action === 'confirm'
            ? $this->confirmPresence($booking)
            : $this->cancel($booking);
    }

    private function confirmPresence(Booking $booking): JsonResponse
    {
        if ($booking->status === 'cancelled') {
            return response()->json(['message' => 'This booking has already been cancelled.'], 422);
        }

        $now = Carbon::parse(Carbon::now(Setting::businessTz())->format('Y-m-d H:i:s'));
        if (Carbon::parse($booking->start_at) > $now) {
            return response()->json(['message' => 'This booking has not started yet.'], 422);
        }
        if (Carbon::parse($booking->end_at) <= $now) {
            return response()->json(['message' => 'This booking has already ended.'], 422);
        }

        if (!$booking->presence_confirmed_at) {
            $booking->update(['presence_confirmed_at' => $now]);
            $this->broadcastChange('presence_confirmed', $booking);
        }

        return response()->json(['presence_confirmed_at' => $booking->presence_confirmed_at]);
    }

    private function cancel(Booking $booking): JsonResponse
    {
        if ($booking->status === 'cancelled') {
            return response()->json(['message' => 'This booking has already been cancelled.'], 422);
        }

        $booking->update(['status' => 'cancelled', 'cancelled_at' => now()]);

        $this->logCancellation($booking, ' via emailed link');
        $this->broadcastChange('updated', $booking);

        return response()->json(['message' => 'Booking cancelled']);
    }
}
