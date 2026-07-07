<?php

namespace App\Providers;

use App\Mail\Transport\GraphTransport;
use App\Models\Setting;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        Gate::define('admin', fn ($user) => $user->role === 'admin');
        Gate::define('building_admin', fn ($user) => in_array($user->role, ['admin', 'building_admin']));
        Gate::define('receptionist', fn ($user) => in_array($user->role, ['admin', 'receptionist']));

        Mail::extend('graph', function () {
            $get = fn (string $key) => Setting::where('key', $key)->value('value') ?? '';
            $encryptedSecret = $get('m365_client_secret');
            $secret = '';
            if ($encryptedSecret) {
                try { $secret = Crypt::decryptString($encryptedSecret); } catch (\Exception $e) { $secret = ''; }
            }

            return new GraphTransport(
                $get('m365_tenant_id'),
                $get('m365_client_id'),
                $secret,
                $get('m365_sender_email'),
            );
        });

        // Switch the default mailer to Microsoft 365 (Graph API) only once an admin has
        // explicitly enabled it in Settings. No SMTP fallback/override is configured here —
        // SMTP (Gmail) sending was intentionally removed (ban/rate-limit risk on a free account
        // sending to many users). With M365 off, mail.default stays whatever .env's MAIL_MAILER
        // says (currently 'array' — mail is discarded, not sent, until M365 or another provider
        // like Brevo is wired up).
        try {
            if (Schema::hasTable('settings') && Setting::where('key', 'm365_mail_enabled')->value('value') === 'true') {
                config(['mail.default' => 'graph']);
            }
        } catch (\Throwable $e) {
            // DB not reachable yet (e.g. during initial migrate) — keep the .env default mailer.
        }
    }
}
