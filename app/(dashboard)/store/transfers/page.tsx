"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, Plus, Search } from "lucide-react";
import { useAppData } from "@/lib/client/useAppData";
import { useSession } from "next-auth/react";
import { formatUnitLabel } from "@/lib/item-display";
import { stockLocationLabel } from "@/lib/businesses";

export default function TransfersPage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const { items, transfers, currentLocation, products } = useAppData();
  const [searchQuery, setSearchQuery] = useState("");
  const canCreateTransfer = user?.role === "Super Admin" || user?.permissions?.includes("inventory.transfers.create");

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="page-heading">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <ArrowRightLeft className="w-8 h-8 text-indigo-600" />
            Stock Transfers
          </h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Counter and store movement for {currentLocation?.name || "this pharmacy"}</p>
        </div>
        {canCreateTransfer && (
          <Link 
            href="/store/transfers/create"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Create Transfer
          </Link>
        )}
      </div>

      {/* Stats/Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-center justify-center">
            <ArrowRightLeft className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Total Transfers</p>
            <p className="text-xl font-black text-slate-900 dark:text-white">{transfers.length}</p>
          </div>
        </div>
      </div>

      {/* Transfer List */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-50 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search transfers..." 
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/20"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
           </div>
        </div>

        <div className="overflow-x-auto overscroll-x-contain scrollbar-hide">
          <table className="w-full text-left min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-zinc-950/50 border-b border-slate-100 dark:border-zinc-800">
                <th className="px-6 py-4 text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Date / ID</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">SKU</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest w-1/4 min-w-[200px]">Item</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Category</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">From</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">To</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest text-right">Qty</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-zinc-800/50">
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2 opacity-30">
                      <ArrowRightLeft className="w-12 h-12" />
                      <p className="text-xs font-black uppercase tracking-widest">No transfers recorded</p>
                    </div>
                  </td>
                </tr>
              ) : (
                transfers.map((tr) => {
                  const product = products?.find(p => p.id === tr.itemId);
                  const item = items.find(i => i.id === tr.itemId) || product;
                  const fromLabel = stockLocationLabel(tr.fromLocationId);
                  const toLabel = stockLocationLabel(tr.toLocationId);
                  const categoryName = item?.category || "General";
                  return (
                    <tr key={tr.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="text-xs font-black text-slate-700 dark:text-zinc-200">{new Date(tr.date).toLocaleDateString()}</p>
                        <p className="text-[10px] font-mono text-slate-400">{tr.id}</p>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 font-mono text-xs font-bold uppercase text-slate-600">{item?.code || "-"}</td>
                      <td className="px-6 py-4 text-xs font-black uppercase tracking-tight text-slate-900 dark:text-white">{item?.name || "-"}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 rounded-lg text-[9px] font-black uppercase tracking-widest border border-indigo-100/40 dark:border-indigo-900/30">
                          {categoryName}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="inline-flex px-2 py-1 bg-slate-100 dark:bg-zinc-800 rounded-md text-[10px] font-black text-slate-600 dark:text-zinc-400 uppercase">
                          {fromLabel}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="inline-flex px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 rounded-md text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase">
                          {toLabel}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-xs font-black text-slate-900 dark:text-white">{tr.quantity} {formatUnitLabel(item)}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex px-2 py-1 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-[9px] font-black uppercase tracking-widest">
                          {tr.status}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

