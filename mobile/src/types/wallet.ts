export interface WalletData { id: string; balance: number; locked_balance: number; available_balance: number; pending_earnings: number; currency: string; status: string; }

export interface Transaction {
  id: string; type: string; amount: number; balance_before: number; balance_after: number;
  reference: string; description: string; status: string; created_at: string;
}

export interface WalletBankAccount {
  bank_name: string;
  bank_code: string;
  account_number: string; // masked by the API (e.g. "****6789")
  account_name: string;
}

export interface WalletBankAccountStatus {
  bank_account: WalletBankAccount | null;
  change_locked: boolean;
  next_change_at: string | null;
}
