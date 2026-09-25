"use client";

import React, { useMemo, useState } from "react";
import { AppModal } from "@/components/app-modal";
import { NumericInput } from "@/components/numeric-input";
import { useAppData } from "@/lib/client/useAppData";
import { useCan } from "@/lib/client/useCan";
import { isStoreLocationId } from "@/lib/businesses";
import { daysUntilExpiry, expiryBand, isBatchExpired } from "@/lib/inventory/fefo";
import { formatUnitLabel } from "@/lib/item-display";
import { formatCurrency } from "@/lib/utils";

export default function ExpiryPage() {
  const { inventoryBatches = [], items = [], products = [], currentLocation, disposeBatch } = useAppData();
  const can = useCan();
  const visibleBatches = can("inventory.store.view")
    ? inventoryBatches
    : inventoryBatches.filter((batch: { locationId?: string }) => !isStoreLocationId(batch.locationId));
  const [band, setBand] = useState("All");
  const [busyId, setBusyId] = useState("");
  const [disposeRow, setDisposeRow] = useState<any>(null);
  const [disposeQty, setDisposeQty] = useState("");
  const [disposeReason, setDisposeReason] = useState("");
  const [disposeError, setDisposeError] = useState("");

  const rows = useMemo(() => {
    const names = new Map<string, any>();
    for (const item of [...products, ...items]) names.set(item.id, item);
    return visibleBatches
      .filter((batch: any) => Number(batch.remainingQuantity) > 0)
      .map((batch: any) => {
        const item = names.get(batch.itemId);
        const days = daysUntilExpiry(batch.expireDate);
        return {
          ...batch,
          name: item?.name || "Medicine",
          code: item?.code || "",
          unit: formatUnitLabel(item),
          days,
          band: expiryBand(batch.expireDate),
        };
      })
      .filter((row: any) => band === "All" || row.band === band)
      .sort((left: any, right: any) => (left.days ?? 99999) - (right.days ?? 99999));
  }, [band, visibleBatches, items, products]);

  const openDispose = (row: any) => {
    const reserved = Number(row.reservedQuantity || 0);
    const available = Math.max(0, Number(row.remainingQuantity || 0) - reserved);
    setDisposeRow(row);
    setDisposeQty(available > 0 ? String(available) : "");
    setDisposeReason(row.band === "Expired" ? "Expired" : row.band === "No expiry" ? "Removed from stock" : "Near expiry");
    setDisposeError("");
  };

  const confirmDispose = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!disposeRow) return;
    const reserved = Number(disposeRow.reservedQuantity || 0);
    const available = Math.max(0, Number(disposeRow.remainingQuantity || 0) - reserved);
    const quantity = Number(disposeQty);
    const reason = disposeReason.trim();
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setDisposeError("Type how many you are removing.");
      return;
    }
    if (quantity > available) {
      setDisposeError(available > 0
        ? `You can remove up to ${available} ${disposeRow.unit}. ${reserved} ${disposeRow.unit} are held for a sale that is not finished.`
        : `All ${reserved} ${disposeRow.unit} are held for a sale that is not finished.`);
      return;
    }
    if (reason.length < 3) {
      setDisposeError("Write a short reason, at least a few letters.");
      return;
    }
    setBusyId(disposeRow.id);
    setDisposeError("");
    try {
      await disposeBatch({
        inventoryBatchId: disposeRow.id,
        quantity,
        reason,
        locationId: disposeRow.locationId || currentLocation?.id,
      });
      setDisposeRow(null);
    } catch (error) {
      setDisposeError(error instanceof Error ? error.message : "Disposal failed.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Expiry</h1>
        <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-500">Usable stock excludes expired batches. Dispose them here.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {["All", "Expired", "Critical", "Near expiry", "Warning", "Normal", "No expiry"].map((entry) => (
          <button key={entry} type="button" onClick={() => setBand(entry)} className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-widest ${band === entry ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-zinc-800"}`}>
            {entry}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-[11px] font-black uppercase tracking-widest text-slate-500">
            <tr>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Medicine</th>
              <th className="px-4 py-3">Batch</th>
              <th className="px-4 py-3">Expiry</th>
              <th className="px-4 py-3">Days</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Reserved</th>
              <th className="px-4 py-3">Cost</th>
              <th className="px-4 py-3">Band</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any) => (
              <tr key={row.id} className="border-t border-slate-100 dark:border-zinc-800">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-bold uppercase">{row.code || "—"}</td>
                <td className="px-4 py-3 font-bold">{row.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{row.batchCode || "—"}</td>
                <td className="px-4 py-3">{row.expireDate ? String(row.expireDate).slice(0, 10) : "—"}</td>
                <td className="px-4 py-3">{row.days ?? "—"}</td>
                <td className="px-4 py-3">{row.remainingQuantity} {row.unit}</td>
                <td className="px-4 py-3">{row.reservedQuantity || 0} {row.unit}</td>
                <td className="px-4 py-3">{row.buyingPrice} / {row.unit}</td>
                <td className={`px-4 py-3 font-bold ${isBatchExpired(row.expireDate) ? "text-rose-600" : ""}`}>{row.band}</td>
                <td className="px-4 py-3 text-right">
                  {can("inventory.stock.adjust") ? (
                  <button type="button" disabled={busyId === row.id} onClick={() => openDispose(row)} className="rounded-xl bg-rose-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-60">
                    Dispose
                  </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-500">No batches in this band.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <DisposeModal
        row={disposeRow}
        quantity={disposeQty}
        reason={disposeReason}
        error={disposeError}
        busy={Boolean(disposeRow && busyId === disposeRow.id)}
        onQuantity={setDisposeQty}
        onReason={setDisposeReason}
        onClose={() => { if (!busyId) setDisposeRow(null); }}
        onSubmit={confirmDispose}
      />
    </div>
  );
}

function DisposeModal({
  row,
  quantity,
  reason,
  error,
  busy,
  onQuantity,
  onReason,
  onClose,
  onSubmit,
}: {
  row: any;
  quantity: string;
  reason: string;
  error: string;
  busy: boolean;
  onQuantity: (value: string) => void;
  onReason: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const remaining = Number(row?.remainingQuantity || 0);
  const reserved = Number(row?.reservedQuantity || 0);
  const available = Math.max(0, remaining - reserved);
  const entered = Number(quantity);
  const unitCost = Number(row?.buyingPrice || 0);
  const removing = Number.isFinite(entered) && entered > 0 ? Math.min(entered, available) : 0;
  const left = Math.max(0, available - removing);
  const loss = removing * unitCost;
  const unit = row?.unit || "";

  return (
    <AppModal open={Boolean(row)} onClose={onClose} contentClassName="max-w-lg" labelledBy="dispose-title">
      {row ? (
        <form onSubmit={onSubmit} className="p-6">
          <h2 id="dispose-title" className="text-lg font-black text-slate-950 dark:text-white">Remove this batch</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {row.name} · {row.batchCode || "No batch number"}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {row.expireDate ? `Expiry ${String(row.expireDate).slice(0, 10)}` : "No expiry date"}
            {row.days != null ? ` · ${row.days < 0 ? `${Math.abs(row.days)} days past` : `${row.days} days left`}` : ""}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-zinc-950">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">On this batch</p>
              <p className="mt-1 text-xl font-black text-slate-950 dark:text-white">{remaining} {unit}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-zinc-950">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">You can remove</p>
              <p className="mt-1 text-xl font-black text-slate-950 dark:text-white">{available} {unit}</p>
            </div>
          </div>

          {reserved > 0 ? (
            <p className="mt-3 text-xs font-semibold leading-5 text-amber-700">
              {reserved} {unit} are held for a sale that is not finished. Those stay on the batch.
            </p>
          ) : (
            <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
              Nothing on this batch is held for a sale. You can remove some, or all of it.
            </p>
          )}

          <label className="mt-4 block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">How many to remove</span>
            <NumericInput
              min={0}
              max={available}
              value={quantity}
              onValueChange={(value) => onQuantity(String(value))}
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-black outline-none focus:border-rose-500 dark:border-zinc-800 dark:bg-zinc-950"
              required
            />
          </label>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
            {removing > 0
              ? left > 0
                ? `This takes ${removing} ${unit} off this batch. ${left} ${unit} stay. Other batches of ${row.name} stay as they are.`
                : `This takes all ${removing} ${unit} off this batch. The batch number stays in the records, with nothing left to sell.`
              : "Type how many to take off this batch."}
            {removing > 0 ? ` The buying cost written off is ${formatCurrency(loss)} (${formatCurrency(unitCost)} each). No cash leaves the till.` : ""}
          </p>

          <label className="mt-4 block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Reason</span>
            <input
              value={reason}
              onChange={(event) => onReason(event.target.value)}
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:border-rose-500 dark:border-zinc-800 dark:bg-zinc-950"
              required
            />
          </label>

          {error ? <p className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-600 dark:bg-rose-950/30">{error}</p> : null}

          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-cancel">Cancel</button>
            <button type="submit" disabled={busy || available <= 0} className="rounded-xl bg-rose-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white disabled:opacity-60">
              {busy ? "Saving…" : "Remove from stock"}
            </button>
          </div>
        </form>
      ) : null}
    </AppModal>
  );
}
