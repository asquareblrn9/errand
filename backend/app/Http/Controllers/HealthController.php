<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class HealthController extends Controller
{
    /**
     * Basic health check (for load balancer).
     *
     * GET /health
     */
    public function basic(): JsonResponse
    {
        return response()->json([
            'status' => 'ok',
            'timestamp' => now()->toISOString(),
        ]);
    }

    /**
     * Detailed health check with dependency status (admin only).
     *
     * GET /health/detailed
     */
    public function detailed(): JsonResponse
    {
        $checks = [
            'database' => $this->checkDatabase(),
            'cache' => $this->checkCache(),
            'timestamp' => now()->toISOString(),
        ];

        $healthy = ! in_array(false, [
            $checks['database']['ok'],
            $checks['cache']['ok'],
        ], true);

        return response()->json([
            'status' => $healthy ? 'healthy' : 'degraded',
            'checks' => $checks,
        ], $healthy ? 200 : 503);
    }

    private function checkDatabase(): array
    {
        try {
            DB::connection()->getPdo();
            DB::select('SELECT 1');
            return ['ok' => true, 'latency_ms' => $this->measureLatency(fn () => DB::select('SELECT 1'))];
        } catch (\Throwable $e) {
            return ['ok' => false, 'error' => $e->getMessage()];
        }
    }

    private function checkCache(): array
    {
        try {
            $key = 'health:check:' . now()->timestamp;
            Cache::put($key, true, 10);
            $value = Cache::get($key);
            return ['ok' => $value === true, 'driver' => config('cache.default')];
        } catch (\Throwable $e) {
            return ['ok' => false, 'error' => $e->getMessage()];
        }
    }

    private function measureLatency(callable $fn): float
    {
        $start = microtime(true);
        $fn();
        return round((microtime(true) - $start) * 1000, 2);
    }
}
