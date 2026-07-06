<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class BlockGuestWrites
{
    /**
     * Guest is a shared, read-only account: block every non-GET request
     * except logout (so a guest can still end their own session).
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $isWrite = !in_array($request->method(), ['GET', 'HEAD']);

        if ($user && $user->role === 'guest' && $isWrite && !$request->is('api/logout')) {
            return response()->json(['message' => 'Guest access is read-only.'], 403);
        }

        return $next($request);
    }
}
