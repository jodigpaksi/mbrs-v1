<?php

namespace App\Providers;

use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        Gate::define('admin', fn ($user) => $user->role === 'admin');
        // building_admin can access building-scoped management routes
        Gate::define('building_admin', fn ($user) => in_array($user->role, ['admin', 'building_admin']));
    }
}
