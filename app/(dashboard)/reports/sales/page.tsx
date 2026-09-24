"use client";

import React, { useState } from "react";
import { BarChart3, ArrowLeft, Download, Filter, Search, Calendar } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useReportData } from "@/lib/client/useAppData";
import { formatCurrency, sumMoney } from "@/lib/utils";
import { formatSalePaymentPartsDetail } from "@/lib/payment-display";
import { ReportScopeBar, useReportScope } from "@/components/report-scope-bar";

export default function SalesReportsPage() {
  const router = useRouter();
  const { sales = [], locations = [], customers = [], currentLocation } = useReportData();
  const scope = useReportScope(locations, currentLocation);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const locationId = scope.scopeId;

  const filteredSales = sales.filter((sale: any) => {
    const customer = customers.find((c: any) => c.id === sale.customerId);
    const customerName = customer?.name || "Walk-in Customer";
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || `${sale.voucherCode} ${customerName}`.toLowerCase().includes(q);
    const matchesLocation = !locationId || sale.locationId === locationId;

    let matchesDate = true;
    if (dateFrom) {
      matchesDate = matchesDate && new Date(sale.saleDate) >= new Date(dateFrom);
    }
    if (dateTo) {
      const endOfDay = new Date(dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      matchesDate = matchesDate && new Date(sale.saleDate) <= endOfDay;
    }

    return matchesSearch && matchesLocation && matchesDate;
  });

  const grossSales = sumMoney(filteredSales.map((sale: any) => sale.subTotal));
  const totalDiscounts = sumMoney(filteredSales.map((sale: any) => sale.discount));
  const netSales = sumMoney(filteredSales.map((sale: any) => sale.totalAmount));
  const salesCount = filteredSales.length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Sales Analytics</h1>
            <p className="text-slate-500 mt-1">Sales for {scope.label} only.</p>
          </div>
        </div>
      </div>

      <ReportScopeBar label={scope.label} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <ReportSummary title="Total Transactions" value={salesCount.toLocaleString()} sub="Filtered sales count" icon={BarChart3} />
        <ReportSummary title="Gross Sales" value={formatCurrency(grossSales)} sub="Before discounts" icon={BarChart3} color="indigo" />
        <ReportSummary title="Discounts Allowed" value={formatCurrency(totalDiscounts)} sub="Promotional reductions" icon={BarChart3} color="amber" />
        <ReportSummary title="Net Sales Revenue" value={formatCurrency(netSales)} sub="Final revenue earned" icon={BarChart3} color="emerald" />
      </div>

      {/* Filters and Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid gap-3 border-b border-slate-100 p-4 dark:border-zinc-800 xl:grid-cols-[minmax(200px,1fr)_150px_150px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search Voucher, Customer..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-semibold outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>
          <div className="relative flex items-center">
            <Calendar className="absolute left-3 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 text-slate-600"
            />
          </div>
          <div className="relative flex items-center">
            <Calendar className="absolute left-3 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 text-slate-600"
            />
          </div>
        </div>

        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[960px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold uppercase tracking-widest text-slate-700 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-slate-300">
                <th className="px-6 py-4 text-left">Voucher</th>
                <th className="px-6 py-4 text-left">Date</th>
                <th className="px-6 py-4 text-left">Customer</th>
                <th className="px-6 py-4 text-right">Subtotal</th>
                <th className="px-6 py-4 text-right">Discount</th>
                <th className="px-6 py-4 text-right">Total</th>
                <th className="px-6 py-4 text-center">Payment Method</th>
                <th className="px-6 py-4 text-left">Bank Account</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredSales.map((sale: any) => {
                const customer = customers.find((c: any) => c.id === sale.customerId);
                return (
                    <tr key={sale.id} className="transition-colors hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                    <td className="px-6 py-4 text-xs font-mono font-bold text-slate-900 dark:text-white">
                      <Link href={`/sales/${sale.id}`} className="hover:text-indigo-600">
                        {sale.voucherCode}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">{new Date(sale.saleDate).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-500">{customer?.name || "Walk-in Customer"}</td>
                    <td className="px-6 py-4 text-right text-xs font-bold text-slate-500">{formatCurrency(Number(sale.subTotal || 0))}</td>
                    <td className="px-6 py-4 text-right text-xs font-bold text-amber-600">{sale.discount > 0 ? `-${formatCurrency(sale.discount)}` : "-"}</td>
                    <td className="px-6 py-4 text-right text-xs font-black text-slate-900 dark:text-zinc-100">{formatCurrency(Number(sale.totalAmount || 0))}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                        sale.paymentMethod === 'CASH' 
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' 
                          : sale.paymentMethod === 'BANK'
                          ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20'
                          : sale.paymentMethod === 'CREDIT'
                          ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20'
                          : 'bg-amber-50 text-amber-600 dark:bg-amber-950/20'
                      }`}>
                        {sale.paymentMethod}
                      </span>
                      {(formatSalePaymentPartsDetail(
                        {
                          cashAmount: sale.cashAmount,
                          bankAmount: sale.bankAmount,
                          creditAmount: sale.creditAmount,
                        },
                        formatCurrency,
                      )) && (
                        <p className="mt-1 text-[9px] font-bold text-slate-400">
                          {formatSalePaymentPartsDetail(
                            {
                              cashAmount: sale.cashAmount,
                              bankAmount: sale.bankAmount,
                              creditAmount: sale.creditAmount,
                            },
                            formatCurrency,
                          )}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {sale.bankAccount?.displayName
                        ? `${sale.bankAccount.displayName}${sale.bankAccount.bankName ? ` (${sale.bankAccount.bankName})` : ""}`
                        : sale.bankAccountId || "-"}
                    </td>
                  </tr>
                );
              })}
              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-xs font-black uppercase tracking-widest text-slate-500">
                    No sales records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ReportSummary({ title, value, sub, icon: Icon, color = "indigo" }: any) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">{title}</p>
        <Icon className={`w-4 h-4 ${color === 'emerald' ? 'text-emerald-500' : color === 'amber' ? 'text-amber-500' : 'text-indigo-500'}`} />
      </div>
      <h4 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{value}</h4>
      <p className="text-[10px] text-slate-500 mt-1 font-bold">{sub}</p>
    </div>
  );
}
