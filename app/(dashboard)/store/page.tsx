"use client";

import React from "react";
import { AppModal } from "@/components/app-modal";
import { NumericInput } from "@/components/numeric-input";
import { StockReasonSelect } from "@/components/stock-reason-select";
import { ChevronDown, Database, Edit, Layers, Package, PlusCircle, Search, ShieldCheck, SlidersHorizontal, Warehouse, X } from "lucide-react";
import { useAppData } from "@/lib/client/useAppData";
import { matchesStockView } from "@/lib/businesses";
import { formatItemChoiceLabel, itemVariant } from "@/lib/item-display";
import { ADJUSTMENT_REASON_PRESETS } from "@/lib/stock-reasons";
import { expiryTone, formatExpiryDay, openBatches, parseReceiptBatch, soonestBatch } from "@/lib/inventory/receipt-batch";
import { BatchListModal } from "@/components/batch-list-modal";
import { ReceiptBatchFields, type ReceiptBatchValue } from "@/components/receipt-batch-fields";
import { cn, formatCurrency } from "@/lib/utils";
import { useSession } from "next-auth/react";

const emptyReceipt = (): ReceiptBatchValue => ({ batchChoice: "new", batchCode: "", expireDate: "", noExpiry: false });

export default function StoreStockPage() {
  return <StockView locationType="STORE" title="Store Stock" description="Stock held in store locations." />;
}

export function StockView({
  locationType,
  title,
  description,
}: {
  locationType: "STORE" | "SHOP";
  title: string;
  description: string;
}) {
  const { data: session } = useSession();
  const user = session?.user as any;
  const { items = [], products = [], locations = [], currentLocation, inventoryBatches = [], adjustStock, addStockEntry, updateItemPrice } = useAppData();
  const [search, setSearch] = React.useState("");
  const [locationId, setLocationId] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [adjustingItem, setAdjustingItem] = React.useState<any>(null);
  const [adjustQuantity, setAdjustQuantity] = React.useState("");
  const [adjustReason, setAdjustReason] = React.useState("");
  const [adjustReceipt, setAdjustReceipt] = React.useState<ReceiptBatchValue>(emptyReceipt);
  const [adjustBatchId, setAdjustBatchId] = React.useState("");
  const [adjustBuyingPrice, setAdjustBuyingPrice] = React.useState("");
  const [adjustSellingPrice, setAdjustSellingPrice] = React.useState("");
  const [adjustError, setAdjustError] = React.useState("");
  const [batchItem, setBatchItem] = React.useState<any>(null);
  const [stockEntryItem, setStockEntryItem] = React.useState<any>(null);
  const [stockEntry, setStockEntry] = React.useState({ quantity: "", buyingPrice: "", sellingPrice: "", note: "", ...emptyReceipt() });
  const [stockEntryError, setStockEntryError] = React.useState("");
  const [priceEditingItem, setPriceEditingItem] = React.useState<any>(null);
  const [priceValues, setPriceValues] = React.useState({ buyingPrice: "", sellingPrice: "" });
  const [priceError, setPriceError] = React.useState("");
  const canAdjustStock = user?.role === "Super Admin";
  const canEditPrice = user?.role === "Super Admin" || user?.permissions?.includes("inventory.items.update");

  const scopedLocations = locations.filter((location: any) => matchesStockView(location.type, locationType));

  React.useEffect(() => {
    if (currentLocation && matchesStockView(currentLocation.type, locationType)) {
      setLocationId(currentLocation.id);
      return;
    }
    setLocationId("");
  }, [currentLocation, locationType]);

  const categories = React.useMemo<string[]>(
    () => Array.from(new Set<string>(products.map((item: any) => String(item.category || "")).filter(Boolean))).sort(),
    [products],
  );

  const stockRows = React.useMemo(() => {
    const rows = new Map<string, any>();
    items.forEach((item: any) => {
      rows.set(`${item.id}:${item.locationId}`, item);
    });

    const targetLocations = locationId
      ? scopedLocations.filter((location: any) => location.id === locationId)
      : currentLocation && matchesStockView(currentLocation.type, locationType)
        ? scopedLocations.filter((location: any) => location.id === currentLocation.id)
        : scopedLocations;

    products.forEach((product: any) => {
      targetLocations.forEach((location: any) => {
        const key = `${product.id}:${location.id}`;
        if (rows.has(key)) return;
        rows.set(key, {
          ...product,
          locationId: location.id,
          stock: 0,
          buyingPrice: product.buyingPrice || 0,
          sellingPrice: product.price || 0,
          price: product.price || 0,
          status: product.status || "Active",
        });
      });
    });

    return [...rows.values()];
  }, [currentLocation?.id, currentLocation?.type, items, locationId, locationType, products, scopedLocations]);

  const filteredStock = stockRows.filter((item: any) => {
    const location = locations.find((entry: any) => entry.id === item.locationId);
    const q = search.trim().toLowerCase();
    const stockStatus = getStockStatus(item);
    return (
      matchesStockView(location?.type, locationType) &&
      (!locationId || item.locationId === locationId) &&
      (!category || item.category === category) &&
      (!status || stockStatus === status) &&
      (!q || `${item.name} ${item.code} ${item.category} ${formatItemChoiceLabel(item, item.locationId)} ${location?.name || ""}`.toLowerCase().includes(q))
    );
  });

  const totalValue = filteredStock.reduce((sum: number, item: any) => sum + Number(item.stock || 0) * Number(item.price || 0), 0);
  const totalQty = filteredStock.reduce((sum: number, item: any) => sum + Number(item.stock || 0), 0);

  const seedPrices = (item: any, batches: Array<{ buyingPrice?: unknown; sellingPrice?: unknown; createdAt?: Date | string | null }>) => {
    const latest = [...batches].sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())[0];
    setAdjustBuyingPrice(String(Number(latest?.buyingPrice ?? item?.buyingPrice ?? 0)));
    setAdjustSellingPrice(String(Number(latest?.sellingPrice ?? item?.sellingPrice ?? item?.price ?? 0)));
  };

  const openAdjustment = (item: any) => {
    setAdjustingItem(item);
    setAdjustReason("");
    setAdjustReceipt(emptyReceipt());
    const batches = openBatches(inventoryBatches, item.id, item.locationId);
    seedPrices(item, batches);
    if (batches.length > 1) {
      setAdjustBatchId("");
      setAdjustQuantity("");
    } else if (batches.length === 1) {
      setAdjustBatchId(batches[0].id);
      setAdjustQuantity(String(Number(batches[0].remainingQuantity || 0)));
    } else {
      setAdjustBatchId("new");
      setAdjustQuantity("");
    }
    setAdjustError("");
  };

  const submitAdjustment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!adjustingItem) return;
    setAdjustError("");
    const entered = Number(adjustQuantity);
    const locationTotal = Number(adjustingItem.stock || 0);
    const batches = openBatches(inventoryBatches, adjustingItem.id, adjustingItem.locationId);
    const selectedBatch = batches.find((batch) => batch.id === adjustBatchId);
    let delta = 0;
    if (batches.length > 1 && !selectedBatch && adjustBatchId !== "new") {
      setAdjustError("Choose which batch this number belongs to.");
      return;
    }
    if (adjustBatchId === "new") {
      if (!Number.isFinite(entered) || entered <= 0) {
        setAdjustError("Type how many you are adding.");
        return;
      }
      const buying = Number(adjustBuyingPrice);
      const selling = Number(adjustSellingPrice);
      if (!Number.isFinite(buying) || buying < 0 || !Number.isFinite(selling) || selling < 0) {
        setAdjustError("Enter the buying price and the selling price for this batch.");
        return;
      }
      try {
        parseReceiptBatch(adjustReceipt);
      } catch (error) {
        setAdjustError(error instanceof Error ? error.message : "Enter the batch number and expiry for the stock you are adding.");
        return;
      }
      delta = entered;
    } else {
      if (!selectedBatch) {
        setAdjustError("Choose a batch.");
        return;
      }
      const onThisBatch = Number(selectedBatch.remainingQuantity || 0);
      if (!Number.isFinite(entered) || entered < 0) {
        setAdjustError("Type how many should be left on this batch.");
        return;
      }
      delta = entered - onThisBatch;
    }
    try {
      await adjustStock({
        itemId: adjustingItem.id,
        locationId: adjustingItem.locationId,
        quantity: locationTotal + delta,
        reason: adjustReason,
        inventoryBatchId: adjustBatchId,
        ...(adjustBatchId === "new" ? { ...adjustReceipt, buyingPrice: Number(adjustBuyingPrice), sellingPrice: Number(adjustSellingPrice) } : {}),
      });
      setAdjustingItem(null);
    } catch (error) {
      setAdjustError(error instanceof Error ? error.message : "Stock adjustment failed.");
    }
  };

  const openStockEntry = (item: any) => {
    setStockEntryItem(item);
    setStockEntry({
      quantity: "",
      buyingPrice: String(Number(item.buyingPrice || 0)),
      sellingPrice: String(Number(item.sellingPrice || item.price || 0)),
      note: "Opening stock entry",
      ...emptyReceipt(),
    });
    setStockEntryError("");
  };

  const submitStockEntry = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stockEntryItem) return;
    setStockEntryError("");
    try {
      parseReceiptBatch(stockEntry);
    } catch (error) {
      setStockEntryError(error instanceof Error ? error.message : "Enter the batch and expiry for this stock.");
      return;
    }
    try {
      await addStockEntry({
        itemId: stockEntryItem.id,
        locationId: stockEntryItem.locationId,
        quantity: Number(stockEntry.quantity),
        buyingPrice: Number(stockEntry.buyingPrice),
        sellingPrice: Number(stockEntry.sellingPrice),
        note: stockEntry.note,
        batchCode: stockEntry.batchCode,
        expireDate: stockEntry.expireDate,
        noExpiry: stockEntry.noExpiry,
      });
      setStockEntryItem(null);
    } catch (error) {
      setStockEntryError(error instanceof Error ? error.message : "Stock entry failed.");
    }
  };

  const openPriceEditor = (item: any) => {
    setPriceEditingItem(item);
    setPriceValues({
      buyingPrice: String(Number(item.buyingPrice || 0)),
      sellingPrice: String(Number(item.sellingPrice || item.price || 0)),
    });
    setPriceError("");
  };

  const submitPriceUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!priceEditingItem) return;
    setPriceError("");
    try {
      await updateItemPrice({
        itemId: priceEditingItem.id,
        locationId: priceEditingItem.locationId,
        buyingPrice: Number(priceValues.buyingPrice),
        sellingPrice: Number(priceValues.sellingPrice),
      });
      setPriceEditingItem(null);
    } catch (error) {
      setPriceError(error instanceof Error ? error.message : "Price update failed.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="page-heading">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl lg:text-3xl">{title}</h1>
          <p className="mt-1 text-slate-500">{description}</p>
        </div>
      </div>

      <div className="page-stats">
        <StatCard title="Stock Value" value={formatCurrency(totalValue)} sub="Filtered value" icon={Database} />
        <StatCard title="Stock Quantity" value={totalQty.toLocaleString()} sub="Available units" icon={Package} />
        <StatCard title="Locations" value={scopedLocations.length.toString()} sub={locationType === "STORE" ? "Stores" : "Counters"} icon={Warehouse} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="page-filters border-b border-slate-100 p-4 dark:border-zinc-800">
          <div className="relative filter-grow" data-filter-grow>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Filter by item, SKU, category or location..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-semibold outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>
          {scopedLocations.length > 1 ? (
            <Select value={locationId} onChange={setLocationId} label="Counter / Store" options={scopedLocations.map((location: any) => ({ value: location.id, label: location.name }))} />
          ) : null}
          <Select value={category} onChange={setCategory} label="All Categories" options={categories.map((entry) => ({ value: entry, label: entry }))} />
          <Select value={status} onChange={setStatus} label="All Status" options={["In Stock", "Low Stock", "Out of Stock"].map((entry) => ({ value: entry, label: entry }))} />
        </div>

        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[1040px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold uppercase tracking-widest text-slate-700 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-slate-300">
                <th className="px-6 py-4 text-left">SKU</th>
                <th className="px-6 py-4 text-left">Item</th>
                <th className="px-6 py-4 text-left">Category</th>
                <th className="px-6 py-4 text-right">Buying Price</th>
                <th className="px-6 py-4 text-right">Unit Selling</th>
                <th className="px-6 py-4 text-center">Current Qty</th>
                <th className="whitespace-nowrap px-4 py-4 text-left">Nearest expiry</th>
                <th className="whitespace-nowrap px-4 py-4 text-left">Batches</th>
                <th className="px-6 py-4 text-right">Total Value</th>
                <th className="px-6 py-4 text-center">Status</th>
                {canAdjustStock && <th className="px-6 py-4 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredStock.map((item: any) => {
                const stockStatus = getStockStatus(item);
                const variant = itemVariant(item, item.locationId);
                const itemName = variant.sizeLabel && variant.sizeLabel.toLowerCase() !== variant.style.toLowerCase()
                  ? `${variant.style} ${variant.sizeLabel}`
                  : item.name || variant.style;
                return (
                  <tr key={`${item.id}-${item.locationId}`} className="transition-colors hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                    <td className="whitespace-nowrap px-6 py-4 font-mono text-xs font-bold uppercase tracking-tight text-slate-700 dark:text-zinc-300">{item.code || "-"}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{itemName}</td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-500">{item.category}</td>
                    <td className="px-6 py-4 text-right text-xs font-bold text-slate-900 dark:text-zinc-100">
                      <div className="flex items-center justify-end gap-2">
                        <span>{formatCurrency(Number(item.buyingPrice || 0))}</span>
                        {canEditPrice && (
                          <button
                            type="button"
                            onClick={() => openPriceEditor(item)}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-zinc-800"
                            title="Edit buying and selling prices"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-xs font-bold text-slate-900 dark:text-zinc-100">
                      <div className="flex items-center justify-end gap-2">
                        <span>{formatCurrency(Number(item.sellingPrice || item.price || 0))}</span>
                        {canEditPrice && (
                          <button
                            type="button"
                            onClick={() => openPriceEditor(item)}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-zinc-800"
                            title="Edit buying and selling prices"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center text-xs font-black text-indigo-600 dark:text-indigo-400">{item.stock}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-xs font-black">
                      {(() => {
                        const soonest = soonestBatch(openBatches(inventoryBatches, item.id, item.locationId));
                        if (!soonest) return <span className="font-bold text-slate-400">—</span>;
                        return <span className={expiryTone(soonest.expireDate)}>{formatExpiryDay(soonest.expireDate)}</span>;
                      })()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      {(() => {
                        const batches = openBatches(inventoryBatches, item.id, item.locationId);
                        if (batches.length === 0) return <span className="text-xs font-bold text-slate-400">—</span>;
                        return (
                          <button
                            type="button"
                            onClick={() => setBatchItem(item)}
                            title="Open the batch list"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300"
                          >
                            <Layers className="h-3.5 w-3.5" />
                            {batches.length === 1 ? "1 batch" : `${batches.length} batches`}
                          </button>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 text-right text-xs font-bold text-slate-900 dark:text-zinc-100">{formatCurrency(Number(item.stock || 0) * Number(item.price || 0))}</td>
                    <td className="px-6 py-4 text-center">
                      <div className={cn(
                        "flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-widest",
                        stockStatus === "Out of Stock" ? "text-rose-600" : stockStatus === "Low Stock" ? "text-amber-600" : "text-emerald-600",
                      )}>
                        <ShieldCheck className="h-3 w-3" />
                        {stockStatus}
                      </div>
                    </td>
                    {canAdjustStock && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openStockEntry(item)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 transition hover:border-emerald-300 hover:text-emerald-600 dark:border-zinc-800"
                          >
                            <PlusCircle className="h-3.5 w-3.5" />
                            Add Stock
                          </button>
                          <button
                            type="button"
                            onClick={() => openAdjustment(item)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-zinc-800"
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            Adjust
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredStock.length === 0 ? (
                <tr>
                  <td colSpan={canAdjustStock ? 12 : 11} className="px-6 py-14 text-center text-xs font-black uppercase tracking-widest text-slate-500">
                    No stock records found
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <AppModal open={Boolean(adjustingItem)} onClose={() => setAdjustingItem(null)} contentClassName="max-w-xl" labelledBy="stock-adjust-title">
          <form onSubmit={submitAdjustment} className="p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="stock-adjust-title" className="text-lg font-black text-slate-950 dark:text-white">Stock Adjustment</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">{adjustingItem?.name} at {locations.find((location: any) => location.id === adjustingItem?.locationId)?.name}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">Change the count on one batch. The other batches stay the same.</p>
              </div>
              <button type="button" onClick={() => setAdjustingItem(null)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-800">
                <X className="h-5 w-5" />
              </button>
            </div>

            {(() => {
              const batches = openBatches(inventoryBatches, adjustingItem?.id, adjustingItem?.locationId);
              const selected = batches.find((batch) => batch.id === adjustBatchId);
              const addingNew = adjustBatchId === "new";
              const waitingForBatch = batches.length > 1 && !selected && !addingNew;
              const onThisBatch = Number(selected?.remainingQuantity || 0);
              const entered = Number(adjustQuantity);
              const delta = addingNew ? entered : entered - onThisBatch;
              const batchLabel = selected
                ? `${selected.batchCode || "This batch"} · ${formatExpiryDay(selected.expireDate)}`
                : "";
              const guide = waitingForBatch
                ? "This medicine has more than one batch. Choose the batch first. The number you type belongs only to that batch."
                : addingNew
                ? entered > 0
                  ? `You are adding ${entered}. Type the number on the carton, or press Internal if there is no number. Choose the expiry, then the buying price and the selling price for this batch.`
                  : "Type how many you are putting in, the number on the carton, the expiry, the buying price, and the selling price."
                : !Number.isFinite(entered)
                  ? `This batch has ${onThisBatch}. Type the number you counted on the shelf.`
                  : delta > 0
                    ? `${batchLabel} goes from ${onThisBatch} to ${entered}. The batch number and expiry stay the same.`
                    : delta < 0
                      ? `${batchLabel} goes from ${onThisBatch} to ${entered}. The other batches stay the same.`
                      : `${batchLabel} stays at ${onThisBatch}. Change the number if the shelf count is different.`;
              return (
                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Which batch</span>
                    <select
                      aria-label="Which batch"
                      value={addingNew ? "new" : selected ? adjustBatchId : ""}
                      onChange={(event) => {
                        const nextId = event.target.value;
                        setAdjustBatchId(nextId);
                        setAdjustError("");
                        if (nextId === "new") {
                          setAdjustQuantity("");
                          setAdjustReceipt(emptyReceipt());
                          if (adjustingItem) seedPrices(adjustingItem, batches);
                          return;
                        }
                        const batch = batches.find((entry) => entry.id === nextId);
                        setAdjustQuantity(batch ? String(Number(batch.remainingQuantity || 0)) : "");
                      }}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      {batches.length > 1 ? <option value="" disabled>Choose a batch</option> : null}
                      {batches.map((batch) => (
                        <option key={batch.id} value={batch.id}>
                          {batch.batchCode || "Batch"} · {formatExpiryDay(batch.expireDate)} · {Number(batch.remainingQuantity || 0)} left
                        </option>
                      ))}
                      <option value="new">New batch</option>
                    </select>
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-4 dark:bg-zinc-950">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {waitingForBatch ? "Choose a batch" : addingNew ? "New batch" : "On this batch now"}
                      </p>
                      <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
                        {waitingForBatch || addingNew ? "—" : onThisBatch}
                      </p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-500">
                        {waitingForBatch ? "The count stays blank until you pick a batch." : addingNew ? "This is stock that is not in the list yet." : batchLabel}
                      </p>
                    </div>
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {waitingForBatch ? "Count" : addingNew ? "How many to add" : "Change it to"}
                      </span>
                      <NumericInput
                        min={0}
                        value={waitingForBatch ? "" : adjustQuantity}
                        disabled={waitingForBatch}
                        onValueChange={(qty) => setAdjustQuantity(String(qty))}
                        className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-black outline-none focus:border-indigo-500 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950"
                        required={!waitingForBatch}
                      />
                    </label>
                  </div>

                  <p className="text-[11px] font-semibold leading-5 text-slate-500">{guide}</p>
                  <p className="text-[11px] font-semibold leading-5 text-slate-400">
                    The number you type is only for this batch. Other batches are left as they are.
                  </p>

                  {addingNew ? (
                    <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-zinc-800">
                      <ReceiptBatchFields
                        value={adjustReceipt}
                        takenCodes={inventoryBatches.map((batch: { batchCode?: string }) => batch.batchCode)}
                        onChange={setAdjustReceipt}
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Buying price</span>
                          <NumericInput
                            min={0}
                            value={adjustBuyingPrice}
                            onValueChange={(price) => setAdjustBuyingPrice(String(price))}
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-950"
                            required
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Selling price</span>
                          <NumericInput
                            min={0}
                            value={adjustSellingPrice}
                            onValueChange={(price) => setAdjustSellingPrice(String(price))}
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-950"
                            required
                          />
                        </label>
                      </div>
                      <p className="text-[11px] font-semibold leading-5 text-slate-500">These prices belong to this new batch. Other batches keep their own prices.</p>
                    </div>
                  ) : null}
                </div>
              );
            })()}

            <div className="mt-4">
              <StockReasonSelect
                presets={ADJUSTMENT_REASON_PRESETS}
                value={adjustReason}
                onChange={setAdjustReason}
                label="Reason"
                customPlaceholder="Describe the stock adjustment reason..."
              />
            </div>
            {adjustError && <p className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-600 dark:bg-rose-950/30">{adjustError}</p>}

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setAdjustingItem(null)} className="btn-cancel">
                Cancel
              </button>
              <button type="submit" className="rounded-xl bg-indigo-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-500/20">
                Save Adjustment
              </button>
            </div>
          </form>
      </AppModal>

      <AppModal open={Boolean(stockEntryItem)} onClose={() => setStockEntryItem(null)} contentClassName="max-w-lg" labelledBy="stock-entry-title">
            <form onSubmit={submitStockEntry} className="p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 id="stock-entry-title" className="text-lg font-black text-slate-950 dark:text-white">Add Stock Entry</h2>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {stockEntryItem?.name} at {locations.find((location: any) => location.id === stockEntryItem?.locationId)?.name}
                  </p>
                </div>
                <button type="button" onClick={() => setStockEntryItem(null)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-800">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4 dark:bg-zinc-950">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Current Qty</p>
                  <p className="mt-2 text-xl font-black text-slate-950 dark:text-white">{Number(stockEntryItem?.stock || 0).toLocaleString()}</p>
                </div>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Qty To Add</span>
                  <NumericInput
                    min={0.01}
                    value={stockEntry.quantity}
                    onValueChange={(quantity) => setStockEntry((current) => ({ ...current, quantity: quantity ? String(quantity) : "" }))}
                    className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-black outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Buying Price</span>
                  <NumericInput
                    min={0}
                    value={stockEntry.buyingPrice}
                    onValueChange={(buyingPrice) => setStockEntry((current) => ({ ...current, buyingPrice: String(buyingPrice) }))}
                    className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-black outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                    required
                  />
                </label>
              </div>
              <div className="mt-4">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Selling Price</span>
                  <NumericInput
                    min={0}
                    value={stockEntry.sellingPrice}
                    onValueChange={(sellingPrice) => setStockEntry((current) => ({ ...current, sellingPrice: String(sellingPrice) }))}
                    className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-black outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                    required
                  />
                </label>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-zinc-800">
                <ReceiptBatchFields
                  value={stockEntry}
                  takenCodes={inventoryBatches.map((batch: { batchCode?: string }) => batch.batchCode)}
                  existingBatches={openBatches(inventoryBatches, stockEntryItem?.id, stockEntryItem?.locationId)}
                  onChange={(next) => setStockEntry((current) => ({ ...current, ...next }))}
                />
              </div>

              <label className="mt-4 block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Note</span>
                <textarea
                  value={stockEntry.note}
                  onChange={(event) => setStockEntry((current) => ({ ...current, note: event.target.value }))}
                  className="min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                  placeholder="Example: Initial stock count"
                />
              </label>

              {stockEntryError && <p className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-600 dark:bg-rose-950/30">{stockEntryError}</p>}

              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setStockEntryItem(null)} className="btn-cancel">
                  Cancel
                </button>
                <button type="submit" className="rounded-xl bg-emerald-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-500/20">
                  Save Stock
                </button>
              </div>
            </form>
      </AppModal>

      <BatchListModal
        open={Boolean(batchItem)}
        onClose={() => setBatchItem(null)}
        title={batchItem?.name || "Batches"}
        subtitle={locations.find((location: any) => location.id === batchItem?.locationId)?.name}
        batches={openBatches(inventoryBatches, batchItem?.id, batchItem?.locationId).map((batch) => ({
          ...batch,
          locationName: locations.find((location: any) => location.id === batch.locationId)?.name,
        }))}
      />

      <AppModal open={Boolean(priceEditingItem)} onClose={() => setPriceEditingItem(null)} labelledBy="stock-price-title">
            <form onSubmit={submitPriceUpdate} className="p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 id="stock-price-title" className="text-lg font-black text-slate-950 dark:text-white">Edit Stock Prices</h2>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {priceEditingItem?.name} at {locations.find((location: any) => location.id === priceEditingItem?.locationId)?.name}
                  </p>
                </div>
                <button type="button" onClick={() => setPriceEditingItem(null)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-800">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Buying Price</span>
                  <NumericInput
                    min={0}
                    value={priceValues.buyingPrice}
                    onValueChange={(buyingPrice) => setPriceValues((current) => ({ ...current, buyingPrice: String(buyingPrice) }))}
                    className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-black outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Selling Price</span>
                  <NumericInput
                    min={0}
                    value={priceValues.sellingPrice}
                    onValueChange={(sellingPrice) => setPriceValues((current) => ({ ...current, sellingPrice: String(sellingPrice) }))}
                    className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-black outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                    required
                  />
                </label>
              </div>
              <p className="mt-2 text-[11px] font-semibold text-slate-500">
                This updates item defaults and open stock batches at this location. It does not create a financial transaction.
              </p>

              {priceError && <p className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-600 dark:bg-rose-950/30">{priceError}</p>}

              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setPriceEditingItem(null)} className="btn-cancel">
                  Cancel
                </button>
                <button type="submit" className="rounded-xl bg-indigo-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-500/20">
                  Save Price
                </button>
              </div>
            </form>
      </AppModal>
    </div>
  );
}

function getStockStatus(item: any) {
  if (Number(item.stock || 0) <= 0) return "Out of Stock";
  if (Number(item.stock || 0) <= Number(item.lowStockAlert || 10)) return "Low Stock";
  return "In Stock";
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

function StatCard({ title, value, sub, icon: Icon }: any) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300">{title}</p>
        <Icon className="h-5 w-5 text-indigo-500" />
      </div>
      <h4 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{value}</h4>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-tight text-slate-500">{sub}</p>
    </div>
  );
}
