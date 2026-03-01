<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ApiTokenMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->header('X-API-TOKEN');
        $expectedToken = env('API_TOKEN', 'default-token-123');

        if ($token !== $expectedToken) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        return $next($request);
    }
}
