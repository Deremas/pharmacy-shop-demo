"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Wallet, Plus, Search } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useAppData } from "@/lib/client/useAppData";
import { useCan } from "@/lib/client/useCan";

export default function ExpensesPage() {
  const { expenses, bankAccounts, currentLocation, locations } = useAppData();
  const can = useCan();
  const [search, setSearch] = useState("");

  const filteredExpenses = expenses.filter((e) => {
    const matchesSearch =
      e.category.toLowerCase().includes(search.toLowerCase()) ||
      e.description.toLowerCase().includes(search.toLowerCase());
    if (currentLocation) return matchesSearch && e.locationId === currentLocation.id;
    return matchesSearch;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="page-heading">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black tracking-tight text-slate-900 dark:text-white sm:text-2xl lg:text-3xl">
            <Wallet className="h-5 w-5 text-rose-500 sm:h-7 sm:w-7" />
            Expenses
          </h1>
          <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-400">
            {currentLocation ? `${currentLocation.name} operational costs` : "Operational costs for the selected business"}
          </p>
        </div>
        {can("finance.expenses.create") ? (
          <Link
            href="/finance/expenses/create"
            className="page-action gap-2 rounded-2xl bg-rose-600 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-rose-900/20 transition-all hover:bg-rose-500 active:scale-95"
          >
            <Plus className="h-4 w-4" /> Record Expense
          </Link>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="page-filters border-b border-slate-100 p-4 dark:border-zinc-800">
          <div className="relative filter-grow" data-filter-grow>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search expenses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs outline-none transition-all focus:ring-1 focus:ring-rose-500 dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <Wallet className="mx-auto mb-4 h-16 w-16 opacity-10" />
            <p className="text-sm font-medium">No expense records found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Date</th>
                  {!currentLocation && <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Location</th>}
                  <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Category</th>
                  <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Description</th>
                  <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Payment</th>
                  <th className="px-6 py-4 text-right text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="py-4 transition-colors hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                    <td className="px-6 py-4 font-mono text-xs font-bold text-slate-500">{new Date(exp.date).toLocaleDateString()}</td>
                    {!currentLocation && (
                      <td className="px-6 py-4">
                        <span className="rounded-lg bg-rose-50 px-2 py-0.5 text-[9px] font-black uppercase text-rose-600">
                          {locations.find((b) => b.id === exp.locationId)?.name}
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:bg-zinc-800 dark:text-slate-400">
                        {exp.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-700 dark:text-zinc-300">{exp.description || "-"}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase text-slate-400">{exp.paymentMethod}</span>
                        {exp.bankAccountId && (
                          <span className="text-[9px] font-bold text-indigo-500">
                            {bankAccounts.find((b) => b.id === exp.bankAccountId)?.displayName}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-rose-600 dark:text-rose-400">{formatCurrency(exp.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
