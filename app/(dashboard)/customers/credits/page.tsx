"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { CreditCard, ArrowUpRight, History, Clock, ShieldAlert } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useAppData } from "@/lib/client/useAppData";
import { listCreditSales } from "@/lib/finance/credit-ledger";

export default function CustomerCredits() {
  const { customers, sales, customerPayments, bankAccounts } = useAppData();
  const [filterType, setFilterType] = useState<"ALL" | "PENDING" | "PAYMENTS">("ALL");

  const paymentAllocations = useMemo(
    () => (customerPayments || []).flatMap((payment: any) => payment.allocations || []),
    [customerPayments],
  );

  const totalOutstanding = useMemo(
    () => customers.reduce((sum, c) => sum + (c.balance || 0), 0),
    [customers],
  );

  const collectedThisMonth = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return customerPayments
      .filter((p) => new Date(p.date).getTime() >= startOfMonth.getTime())
      .reduce((sum, p) => sum + p.amount, 0);
  }, [customerPayments]);

  const overdueBalance = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return listCreditSales(sales, customerPayments, paymentAllocations)
      .filter((sale) => sale.outstandingAmount > 0 && new Date(sale.saleDate || 0).getTime() < thirtyDaysAgo.getTime())
      .reduce((sum, sale) => sum + sale.outstandingAmount, 0);
  }, [sales, customerPayments, paymentAllocations]);

  const creditHistory = useMemo(() => {
    const list = listCreditSales(sales, customerPayments, paymentAllocations).map((sale) => ({
      id: sale.saleId,
      customerId: sale.customerId,
      customerName: customers.find((customer: any) => customer.id === sale.customerId)?.name || "Customer",
      originalCredit: sale.originalCredit,
      paidAmount: sale.paidAmount,
      outstanding: sale.outstandingAmount,
      date: sale.saleDate ? new Date(sale.saleDate).toISOString().split("T")[0] : "",
      status: sale.status,
    }));
    const sortedList = list.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    if (filterType === "PENDING") return sortedList.filter((item) => item.outstanding > 0);
    return sortedList;
  }, [customers, sales, customerPayments, paymentAllocations, filterType]);

  const recentPayments = useMemo(() => {
    return [...(customerPayments || [])]
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 50)
      .map((payment: any) => {
        const bank = payment.bankAccount || bankAccounts.find((account: any) => account.id === payment.bankAccountId);
        return {
          id: payment.id,
          customerName: customers.find((customer: any) => customer.id === payment.customerId)?.name || "Customer",
          amount: Number(payment.amount || 0),
          date: payment.date,
          method: payment.method,
          bankLabel: bank
            ? `${bank.displayName}${bank.bankName ? ` (${bank.bankName})` : ""}`
            : "",
          remainingBalance: Number(payment.remainingBalance || 0),
        };
      });
  }, [customerPayments, customers, bankAccounts]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            <ShieldAlert className="h-8 w-8 text-indigo-600" />
            Customer Credits
          </h1>
          <p className="mt-1 text-slate-500">Track outstanding balances and credit aging.</p>
        </div>
        <Link
          href="/customers/credits/pay"
          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-500 active:scale-95"
        >
          Record Credit Payment
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <CreditSummaryCard title="Total Outstanding" value={formatCurrency(totalOutstanding)} subtitle={`From ${customers.filter((c) => c.balance > 0).length} customers`} color="rose" icon={CreditCard} />
        <CreditSummaryCard title="Collected This Month" value={formatCurrency(collectedThisMonth)} subtitle="Updated dynamically" color="green" icon={ArrowUpRight} />
        <CreditSummaryCard title="Overdue Balance (30+ Days)" value={formatCurrency(overdueBalance)} subtitle="Oldest unpaid sales first" color="amber" icon={Clock} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-slate-200 p-6 dark:border-zinc-800">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
            <History className="h-4 w-4 text-indigo-500" />
            Credit Activity Log
          </h3>
          <div className="flex gap-2">
            <button type="button" onClick={() => setFilterType("ALL")} className={cn("rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest transition-all", filterType === "ALL" ? "border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-900/30 dark:bg-indigo-950/20" : "border-slate-100 bg-slate-50 text-slate-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-slate-300")}>ALL HISTORIC</button>
            <button type="button" onClick={() => setFilterType("PENDING")} className={cn("rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest transition-all", filterType === "PENDING" ? "border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-900/30 dark:bg-indigo-950/20" : "border-slate-100 bg-slate-50 text-slate-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-slate-300")}>OUTSTANDING</button>
            <button type="button" onClick={() => setFilterType("PAYMENTS")} className={cn("rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest transition-all", filterType === "PAYMENTS" ? "border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-900/30 dark:bg-indigo-950/20" : "border-slate-100 bg-slate-50 text-slate-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-slate-300")}>PAYMENTS</button>
          </div>
        </div>

        <div className="overflow-x-auto overscroll-x-contain">
          {filterType === "PAYMENTS" ? (
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:border-zinc-800 dark:bg-zinc-950/30">
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Method</th>
                  <th className="px-6 py-4">Bank</th>
                  <th className="px-6 py-4">Remaining</th>
                  <th className="px-6 py-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {recentPayments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-xs font-bold text-slate-400">No credit payments recorded yet.</td>
                  </tr>
                ) : (
                  recentPayments.map((payment) => (
                    <tr key={payment.id} className="transition-all duration-150 hover:bg-slate-50/50 dark:hover:bg-zinc-800/20">
                      <td className="px-6 py-4 text-sm font-bold text-slate-800 dark:text-zinc-200">{payment.customerName}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-emerald-600">{formatCurrency(payment.amount)}</td>
                      <td className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">{payment.method}</td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-500">{payment.method === "BANK" ? payment.bankLabel || "—" : "—"}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-500">{formatCurrency(payment.remainingBalance)}</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">{new Date(payment.date).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
          <table className="w-full min-w-[860px] text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:border-zinc-800 dark:bg-zinc-950/30">
                <th className="px-6 py-4">Transaction Details</th>
                <th className="px-6 py-4">Original Credit</th>
                <th className="px-6 py-4">Paid</th>
                <th className="px-6 py-4">Outstanding Balance</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {creditHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-xs font-bold text-slate-400">No credit activities matching the criteria.</td>
                </tr>
              ) : (
                creditHistory.map((txn) => (
                  <tr key={txn.id} className="transition-all duration-150 hover:bg-slate-50/50 dark:hover:bg-zinc-800/20">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-800 dark:text-zinc-200">{txn.customerName}</p>
                      <p className="font-mono text-[10px] text-slate-400">TRX-{txn.id}</p>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-500">{formatCurrency(txn.originalCredit)}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-emerald-600">{formatCurrency(txn.paidAmount)}</td>
                    <td className={cn("px-6 py-4 text-sm font-bold", txn.outstanding > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-400")}>{formatCurrency(txn.outstanding)}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">{txn.date}</td>
                    <td className="px-6 py-4">
                      <span className={cn("rounded border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider", txn.status === "SETTLED" ? "border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-emerald-900/30 dark:bg-emerald-950/20" : txn.status === "PARTIAL" ? "border-blue-100 bg-blue-50 text-blue-600 dark:border-blue-900/30 dark:bg-blue-950/20" : "border-amber-100 bg-amber-50 text-amber-600 dark:border-amber-900/30 dark:bg-amber-950/20")}>{txn.status}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {txn.outstanding > 0 ? (
                        <Link href={`/customers/credits/pay?customerId=${txn.customerId}&saleId=${txn.id}`} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-sm transition-all hover:bg-emerald-500">
                          Settle
                        </Link>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400">Fully Settled</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          )}
        </div>
      </div>
    </div>
  );
}

function CreditSummaryCard({ title, value, subtitle, color, icon: Icon }: any) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className={cn("absolute -bottom-4 -right-4 opacity-5 transition-transform duration-500 group-hover:scale-110", color === "rose" ? "text-rose-600" : color === "green" ? "text-green-600" : "text-amber-600")}>
        <Icon className="h-32 w-32" />
      </div>
      <div className="relative z-10">
        <div className={cn("mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:-translate-y-1", color === "rose" ? "bg-rose-500/10 text-rose-600" : color === "green" ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600")}>
          <Icon className="h-6 w-6" />
        </div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300">{title}</p>
        <h3 className={cn("mt-1 text-3xl font-bold", color === "rose" ? "text-rose-600 dark:text-rose-500" : color === "green" ? "text-green-600 dark:text-green-500" : "text-slate-900 dark:text-white")}>{value}</h3>
        <p className="mt-2 text-[10px] font-medium text-slate-400">{subtitle}</p>
      </div>
    </div>
  );
}
