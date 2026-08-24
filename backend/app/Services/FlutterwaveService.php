<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * FlutterwaveService
 *
 * Handles:
 *  - Payment link generation (wallet funding)
 *  - Bank account resolution
 *  - Transfers (withdrawals)
 *  - Transaction verification
 *
 * API docs: https://developer.flutterwave.com/reference
 */
class FlutterwaveService
{
    private string $baseUrl;

    private string $secretKey;

    public function __construct()
    {
        $this->baseUrl = (string) config('services.flutterwave.base_url', 'https://api.flutterwave.com/v3');
        $this->secretKey = (string) config('services.flutterwave.secret_key', '');
    }

    // ── Bank Verification ────────────────────────────────────

    /**
     * Resolve a bank account number via Flutterwave.
     *
     * @return array{account_name: string, account_number: string}
     */
    public function resolveAccount(string $accountNumber, string $bankCode): array
    {
        $response = Http::withToken($this->secretKey)
            ->post("{$this->baseUrl}/accounts/resolve", [
                'account_number' => $accountNumber,
                'account_bank' => $bankCode,
            ]);

        if (! $response->successful()) {
            Log::warning('Flutterwave: Account resolution failed', [
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
        ];
    }

    /**
     * Get list of Nigerian banks supported by Flutterwave.
     */
    public function getBanks(): array
    {
        $response = Http::withToken($this->secretKey)
            ->get("{$this->baseUrl}/banks/NG");

        if (! $response->successful()) {
            return [];
        }

        return collect($response->json('data'))
            ->map(fn (array $bank) => [
                'name' => $bank['name'],
                'code' => $bank['code'],
            ])
            ->unique('code')
            ->sortBy('name')
            ->values()
            ->toArray();
    }

    // ── Wallet Funding ───────────────────────────────────────

    /**
     * Initialize a Flutterwave payment for wallet funding.
     *
     * @return array{link: string, tx_ref: string}
     */
    public function initializeFunding(
        string $email,
        float $amount,
        string $reference,
        string $customerName = '',
        string $customerPhone = '',
        ?string $redirectUrl = null,
    ): array {
        $redirectUrl ??= config('app.frontend_url').'/wallet?funded=true&provider=flutterwave';

        $response = Http::withToken($this->secretKey)
            ->post("{$this->baseUrl}/payments", [
                'tx_ref' => $reference,
                'amount' => $amount,
                'currency' => 'NGN',
                'redirect_url' => $redirectUrl,
                'payment_options' => 'card,banktransfer,ussd',
                'customer' => [
                    'email' => $email,
                    'name' => $customerName,
                    'phonenumber' => $customerPhone,
                ],
                'meta' => [
                    'type' => 'wallet_funding',
                ],
                'customizations' => [
                    'title' => 'Errand Boy Wallet',
                    'description' => 'Fund your Errand Boy wallet',
                ],
            ]);

        if (! $response->successful()) {
            Log::error('Flutterwave: Funding initialization failed', [
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
            'link' => $data['link'],
            'tx_ref' => $reference,
        ];
    }

    /**
     * Verify a Flutterwave transaction by transaction ID.
     */
    public function verifyTransaction(string $transactionId): array
    {
        $response = Http::withToken($this->secretKey)
            ->get("{$this->baseUrl}/transactions/{$transactionId}/verify");

        if (! $response->successful()) {
            throw new \InvalidArgumentException('Could not verify transaction.');
        }

        return $response->json('data');
    }

    // ── Transfers (Withdrawals) ──────────────────────────────

    /**
     * Initiate a transfer to a bank account via Flutterwave.
     *
     * @param  string  $accountBank  Bank code
     * @param  string  $accountNumber  Account number
     * @param  float  $amount  Amount in Naira
     * @param  string  $narration  Transfer narration
     * @param  string  $reference  Unique reference
     * @return array{id: int, status: string, reference: string}
     */
    public function initiateTransfer(
        string $accountBank,
        string $accountNumber,
        float $amount,
        string $narration,
        string $reference,
    ): array {
        $response = Http::withToken($this->secretKey)
            ->post("{$this->baseUrl}/transfers", [
                'account_bank' => $accountBank,
                'account_number' => $accountNumber,
                'amount' => $amount,
                'narration' => $narration,
                'currency' => 'NGN',
                'reference' => $reference,
                'callback_url' => config('app.url').'/api/v1/payments/webhook/flutterwave',
            ]);

        if (! $response->successful()) {
            Log::error('Flutterwave: Transfer initiation failed', [
                'account_number' => $accountNumber,
                'amount' => $amount,
                'response' => $response->json(),
            ]);

            throw new \InvalidArgumentException(
                $response->json('message', 'Could not initiate transfer. Please try again.')
            );
        }

        $data = $response->json('data');

        return [
            'id' => $data['id'],
            'status' => $data['status'],
            'reference' => $data['reference'],
        ];
    }
}
