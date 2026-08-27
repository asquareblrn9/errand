"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { Download, Wallet, Lock, TrendingUp, ArrowUpRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatsSkeleton, ListSkeleton } from "@/components/shared/SkeletonLoader";
import { useSetPageHeader } from "@/components/layout/PageHeaderContext";
import { Amount, StatTile, StatusBadge, formatNaira } from "@/components/design";
import { FundDialog, WithdrawDialog } from "@/components/payments/WalletDialogs";
import { useWallet, useTransactions } from "@/hooks/queries/wallet/use-wallet";
import { useRequesterHome } from "@/hooks/queries/requester/use-requester-home";
import { useAuthStore } from "@/store/authStore";
import { walletApi } from "@/services/api/wallet.api";
import { queryKeys } from "@/hooks/queries/query-keys";
import { toast } from "@/store/toastStore";
import type { WalletTransaction, PaymentGateway } from "@/types/api/wallet";
import type { ApiErrorResponse } from "@/types/api/common";

const typeLabel: Record<string, string> = {
  deposit: "Wallet top-up",
  payout: "Earnings payout",
  withdrawal: "Withdrawal",
  payment: "Payment",
  refund: "Refund",
  lock: "Escrow lock",
  unlock: "Escrow release",
  fee: "Fee",
  adjustment: "Adjustment",
};

function exportCsv(transactions: WalletTransaction[]) {
  const header = ["Date", "Type", "Description", "Amount", "Status", "Balance After"];
  const rows = transactions.map((tx) => [
    new Date(tx.created_at).toLocaleDateString("en-GB"),
    tx.type,
    `"${(tx.description ?? "").replace(/"/g, '""')}"`,
    tx.amount,
    tx.status,
    tx.balance_after,
  ]);
  const csv = [header, ...rows]
    .map((r) => r.join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function WalletContent() {
  useSetPageHeader("Wallet", "Balance, escrow & transaction history");
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isRequester = user?.role === "requester";
  const isErrander = user?.role === "errander";

  const { data: wallet, isLoading } = useWallet();
  const { data: transactions = [], isLoading: txLoading } = useTransactions();
  const { data: requesterHome } = useRequesterHome(isRequester);

  useEffect(() => {
    const funded = searchParams.get("funded");
    if (funded !== "true") return;

    const provider = (searchParams.get("provider") as PaymentGateway | null) ?? "paystack";

    // Paystack returns `reference` or `trxref`; Flutterwave returns `tx_ref` or `transaction_id`
    const reference =
      searchParams.get("trxref") ||
      searchParams.get("reference") ||
      searchParams.get("tx_ref") ||
      searchParams.get("transaction_id");

    // Flutterwave also passes `status` directly (successful | failed | cancelled)
    const providerStatus = searchParams.get("status");

    const clearParams = () => window.history.replaceState({}, "", "/wallet");
    const refreshWallet = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
    };

    // Cancelled — user abandoned the provider checkout
    if (providerStatus === "cancelled") {
      toast.warning("Payment cancelled", "Your wallet was not charged.");
      refreshWallet();
      clearParams();
      return;
    }

    // Provider reports a failure — no need to verify
    if (providerStatus && providerStatus !== "successful") {
      toast.error("Payment failed", "The payment was not completed successfully.");
      refreshWallet();
      clearParams();
      return;
    }

    if (reference) {
      walletApi.verifyPayment({ reference, provider })
        .then(() => {
          toast.success("Wallet funded", "Your wallet has been credited.");
          refreshWallet();
          clearParams();
        })
        .catch((err) => {
          // The webhook may have already credited this payment — treat as success
          const axiosError = err as AxiosError<ApiErrorResponse & { code?: string }>;
          const code = axiosError.response?.data?.code;
          if (code === "duplicate_reference") {
            toast.success("Wallet funded", "Your wallet has been credited.");
            refreshWallet();
          } else {
            toast.error(
              "Verification failed",
              axiosError.response?.data?.message ?? "Could not verify payment. Contact support.",
            );
          }
          clearParams();
        });
    } else {
      clearParams();
    }
  }, [searchParams, queryClient]);

  return (
    <div className="space-y-[22px]">
      {isLoading ? (
        <StatsSkeleton cards={3} />
      ) : (
        <div className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-3">
          <StatTile
            label={isErrander ? "Available to withdraw" : "Wallet balance"}
            value={<Amount value={isErrander ? wallet?.available_balance : wallet?.balance} />}
            icon={Wallet}
            action={
              isErrander ? (
                <WithdrawDialog />
              ) : (
                <FundDialog />
              )
            }
          />
          <StatTile
            label="In escrow (active)"
            value={<Amount value={wallet?.locked_balance} />}
            icon={Lock}
            iconBg="bg-[#FFF1E6]"
            iconColor="text-[#B24E00]"
            delta={`${wallet?.locked_balance && wallet.locked_balance > 0 ? "Held until confirmation" : "No escrow right now"}`}
          />
          {isRequester ? (
            <StatTile
              label="Total spent (lifetime)"
              value={<Amount value={requesterHome?.stats.spent_lifetime} />}
              icon={TrendingUp}
              iconBg="bg-[#E8F0FF]"
              iconColor="text-[#1D4FB8]"
              delta={`since ${user?.member_since ?? "joining"}`}
            />
          ) : (
            <StatTile
              label="Pending (escrow)"
              value={<Amount value={wallet?.pending_earnings} />}
              icon={Clock}
              iconBg="bg-[#E8F0FF]"
              iconColor="text-[#1D4FB8]"
              delta={`${(wallet?.pending_earnings ?? 0) > 0 ? "Awaiting confirmation" : "Nothing pending"}`}
            />
          )}
        </div>
      )}

      {/* Actions row */}
      <div className="flex gap-3">
        {!isErrander && <FundDialog />}
        {!isRequester && <WithdrawDialog />}
      </div>

      {/* Transaction history */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-[15px] font-bold text-[#0A1628]">
            Transaction history
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCsv(transactions)}
            disabled={transactions.length === 0}
            className="rounded-[9px] font-heading text-xs font-bold"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>
        <div className="overflow-hidden rounded-[20px] border border-[#E9ECEF] bg-white shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]">
          {txLoading ? (
            <div className="p-5"><ListSkeleton rows={3} /></div>
          ) : transactions.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#6C757D]">No transactions yet.</p>
          ) : (
            <table className="eg-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx: WalletTransaction) => (
                  <tr key={tx.id} className="eg-row-hover">
                    <td className="text-[#6C757D]">
                      {new Date(tx.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                    <td className="text-[#0A1628]">
                      {typeLabel[tx.type] ?? tx.type}
                    </td>
                    <td className="max-w-[280px] truncate text-[#6C757D]">
                      {tx.description}
                    </td>
                    <td>
                      <span
                        className={`eg-amt flex items-center gap-1 ${
                          tx.type === "deposit" || tx.type === "payout" || tx.type === "refund" || tx.type === "unlock"
                            ? "text-[#008554]"
                            : "text-[#0A1628]"
                        }`}
                      >
                        {tx.type === "deposit" || tx.type === "payout" || tx.type === "refund" || tx.type === "unlock" ? (
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        ) : null}
                        {formatNaira(tx.amount, { sign: true })}
                      </span>
                    </td>
                    <td>
                      <StatusBadge
                        status={tx.status === "successful" ? "paid out" : tx.type === "withdrawal" ? "escrowed" : tx.status}
                        label={tx.status === "successful" ? "Completed" : tx.status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WalletPage() {
  return (
    <Suspense fallback={<StatsSkeleton cards={3} />}>
      <WalletContent />
    </Suspense>
  );
}
