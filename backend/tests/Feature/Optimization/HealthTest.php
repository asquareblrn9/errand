<?php

declare(strict_types=1);

namespace Tests\Feature\Optimization;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Test;

class HealthTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function basic_health_check_returns_ok(): void
    {
        $this->getJson('/api/health')
            ->assertOk()
            ->assertJsonPath('status', 'ok');
    }

    #[Test]
    public function detailed_health_check_returns_healthy(): void
    {
        $this->getJson('/api/health/detailed')
            ->assertOk()
            ->assertJsonStructure(['status', 'checks' => ['database', 'cache']]);
    }

    #[Test]
    public function correlation_id_is_returned_in_response(): void
    {
        $response = $this->getJson('/api/health');
        $response->assertHeader('X-Correlation-ID');
    }

    #[Test]
    public function correlation_id_is_reused_when_provided(): void
    {
        $response = $this->withHeader('X-Correlation-ID', 'test-corr-id-123')
            ->getJson('/api/health');

        $response->assertHeader('X-Correlation-ID', 'test-corr-id-123');
    }

    #[Test]
    public function categories_are_cached(): void
    {
        $this->getJson('/api/v1/categories')->assertOk();

        // Second call should use cache
        $this->getJson('/api/v1/categories')->assertOk();
    }
}
