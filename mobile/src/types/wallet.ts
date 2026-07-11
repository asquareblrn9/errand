export interface WalletData { id: string; balance: number; locked_balance: number; available_balance: number; currency: string; status: string; }

export interface Transaction {
  id: string; type: string; amount: number; balance_before: number; balance_after: number;
  reference: string; description: string; status: string; created_at: string;
}
