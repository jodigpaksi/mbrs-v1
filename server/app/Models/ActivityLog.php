<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActivityLog extends Model
{
    const UPDATED_AT = null; // logs are immutable — only created_at

    protected $fillable = [
        'user_id', 'action', 'category', 'subject_type', 'subject_id',
        'description', 'metadata', 'ip_address',
    ];

    protected $casts = [
        'metadata'   => 'array',
        'created_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Record an admin/audit event. Wrapped so logging never breaks the action.
     *
     * @param string                              $action      e.g. 'booking.cancelled'
     * @param string                              $description human-readable line
     * @param \Illuminate\Database\Eloquent\Model|null $subject the affected record
     * @param array<string, mixed>                $metadata    extra context (old/new, etc.)
     */
    public static function record(string $action, string $description, ?Model $subject = null, array $metadata = []): void
    {
        try {
            static::create([
                'user_id'      => auth()->id(),
                'action'       => $action,
                'category'     => explode('.', $action)[0],
                'subject_type' => $subject ? class_basename($subject) : null,
                'subject_id'   => $subject?->getKey(),
                'description'  => $description,
                'metadata'     => $metadata ?: null,
                'ip_address'   => request()->ip(),
            ]);
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
