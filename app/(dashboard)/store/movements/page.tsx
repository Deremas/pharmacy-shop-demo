"use client";

import React from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronDown, History, Search } from "lucide-react";
import { useAppData } from "@/lib/client/useAppData";
import { cn } from "@/lib/utils";
import { paginateRows } from "@/lib/sales-utils";

export default function MovementsPage() {
  const { inventoryMovements = [], locations = [], currentLocation } = useAppData();
  const [search, setSearch] = React.useState("");
  const [locationId, setLocationId] = React.useState("");
  const [type, setType] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(15);
  const showLocation = !currentLocation && !locationId;

  React.useEffect(() => {
    if (currentLocation) setLocationId(currentLocation.id);
  }, [currentLocation]);

  const movementTypes = React.useMemo<string[]>(
    () => Array.from(new Set<string>(inventoryMovements.map((movement: any) => String(movement.type || "")).filter(Boolean))).sort(),
    [inventoryMovements],
  );

  const filteredMovements = inventoryMovements.filter((movement: any) => {
    const q = search.trim().toLowerCase();
    return (
      (!locationId || movement.locationId === locationId) &&
      (!type || movement.type === type) &&
      (!q || `${movement.itemName} ${movement.itemCode} ${movement.type} ${movement.locationName} ${movement.referenceId}`.toLowerCase().includes(q))
    );
  });
  const pagedMovements = paginateRows<any>(filteredMovements, page, pageSize);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          <History className="h-8 w-8 text-indigo-600" />
          Stock Movements
        </h1>
        <p className="mt-1 text-slate-500">Audit log of item entries, exits, sales, purchases, and transfers.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="page-filters border-b border-slate-100 p-4 dark:border-zinc-800">
          <div className="relative filter-grow" data-filter-grow>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search movements..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-semibold outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>
          {locations.length > 1 ? (
            <Select value={locationId} onChange={(value) => { setLocationId(value); setPage(1); }} label="Counter / Store" options={locations.map((location: any) => ({ value: location.id, label: location.name }))} />
          ) : null}
          <Select value={type} onChange={(value) => { setType(value); setPage(1); }} label="All Types" options={movementTypes.map((entry) => ({ value: entry, label: entry.replace(/_/g, " ") }))} />
        </div>

        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold uppercase tracking-widest text-slate-700 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-slate-300">
                <th className="px-6 py-4 text-left">Type</th>
                <th className="px-6 py-4 text-left">SKU</th>
                <th className="px-6 py-4 text-left">Item</th>
                {showLocation && <th className="px-6 py-4 text-left">Location</th>}
                <th className="px-6 py-4 text-center">Quantity</th>
                <th className="px-6 py-4 text-center">Before / After</th>
                <th className="px-6 py-4 text-left">Reference</th>
                <th className="px-6 py-4 text-right">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {pagedMovements.rows.map((movement: any) => {
                const isIn = Number(movement.quantity || 0) > 0;
                return (
                  <tr key={movement.id} className="transition-colors hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                    <td className="px-6 py-4">
                      <span className={cn(
                        "flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider",
                        isIn ? "text-emerald-600" : "text-rose-600",
                      )}>
                        {isIn ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                        {String(movement.type || "").replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 font-mono text-xs font-bold uppercase tracking-tight text-slate-700 dark:text-zinc-300">{movement.itemCode || "-"}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-800 dark:text-zinc-200">{movement.itemName}</td>
                    {showLocation && (
                      <td className="px-6 py-4 text-xs font-bold text-slate-500">{movement.locationName}</td>
                    )}
                    <td className="px-6 py-4 text-center">
                      <span className={cn("text-xs font-black", isIn ? "text-emerald-600" : "text-rose-600")}>
                        {isIn ? `+${movement.quantity}` : movement.quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-mono text-xs text-slate-500">
                      {movement.beforeQuantity} / {movement.afterQuantity}
                    </td>
                    <td className="max-w-[220px] truncate px-6 py-4 text-xs text-slate-500">
                      {movement.referenceType || "-"} {movement.referenceId || ""}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-xs text-slate-400">{new Date(movement.createdAt).toLocaleString()}</td>
                  </tr>
                );
              })}
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={showLocation ? 8 : 7} className="px-6 py-14 text-center text-xs font-black uppercase tracking-widest text-slate-500">
                    No movements found
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500 dark:border-zinc-800">
          <span>Page {pagedMovements.page} of {pagedMovements.totalPages} - {filteredMovements.length} movements</span>
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
            <button type="button" disabled={pagedMovements.page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40 dark:border-zinc-800">Prev</button>
            <button type="button" disabled={pagedMovements.page >= pagedMovements.totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40 dark:border-zinc-800">Next</button>
          </div>
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
