"use client";

import Link from "next/link";
import React, { useState, useMemo } from "react";
import {
  Landmark,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  AlertTriangle,
  Calendar,
  BarChart3,
  DollarSign,
  ShoppingCart,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  Users,
  Package,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useReportData } from "@/lib/client/useAppData";
import { formatCurrency, subtractMoney, sumMoney } from "@/lib/utils";
import { saleProfit } from "@/lib/sales-utils";
import { ReportScopeBar, useReportScope } from "@/components/report-scope-bar";

// ─── Helper ────────────────────────────────────────────────────────────────

function inDateRange(dateValue: string | Date, from: string, to: string) {
  const d = new Date(dateValue);
  if (from && d < new Date(from)) return false;
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    if (d > end) return false;
  }
  return true;
}

// ─── Sub-components ────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  color = "indigo",
  trend,
}: {
  title: string;
  value: string;
  sub: string;
  icon: any;
  color?: string;
  trend?: "up" | "down" | "neutral";
}) {
  const colorMap: Record<string, string> = {
    indigo: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/30",
    emerald: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
    amber: "text-amber-500 bg-amber-50 dark:bg-amber-950/30",
    rose: "text-rose-500 bg-rose-50 dark:bg-rose-950/30",
    violet: "text-violet-500 bg-violet-50 dark:bg-violet-950/30",
    sky: "text-sky-500 bg-sky-50 dark:bg-sky-950/30",
  };
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-tight">
          {title}
        </p>
        <div className={`p-2 rounded-xl ${colorMap[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <h4 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{value}</h4>
      <div className="flex items-center gap-1 mt-1">
        {trend === "up" && <ArrowUpRight className="w-3 h-3 text-emerald-500" />}
        {trend === "down" && <ArrowDownRight className="w-3 h-3 text-rose-500" />}
        <p className="text-[10px] text-slate-400 font-semibold">{sub}</p>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-3">
      {children}
    </h2>
  );
}

function ProgressBar({ value, max, color = "indigo" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const colorMap: Record<string, string> = {
    indigo: "bg-indigo-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    violet: "bg-violet-500",
    sky: "bg-sky-500",
  };
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${colorMap[color]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// Expense category color palette
const CATEGORY_COLORS: string[] = ["indigo", "sky", "violet", "amber", "emerald", "rose"];

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function FinanceReportsPage() {
  const router = useRouter();
  const {
    sales = [],
    purchases = [],
    expenses = [],
    customerPayments = [],
    supplierPayments = [],
    bankAccounts = [],
    customers = [],
    suppliers = [],
    locations = [],
    currentLocation,
  } = useReportData();
  const scope = useReportScope(locations, currentLocation);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "receivables" | "payables" | "expenses">("overview");
  const locationId = scope.scopeId;

  // ── Filtered data ──────────────────────────────────────────────────────
  const filteredSales = useMemo(
    () =>
      sales.filter((s: any) => {
        if (locationId && s.locationId !== locationId) return false;
        return inDateRange(s.saleDate, dateFrom, dateTo);
      }),
    [sales, locationId, dateFrom, dateTo]
  );

  const filteredPurchases = useMemo(
    () =>
      purchases.filter((p: any) => {
        if (locationId && p.locationId !== locationId) return false;
        return inDateRange(p.purchaseDate, dateFrom, dateTo);
      }),
    [purchases, locationId, dateFrom, dateTo]
  );

  const filteredExpenses = useMemo(
    () =>
      expenses.filter((e: any) => {
        if (locationId && e.locationId !== locationId) return false;
        return inDateRange(e.expenseDate, dateFrom, dateTo);
      }),
    [expenses, locationId, dateFrom, dateTo]
  );

  const filteredCustPayments = useMemo(
    () =>
      customerPayments.filter((p: any) => {
        if (locationId && p.locationId !== locationId) return false;
        return inDateRange(p.paymentDate, dateFrom, dateTo);
      }),
    [customerPayments, locationId, dateFrom, dateTo]
  );

  const filteredSuppPayments = useMemo(
    () =>
      supplierPayments.filter((p: any) => {
        if (locationId && p.locationId !== locationId) return false;
        return inDateRange(p.paymentDate, dateFrom, dateTo);
      }),
    [supplierPayments, locationId, dateFrom, dateTo]
  );

  // ── Core metrics ───────────────────────────────────────────────────────
  const totalRevenue = sumMoney(filteredSales.map((sale: any) => sale.totalAmount));
  const grossProfit = sumMoney(filteredSales.map((sale: any) => saleProfit(sale)));
  const totalCOGS = subtractMoney(totalRevenue, grossProfit);
  const totalExpenses = sumMoney(filteredExpenses.map((expense: any) => expense.amount));
  const netProfit = subtractMoney(grossProfit, totalExpenses);

  // ── Cash flow ──────────────────────────────────────────────────────────
  const cashIn = sumMoney([
    ...filteredSales.map((sale: any) => sale.cashAmount),
    ...filteredCustPayments.filter((payment: any) => payment.paymentMethod === "CASH").map((payment: any) => payment.amount),
  ]);

  const bankIn = sumMoney([
    ...filteredSales.map((sale: any) => sale.bankAmount),
    ...filteredCustPayments.filter((payment: any) => payment.paymentMethod === "BANK").map((payment: any) => payment.amount),
  ]);

  const cashOut = sumMoney([
    ...filteredPurchases.map((purchase: any) => purchase.cashAmount ?? (purchase.paymentMethod === "CASH" ? purchase.paidAmount : 0)),
    ...filteredExpenses.filter((expense: any) => expense.paymentMethod === "CASH").map((expense: any) => expense.amount),
    ...filteredSuppPayments.filter((payment: any) => payment.paymentMethod === "CASH").map((payment: any) => payment.amount),
  ]);

  const bankOut = sumMoney([
    ...filteredPurchases.map((purchase: any) => purchase.bankAmount ?? (purchase.paymentMethod === "BANK" ? purchase.paidAmount : 0)),
    ...filteredExpenses.filter((expense: any) => expense.paymentMethod === "BANK").map((expense: any) => expense.amount),
    ...filteredSuppPayments.filter((payment: any) => payment.paymentMethod === "BANK").map((payment: any) => payment.amount),
  ]);

  const netCashFlow = subtractMoney(cashIn, cashOut);
  const netBankFlow = subtractMoney(bankIn, bankOut);

  // ── Receivables (credit sales outstanding) ─────────────────────────────
  const outstandingReceivables = useMemo(() => {
    // Use ALL sales (not just date-filtered) for outstanding amounts, then optionally filter
    const creditSales = sales.filter((s: any) => {
      const credit = Number(s.creditAmount || 0);
      if (credit <= 0) return false;
      if (locationId && s.locationId !== locationId) return false;
      return true;
    });

    return creditSales
      .map((s: any) => {
        const paid = s.paidAmount != null
          ? Number(s.paidAmount || 0)
          : customerPayments
            .flatMap((p: any) => (p.allocations || []).length
              ? (p.allocations || []).filter((allocation: any) => allocation.saleId === s.id)
              : (p.saleId === s.id ? [{ amount: p.amount }] : []))
            .reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
        const outstanding = s.outstandingAmount != null
          ? Number(s.outstandingAmount || 0)
          : Math.max(0, Number(s.creditAmount || 0) - paid);
        const customer = customers.find((c: any) => c.id === s.customerId);
        const location = locations.find((l: any) => l.id === s.locationId);
        return {
          id: s.id,
          voucherCode: s.voucherCode,
          customerName: customer?.name || "Walk-in Customer",
          locationName: location?.name || "—",
          saleDate: s.saleDate,
          totalCredit: Number(s.creditAmount || 0),
          paid,
          outstanding,
        };
      })
      .filter((r: any) => r.outstanding > 0)
      .sort((a: any, b: any) => b.outstanding - a.outstanding);
  }, [sales, customerPayments, customers, locations, locationId]);

  const totalReceivables = outstandingReceivables.reduce((s: any, r: any) => s + r.outstanding, 0);

  // ── Payables (unpaid / partial purchases) ─────────────────────────────
  const outstandingPayables = useMemo(() => {
    const debtPurchases = purchases.filter((p: any) => {
      const debt = Number(p.debtAmount || 0);
      if (debt <= 0) return false;
      if (locationId && p.locationId !== locationId) return false;
      return true;
    });

    return debtPurchases
      .map((p: any) => {
        const supplier = suppliers.find((s: any) => s.id === p.supplierId);
        const location = locations.find((l: any) => l.id === p.locationId);
        return {
          id: p.id,
          invoiceNo: p.invoiceNo || "—",
          supplierName: supplier?.name || "Unknown Supplier",
          locationName: location?.name || "—",
          purchaseDate: p.purchaseDate,
          totalAmount: Number(p.totalAmount || 0),
          paidAmount: Number(p.paidAmount || 0),
          cashAmount: Number(p.cashAmount || 0),
          bankAmount: Number(p.bankAmount || 0),
          outstanding: Number(p.debtAmount || 0),
        };
      })
      .filter((r: any) => r.outstanding > 0)
      .sort((a: any, b: any) => b.outstanding - a.outstanding);
  }, [purchases, suppliers, locations, locationId]);

  const totalPayables = outstandingPayables.reduce((s: any, r: any) => s + r.outstanding, 0);

  // ── Expense breakdown by category ──────────────────────────────────────
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach((e: any) => {
      const cat = e.category || "Uncategorized";
      map[cat] = (map[cat] || 0) + Number(e.amount || 0);
    });
    return Object.entries(map)
      .map(([cat, amount]) => ({ cat, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses]);

  const maxExpCat = expenseByCategory[0]?.amount || 1;

  // ── Bank accounts summary ──────────────────────────────────────────────
  const scopedBankAccounts = bankAccounts.filter((account: any) => !locationId || account.locationId === locationId);
  const totalBankBalance = scopedBankAccounts.reduce((s: number, acc: any) => s + Number(acc.currentBalance || 0), 0);

  // ── Tab content ────────────────────────────────────────────────────────
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "receivables", label: `Receivables${totalReceivables > 0 ? ` (${outstandingReceivables.length})` : ""}` },
    { id: "payables", label: `Payables${totalPayables > 0 ? ` (${outstandingPayables.length})` : ""}` },
    { id: "expenses", label: "Expenses" },
  ] as const;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Finance Reports</h1>
            <p className="text-slate-500 mt-1 text-sm">Profit, cash, and balances for {scope.label} only.</p>
          </div>
        </div>
      </div>

      <ReportScopeBar label={scope.label} />

      {/* ── Filters ── */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-[160px_160px] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
        <div className="relative flex items-center">
          <Calendar className="absolute left-3 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 text-slate-600"
          />
        </div>
        <div className="relative flex items-center">
          <Calendar className="absolute left-3 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 text-slate-600"
          />
        </div>
      </div>

      {/* ── Top KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard
          title="Total Revenue"
          value={formatCurrency(totalRevenue)}
          sub={`${filteredSales.length} sales`}
          icon={TrendingUp}
          color="emerald"
          trend="up"
        />
        <KpiCard
          title="Total Purchases"
          value={formatCurrency(totalCOGS)}
          sub={`${filteredPurchases.length} orders`}
          icon={ShoppingCart}
          color="sky"
        />
        <KpiCard
          title="Gross Profit"
          value={formatCurrency(grossProfit)}
          sub={`${filteredSales.length} sales profit`}
          icon={DollarSign}
          color={grossProfit >= 0 ? "indigo" : "rose"}
          trend={grossProfit >= 0 ? "up" : "down"}
        />
        <KpiCard
          title="Total Expenses"
          value={formatCurrency(totalExpenses)}
          sub={`${filteredExpenses.length} entries`}
          icon={Receipt}
          color="amber"
          trend="down"
        />
        <KpiCard
          title="Net Profit"
          value={formatCurrency(netProfit)}
          sub="gross profit minus expenses"
          icon={Landmark}
          color={netProfit >= 0 ? "violet" : "rose"}
          trend={netProfit >= 0 ? "up" : "down"}
        />
        <KpiCard
          title="Bank Balances"
          value={formatCurrency(totalBankBalance)}
          sub={`${scopedBankAccounts.length} accounts`}
          icon={Building2}
          color="sky"
        />
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-slate-100 dark:bg-zinc-800 rounded-xl p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === tab.id
                ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cash Flow */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6">
            <SectionTitle>Cash Flow</SectionTitle>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                    <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Cash Inflow</p>
                    <p className="text-[10px] text-emerald-600/70">Sales + Customer Payments (Cash)</p>
                  </div>
                </div>
                <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">{formatCurrency(cashIn)}</p>
              </div>
              <div className="flex items-center justify-between p-4 bg-rose-50 dark:bg-rose-950/20 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-lg">
                    <ArrowDownRight className="w-4 h-4 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-rose-700 dark:text-rose-400">Cash Outflow</p>
                    <p className="text-[10px] text-rose-600/70">Purchases + Expenses + Payments (Cash)</p>
                  </div>
                </div>
                <p className="text-lg font-black text-rose-700 dark:text-rose-400">{formatCurrency(cashOut)}</p>
              </div>
              <div
                className={`flex items-center justify-between p-4 rounded-xl ${
                  netCashFlow >= 0
                    ? "bg-indigo-50 dark:bg-indigo-950/20"
                    : "bg-amber-50 dark:bg-amber-950/20"
                }`}
              >
                <p className={`text-xs font-black uppercase tracking-widest ${netCashFlow >= 0 ? "text-indigo-700 dark:text-indigo-400" : "text-amber-700 dark:text-amber-400"}`}>
                  Net Cash Flow
                </p>
                <p className={`text-lg font-black ${netCashFlow >= 0 ? "text-indigo-700 dark:text-indigo-400" : "text-amber-700 dark:text-amber-400"}`}>
                  {formatCurrency(netCashFlow)}
                </p>
              </div>
            </div>
          </div>

          {/* Bank Flow */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6">
            <SectionTitle>Bank Flow</SectionTitle>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-sky-50 dark:bg-sky-950/20 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-sky-100 dark:bg-sky-900/30 rounded-lg">
                    <ArrowUpRight className="w-4 h-4 text-sky-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-sky-700 dark:text-sky-400">Bank Inflow</p>
                    <p className="text-[10px] text-sky-600/70">Sales + Customer Payments (Bank)</p>
                  </div>
                </div>
                <p className="text-lg font-black text-sky-700 dark:text-sky-400">{formatCurrency(bankIn)}</p>
              </div>
              <div className="flex items-center justify-between p-4 bg-rose-50 dark:bg-rose-950/20 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-lg">
                    <ArrowDownRight className="w-4 h-4 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-rose-700 dark:text-rose-400">Bank Outflow</p>
                    <p className="text-[10px] text-rose-600/70">Purchases + Expenses + Payments (Bank)</p>
                  </div>
                </div>
                <p className="text-lg font-black text-rose-700 dark:text-rose-400">{formatCurrency(bankOut)}</p>
              </div>
              <div
                className={`flex items-center justify-between p-4 rounded-xl ${
                  netBankFlow >= 0
                    ? "bg-indigo-50 dark:bg-indigo-950/20"
                    : "bg-amber-50 dark:bg-amber-950/20"
                }`}
              >
                <p className={`text-xs font-black uppercase tracking-widest ${netBankFlow >= 0 ? "text-indigo-700 dark:text-indigo-400" : "text-amber-700 dark:text-amber-400"}`}>
                  Net Bank Flow
                </p>
                <p className={`text-lg font-black ${netBankFlow >= 0 ? "text-indigo-700 dark:text-indigo-400" : "text-amber-700 dark:text-amber-400"}`}>
                  {formatCurrency(netBankFlow)}
                </p>
              </div>
            </div>
          </div>

          {/* P&L Summary */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6">
            <SectionTitle>Profit & Loss Summary</SectionTitle>
            <div className="space-y-3">
              {[
                { label: "Total Revenue", value: totalRevenue, color: "emerald" as const },
                { label: "Cost of Goods Sold", value: -totalCOGS, color: "rose" as const },
                { label: "Gross Profit", value: grossProfit, color: grossProfit >= 0 ? "indigo" as const : "rose" as const, bold: true },
                { label: "Operating Expenses", value: -totalExpenses, color: "amber" as const },
                { label: "Net Profit / Loss", value: netProfit, color: netProfit >= 0 ? "violet" as const : "rose" as const, bold: true },
              ].map((row, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between py-2.5 ${
                    row.bold
                      ? "border-t border-slate-200 dark:border-zinc-700 mt-1 pt-3"
                      : "border-b border-slate-100 dark:border-zinc-800"
                  }`}
                >
                  <p className={`text-xs ${row.bold ? "font-black text-slate-900 dark:text-white" : "font-semibold text-slate-600 dark:text-slate-400"}`}>
                    {row.label}
                  </p>
                  <p
                    className={`text-xs font-black ${
                      row.color === "emerald"
                        ? "text-emerald-600"
                        : row.color === "rose"
                        ? "text-rose-600"
                        : row.color === "indigo"
                        ? "text-indigo-600"
                        : row.color === "amber"
                        ? "text-amber-600"
                        : "text-violet-600"
                    }`}
                  >
                    {row.value < 0 ? `(${formatCurrency(Math.abs(row.value))})` : formatCurrency(row.value)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Bank Accounts */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6">
            <SectionTitle>Bank Account Balances</SectionTitle>
            {scopedBankAccounts.length === 0 ? (
              <div className="text-center py-8 text-slate-300 dark:text-zinc-600">
                <Building2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-xs font-bold uppercase tracking-widest">No bank accounts configured</p>
              </div>
            ) : (
              <div className="space-y-3">
                {scopedBankAccounts.map((acc: any) => (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-sky-100 dark:bg-sky-900/30 rounded-lg">
                        {acc.accountType === "CASH" ? (
                          <Wallet className="w-4 h-4 text-sky-600" />
                        ) : (
                          <Building2 className="w-4 h-4 text-sky-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{acc.displayName}</p>
                        <p className="text-[10px] text-slate-400">{acc.accountType === "CASH" ? "Cash Account" : acc.bankName || "Bank Account"}</p>
                      </div>
                    </div>
                    <p className={`text-sm font-black ${Number(acc.currentBalance) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {formatCurrency(Number(acc.currentBalance || 0))}
                    </p>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-zinc-700">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500">Total</p>
                  <p className={`text-sm font-black ${totalBankBalance >= 0 ? "text-indigo-600" : "text-rose-600"}`}>
                    {formatCurrency(totalBankBalance)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Receivables Tab ── */}
      {activeTab === "receivables" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              title="Total Outstanding"
              value={formatCurrency(totalReceivables)}
              sub={`${outstandingReceivables.length} unpaid credit sales`}
              icon={Users}
              color="rose"
              trend="down"
            />
            <KpiCard
              title="Largest Receivable"
              value={outstandingReceivables[0] ? formatCurrency(outstandingReceivables[0].outstanding) : "—"}
              sub={outstandingReceivables[0]?.customerName || "No data"}
              icon={AlertTriangle}
              color="amber"
            />
            <KpiCard
              title="Avg Per Customer"
              value={
                outstandingReceivables.length > 0
                  ? formatCurrency(totalReceivables / outstandingReceivables.length)
                  : "—"
              }
              sub="Average outstanding balance"
              icon={BarChart3}
              color="indigo"
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Outstanding Receivables</p>
            </div>
            <div className="overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[860px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:border-zinc-800 dark:bg-zinc-950/50">
                    <th className="px-5 py-3 text-left">Voucher</th>
                    <th className="px-5 py-3 text-left">Customer</th>
                    <th className="px-5 py-3 text-left">Sale Date</th>
                    <th className="px-5 py-3 text-right">Total Credit</th>
                    <th className="px-5 py-3 text-right">Paid</th>
                    <th className="px-5 py-3 text-right">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {outstandingReceivables.map((r: any) => (
                    <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="px-5 py-3 text-xs font-mono font-bold text-slate-900 dark:text-white">
                        <Link href={`/sales/${r.id}`} className="hover:text-indigo-600">
                          {r.voucherCode}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-xs font-bold text-slate-600">{r.customerName}</td>
                      <td className="px-5 py-3 text-xs text-slate-500">{new Date(r.saleDate).toLocaleDateString()}</td>
                      <td className="px-5 py-3 text-right text-xs font-bold text-slate-600">{formatCurrency(r.totalCredit)}</td>
                      <td className="px-5 py-3 text-right text-xs font-bold text-emerald-600">{formatCurrency(r.paid)}</td>
                      <td className="px-5 py-3 text-right text-xs font-black text-rose-600">{formatCurrency(r.outstanding)}</td>
                    </tr>
                  ))}
                  {outstandingReceivables.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-xs font-black uppercase tracking-widest text-slate-500">
                        No outstanding receivables
                      </td>
                    </tr>
                  )}
                </tbody>
                {outstandingReceivables.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950/50">
                      <td colSpan={4} className="px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-500">Total Outstanding</td>
                      <td className="px-5 py-3 text-right text-xs font-black text-slate-900 dark:text-white">
                        {formatCurrency(outstandingReceivables.reduce((s: number, r: any) => s + r.totalCredit, 0))}
                      </td>
                      <td className="px-5 py-3 text-right text-xs font-black text-emerald-600">
                        {formatCurrency(outstandingReceivables.reduce((s: number, r: any) => s + r.paid, 0))}
                      </td>
                      <td className="px-5 py-3 text-right text-xs font-black text-rose-600">
                        {formatCurrency(totalReceivables)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Payables Tab ── */}
      {activeTab === "payables" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              title="Total Outstanding"
              value={formatCurrency(totalPayables)}
              sub={`${outstandingPayables.length} unpaid orders`}
              icon={Package}
              color="rose"
              trend="down"
            />
            <KpiCard
              title="Largest Payable"
              value={outstandingPayables[0] ? formatCurrency(outstandingPayables[0].outstanding) : "—"}
              sub={outstandingPayables[0]?.supplierName || "No data"}
              icon={AlertTriangle}
              color="amber"
            />
            <KpiCard
              title="Avg Per Supplier"
              value={
                outstandingPayables.length > 0
                  ? formatCurrency(totalPayables / outstandingPayables.length)
                  : "—"
              }
              sub="Average outstanding payable"
              icon={BarChart3}
              color="indigo"
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Outstanding Payables</p>
            </div>
            <div className="overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[860px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:border-zinc-800 dark:bg-zinc-950/50">
                    <th className="px-5 py-3 text-left">Invoice #</th>
                    <th className="px-5 py-3 text-left">Supplier</th>
                    <th className="px-5 py-3 text-left">Date</th>
                    <th className="px-5 py-3 text-right">Total</th>
                    <th className="px-5 py-3 text-right">Cash</th>
                    <th className="px-5 py-3 text-right">Bank</th>
                    <th className="px-5 py-3 text-right">Paid</th>
                    <th className="px-5 py-3 text-right">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {outstandingPayables.map((r: any) => (
                    <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="px-5 py-3 text-xs font-mono font-bold text-slate-900 dark:text-white">{r.invoiceNo}</td>
                      <td className="px-5 py-3 text-xs font-bold text-slate-600">{r.supplierName}</td>
                      <td className="px-5 py-3 text-xs text-slate-500">{new Date(r.purchaseDate || r.date).toLocaleDateString()}</td>
                      <td className="px-5 py-3 text-right text-xs font-bold text-slate-600">{formatCurrency(r.totalAmount)}</td>
                      <td className="px-5 py-3 text-right text-xs font-bold text-slate-600">{formatCurrency(r.cashAmount)}</td>
                      <td className="px-5 py-3 text-right text-xs font-bold text-slate-600">{formatCurrency(r.bankAmount)}</td>
                      <td className="px-5 py-3 text-right text-xs font-bold text-emerald-600">{formatCurrency(r.paidAmount)}</td>
                      <td className="px-5 py-3 text-right text-xs font-black text-rose-600">{formatCurrency(r.outstanding)}</td>
                    </tr>
                  ))}
                  {outstandingPayables.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-xs font-black uppercase tracking-widest text-slate-500">
                        No outstanding payables
                      </td>
                    </tr>
                  )}
                </tbody>
                {outstandingPayables.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950/50">
                      <td colSpan={4} className="px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-500">Total Outstanding</td>
                      <td className="px-5 py-3 text-right text-xs font-black text-slate-900 dark:text-white">
                        {formatCurrency(outstandingPayables.reduce((s: number, r: any) => s + r.totalAmount, 0))}
                      </td>
                      <td className="px-5 py-3 text-right text-xs font-black text-slate-900 dark:text-white">
                        {formatCurrency(outstandingPayables.reduce((s: number, r: any) => s + r.cashAmount, 0))}
                      </td>
                      <td className="px-5 py-3 text-right text-xs font-black text-slate-900 dark:text-white">
                        {formatCurrency(outstandingPayables.reduce((s: number, r: any) => s + r.bankAmount, 0))}
                      </td>
                      <td className="px-5 py-3 text-right text-xs font-black text-emerald-600">
                        {formatCurrency(outstandingPayables.reduce((s: number, r: any) => s + r.paidAmount, 0))}
                      </td>
                      <td className="px-5 py-3 text-right text-xs font-black text-rose-600">
                        {formatCurrency(totalPayables)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Expenses Tab ── */}
      {activeTab === "expenses" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              title="Total Expenses"
              value={formatCurrency(totalExpenses)}
              sub={`${filteredExpenses.length} entries`}
              icon={Receipt}
              color="amber"
            />
            <KpiCard
              title="Top Category"
              value={expenseByCategory[0]?.cat || "—"}
              sub={expenseByCategory[0] ? formatCurrency(expenseByCategory[0].amount) : "No data"}
              icon={BarChart3}
              color="rose"
            />
            <KpiCard
              title="Avg per Entry"
              value={filteredExpenses.length > 0 ? formatCurrency(totalExpenses / filteredExpenses.length) : "—"}
              sub="Average expense amount"
              icon={DollarSign}
              color="violet"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Breakdown */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6">
              <SectionTitle>By Category</SectionTitle>
              {expenseByCategory.length === 0 ? (
                <div className="text-center py-8 text-slate-300 dark:text-zinc-600">
                  <Receipt className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-bold uppercase tracking-widest">No expenses recorded</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {expenseByCategory.map(({ cat, amount }, i) => (
                    <div key={cat}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              i === 0 ? "bg-indigo-500" : i === 1 ? "bg-sky-500" : i === 2 ? "bg-violet-500" : i === 3 ? "bg-amber-500" : i === 4 ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                          />
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{cat}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-black text-slate-900 dark:text-white">{formatCurrency(amount)}</p>
                          <p className="text-[10px] text-slate-400">{totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(1) : 0}%</p>
                        </div>
                      </div>
                      <ProgressBar value={amount} max={maxExpCat} color={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Expense List */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Expense Entries</p>
              </div>
              <div className="overflow-auto overscroll-x-contain max-h-96">
                <table className="w-full min-w-[760px]">
                  <thead className="sticky top-0">
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:border-zinc-800 dark:bg-zinc-950/80">
                      <th className="px-5 py-3 text-left">Description</th>
                      <th className="px-5 py-3 text-left">Category</th>
                      <th className="px-5 py-3 text-left">Date</th>
                      <th className="px-5 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {[...filteredExpenses]
                      .sort((a: any, b: any) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime())
                      .map((e: any) => (
                        <tr key={e.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                          <td className="px-5 py-3 text-xs font-bold text-slate-900 dark:text-white">{e.name}</td>
                          <td className="px-5 py-3">
                            <span className="inline-flex px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-amber-50 text-amber-600 dark:bg-amber-950/20">
                              {e.category || "General"}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-xs text-slate-500">{new Date(e.expenseDate).toLocaleDateString()}</td>
                          <td className="px-5 py-3 text-right text-xs font-black text-rose-600">{formatCurrency(Number(e.amount || 0))}</td>
                        </tr>
                      ))}
                    {filteredExpenses.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center text-xs font-black uppercase tracking-widest text-slate-500">
                          No expense records found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
