<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * PaystackService
 *
 * Handles:
 *  - Bank account resolution (verify account number → account name)
 *  - Payment link generation (wallet funding)
 *  - Transfers (withdrawals to bank accounts)
 *  - Transaction verification
 *
 * API docs: https://paystack.com/docs/api/
 */
class PaystackService
{
    private string $baseUrl;

    private string $secretKey;

    public function __construct()
    {
        $this->baseUrl = (string) config('services.paystack.base_url', 'https://api.paystack.co');
        $this->secretKey = (string) config('services.paystack.secret_key', '');
    }

    // ── Bank Verification ────────────────────────────────────

    /**
     * Resolve a bank account number to get the account holder's name.
     *
     * @return array{account_name: string, account_number: string, bank_code: string}
     */
    public function resolveAccount(string $accountNumber, string $bankCode): array
    {
        $response = Http::withToken($this->secretKey)
            ->get("{$this->baseUrl}/bank/resolve", [
                'account_number' => $accountNumber,
                'bank_code' => $bankCode,
            ]);

        if (! $response->successful()) {
            Log::warning('Paystack: Account resolution failed', [
                'account_number' => $accountNumber,
                'bank_code' => $bankCode,
                'response' => $response->json(),
            ]);

            throw new \InvalidArgumentException(
                $response->json('message', 'Could not verify account. Please check the account number and bank.')
            );
        }

        $data = $response->json('data');

        return [
            'account_name' => $data['account_name'],
            'account_number' => $data['account_number'],
            'bank_code' => $bankCode,
        ];
    }

    /**
     * Get list of banks supported by Paystack.
     */
    public function getBanks(): array
    {
        $response = Http::withToken($this->secretKey)
            ->get("{$this->baseUrl}/bank", [
                'currency' => 'NGN',
            ]);

        if (! $response->successful()) {
            return [];
        }

        return collect($response->json('data'))
            ->map(fn (array $bank) => [
                'name' => $bank['name'],
                'code' => $bank['code'],
            ])
            ->sortBy('name')
            ->values()
            ->toArray();
    }

    // ── Wallet Funding ───────────────────────────────────────

    /**
     * Initialize a Paystack transaction for wallet funding.
     *
     * Returns a payment URL the user should be redirected to.
     *
     * @return array{authorization_url: string, reference: string, access_code: string}
     */
    public function initializeFunding(string $email, float $amount, string $reference, ?string $redirectUrl = null): array
    {
        $redirectUrl ??= config('app.frontend_url').'/wallet?funded=true&provider=paystack';
        $amountInKobo = (int) round($amount * 100);

        $response = Http::withToken($this->secretKey)
            ->post("{$this->baseUrl}/transaction/initialize", [
                'email' => $email,
                'amount' => $amountInKobo,
                'reference' => $reference,
                'callback_url' => $redirectUrl,
                'metadata' => [
                    'type' => 'wallet_funding',
                ],
                'channels' => ['card', 'bank', 'ussd', 'bank_transfer'],
            ]);

        if (! $response->successful()) {
            Log::error('Paystack: Funding initialization failed', [
                'email' => $email,
                'amount' => $amount,
                'response' => $response->json(),
            ]);

            throw new \InvalidArgumentException(
                $response->json('message', 'Could not initialize payment. Please try again.')
            );
        }

        $data = $response->json('data');

        return [
            'authorization_url' => $data['authorization_url'],
            'reference' => $data['reference'],
            'access_code' => $data['access_code'],
        ];
    }

    /**
     * Verify a Paystack transaction by reference.
     */
    public function verifyTransaction(string $reference): array
    {
        $response = Http::withToken($this->secretKey)
            ->get("{$this->baseUrl}/transaction/verify/{$reference}");

        if (! $response->successful()) {
            throw new \InvalidArgumentException('Could not verify transaction.');
        }

        return $response->json('data');
    }

    // ── Transfers (Withdrawals) ──────────────────────────────

    /**
     * Create a transfer recipient (bank account destination).
     */
    public function createTransferRecipient(
        string $name,
        string $accountNumber,
        string $bankCode,
    ): string {
        $response = Http::withToken($this->secretKey)
            ->post("{$this->baseUrl}/transferrecipient", [
                'type' => 'nuban',
                'name' => $name,
                'account_number' => $accountNumber,
                'bank_code' => $bankCode,
                'currency' => 'NGN',
            ]);

        if (! $response->successful()) {
            Log::error('Paystack: Transfer recipient creation failed', [
                'account_number' => $accountNumber,
                'bank_code' => $bankCode,
                'response' => $response->json(),
            ]);

            throw new \InvalidArgumentException(
                $response->json('message', 'Could not create transfer recipient. Please check your bank details.')
            );
        }

        return $response->json('data.recipient_code');
    }

    /**
     * Initiate a transfer to a bank account.
     *
     * @param  string  $recipientCode  Paystack recipient code
     * @param  float  $amount  Amount in Naira
     * @param  string  $reason  Transfer narration
     * @param  string  $reference  Unique reference
     * @return array{transfer_code: string, reference: string, status: string}
     */
    public function initiateTransfer(
        string $recipientCode,
        float $amount,
        string $reason,
        string $reference,
    ): array {
        $amountInKobo = (int) round($amount * 100);

        $response = Http::withToken($this->secretKey)
            ->post("{$this->baseUrl}/transfer", [
                'source' => 'balance',
                'reason' => $reason,
                'amount' => $amountInKobo,
                'recipient' => $recipientCode,
                'reference' => $reference,
            ]);

        if (! $response->successful()) {
            Log::error('Paystack: Transfer initiation failed', [
                'recipient_code' => $recipientCode,
                'amount' => $amount,
                'response' => $response->json(),
            ]);

            throw new \InvalidArgumentException(
                $response->json('message', 'Could not initiate transfer. Please try again.')
            );
        }

        $data = $response->json('data');

        return [
            'transfer_code' => $data['transfer_code'],
            'reference' => $data['reference'],
            'status' => $data['status'],
        ];
    }

    /**
     * Fetch balance from Paystack.
     */
    public function getBalance(): array
    {
        $response = Http::withToken($this->secretKey)
            ->get("{$this->baseUrl}/balance");

        if (! $response->successful()) {
            return [];
        }

        return $response->json('data');
    }
}
