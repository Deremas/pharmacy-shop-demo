"use client";

import React from "react";
import Link from "next/link";
import { ArrowDownLeft, Landmark, Plus, Wallet } from "lucide-react";

import { buildLedgerTransactions, movementSummary } from "@/lib/finance-ledger";
import { cn, formatCurrency } from "@/lib/utils";
import { isTenantBusiness, locationsForCurrentBusiness } from "@/lib/businesses";
import { calculateLocationCashBalance, useAppData } from "@/lib/client/useAppData";

export default function FinancePage() {
  const state = useAppData();
  const ledger = buildLedgerTransactions(state);
  const bankAccounts = state.bankAccounts.filter((account) => account.accountType === "BANK");

  const accountBalance = (accountId: string, fallbackBalance: number) =>
    movementSummary(ledger.filter((tx) => tx.accountId === accountId), fallbackBalance).availableBalance;

  const cashLocations = locationsForCurrentBusiness(state.currentLocation, state.locations)
    .filter(isTenantBusiness)
    .map((location) => ({
    ...location,
    balance: calculateLocationCashBalance(state, location.id),
  }));
  const locationCashTotal = cashLocations.reduce((sum, location) => sum + location.balance, 0);
  const cashBalance = locationCashTotal;
  const bankTotal = bankAccounts.reduce((sum, account) => sum + accountBalance(account.id, account.currentBalance), 0);
  const totals = movementSummary(ledger, 0);
  const inflow = totals.totalInflow;
  const outflow = totals.totalOutflow;

  return (
    <div className="space-y-6 pb-20 font-sans animate-in fade-in duration-500">
      <div className="page-heading">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black tracking-tight text-slate-950 dark:text-white sm:text-2xl lg:text-3xl">
            <Landmark className="h-8 w-8 text-indigo-600" />
            Finance
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Cash and bank for this business.
          </p>
        </div>
        <Link
          href="/finance/banks"
          className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-500 active:scale-95"
        >
          <Plus className="h-5 w-5" />
          Bank Accounts
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Cash Balance" value={formatCurrency(cashBalance)} tone="cash" />
        <SummaryCard label="Bank Balance" value={formatCurrency(bankTotal)} tone="bank" />
        <SummaryCard label="Inflow" value={formatCurrency(inflow)} tone="in" />
        <SummaryCard label="Outflow" value={formatCurrency(outflow)} tone="out" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5 dark:border-zinc-800">
            <div>
              <h2 className="text-lg font-black text-slate-950 dark:text-white">Cash Drawer</h2>
              <p className="text-xs font-semibold text-slate-500">On-hand cash in this business.</p>
            </div>
            <Wallet className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="divide-y divide-slate-100 dark:divide-zinc-800">
            {cashLocations.map((location) => (
              <div key={location.id} className="flex items-center justify-between gap-4 p-5">
                <div>
                  <p className="text-sm font-black text-slate-950 dark:text-white">{location.name}</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Cash drawer</p>
                </div>
                <div className="text-right">
                  <p className={cn("text-lg font-black", location.balance >= 0 ? "text-slate-950 dark:text-white" : "text-rose-600")}>
                    {formatCurrency(location.balance)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5 dark:border-zinc-800">
            <div>
              <h2 className="text-lg font-black text-slate-950 dark:text-white">Recent Transactions</h2>
              <p className="text-xs font-semibold text-slate-500">Latest sales, purchases, and expenses.</p>
            </div>
            <Link href="/finance/transactions" className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:underline">
              View All
            </Link>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-zinc-800">
            {ledger.length === 0 ? (
              <p className="p-6 text-sm font-bold text-slate-400">No finance transactions yet.</p>
            ) : ledger.slice(0, 8).map((tx) => (
              <Link
                key={tx.id}
                href={tx.category === "Sale" ? `/sales/${tx.sourceId}` : tx.category === "Purchase" ? `/purchases/${tx.sourceId}` : "/finance/transactions"}
                className="flex items-center justify-between gap-4 p-5 transition hover:bg-slate-50 dark:hover:bg-zinc-800/35"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-950 dark:text-white">{tx.category}</p>
                  <p className="mt-1 truncate text-[10px] font-black uppercase tracking-widest text-slate-500">{tx.description}</p>
                </div>
                <div className="text-right">
                  <p className={cn("text-sm font-black", tx.type === "EXPENSE" || tx.method === "CASH_OUT" ? "text-rose-600" : "text-emerald-600")}>
                    {tx.type === "EXPENSE" || tx.method === "CASH_OUT" ? "-" : "+"}{formatCurrency(tx.amount)}
                  </p>
                  <p className="mt-1 text-[10px] font-bold text-slate-400">{new Date(tx.date).toLocaleDateString()}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: "cash" | "bank" | "in" | "out" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
        <span className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl",
          tone === "cash" && "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40",
          tone === "bank" && "bg-blue-50 text-blue-600 dark:bg-blue-950/40",
          tone === "in" && "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40",
          tone === "out" && "bg-rose-50 text-rose-600 dark:bg-rose-950/40",
        )}>
          {tone === "out" ? <ArrowDownLeft className="h-4 w-4" /> : <Landmark className="h-4 w-4" />}
        </span>
      </div>
      <p className="mt-4 text-2xl font-black tracking-tight text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}
