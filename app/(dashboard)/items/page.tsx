"use client";

import React from "react";
import { AlertTriangle, ChevronDown, Edit, Package, Plus, Search, Trash } from "lucide-react";
import Link from "next/link";
import { useAppData } from "@/lib/client/useAppData";
import { useCan } from "@/lib/client/useCan";
import { formatItemChoiceLabel, formatUnitLabel, itemVariant } from "@/lib/item-display";
import { cn, formatCurrency } from "@/lib/utils";

export default function ItemList() {
  const { products = [], items = [], currentLocation, deleteItem } = useAppData();
  const can = useCan();
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [itemToDelete, setItemToDelete] = React.useState<string | null>(null);

  const catalog = React.useMemo(() => {
    if (products.length > 0) return products;
    const byId = new Map<string, any>();
    items.forEach((item: any) => {
      if (!byId.has(item.id)) byId.set(item.id, item);
    });
    return [...byId.values()];
  }, [items, products]);

  const categories = React.useMemo<string[]>(
    () => Array.from(new Set<string>(catalog.map((item: any) => String(item.category || "")).filter(Boolean))).sort(),
    [catalog],
  );

  const filteredItems = catalog.filter((item: any) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || `${item.name} ${item.code} ${item.category} ${formatItemChoiceLabel(item, currentLocation?.id)}`.toLowerCase().includes(q);
    const matchesCategory = !category || item.category === category;
    return matchesSearch && matchesCategory;
  });

  const stockFor = (itemId: string, locationId?: string) =>
    items
      .filter((row: any) => row.id === itemId && (!locationId || row.locationId === locationId))
      .reduce((sum: number, row: any) => sum + Number(row.stock || 0), 0);

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteItem(itemToDelete);
      setItemToDelete(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not delete item.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="page-heading">
        <div>
          <h1 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white sm:text-2xl">Item List</h1>
          <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-400">
            Product catalog with {currentLocation?.name || "active location"} stock context
          </p>
        </div>
        {can("inventory.items.create") ? (
          <Link href="/items/create" className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-500 active:scale-95">
            <Plus className="h-5 w-5" />
            Create New Item
          </Link>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="page-filters border-b border-slate-200 p-4 dark:border-zinc-800">
          <div className="relative filter-grow" data-filter-grow>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by name, code or category..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium outline-none transition-all focus:ring-1 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="relative">
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 pr-9 text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="">All Categories</option>
              {categories.map((entry) => (
                <option key={entry} value={entry}>{entry}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          </div>
        </div>

        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[860px] text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-700 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-300">
                <th className="whitespace-nowrap px-6 py-5">Product Details</th>
                <th className="whitespace-nowrap px-6 py-5">Item Code</th>
                <th className="whitespace-nowrap px-6 py-5">Category</th>
                <th className="whitespace-nowrap px-6 py-5">Unit</th>
                <th className="whitespace-nowrap px-6 py-5">Active Stock</th>
                <th className="whitespace-nowrap px-6 py-5">Total Stock</th>
                <th className="whitespace-nowrap px-6 py-5">Selling Price</th>
                <th className="whitespace-nowrap px-6 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-bold dark:divide-zinc-800">
              {filteredItems.map((item: any) => {
                const activeStock = stockFor(item.id, currentLocation?.id);
                const totalStock = stockFor(item.id);
                const variant = itemVariant(item, currentLocation?.id);
                return (
                  <tr key={item.id} className="transition-all hover:bg-slate-50 dark:hover:bg-zinc-800/20">
                    <td className="max-w-xs px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300">
                          <Package className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black uppercase tracking-tight text-slate-900 dark:text-zinc-200">{variant.style}</p>
                          {variant.sizeLabel && variant.sizeLabel.toLowerCase() !== variant.style.toLowerCase() ? (
                            <p className="text-[10px] font-bold uppercase tracking-tight text-slate-600 dark:text-zinc-400">{variant.sizeLabel}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-5 font-mono text-xs uppercase tracking-tighter text-slate-700 dark:text-zinc-300">{item.code || "-"}</td>
                    <td className="whitespace-nowrap px-6 py-5 text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300">{item.category || "-"}</td>
                    <td className="whitespace-nowrap px-6 py-5 text-xs font-bold text-slate-700 dark:text-zinc-300">{formatUnitLabel(item)}</td>
                    <td className="px-6 py-5 text-sm font-black">
                      <span className={cn(activeStock <= Number(item.lowStockAlert || 10) ? "text-rose-600" : "text-slate-900 dark:text-white")}>{activeStock} {formatUnitLabel(item)}</span>
                    </td>
                    <td className="px-6 py-5 text-sm font-black text-slate-900 dark:text-white">{totalStock} {formatUnitLabel(item)}</td>
                    <td className="px-6 py-5 font-mono text-sm font-black text-slate-900 dark:text-zinc-100">{formatCurrency(item.price || 0)} / {formatUnitLabel(item)}</td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {can("inventory.items.update") ? (
                          <Link
                            href={`/items/create?id=${item.id}`}
                            aria-label={`Edit ${item.name}`}
                            className="rounded-xl p-2 text-slate-600 transition-all hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-zinc-800"
                          >
                            <Edit className="h-4 w-4" />
                          </Link>
                        ) : null}
                        {can("inventory.items.delete") ? (
                          <button onClick={() => setItemToDelete(item.id)} className="rounded-xl p-2 text-slate-600 transition-all hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20">
                            <Trash className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center text-xs font-black uppercase tracking-widest text-slate-500">
                    No items found
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {itemToDelete ? (
        <div className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain flex justify-center bg-black/40 p-4 backdrop-blur-sm pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900 my-auto max-h-[min(92dvh,calc(100dvh-2rem))] overflow-y-auto">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-600" />
              <div>
                <h3 className="text-lg font-black text-slate-950 dark:text-white">Confirm Deletion</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  This permanently removes only unused zero-stock items. Items with stock or transaction history stay protected.
                </p>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setItemToDelete(null)} className="btn-cancel flex-1">Cancel</button>
              <button onClick={handleDelete} className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white">Delete</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
