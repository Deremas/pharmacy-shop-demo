"use client";

import React from "react";
import Link from "next/link";
import { Truck, Search } from "lucide-react";

import { useAppData } from "@/lib/client/useAppData";
import { isTenantBusiness } from "@/lib/businesses";
import { formatUnitLabel } from "@/lib/item-display";
import { formatCurrency } from "@/lib/utils";
import { paginateRows } from "@/lib/sales-utils";

export default function PurchaseItemsPage() {
  const { purchases, items, products = [], locations, suppliers, currentLocation } =
    useAppData();
  const businessLocations = (locations || []).filter(isTenantBusiness);
  const [search, setSearch] = React.useState("");
  const [locationId, setLocationId] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(15);
  const showLocation = !currentLocation && !locationId;

  React.useEffect(() => {
    if (currentLocation?.id) setLocationId(currentLocation.id);
  }, [currentLocation?.id]);

  const itemName = (id: string) =>
    products.find((item: any) => item.id === id)?.name || items.find((item: any) => item.id === id)?.name || id;
  const itemCode = (id: string) =>
    products.find((item: any) => item.id === id)?.code || items.find((item: any) => item.id === id)?.code || "";
  const itemUnit = (id: string) =>
    formatUnitLabel(products.find((item: any) => item.id === id) || items.find((item: any) => item.id === id)) || "-";
  const supplierName = (id?: string | null) =>
    suppliers.find((s: any) => s.id === id)?.name || "No Supplier";
  const locationName = (id: string) =>
    locations.find((location: any) => location.id === id)?.name || "-";

  const rows = purchases
    .filter(
      (purchase: any) => !locationId || purchase.locationId === locationId,
    )
    .flatMap((purchase: any) =>
      purchase.items.map((line: any) => ({
        purchase,
        line,
        item: itemName(line.itemId),
        code: itemCode(line.itemId),
        unit: itemUnit(line.itemId),
        supplier: supplierName(purchase.supplierId),
        location: locationName(purchase.locationId),
      })),
    )
    .filter((row: any) => {
      const haystack =
        `${row.purchase.id} ${row.item} ${row.code} ${row.supplier} ${row.location}`.toLowerCase();
      return haystack.includes(search.toLowerCase());
    });
  const pagedRows = paginateRows<any>(rows, page, pageSize);

  // Summary stats
  const totalItems = rows.length;
  const totalQty = rows.reduce(
    (sum: number, r: any) => sum + Number(r.line.qty || 0),
    0,
  );
  const totalInvestment = rows.reduce(
    (sum: number, r: any) =>
      sum + Number(r.line.total || r.line.qty * r.line.unitCost || 0),
    0,
  );

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="page-heading">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
            <Truck className="h-7 w-7 text-amber-600 sm:h-8 sm:w-8" />
            Purchased Items
          </h1>
          <p className="mt-1 text-xs font-black uppercase tracking-widest text-slate-500">
            Item-level procurement history by location
          </p>
        </div>
      </div>

      <div className="page-stats">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm sm:p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Total Line Items
          </p>
          <p className="mt-1 text-xl font-black text-slate-900 dark:text-white sm:text-2xl">
            {totalItems.toLocaleString()}
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm sm:p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Total Quantity
          </p>
          <p className="mt-1 text-xl font-black text-slate-900 dark:text-white sm:text-2xl">
            {totalQty.toLocaleString()}
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm sm:p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Total Investment
          </p>
          <p className="mt-1 text-xl font-black text-amber-600 dark:text-amber-400 sm:text-2xl">
            {formatCurrency(totalInvestment)}
          </p>
        </div>
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
              placeholder="Search purchased items..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-bold outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-900"
            />
          </div>
          {businessLocations.length > 1 ? (
          <select
            value={locationId}
            onChange={(event) => {
              setLocationId(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-widest text-slate-600 outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <option value="">Counter / Store</option>
            {businessLocations.map((location: any) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
          ) : null}
        </div>
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[1000px] text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-zinc-800 dark:bg-zinc-950/50">
                <th className="px-5 py-4">Date</th>
                <th className="px-5 py-4">Purchase ID</th>
                <th className="px-5 py-4">SKU</th>
                <th className="px-5 py-4">Item</th>
                <th className="px-5 py-4">Supplier</th>
                {showLocation && <th className="px-5 py-4">Location</th>}
                <th className="px-5 py-4 text-right">Qty</th>
                <th className="px-5 py-4 text-right">Buying Price</th>
                <th className="px-5 py-4 text-right">Selling Price</th>
                <th className="px-5 py-4 text-right">Total</th>
                <th className="px-5 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={showLocation ? 11 : 10}
                    className="px-5 py-14 text-center text-xs font-black uppercase tracking-widest text-slate-500"
                  >
                    No purchased items found
                  </td>
                </tr>
              ) : (
                pagedRows.rows.map((row: any) => (
                  <tr
                    key={`${row.purchase.id}-${row.line.id}`}
                    className="hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="px-5 py-4 text-sm font-semibold text-slate-500">
                      {new Date(row.purchase.purchaseDate).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-sm font-black text-slate-950 dark:text-white">
                      {row.purchase.id}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 font-mono text-xs font-bold uppercase tracking-widest text-slate-500">{row.code || "-"}</td>
                    <td className="px-5 py-4 text-sm font-black text-slate-950 dark:text-white">{row.item}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-500">
                      {row.supplier}
                    </td>
                    {showLocation && (
                      <td className="px-5 py-4">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 rounded-lg text-[9px] font-black uppercase">
                          {row.location}
                        </span>
                      </td>
                    )}
                    <td className="px-5 py-4 text-right text-sm font-black">
                      {row.line.qty}
                    </td>
                    <td className="px-5 py-4 text-right text-sm font-black font-mono">
                      {formatCurrency(row.line.unitCost)}
                    </td>
                    <td className="px-5 py-4 text-right text-sm font-black font-mono text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(row.line.sellingPrice || 0)}
                    </td>
                    <td className="px-5 py-4 text-right text-sm font-black text-amber-600 dark:text-amber-400">
                      {formatCurrency(
                        row.line.total || row.line.qty * row.line.unitCost,
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/purchases/${row.purchase.id}`}
                        className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500 dark:border-zinc-800">
          <span>Page {pagedRows.page} of {pagedRows.totalPages} - {rows.length} purchased items</span>
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
            <button type="button" disabled={pagedRows.page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40 dark:border-zinc-800">Prev</button>
            <button type="button" disabled={pagedRows.page >= pagedRows.totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40 dark:border-zinc-800">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
