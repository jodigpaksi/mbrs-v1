<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExtEditLog extends Model
{
    const UPDATED_AT = null; // logs are immutable — only created_at

    protected $fillable = [
        'target_user_id', 'editor_user_id', 'changed_fields',
    ];

    protected $casts = [
        'changed_fields' => 'array',
        'created_at'     => 'datetime',
    ];

    public function targetUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'target_user_id');
    }

    public function editorUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'editor_user_id');
    }
}
