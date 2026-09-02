<?php

declare(strict_types=1);

namespace Tests\Feature\Kyc;

use App\Enums\UserRole;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class BankAccountTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleAndPermissionSeeder::class);
    }

    #[Test]
    public function first_bank_save_is_allowed_and_does_not_lock(): void
    {
        [$user, $token] = $this->user();

        $this->withToken($token)->postJson('/api/v1/kyc/bank-account', $this->bank('044', '0123456789'))
            ->assertCreated();

        $this->assertNull($user->fresh()->bank_changed_at);
        $this->assertDatabaseHas('bank_accounts', ['user_id' => $user->id, 'account_number' => '0123456789']);
    }

    #[Test]
    public function identical_resave_is_allowed_and_does_not_count(): void
    {
        [$user, $token] = $this->user();

        $this->withToken($token)->postJson('/api/v1/kyc/bank-account', $this->bank('044', '0123456789'))
            ->assertCreated();
        $this->withToken($token)->postJson('/api/v1/kyc/bank-account', $this->bank('044', '0123456789'))
            ->assertCreated();

        $this->assertNull($user->fresh()->bank_changed_at);
        $this->assertDatabaseCount('bank_accounts', 1);
    }

    #[Test]
    public function second_change_in_same_month_is_locked(): void
    {
        [$user, $token] = $this->user();

        // First save, then a real change in the same month
        $this->withToken($token)->postJson('/api/v1/kyc/bank-account', $this->bank('044', '0123456789'))
            ->assertCreated();
        $this->withToken($token)->postJson('/api/v1/kyc/bank-account', $this->bank('058', '9876543210'))
            ->assertCreated();

        $this->assertNotNull($user->fresh()->bank_changed_at);

        // Third change attempt in the same month → locked
        $this->withToken($token)->postJson('/api/v1/kyc/bank-account', $this->bank('011', '5555555555'))
            ->assertStatus(422)
            ->assertJsonPath('code', 'bank_change_locked')
            ->assertJsonPath('next_change_at', now()->addMonthNoOverflow()->startOfMonth()->toDateString());

        // Bank C must not have been persisted — still bank B
        $this->assertDatabaseHas('bank_accounts', ['user_id' => $user->id, 'account_number' => '9876543210']);
        $this->assertDatabaseMissing('bank_accounts', ['user_id' => $user->id, 'account_number' => '5555555555']);
    }

    #[Test]
    public function change_in_next_month_is_allowed(): void
    {
        [$user, $token] = $this->user();

        $this->withToken($token)->postJson('/api/v1/kyc/bank-account', $this->bank('044', '0123456789'))
            ->assertCreated();

        // Pretend the change happened last month
        $user->update(['bank_changed_at' => now()->subMonth()]);

        $this->withToken($token)->postJson('/api/v1/kyc/bank-account', $this->bank('058', '9876543210'))
            ->assertCreated();

        $this->assertDatabaseHas('bank_accounts', ['user_id' => $user->id, 'account_number' => '9876543210']);
    }

    #[Test]
    public function wallet_bank_account_endpoint_reports_lock_state(): void
    {
        [$user, $token] = $this->user();

        // No bank yet
        $this->withToken($token)->getJson('/api/v1/wallet/bank-account')
            ->assertOk()
            ->assertJsonPath('data.bank_account', null)
            ->assertJsonPath('data.change_locked', false)
            ->assertJsonPath('data.next_change_at', null);

        // First save — masked account, still unlocked
        $this->withToken($token)->postJson('/api/v1/kyc/bank-account', $this->bank('044', '0123456789'))
            ->assertCreated();

        $this->withToken($token)->getJson('/api/v1/wallet/bank-account')
            ->assertOk()
            ->assertJsonPath('data.bank_account.account_number', '****6789')
            ->assertJsonPath('data.change_locked', false);

        // Real change → locked for the rest of the month
        $this->withToken($token)->postJson('/api/v1/kyc/bank-account', $this->bank('058', '9876543210'))
            ->assertCreated();

        $this->withToken($token)->getJson('/api/v1/wallet/bank-account')
            ->assertOk()
            ->assertJsonPath('data.change_locked', true)
            ->assertJsonPath('data.next_change_at', now()->addMonthNoOverflow()->startOfMonth()->toDateString());
    }

    private function user(): array
    {
        $user = User::factory()->requester()->create([
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
            'kyc_tier' => 1,
        ]);
        $user->assignRole(UserRole::Requester);

        return [$user, $user->createToken('test')->plainTextToken];
    }

    private function bank(string $bankCode, string $accountNumber): array
    {
        return [
            'bank_name' => 'Test Bank',
            'bank_code' => $bankCode,
            'account_number' => $accountNumber,
            'account_name' => 'John Doe',
        ];
    }
}
