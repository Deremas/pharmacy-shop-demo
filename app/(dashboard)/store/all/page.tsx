"use client";

import React from "react";
import { 
  Search, 
  Package,
  RefreshCw,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { formatUnitLabel } from "@/lib/item-display";
import { stockLocationLabel } from "@/lib/businesses";
import { useAppData } from "@/lib/client/useAppData";

export default function AllLocationStock() {
  const { items = [], products = [], locations = [], refresh } = useAppData();
  const [search, setSearch] = React.useState("");

  const matrix = React.useMemo(() => {
    const rows = new Map<string, any>();
    products.forEach((product: any) => {
      rows.set(product.id, {
        id: product.id,
        item: product.name,
        code: product.code || "",
        category: product.category || "",
        unit: formatUnitLabel(product),
        total: 0,
        price: Number(product.price || 0),
        breakdown: Object.fromEntries(locations.map((location: any) => [location.id, 0])),
      });
    });
    items.forEach((stockItem: any) => {
      const row = rows.get(stockItem.id) || {
        id: stockItem.id,
        item: stockItem.name,
        code: stockItem.code || "",
        category: stockItem.category || "",
        unit: formatUnitLabel(stockItem),
        total: 0,
        price: Number(stockItem.sellingPrice || stockItem.price || 0),
        breakdown: Object.fromEntries(locations.map((location: any) => [location.id, 0])),
      };
      const stock = Number(stockItem.stock || 0);
      row.breakdown[stockItem.locationId] = (row.breakdown[stockItem.locationId] || 0) + stock;
      row.total += stock;
      rows.set(stockItem.id, row);
    });
    const normalizedSearch = search.trim().toLowerCase();
    return [...rows.values()]
      .filter((row) => !normalizedSearch || `${row.item} ${row.code} ${row.category}`.toLowerCase().includes(normalizedSearch))
      .sort((a, b) => a.item.localeCompare(b.item));
  }, [items, products, locations, search]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-sans">
      <div className="page-heading">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Dispensary/Store Inventory Matrix</h1>
          <p className="text-slate-600 dark:text-zinc-400 text-sm font-bold uppercase tracking-widest mt-1">Aggregated stock by location</p>
        </div>
        <button onClick={refresh} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">
           <RefreshCw className="w-4 h-4" />
           Refresh Matrix
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-sm overflow-hidden font-sans">
        <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4 font-sans">
           <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 font-bold" />
              <input 
                type="text" 
                placeholder="Lookup product by name or SKU..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:ring-1 focus:ring-indigo-500 font-medium font-sans"
              />
           </div>
        </div>

        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[860px] text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-zinc-950/30 text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] border-b border-slate-200 dark:border-zinc-800">
                <th className="px-6 py-5">Global Product Catalog</th>
                {locations.map((location: any) => (
                  <th key={location.id} className="px-6 py-5 text-center">{stockLocationLabel(location.id, location.type)}</th>
                ))}
                <th className="px-6 py-5 text-right">Total Aggregate</th>
                <th className="px-6 py-5 text-right">Valuation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 font-sans">
              {matrix.length === 0 ? (
                <tr>
                  <td colSpan={locations.length + 3} className="px-6 py-14 text-center text-sm font-bold text-slate-400">
                    No stock records found.
                  </td>
                </tr>
              ) : matrix.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/20 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-300 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/10 transition-colors">
                          <Package className="w-5 h-5 transition-transform group-hover:scale-110" />
                       </div>
                       <div>
                          <p className="text-sm font-black text-slate-800 dark:text-zinc-200 truncate max-w-[180px]">{item.item}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-0.5">{item.category}</p>
                       </div>
                    </div>
                  </td>
                  {locations.map((location: any) => (
                    <td key={location.id} className="px-6 py-5 text-center font-mono text-xs font-bold text-slate-500 dark:text-zinc-400">
                      {item.breakdown[location.id] || 0}
                    </td>
                  ))}
                  <td className="px-6 py-5 text-right">
                    <span className="px-3 py-1 bg-indigo-500/10 text-indigo-600 rounded-full font-black text-sm tracking-tighter">
                       {item.total} {item.unit || "Units"}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter">{formatCurrency(item.total * item.price)}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
