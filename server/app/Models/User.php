<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, HasApiTokens;

    protected $fillable = [
        'name',
        'email',
        'password',
        'department_id',
        'role',
        'ext',
        'avatar',
        'on_duty',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $appends = ['department_name'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'on_duty' => 'boolean',
        ];
    }

    public function getDepartmentNameAttribute(): string
    {
        return $this->relationLoaded('department') ? ($this->department?->name ?? '') : '';
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    public function adminBuildings(): BelongsToMany
    {
        return $this->belongsToMany(Building::class, 'admin_buildings');
    }

    /** Returns building IDs this user can manage. Empty array = unrestricted (super admin). */
    public function managedBuildingIds(): array
    {
        if ($this->role === 'admin') return [];
        return $this->adminBuildings()->pluck('buildings.id')->toArray();
    }

    public function canManageBuilding(int $buildingId): bool
    {
        if ($this->role === 'admin') return true;
        return in_array($buildingId, $this->managedBuildingIds());
    }

    /** Whether this user has any scoped-access role (not regular user). */
    public function isScopedStaff(): bool
    {
        return in_array($this->role, ['admin', 'building_admin', 'receptionist']);
    }
}
