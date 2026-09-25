"use client";

import React from "react";
import Link from "next/link";
import { ReceiptText, Search } from "lucide-react";

import { useAppData } from "@/lib/client/useAppData";
import { isTenantBusiness } from "@/lib/businesses";
import { formatCurrency } from "@/lib/utils";
import { paginateRows } from "@/lib/sales-utils";
import { formatSalePaymentPartsDetail } from "@/lib/payment-display";

export default function SoldItemsPage() {
  const { sales, items, products = [], locations, customers, currentLocation } = useAppData();
  const businessLocations = (locations || []).filter(isTenantBusiness);
  const [search, setSearch] = React.useState("");
  const [locationId, setLocationId] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(15);
  const showLocation = !currentLocation && !locationId;

  React.useEffect(() => {
    if (currentLocation?.id) setLocationId(currentLocation.id);
  }, [currentLocation?.id]);

  const itemName = (id: string) => products.find((item: any) => item.id === id)?.name || items.find((item: any) => item.id === id)?.name || id;
  const itemCode = (id: string) => products.find((item: any) => item.id === id)?.code || items.find((item: any) => item.id === id)?.code || "";
  const customerName = (id?: string | null) => customers.find((customer: any) => customer.id === id)?.name || "Walk-in Customer";
  const locationName = (id: string) => locations.find((location: any) => location.id === id)?.name || "-";

  const rows = sales
    .filter((sale: any) => !locationId || sale.locationId === locationId)
    .flatMap((sale: any) =>
      sale.items.map((line: any) => ({
        sale,
        line,
        item: line.itemName || itemName(line.itemId),
        code: itemCode(line.itemId),
        customer: customerName(sale.customerId),
        location: locationName(sale.locationId),
      })),
    )
    .filter((row: any) => {
      const haystack = `${row.sale.id} ${row.item} ${row.code} ${row.customer} ${row.location}`.toLowerCase();
      return haystack.includes(search.toLowerCase());
    });
  const pagedRows = paginateRows<any>(rows, page, pageSize);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
            <ReceiptText className="h-8 w-8 text-emerald-600" />
            Sold Items
          </h1>
          <p className="mt-1 text-xs font-black uppercase tracking-widest text-slate-500">Item-level sales history by location</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search sold items..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-bold outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-900 sm:w-72"
            />
          </div>
          {businessLocations.length > 1 ? (
            <select
            value={locationId}
            onChange={(event) => {
              setLocationId(event.target.value);
              setPage(1);
            }}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-widest text-slate-600 outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <option value="">Counter / Store</option>
            {businessLocations.map((location: any) => (
              <option key={location.id} value={location.id}>{location.name}</option>
            ))}
          </select>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[900px] text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-zinc-800 dark:bg-zinc-950/50">
                <th className="px-5 py-4">Date</th>
                <th className="px-5 py-4">Sale</th>
                <th className="px-5 py-4">SKU</th>
                <th className="px-5 py-4">Item</th>
                <th className="px-5 py-4">Customer</th>
                {showLocation && <th className="px-5 py-4">Location</th>}
                <th className="px-5 py-4">Payment</th>
                <th className="px-5 py-4 text-right">Qty</th>
                <th className="px-5 py-4 text-right">Unit Price</th>
                <th className="px-5 py-4 text-right">Total</th>
                <th className="px-5 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={showLocation ? 11 : 10} className="px-5 py-14 text-center text-xs font-black uppercase tracking-widest text-slate-500">
                    No sold items found
                  </td>
                </tr>
              ) : pagedRows.rows.map((row: any) => (
                <tr key={`${row.sale.id}-${row.line.id}`} className="hover:bg-slate-50 dark:hover:bg-zinc-800/30">
                  <td className="px-5 py-4 text-sm font-semibold text-slate-500">{new Date(row.sale.saleDate).toLocaleDateString()}</td>
                  <td className="px-5 py-4 text-sm font-black text-slate-950 dark:text-white">{row.sale.id}</td>
                  <td className="whitespace-nowrap px-5 py-4 font-mono text-xs font-bold uppercase tracking-widest text-slate-500">{row.code || "-"}</td>
                  <td className="px-5 py-4 text-sm font-black text-slate-950 dark:text-white">{row.item}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-slate-500">{row.customer}</td>
                  {showLocation && (
                    <td className="px-5 py-4 text-sm font-semibold text-slate-500">{row.location}</td>
                  )}
                  <td className="px-5 py-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{row.sale.paymentMethod}</p>
                    {(() => {
                      const detail = formatSalePaymentPartsDetail(
                        {
                          cashAmount: row.sale.cashAmount,
                          bankAmount: row.sale.bankAmount,
                          creditAmount: row.sale.creditAmount,
                        },
                        formatCurrency,
                      );
                      return detail ? <p className="mt-0.5 text-[10px] font-bold text-slate-400">{detail}</p> : null;
                    })()}
                  </td>
                  <td className="px-5 py-4 text-right text-sm font-black">{row.line.qty}</td>
                  <td className="px-5 py-4 text-right text-sm font-black">{formatCurrency(row.line.price)}</td>
                  <td className="px-5 py-4 text-right text-sm font-black text-emerald-600">{formatCurrency(row.line.total)}</td>
                  <td className="px-5 py-4 text-right">
                    <Link href={`/sales/${row.sale.id}`} className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500 dark:border-zinc-800">
          <span>Page {pagedRows.page} of {pagedRows.totalPages} - {rows.length} sold items</span>
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
