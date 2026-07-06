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
        // explicitly enabled it in Settings — otherwise use the admin-chosen fallback driver,
        // falling back to whatever .env has if that Setting was never saved.
        try {
            if (Schema::hasTable('settings')) {
                $get = fn (string $key) => Setting::where('key', $key)->value('value');

                if ($get('m365_mail_enabled') === 'true') {
                    config(['mail.default' => 'graph']);
                } elseif ($fallback = $get('mail_fallback_driver')) {
                    config(['mail.default' => $fallback]);
                }

                // SMTP connection details, admin-editable in Settings instead of .env.
                // Each key only overrides config when actually saved — untouched fields keep the .env value.
                if ($host = $get('smtp_host')) config(['mail.mailers.smtp.host' => $host]);
                if ($port = $get('smtp_port')) config(['mail.mailers.smtp.port' => (int) $port]);
                if (($enc = $get('smtp_encryption')) !== null) config(['mail.mailers.smtp.encryption' => $enc === 'none' ? null : $enc]);
                if ($user = $get('smtp_username')) config(['mail.mailers.smtp.username' => $user]);
                if ($encryptedPass = $get('smtp_password')) {
                    try { config(['mail.mailers.smtp.password' => Crypt::decryptString($encryptedPass)]); } catch (\Throwable $e) {}
                }
                if ($fromAddress = $get('smtp_from_address')) config(['mail.from.address' => $fromAddress]);
                if ($fromName = $get('smtp_from_name')) config(['mail.from.name' => $fromName]);
            }
        } catch (\Throwable $e) {
            // DB not reachable yet (e.g. during initial migrate) — keep the .env default mailer.
        }
    }
}
