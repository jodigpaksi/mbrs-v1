<?php

namespace App\Services\Microsoft365;

use App\Models\Booking;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GraphCalendarSync
{
    /**
     * Best-effort: creates an Outlook/Teams calendar event for a newly created booking.
     * Never throws — calendar sync failures must not block booking creation.
     */
    public static function syncCreate(Booking $booking): void
    {
        if (!GraphClient::isCalendarSyncEnabled()) return;

        $recipient = $booking->bookedForUser ?? $booking->user;
        if (!$recipient || !$recipient->email) return;

        try {
            $token = GraphClient::getAccessToken();
            $tz = \App\Models\Setting::businessTz();

            $payload = [
                'subject' => $booking->title,
                'body' => [
                    'contentType' => 'Text',
                    'content' => $booking->description ?? '',
                ],
                'start' => [
                    'dateTime' => \Carbon\Carbon::parse($booking->start_at)->format('Y-m-d\TH:i:s'),
                    'timeZone' => $tz,
                ],
                'end' => [
                    'dateTime' => \Carbon\Carbon::parse($booking->end_at)->format('Y-m-d\TH:i:s'),
                    'timeZone' => $tz,
                ],
                'location' => [
                    'displayName' => $booking->room?->name ?? '',
                ],
            ];

            $res = Http::withToken($token)
                ->post("https://graph.microsoft.com/v1.0/users/{$recipient->email}/events", $payload);

            if ($res->successful()) {
                $booking->update(['m365_event_id' => $res->json('id')]);
            } else {
                Log::warning("M365 calendar sync failed for booking #{$booking->id}: " . $res->body());
            }
        } catch (\Throwable $e) {
            Log::warning("M365 calendar sync failed for booking #{$booking->id}: " . $e->getMessage());
        }
    }
}
