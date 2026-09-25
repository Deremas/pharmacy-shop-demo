"use client";

import React from "react";
import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Banknote,
  Calendar,
  Landmark,
  Search,
} from "lucide-react";
import { cn, formatCurrency, sumMoney } from "@/lib/utils";
import { MultiSelectDropdown } from "@/components/multi-select-dropdown";
import { paginateRows } from "@/lib/sales-utils";

type AccountOption = {
  id: string;
  displayName: string;
};

type LocationOption = {
  id: string;
  name: string;
};

type LedgerRow = {
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  category: string;
  description: string;
  amount: number;
  date: string;
  method: string;
  accountId: string;
  accountName: string;
  locationId: string;
  locationName: string;
};

export function TransactionsClient({
  accounts,
  locations,
  transactions,
  initialLocationIds = [],
}: {
  accounts: AccountOption[];
  locations: LocationOption[];
  transactions: LedgerRow[];
  initialLocationIds?: string[];
}) {
  const [search, setSearch] = React.useState("");
  const [locationFilters, setLocationFilters] = React.useState<string[]>(initialLocationIds);
  const [accountFilters, setAccountFilters] = React.useState<string[]>([]);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);

  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch = `${tx.id} ${tx.category} ${tx.description} ${tx.accountName}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesLocation = locationFilters.length === 0 || locationFilters.includes(tx.locationId);
    const matchesAccount = accountFilters.length === 0 || accountFilters.includes(tx.accountId);
    return matchesSearch && matchesLocation && matchesAccount;
  });

  const income = sumMoney(filteredTransactions.filter((tx) => tx.type === "INCOME").map((tx) => tx.amount));
  const expense = sumMoney(filteredTransactions.filter((tx) => tx.type === "EXPENSE").map((tx) => tx.amount));
  const pagedTransactions = paginateRows(filteredTransactions, page, pageSize);
  const showLocation = locations.length > 1 && locationFilters.length !== 1;
  const setSearchFilter = (value: string) => {
    setSearch(value);
    setPage(1);
  };
  const setLocationFilterValues = (values: string[]) => {
    setLocationFilters(values);
    setPage(1);
  };
  const setAccountFilterValues = (values: string[]) => {
    setAccountFilters(values);
    setPage(1);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-sans">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Ledger Transactions</h1>
          <p className="text-sm text-slate-500">Cash, bank, and expense movements for the selected business.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:min-w-[320px]">
          <SummaryPill label="Inflow" value={formatCurrency(income)} tone="green" />
          <SummaryPill label="Outflow" value={formatCurrency(expense)} tone="rose" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-zinc-800 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by transaction, category, or account..."
              value={search}
              onChange={(event) => setSearchFilter(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>
          {locations.length > 1 ? (
          <MultiSelectDropdown
            label="Counter / Store"
            allLabel="All"
            options={locations.map((location) => ({ value: location.id, label: location.name }))}
            selected={locationFilters}
            onChange={setLocationFilterValues}
          />
          ) : null}
          <MultiSelectDropdown
            label="Accounts"
            allLabel="All"
            options={accounts.map((account) => ({ value: account.id, label: account.displayName }))}
            selected={accountFilters}
            onChange={setAccountFilterValues}
          />
        </div>

        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[860px] text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:border-zinc-800 dark:bg-zinc-950/30">
                <th className="px-6 py-4">Transaction</th>
                <th className="px-6 py-4">Type</th>
                {showLocation && <th className="px-6 py-4">Location</th>}
                <th className="px-6 py-4">Account</th>
                <th className="px-6 py-4">Mode</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={showLocation ? 7 : 6} className="px-6 py-14 text-center text-xs font-black uppercase tracking-widest text-slate-500">
                    No transactions found
                  </td>
                </tr>
              ) : pagedTransactions.rows.map((tx) => (
                <tr key={tx.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/20">
                  <td className="px-6 py-4">
                    <p className="text-sm font-black uppercase tracking-tighter text-slate-800 dark:text-zinc-200">{tx.category}</p>
                    <p className="text-[10px] font-bold leading-none tracking-widest text-slate-500">{tx.description}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className={cn(
                      "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest",
                      tx.type === "INCOME" ? "border-green-500/10 bg-green-500/10 text-green-600" :
                      tx.type === "EXPENSE" ? "border-rose-500/10 bg-rose-500/10 text-rose-600" : "border-blue-500/10 bg-blue-500/10 text-blue-600"
                    )}>
                      {tx.type === "INCOME" ? <ArrowDownLeft className="h-3 w-3" /> : tx.type === "EXPENSE" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowRightLeft className="h-3 w-3" />}
                      {tx.type}
                    </div>
                  </td>
                  {showLocation && (
                    <td className="px-6 py-4 text-xs font-bold text-slate-500">{tx.locationName}</td>
                  )}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                      <Landmark className="h-3 w-3 opacity-40" />
                      {tx.accountName}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500">
                      {tx.method === "BANK" ? <Landmark className="h-3 w-3" /> : <Banknote className="h-3.5 w-3.5" />}
                      {tx.method}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                      <Calendar className="h-3 w-3" />
                      {new Date(tx.date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className={cn(
                    "px-6 py-4 text-right text-sm font-black tracking-tighter",
                    tx.type === "INCOME" ? "text-green-600" : tx.type === "EXPENSE" ? "text-rose-600" : "text-blue-600"
                  )}>
                    {tx.type === "INCOME" ? "+" : tx.type === "EXPENSE" ? "-" : ""}{formatCurrency(tx.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500 dark:border-zinc-800">
          <span>Page {pagedTransactions.page} of {pagedTransactions.totalPages} - {filteredTransactions.length} transactions</span>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] font-black uppercase tracking-widest outline-none dark:border-zinc-800 dark:bg-zinc-950"
            >
              {[10, 15, 25, 50].map((size) => (
                <option key={size} value={size}>{size} / page</option>
              ))}
            </select>
            <button type="button" disabled={pagedTransactions.page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40 dark:border-zinc-800">Prev</button>
            <button type="button" disabled={pagedTransactions.page >= pagedTransactions.totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40 dark:border-zinc-800">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryPill({ label, value, tone }: { label: string; value: string; tone: "green" | "rose" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className={cn("mt-1 text-sm font-black", tone === "green" ? "text-green-600" : "text-rose-600")}>{value}</p>
    </div>
  );
}
