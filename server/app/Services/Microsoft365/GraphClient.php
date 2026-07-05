<?php

namespace App\Services\Microsoft365;

use App\Models\Setting;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;

class GraphClient
{
    public static function credentials(): ?array
    {
        $get = fn (string $key) => Setting::where('key', $key)->value('value');
        $tenantId = $get('m365_tenant_id');
        $clientId = $get('m365_client_id');
        $encryptedSecret = $get('m365_client_secret');

        if (!$tenantId || !$clientId || !$encryptedSecret) {
            return null;
        }

        try {
            $clientSecret = Crypt::decryptString($encryptedSecret);
        } catch (\Exception $e) {
            return null;
        }

        return ['tenant_id' => $tenantId, 'client_id' => $clientId, 'client_secret' => $clientSecret];
    }

    /** @throws \RuntimeException */
    public static function getAccessToken(): string
    {
        $creds = self::credentials();
        if (!$creds) {
            throw new \RuntimeException('Microsoft 365 Tenant ID, Client ID, or Client Secret is not configured.');
        }

        $res = Http::asForm()->post("https://login.microsoftonline.com/{$creds['tenant_id']}/oauth2/v2.0/token", [
            'client_id'     => $creds['client_id'],
            'client_secret' => $creds['client_secret'],
            'scope'         => 'https://graph.microsoft.com/.default',
            'grant_type'    => 'client_credentials',
        ]);

        $token = $res->json('access_token');
        if (!$token) {
            $err = $res->json('error_description') ?? $res->json('error') ?? 'Unknown error acquiring Graph token.';
            throw new \RuntimeException("Microsoft Graph auth failed: {$err}");
        }

        return $token;
    }

    public static function isCalendarSyncEnabled(): bool
    {
        return Setting::where('key', 'm365_calendar_sync_enabled')->value('value') === 'true';
    }
}
