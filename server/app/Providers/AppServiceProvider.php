<?php

namespace App\Providers;

use App\Mail\Transport\BrevoTransport;
use App\Mail\Transport\GraphTransport;
use App\Mail\Transport\ResendTransport;
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

        $decrypt = function (string $encrypted): string {
            if (!$encrypted) return '';
            try { return Crypt::decryptString($encrypted); } catch (\Exception $e) { return ''; }
        };

        Mail::extend('graph', function () use ($decrypt) {
            $get = fn (string $key) => Setting::where('key', $key)->value('value') ?? '';
            return new GraphTransport(
                $get('m365_tenant_id'),
                $get('m365_client_id'),
                $decrypt($get('m365_client_secret')),
                $get('m365_sender_email'),
            );
        });

        Mail::extend('resend', function () use ($decrypt) {
            $get = fn (string $key) => Setting::where('key', $key)->value('value') ?? '';
            return new ResendTransport(
                $decrypt($get('resend_api_key')),
                $get('resend_from_address'),
                $get('resend_from_name'),
            );
        });

        Mail::extend('brevo', function () use ($decrypt) {
            $get = fn (string $key) => Setting::where('key', $key)->value('value') ?? '';
            return new BrevoTransport(
                $decrypt($get('brevo_api_key')),
                $get('brevo_from_address'),
                $get('brevo_from_name'),
            );
        });

        // Switch the default mailer to whichever provider an admin has selected as the
        // "active mailer" in Settings (Mailer group) — Microsoft 365 / Resend / Brevo.
        // No SMTP fallback/override is configured here — SMTP (Gmail) sending was
        // intentionally removed (ban/rate-limit risk on a free account sending to many
        // users). With no active mailer selected, mail.default stays whatever .env's
        // MAIL_MAILER says (currently 'array' — mail is discarded, not sent).
        try {
            if (Schema::hasTable('settings')) {
                $activeMailer = Setting::where('key', 'active_mailer')->value('value');
                $mailerMap = ['m365' => 'graph', 'resend' => 'resend', 'brevo' => 'brevo'];
                if (isset($mailerMap[$activeMailer])) {
                    config(['mail.default' => $mailerMap[$activeMailer]]);
                }
            }
        } catch (\Throwable $e) {
            // DB not reachable yet (e.g. during initial migrate) — keep the .env default mailer.
        }
    }
}
