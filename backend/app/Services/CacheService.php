<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Cache;

/**
 * Centralized caching service with standardized TTLs and cache tags.
 *
 * All cache keys follow the pattern: {entity}:{identifier}
 * TTLs are configured centrally for easy tuning.
 */
class CacheService
{
    // Standard TTLs in seconds
    private const TTL_CATEGORIES = 3600;     // 1 hour
    private const TTL_PLANS = 1800;          // 30 min
    private const TTL_PUBLIC_PROFILE = 300;  // 5 min
    private const TTL_TRUST_SCORE = 300;     // 5 min
    private const TTL_USER_RATINGS = 120;    // 2 min
    private const TTL_REQUEST_FEED = 30;     // 30 sec (real-time data)

    /**
     * Remember a value in cache, or compute and store it.
     */
    public function remember(string $key, int $ttl, callable $callback): mixed
    {
        return Cache::remember($key, $ttl, $callback);
    }

    /**
     * Invalidate cache entries matching a tag pattern.
     */
    public function invalidate(string $tag): void
    {
        Cache::forget($tag);
    }

    /**
     * Get cached categories or compute fresh.
     */
    public function getCategories(callable $callback): mixed
    {
        return $this->remember('categories:all', self::TTL_CATEGORIES, $callback);
    }

    /**
     * Get cached plans or compute fresh.
     */
    public function getPlans(callable $callback): mixed
    {
        return $this->remember('plans:all', self::TTL_PLANS, $callback);
    }

    /**
     * Get cached public profile or compute fresh.
     */
    public function getPublicProfile(string $userId, callable $callback): mixed
    {
        return $this->remember("user:{$userId}:public", self::TTL_PUBLIC_PROFILE, $callback);
    }

    /**
     * Get cached trust score or compute fresh.
     */
    public function getTrustScore(string $userId, callable $callback): mixed
    {
        return $this->remember("user:{$userId}:trust", self::TTL_TRUST_SCORE, $callback);
    }

    /**
     * Invalidate all caches related to a user.
     */
    public function invalidateUser(string $userId): void
    {
        Cache::forget("user:{$userId}:public");
        Cache::forget("user:{$userId}:trust");
    }

    /**
     * Invalidate categories cache (called when admin updates categories).
     */
    public function invalidateCategories(): void
    {
        Cache::forget('categories:all');
    }

    /**
     * Invalidate plans cache (called when admin updates plans).
     */
    public function invalidatePlans(): void
    {
        Cache::forget('plans:all');
    }
}
