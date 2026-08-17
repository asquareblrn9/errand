"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CreditCard, Download, TrendingUp, Wallet, Clock, Star, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatsSkeleton, ListSkeleton } from "@/components/shared/SkeletonLoader";
import { useSetPageHeader } from "@/components/layout/PageHeaderContext";
import { Amount, StatTile, StatusBadge, formatNaira } from "@/components/design";
import { WithdrawDialog } from "@/components/payments/WalletDialogs";
import { useWallet, useTransactions } from "@/hooks/queries/wallet/use-wallet";
import { useErranderEarnings } from "@/hooks/queries/errander/use-errander-home";
import { useAuthStore } from "@/store/authStore";
import type { WalletTransaction } from "@/types/api/wallet";

function exportCsv(transactions: WalletTransaction[]) {
  const header = ["Date", "Type", "Description", "Amount", "Status"];
  const rows = transactions.map((tx) => [
    new Date(tx.created_at).toLocaleDateString("en-GB"),
    tx.type,
    `"${(tx.description ?? "").replace(/"/g, '""')}"`,
    tx.amount,
    tx.status,
  ]);
  const csv = [header, ...rows]
    .map((r) => r.join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payouts-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function EarningsPage() {
  useSetPageHeader("Earnings", "Payouts, ratings & withdrawal");
  const user = useAuthStore((s) => s.user);
  const isErrander = user?.role === "errander";

  const { data: wallet, isLoading } = useWallet();
  const { data: earnings, isLoading: earningsLoading } = useErranderEarnings(isErrander);
  const { data: transactions = [], isLoading: txLoading } = useTransactions();

  const payoutRows = useMemo(
    () => transactions.filter((tx) => tx.type === "payout" || tx.type === "withdrawal"),
    [transactions],
  );

  if (!isErrander) {
    return (
      <div className="rounded-[20px] border border-[#E9ECEF] bg-white p-10 text-center shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]">
        <Wallet className="mx-auto mb-3 h-8 w-8 text-[#ADB5BD]" />
        <h2 className="mb-1 font-heading text-lg font-bold text-[#0A1628]">
          Earnings are for erranders
        </h2>
        <p className="mb-4 text-sm text-[#6C757D]">
          Track your payout history here when you run errands.
        </p>
        <Link href="/dashboard">
          <Button className="rounded-[11px] bg-[#00A86B] font-heading text-[13px] font-bold text-white hover:bg-[#008554]">
            Back to dashboard
          </Button>
        </Link>
      </div>
    );
  }

  if (isLoading || earningsLoading) return <StatsSkeleton cards={3} />;

  const distribution = earnings?.rating_breakdown?.distribution ?? [];
  const maxCount = Math.max(...distribution.map((d) => d.count), 1);

  return (
    <div className="space-y-[22px]">
      {/* Stat tiles */}
      <div className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-3">
        <StatTile
          label="Available to withdraw"
          value={<Amount value={wallet?.available_balance} />}
          icon={Wallet}
          action={<WithdrawDialog />}
        />
        <StatTile
          label="Pending (escrow)"
          value={<Amount value={wallet?.pending_earnings} />}
          icon={Clock}
          iconBg="bg-[#FFF1E6]"
          iconColor="text-[#B24E00]"
          delta={`${(wallet?.pending_earnings ?? 0) > 0 ? "Awaiting confirmation" : "Nothing pending"}`}
        />
        <StatTile
          label="Lifetime earnings"
          value={<Amount value={earnings?.lifetime_earnings.total} />}
          icon={TrendingUp}
          iconBg="bg-[#E8F0FF]"
          iconColor="text-[#1D4FB8]"
          delta={`${earnings?.lifetime_earnings.jobs_count ?? 0} errands completed`}
        />
      </div>

      {/* Payout method + rating breakdown */}
      <div className="grid gap-[18px] xl:grid-cols-2">
        <div className="rounded-[20px] border border-[#E9ECEF] bg-white p-5 shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-[15px] font-bold text-[#0A1628]">Payout method</h2>
            <Link
              href="/verification"
              className="flex items-center gap-1 text-[12.5px] font-bold text-[#00A86B] hover:text-[#008554]"
            >
              {earnings?.bank_account ? "Change" : "Add"}
            </Link>
          </div>
          {earnings?.bank_account ? (
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] bg-[#0A1628] text-white">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <div className="font-heading text-[13.5px] font-bold text-[#0A1628]">
                  {earnings.bank_account.bank_name} •••• {earnings.bank_account.account_number.slice(-4)}
                </div>
                <div className="text-xs text-[#6C757D]">
                  {earnings.bank_account.account_name} · Payouts arrive within 24 hours
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] bg-[#E9ECEF] text-[#6C757D]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="text-sm text-[#6C757D]">
                No verified bank account yet —{" "}
                <Link href="/verification" className="font-bold text-[#00A86B]">
                  complete KYC
                </Link>{" "}
                to add one.
              </div>
            </div>
          )}
        </div>

        <div className="rounded-[20px] border border-[#E9ECEF] bg-white p-5 shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-[15px] font-bold text-[#0A1628]">Rating breakdown</h2>
            <span className="flex items-center gap-1 text-[15px]">
              <Star className="h-4 w-4 fill-[#FF6B00] text-[#FF6B00]" />
              <span className="font-heading font-bold text-[#0A1628]">
                {earnings?.rating_breakdown.average_rating != null
                  ? earnings.rating_breakdown.average_rating.toFixed(1)
                  : "—"}
              </span>
            </span>
          </div>
          {distribution.every((d) => d.count === 0) ? (
            <p className="py-6 text-center text-[12.5px] text-[#ADB5BD]">
              No ratings yet — complete errands to earn your first.
            </p>
          ) : (
            <div className="flex flex-col gap-[7px]">
              {distribution.map((d) => (
                <div key={d.stars} className="flex items-center gap-2 text-[11.5px]">
                  <span className="w-3.5 text-[#6C757D]">{d.stars}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#E9ECEF]">
                    <div
                      className={`h-full rounded-full ${d.stars >= 4 ? "bg-[#00A86B]" : "bg-[#ADB5BD]"}`}
                      style={{ width: `${(d.count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-mono text-[#6C757D]">{d.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Payout history */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-[15px] font-bold text-[#0A1628]">
            Payout history
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCsv(payoutRows)}
            disabled={payoutRows.length === 0}
            className="rounded-[9px] font-heading text-xs font-bold"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>
        <div className="overflow-hidden rounded-[20px] border border-[#E9ECEF] bg-white shadow-[0_1px_2px_rgba(10,22,40,.04),0_2px_6px_-2px_rgba(10,22,40,.06)]">
          {txLoading ? (
            <div className="p-5"><ListSkeleton rows={3} /></div>
          ) : payoutRows.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#6C757D]">
              No payouts yet. Complete errands to start earning.
            </p>
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
                {payoutRows.map((tx: WalletTransaction) => (
                  <tr key={tx.id} className="eg-row-hover">
                    <td className="text-[#6C757D]">
                      {new Date(tx.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                    <td className="text-[#0A1628]">
                      {tx.type === "payout" ? "Errand payout" : "Withdrawal"}
                    </td>
                    <td className="max-w-[300px] truncate text-[#6C757D]">
                      {tx.description}
                    </td>
                    <td>
                      <span className={`eg-amt ${tx.type === "payout" ? "text-[#008554]" : "text-[#0A1628]"}`}>
                        {formatNaira(tx.amount, { sign: true })}
                      </span>
                    </td>
                    <td>
                      <StatusBadge
                        status={tx.type === "payout" ? "paid out" : "escrowed"}
                        label={tx.type === "payout" ? "Paid out" : "Processing"}
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
