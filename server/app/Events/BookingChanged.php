<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcast on a PUBLIC channel with a minimal payload only.
 * Carries no booking details — just enough for clients to invalidate the
 * relevant TanStack Query caches and refetch through the authenticated API
 * (which still enforces per-user visibility). This keeps the realtime layer
 * simple (no broadcasting-auth endpoint) without leaking sensitive data.
 */
class BookingChanged implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param string      $action created | updated | deleted | cleared
     * @param int|null    $id     affected booking id (null for series/bulk)
     * @param string|null $date   Y-m-d of the booking start, for targeted invalidation
     */
    public function __construct(
        public string $action,
        public ?int $id = null,
        public ?string $date = null,
    ) {}

    public function broadcastOn(): Channel
    {
        return new Channel('bookings');
    }

    public function broadcastAs(): string
    {
        return 'BookingChanged';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'action' => $this->action,
            'id'     => $this->id,
            'date'   => $this->date,
        ];
    }
}
