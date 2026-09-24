"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Truck, ArrowDownRight, History, Clock, Landmark } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useAppData } from "@/lib/client/useAppData";
import { useCan } from "@/lib/client/useCan";

export default function SupplierDebts() {
  const { suppliers, purchases, supplierPayments } = useAppData();
  const can = useCan();
  const [filterType, setFilterType] = useState<"ALL" | "OUTSTANDING">("ALL");

  const totalPayable = useMemo(() => suppliers.reduce((sum, s) => sum + (s.debt || 0), 0), [suppliers]);

  const paidThisMonth = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return supplierPayments
      .filter((p) => new Date(p.date).getTime() >= startOfMonth.getTime())
      .reduce((sum, p) => sum + p.amount, 0);
  }, [supplierPayments]);

  const overdueBalance = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const debtPurchases = purchases.filter((p) => p.debtAmount > 0);
    let overdue = 0;
    suppliers.forEach((supplier) => {
      const suppPurchases = debtPurchases.filter((p) => p.supplierId === supplier.id);
      const suppPayments = supplierPayments.filter((p) => p.supplierId === supplier.id);
      let remainingPaymentPool = suppPayments.reduce((sum, p) => sum + p.amount, 0);
      const sortedPurchases = [...suppPurchases].sort(
        (a, b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime(),
      );
      sortedPurchases.forEach((purchase) => {
        const debt = purchase.debtAmount || 0;
        let allocatedPayment = 0;
        if (debt > 0 && remainingPaymentPool > 0) {
          allocatedPayment = Math.min(debt, remainingPaymentPool);
          remainingPaymentPool -= allocatedPayment;
        }
        const outstanding = debt - allocatedPayment;
        if (outstanding > 0 && new Date(purchase.purchaseDate).getTime() < thirtyDaysAgo.getTime()) {
          overdue += outstanding;
        }
      });
    });
    return overdue;
  }, [suppliers, purchases, supplierPayments]);

  const debtHistory = useMemo(() => {
    const debtPurchases = purchases.filter((p) => p.debtAmount > 0);
    const list: any[] = [];
    suppliers.forEach((supplier) => {
      const suppPurchases = debtPurchases.filter((p) => p.supplierId === supplier.id);
      const suppPayments = supplierPayments.filter((p) => p.supplierId === supplier.id);
      let remainingPaymentPool = suppPayments.reduce((sum, p) => sum + p.amount, 0);
      const sortedPurchases = [...suppPurchases].sort(
        (a, b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime(),
      );
      sortedPurchases.forEach((purchase) => {
        const debt = purchase.debtAmount || 0;
        let allocatedPayment = 0;
        if (debt > 0 && remainingPaymentPool > 0) {
          allocatedPayment = Math.min(debt, remainingPaymentPool);
          remainingPaymentPool -= allocatedPayment;
        }
        const outstanding = debt - allocatedPayment;
        list.push({
          id: purchase.id,
          supplierId: supplier.id,
          supplierName: supplier.name,
          originalDebt: debt,
          outstanding,
          date: new Date(purchase.purchaseDate).toISOString().split("T")[0],
          status: outstanding === 0 ? "SETTLED" : outstanding < debt ? "PARTIAL" : "UNPAID",
        });
      });
    });
    const sortedList = list.sort((a, b) => b.id.localeCompare(a.id));
    if (filterType === "OUTSTANDING") return sortedList.filter((item) => item.outstanding > 0);
    return sortedList;
  }, [suppliers, purchases, supplierPayments, filterType]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            <Landmark className="h-8 w-8 text-indigo-600" />
            Supplier Debts
          </h1>
          <p className="mt-1 text-slate-500">Manage accounts payable and payment schedules.</p>
        </div>
        {can("suppliers.payments.create") ? (
          <Link href="/suppliers/debts/pay" className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-500 active:scale-95">
            <Landmark className="h-4 w-4" />
            Record Debt Payment
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <DebtSummaryCard title="Total Accounts Payable" value={formatCurrency(totalPayable)} subtitle={`To ${suppliers.filter((s) => s.debt > 0).length} active suppliers`} color="rose" icon={Truck} />
        <DebtSummaryCard title="Paid This Month" value={formatCurrency(paidThisMonth)} subtitle="Updated dynamically" color="green" icon={ArrowDownRight} />
        <DebtSummaryCard title="Overdue Balance (30+ Days)" value={formatCurrency(overdueBalance)} subtitle="FIFO Aging Allocation" color="amber" icon={Clock} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-slate-200 p-6 dark:border-zinc-800">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
            <History className="h-4 w-4 text-indigo-500" />
            Debts &amp; Payment Activity
          </h3>
          <div className="flex gap-2">
            <button type="button" onClick={() => setFilterType("ALL")} className={cn("rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest", filterType === "ALL" ? "border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-900/30 dark:bg-indigo-950/20" : "border-slate-100 bg-slate-50 text-slate-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-slate-300")}>ALL HISTORIC</button>
            <button type="button" onClick={() => setFilterType("OUTSTANDING")} className={cn("rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest", filterType === "OUTSTANDING" ? "border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-900/30 dark:bg-indigo-950/20" : "border-slate-100 bg-slate-50 text-slate-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-slate-300")}>OUTSTANDING</button>
          </div>
        </div>
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[800px] text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:border-zinc-800 dark:bg-zinc-950/30">
                <th className="px-6 py-4">Supplier / Purchase</th>
                <th className="px-6 py-4">Original Debt</th>
                <th className="px-6 py-4">Outstanding Balance</th>
                <th className="px-6 py-4">Purchase Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {debtHistory.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-xs font-bold text-slate-400">No debt activities matching the criteria.</td></tr>
              ) : (
                debtHistory.map((entry) => (
                  <tr key={entry.id} className="transition-all hover:bg-slate-50/50 dark:hover:bg-zinc-800/20">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-800 dark:text-zinc-200">{entry.supplierName}</p>
                      <p className="font-mono text-[10px] text-slate-400">PO-{entry.id.slice(0, 8)}</p>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-500">{formatCurrency(entry.originalDebt)}</td>
                    <td className={cn("px-6 py-4 text-sm font-bold", entry.outstanding > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-400")}>{formatCurrency(entry.outstanding)}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">{entry.date}</td>
                    <td className="px-6 py-4">
                      <span className={cn("rounded border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider", entry.status === "SETTLED" ? "border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-emerald-900/30 dark:bg-emerald-950/20" : entry.status === "PARTIAL" ? "border-blue-100 bg-blue-50 text-blue-600 dark:border-blue-900/30 dark:bg-blue-950/20" : "border-amber-100 bg-amber-50 text-amber-600 dark:border-amber-900/30 dark:bg-amber-950/20")}>{entry.status}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {entry.outstanding > 0 ? (
                        <Link href={`/suppliers/debts/pay?supplierId=${entry.supplierId}`} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-sm hover:bg-emerald-500">Settle</Link>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400">Fully Settled</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DebtSummaryCard({ title, value, subtitle, color, icon: Icon }: any) {
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
