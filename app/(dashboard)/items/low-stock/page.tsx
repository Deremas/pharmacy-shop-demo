"use client";

import React from "react";
import { AlertTriangle, ChevronDown, Package, Search } from "lucide-react";
import { useAppData } from "@/lib/client/useAppData";
import { formatItemChoiceLabel, formatUnitLabel, itemVariant } from "@/lib/item-display";
import { aggregateCatalogStock, alertLevelForStock, thresholdForItem, uniqueCatalogItems } from "@/lib/stock";
import { cn } from "@/lib/utils";

export default function LowStockPage() {
  const { items = [], products = [], currentLocation } = useAppData();
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [alertLevel, setAlertLevel] = React.useState("");

  const catalog = React.useMemo(
    () => uniqueCatalogItems(products, items),
    [items, products],
  );
  const combinedItems = React.useMemo(
    () => aggregateCatalogStock(catalog, items),
    [catalog, items],
  );
  const categories = React.useMemo<string[]>(
    () => Array.from(new Set<string>(combinedItems.map((item: any) => String(item.category || "")).filter(Boolean))).sort(),
    [combinedItems],
  );

  const lowStockItems = combinedItems.filter((item: any) => {
    const threshold = thresholdForItem(item);
    const level = alertLevelForStock(Number(item.stock || 0), threshold);
    const q = search.trim().toLowerCase();
    return (
      level !== "Healthy" &&
      (!category || item.category === category) &&
      (!alertLevel || level === alertLevel) &&
      (!q || `${item.name} ${item.code} ${item.category} ${formatItemChoiceLabel(item, currentLocation?.id)}`.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl lg:text-3xl">
          <AlertTriangle className="h-5 w-5 text-amber-500 sm:h-7 sm:w-7" />
          Low Stock Alerts
        </h1>
        <p className="mt-1 text-slate-500">Items below their configured minimum, using combined shop + store quantity.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="page-filters border-b border-slate-100 p-4 dark:border-zinc-800">
          <div className="relative filter-grow" data-filter-grow>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search item, SKU or category..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-semibold outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>
          <Select value={category} onChange={setCategory} label="All Categories" options={categories.map((entry) => ({ value: entry, label: entry }))} />
          <Select value={alertLevel} onChange={setAlertLevel} label="All Alerts" options={["Out of Stock", "Critical", "Below Minimum"].map((entry) => ({ value: entry, label: entry }))} />
        </div>

        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold uppercase tracking-widest text-slate-700 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-slate-300">
                <th className="px-6 py-4 text-left">Item</th>
                <th className="px-6 py-4 text-left">Code</th>
                <th className="px-6 py-4 text-left">Category</th>
                <th className="px-6 py-4 text-center">Dispensary</th>
                <th className="px-6 py-4 text-center">Store</th>
                <th className="px-6 py-4 text-center">Total</th>
                <th className="px-6 py-4 text-center">Threshold</th>
                <th className="px-6 py-4 text-center">Alert</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {lowStockItems.map((item: any) => {
                const threshold = thresholdForItem(item);
                const level = alertLevelForStock(Number(item.stock || 0), threshold);
                const variant = itemVariant(item, currentLocation?.id);
                return (
                  <tr key={item.id} className="transition-colors hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-900/20">
                          <Package className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{variant.style}</span>
                          {variant.sizeLabel && variant.sizeLabel.toLowerCase() !== variant.style.toLowerCase() ? (
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{variant.sizeLabel}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs font-bold uppercase tracking-tight text-slate-700 dark:text-zinc-300">{item.code || "-"}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300">{item.category}</td>
                    <td className="px-6 py-4 text-center text-xs font-bold text-slate-600">{item.shopStock} {formatUnitLabel(item)}</td>
                    <td className="px-6 py-4 text-center text-xs font-bold text-slate-600">{item.storeStock} {formatUnitLabel(item)}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "rounded-lg p-1.5 text-xs font-black",
                        Number(item.stock || 0) <= 0 ? "bg-rose-100 text-rose-600 dark:bg-rose-900/30" : "bg-amber-100 text-amber-600 dark:bg-amber-900/30",
                      )}>
                        {item.stock} {formatUnitLabel(item)} LEFT
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-xs font-bold text-slate-500">{threshold} {formatUnitLabel(item)}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-widest",
                        level === "Out of Stock" && "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
                        level === "Critical" && "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
                        level === "Below Minimum" && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
                      )}>
                        {level}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {lowStockItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center text-xs font-black uppercase tracking-widest text-slate-500">
                    No low stock alerts found
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Select({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="relative block">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 pr-9 text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
    </label>
  );
}
