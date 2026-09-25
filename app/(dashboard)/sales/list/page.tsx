"use client";

import React, { useState } from "react";
import {
  Search,
  Filter,
  User,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

import { formatCurrency } from "@/lib/utils";
import { formatUnitLabel } from "@/lib/item-display";
import { isTenantBusiness } from "@/lib/businesses";
import { useAppData } from "@/lib/client/useAppData";
import { formatSalePaymentPartsDetail } from "@/lib/payment-display";

export default function SoldItems() {
  const { sales = [], products = [], items = [], customers = [], locations = [], currentLocation } = useAppData();
  const businessLocations = locations.filter(isTenantBusiness);
  const [search, setSearch] = useState("");
  const [locationId, setLocationId] = useState("");
  const showLocation = !currentLocation && !locationId;

  React.useEffect(() => {
    if (currentLocation?.id) setLocationId(currentLocation.id);
  }, [currentLocation?.id]);

  const soldItems = React.useMemo(() => {
    const rows = sales.flatMap((sale: any) => {
      const customer = customers.find((entry: any) => entry.id === sale.customerId);
      const location = locations.find((entry: any) => entry.id === sale.locationId);
      const paymentDetail = formatSalePaymentPartsDetail(
        {
          cashAmount: sale.cashAmount,
          bankAmount: sale.bankAmount,
          creditAmount: sale.creditAmount,
        },
        formatCurrency,
      );
      return (sale.items || []).map((line: any) => {
        const product = products.find((entry: any) => entry.id === line.itemId) || items.find((entry: any) => entry.id === line.itemId);
        return {
          id: line.id || `${sale.id}-${line.itemId}`,
          saleId: sale.id,
          itemId: line.itemId,
          name: product?.name || "Unknown item",
          code: product?.code || "",
          qty: Number(line.qty || 0),
          unit: formatUnitLabel(product),
          price: Number(line.price || 0),
          total: Number(line.total || 0),
          date: sale.saleDate,
          locationId: sale.locationId,
          location: location?.name || "Unknown location",
          customer: customer?.name || "Walk-in",
          paymentMethod: sale.paymentMethod,
          paymentDetail,
        };
      });
    });
    const term = search.trim().toLowerCase();
    return rows
      .filter((row: any) => !locationId || row.locationId === locationId)
      .filter((row: any) => !term || `${row.name} ${row.code} ${row.customer} ${row.location} ${row.saleId} ${row.paymentMethod}`.toLowerCase().includes(term))
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales, products, items, customers, locations, locationId, search]);

  const totalPageValue = soldItems.reduce((sum: number, item: any) => sum + item.total, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Sold Items History</h1>
          <p className="text-slate-500 text-sm">Granular view of all inventory exits and sales transactions.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-lg font-sans">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by product name, customer or voucher..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
            />
          </div>
          <div className="flex gap-2">
          {businessLocations.length > 1 ? (
            <select
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
              className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-500 p-2 outline-none"
            >
              <option value="">Counter / Store</option>
              {businessLocations.map((location: any) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
          ) : null}
            <button className="p-2 border border-slate-200 dark:border-zinc-800 rounded-lg bg-slate-50 dark:bg-zinc-950 text-slate-400 hover:text-slate-900 transition-colors">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[980px] text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-zinc-950/30 text-[10px] text-slate-500 font-bold uppercase tracking-widest border-b border-slate-200 dark:border-zinc-800">
                <th className="px-6 py-4">SKU</th>
                <th className="px-6 py-4">Item</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Quantity</th>
                <th className="px-6 py-4">Unit Price</th>
                <th className="px-6 py-4">Total Amount</th>
                <th className="px-6 py-4">Payment</th>
                {showLocation && <th className="px-6 py-4">Counter/Store</th>}
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {soldItems.length === 0 ? (
                <tr>
                  <td colSpan={showLocation ? 10 : 9} className="px-6 py-14 text-center text-sm font-bold text-slate-400">
                    No sold items found.
                  </td>
                </tr>
              ) : soldItems.map((item: any) => (
                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/20 transition-colors font-sans">
                  <td className="whitespace-nowrap px-6 py-4 font-mono text-xs font-bold uppercase tracking-tight text-slate-600">{item.code || "-"}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-800 dark:text-zinc-200">{item.name}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-zinc-400 text-xs">
                      <User className="w-3 h-3 text-slate-300" />
                      {item.customer}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-slate-700 dark:text-zinc-300">{item.qty} {item.unit}</span>
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-slate-500">{formatCurrency(item.price)}</td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(item.total)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{item.paymentMethod}</span>
                    {item.paymentDetail ? (
                      <p className="mt-0.5 text-[10px] font-bold text-slate-400">{item.paymentDetail}</p>
                    ) : null}
                  </td>
                  {showLocation && (
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">{item.location}</span>
                    </td>
                  )}
                  <td className="px-6 py-4">
                    <p className="text-[10px] font-medium text-slate-400 whitespace-nowrap">{new Date(item.date).toLocaleString()}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/sales/${item.saleId}`} className="inline-flex p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-slate-300 hover:text-indigo-600 transition-all">
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-zinc-950/30 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">Total Page Value: </span>
            <span className="text-xs font-black text-indigo-600">{formatCurrency(totalPageValue)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-1 border border-slate-200 dark:border-zinc-800 rounded disabled:opacity-30" disabled><ChevronLeft className="w-4 h-4" /></button>
            <button className="p-1 border border-slate-200 dark:border-zinc-800 rounded disabled:opacity-30" disabled><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
