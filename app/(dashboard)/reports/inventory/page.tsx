"use client";

import React, { useState } from "react";
import {
  Package,
  ArrowLeft,
  Download,
  Filter,
  Search,
  Warehouse,
  ShieldAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useReportData } from "@/lib/client/useAppData";
import { formatCurrency } from "@/lib/utils";
import { formatUnitLabel } from "@/lib/item-display";
import { ReportScopeBar, useReportScope } from "@/components/report-scope-bar";

export default function InventoryReportsPage() {
  const router = useRouter();
  const { items = [], locations = [], categories = [], currentLocation } = useReportData();
  const scope = useReportScope(locations, currentLocation);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const locationId = scope.scopeId;

  const filteredItems = items.filter((item: any) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      `${item.name} ${item.code} ${item.category}`.toLowerCase().includes(q);
    const matchesLocation = !locationId || item.locationId === locationId;
    const matchesCategory = !categoryId || item.category === categoryId;
    return matchesSearch && matchesLocation && matchesCategory;
  });

  const totalItems = Array.from(
    new Set(filteredItems.map((item: any) => item.id)),
  ).length;
  const totalValuation = filteredItems.reduce(
    (sum: number, item: any) =>
      sum + Number(item.stock || 0) * Number(item.price || 0),
    0,
  );
  const lowStockCount = filteredItems.filter(
    (item: any) => Number(item.stock || 0) <= Number(item.lowStockAlert || 10),
  ).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Inventory Reports
            </h1>
            <p className="text-slate-500 mt-1">
              Stock for {scope.label} only.
            </p>
          </div>
        </div>
      </div>

      <ReportScopeBar label={scope.label} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ReportSummary
          title="Total Items"
          value={totalItems.toLocaleString()}
          sub="Inventory Worth"
          icon={Package}
        />
        <ReportSummary
          title="Total Valuation"
          value={formatCurrency(totalValuation)}
          sub="Based on retail price"
          icon={Warehouse}
          color="emerald"
        />
        <ReportSummary
          title="Low Stock Items"
          value={lowStockCount.toLocaleString()}
          sub="Items below safety levels"
          icon={ShieldAlert}
          color="amber"
        />
      </div>

      {/* Filters and Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid gap-3 border-b border-slate-100 p-4 dark:border-zinc-800 xl:grid-cols-[minmax(260px,1fr)_200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by name, code..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-semibold outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>
          <label className="relative block">
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 pr-9 text-xs font-bold uppercase text-slate-600 outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="">All Categories</option>
              {categories.map((cat: any) => (
                <option key={cat.name} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold uppercase tracking-widest text-slate-700 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-slate-300">
                <th className="px-6 py-4 text-left">Item Name</th>
                <th className="px-6 py-4 text-left">SKU / Code</th>
                <th className="px-6 py-4 text-left">Category</th>
                <th className="px-6 py-4 text-right">Unit Price</th>
                <th className="px-6 py-4 text-center">Stock Level</th>
                <th className="px-6 py-4 text-right">Valuation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredItems.map((item: any, idx: number) => {
                const itemValuation =
                  Number(item.stock || 0) * Number(item.price || 0);
                const isLowStock =
                  Number(item.stock || 0) <= Number(item.lowStockAlert || 10);
                return (
                  <tr
                    key={`${item.id}-${idx}`}
                    className="transition-colors hover:bg-slate-50/50 dark:hover:bg-zinc-800/30"
                  >
                    <td className="px-6 py-4 text-xs font-bold text-slate-900 dark:text-white">
                      {item.name}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-400">
                      {item.code || "-"}
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-500">
                      {item.category}
                    </td>
                    <td className="px-6 py-4 text-right text-xs font-bold text-slate-900 dark:text-zinc-100">
                      {formatCurrency(Number(item.price || 0))}
                    </td>
                    <td
                      className={`px-6 py-4 text-center text-xs font-black ${isLowStock ? "text-rose-500" : "text-slate-700 dark:text-zinc-300"}`}
                    >
                      {item.stock} {formatUnitLabel(item)}
                    </td>
                    <td className="px-6 py-4 text-right text-xs font-bold text-slate-900 dark:text-zinc-100">
                      {formatCurrency(itemValuation)}
                    </td>
                  </tr>
                );
              })}
              {filteredItems.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-xs font-black uppercase tracking-widest text-slate-500"
                  >
                    No items found
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

function ReportSummary({
  title,
  value,
  sub,
  icon: Icon,
  color = "indigo",
}: any) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
          {title}
        </p>
        <Icon
          className={`w-4 h-4 ${color === "emerald" ? "text-emerald-500" : color === "amber" ? "text-amber-500" : "text-indigo-500"}`}
        />
      </div>
      <h4 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
        {value}
      </h4>
      <p className="text-[10px] text-slate-500 mt-1 font-bold">{sub}</p>
    </div>
  );
}
