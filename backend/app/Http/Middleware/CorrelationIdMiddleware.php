<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Attach an X-Correlation-ID to every request/response pair.
 *
 * If the client sends an X-Correlation-ID header, it is reused.
 * Otherwise, a new UUID v4 is generated. The ID is added to the
 * response headers and made available to the application log context.
 */
class CorrelationIdMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $correlationId = $request->header('X-Correlation-ID', (string) Str::uuid());

        // Make it available globally
        $request->headers->set('X-Correlation-ID', $correlationId);
        app()->instance('correlation-id', $correlationId);

        $response = $next($request);
        $response->headers->set('X-Correlation-ID', $correlationId);

        return $response;
    }
}
