"use client";

import React from "react";
import { AlertTriangle, Package, Search, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { NumericInput } from "@/components/numeric-input";
import { SearchableSelect } from "@/components/searchable-select";
import { StockLocationToggle } from "@/components/stock-location-toggle";
import { StockReasonSelect } from "@/components/stock-reason-select";
import { useAppData } from "@/lib/client/useAppData";
import {
  shopLocationIdFor,
  stockLocationIdsFor,
  stockLocationLabel,
} from "@/lib/businesses";
import { formatItemChoiceLabel, formatUnitLabel, itemSelectOption } from "@/lib/item-display";
import { wholeQuantity } from "@/lib/units";
import { DAMAGE_REASON_PRESETS } from "@/lib/stock-reasons";
import { formatCurrency, cn } from "@/lib/utils";
import { paginateRows } from "@/lib/sales-utils";

export default function DamagePage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const canRecord = user?.role === "Super Admin";

  const {
    products = [],
    items = [],
    inventoryMovements = [],
    currentLocation,
    recordDamage,
    refresh,
  } = useAppData();

  const [itemId, setItemId] = React.useState("");
  const [stockLocationId, setStockLocationId] = React.useState("");
  const [quantity, setQuantity] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(15);

  React.useEffect(() => {
    if (!currentLocation?.id) return;
    const allowed = stockLocationIdsFor(currentLocation.id);
    if (!allowed.includes(stockLocationId)) {
      setStockLocationId(shopLocationIdFor(currentLocation.id));
    }
  }, [currentLocation?.id, stockLocationId]);

  const catalog = React.useMemo(() => {
    if (products.length > 0) return products;
    const byId = new Map<string, any>();
    items.forEach((item: any) => {
      if (!byId.has(item.id)) byId.set(item.id, item);
    });
    return [...byId.values()];
  }, [items, products]);

  const availableQty = React.useMemo(() => {
    if (!itemId || !stockLocationId) return 0;
    return items
      .filter((row: any) => row.id === itemId && row.locationId === stockLocationId)
      .reduce((sum: number, row: any) => sum + Number(row.stock || 0), 0);
  }, [itemId, items, stockLocationId]);

  const selectedItem = catalog.find((item: any) => item.id === itemId);
  const unitBuying = Number(selectedItem?.buyingPrice || 0);

  const damageRows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return inventoryMovements
      .filter((movement: any) => movement.type === "DAMAGE")
      .filter((movement: any) => {
        if (!q) return true;
        return `${movement.itemName} ${movement.itemCode} ${movement.note} ${movement.locationName}`
          .toLowerCase()
          .includes(q);
      })
      .sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [inventoryMovements, search]);

  const paged = paginateRows<any>(damageRows, page, pageSize);

  const todayStart = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const todayRows = damageRows.filter(
    (row: any) => new Date(row.createdAt).getTime() >= todayStart,
  );
  const todayQty = todayRows.reduce(
    (sum: number, row: any) => sum + Math.abs(Number(row.quantity || 0)),
    0,
  );
  const periodQty = damageRows.reduce(
    (sum: number, row: any) => sum + Math.abs(Number(row.quantity || 0)),
    0,
  );
  const estCost = damageRows.reduce((sum: number, row: any) => {
    const product =
      catalog.find((item: any) => item.id === row.itemId) ||
      items.find((item: any) => item.id === row.itemId);
    const cost = Number(product?.buyingPrice || 0);
    return sum + Math.abs(Number(row.quantity || 0)) * cost;
  }, 0);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    const qty = Number(quantity);
    if (!itemId || !stockLocationId) {
      setError("Select an item and shop/store location.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Enter a positive quantity to write off.");
      return;
    }
    if (qty > availableQty) {
      setError(`Only ${availableQty} available at this location.`);
      return;
    }
    if (reason.trim().length < 5) {
      setError("Reason must be at least 5 characters.");
      return;
    }
    setSaving(true);
    try {
      await recordDamage({
        itemId,
        locationId: stockLocationId,
        quantity: qty,
        reason: reason.trim(),
      });
      setQuantity("");
      setReason("");
      setItemId("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record damage.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-16">
      <div className="page-heading">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            <Trash2 className="h-7 w-7 text-rose-600 sm:h-8 sm:w-8" />
            Damage / Write-off
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Record damaged or out-of-use stock. Reduces inventory only — no expense posting.
          </p>
        </div>
      </div>

      <div className="page-stats">
        <StatCard title="Damaged today" value={String(todayQty)} icon={AlertTriangle} />
        <StatCard title="Total qty (list)" value={String(periodQty)} icon={Package} />
        <StatCard title="Est. buying cost" value={formatCurrency(estCost)} icon={Trash2} />
      </div>

      {canRecord ? (
        <form
          onSubmit={submit}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6"
        >
          <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
            Record damage
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                Item
              </label>
              <SearchableSelect
                value={itemId}
                onChange={setItemId}
                placeholder="Select item…"
                options={catalog.map((item: any) =>
                  itemSelectOption(item, undefined, currentLocation?.id),
                )}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                Dispensary / Store
              </label>
              <StockLocationToggle
                businessId={currentLocation?.id}
                value={stockLocationId}
                onChange={setStockLocationId}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                Qty to write off
              </label>
              <NumericInput
                value={quantity}
                onValueChange={(value) => setQuantity(String(wholeQuantity(value, formatUnitLabel(selectedItem)) || ""))}
                step={1}
                min={0}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:ring-1 focus:ring-rose-500 dark:border-zinc-800 dark:bg-zinc-950"
              />
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Available: {availableQty}
                {selectedItem ? ` ${formatUnitLabel(selectedItem)}` : ""}
                {unitBuying > 0 ? ` · ${formatCurrency(unitBuying)} / ${formatUnitLabel(selectedItem) || "unit"}` : ""}
              </p>
            </div>
            <div className="sm:col-span-2 xl:col-span-3">
              <StockReasonSelect
                presets={DAMAGE_REASON_PRESETS}
                value={reason}
                onChange={setReason}
                label="Damage reason"
                customPlaceholder="Describe what happened to the stock..."
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="page-action h-11 w-full rounded-xl bg-rose-600 px-4 text-[10px] font-black uppercase tracking-widest text-white shadow-sm hover:bg-rose-500 disabled:opacity-60 sm:w-auto"
              >
                {saving ? "Saving…" : "Record damage"}
              </button>
            </div>
          </div>
          {error ? (
            <p className="mt-3 text-xs font-bold text-rose-600">{error}</p>
          ) : null}
        </form>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Viewing damage history only. Stock adjust permission is required to record write-offs.
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="page-filters border-b border-slate-100 p-4 dark:border-zinc-800">
          <div className="relative min-w-[12rem] flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search damage records…"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-semibold outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>
        </div>

        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-zinc-800 dark:bg-zinc-950/50">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Item</th>
                <th className="px-5 py-3">At</th>
                <th className="px-5 py-3 text-right">Qty</th>
                <th className="px-5 py-3 text-right">Est. cost</th>
                <th className="px-5 py-3">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {paged.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-14 text-center text-xs font-black uppercase tracking-widest text-slate-400"
                  >
                    No damage records yet
                  </td>
                </tr>
              ) : (
                paged.rows.map((row: any) => {
                  const product =
                    catalog.find((item: any) => item.id === row.itemId) ||
                    items.find((item: any) => item.id === row.itemId);
                  const qty = Math.abs(Number(row.quantity || 0));
                  const cost = qty * Number(product?.buyingPrice || 0);
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                      <td className="px-5 py-3 text-xs font-semibold text-slate-500">
                        {new Date(row.createdAt).toLocaleString()}
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {formatItemChoiceLabel(
                            { name: row.itemName, code: row.itemCode, locationId: row.locationId },
                            currentLocation?.id,
                          )}
                        </p>
                        <p className="font-mono text-[10px] uppercase text-slate-400">
                          {row.itemCode || "-"}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-xs font-bold uppercase tracking-widest text-slate-500">
                        {stockLocationLabel(row.locationId, row.locationType)}
                      </td>
                      <td className="px-5 py-3 text-right text-sm font-black text-rose-600">
                        −{qty}
                      </td>
                      <td className="px-5 py-3 text-right text-sm font-bold text-slate-700 dark:text-zinc-200">
                        {formatCurrency(cost)}
                      </td>
                      <td className="max-w-[240px] truncate px-5 py-3 text-xs text-slate-500">
                        {row.note || "-"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500 dark:border-zinc-800">
          <span>
            Page {paged.page} of {paged.totalPages} — {damageRows.length} records
          </span>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold dark:border-zinc-800 dark:bg-zinc-950"
            >
              {[10, 15, 25, 50].map((size) => (
                <option key={size} value={size}>
                  {size}/page
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={paged.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-200 px-2 py-1 disabled:opacity-30 dark:border-zinc-800"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={paged.page >= paged.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-200 px-2 py-1 disabled:opacity-30 dark:border-zinc-800"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{title}</p>
          <p className="mt-1 truncate text-lg font-black text-slate-900 dark:text-white sm:text-xl">
            {value}
          </p>
        </div>
        <div className={cn("rounded-xl bg-rose-50 p-2 text-rose-600 dark:bg-rose-950/40")}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
