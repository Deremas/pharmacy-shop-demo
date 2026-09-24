"use client";

import React, { useMemo, useState } from "react";
import { useAppData } from "@/lib/client/useAppData";
import { daysUntilExpiry, expiryBand, isBatchExpired } from "@/lib/inventory/fefo";
import { formatUnitLabel } from "@/lib/item-display";

export default function ExpiryPage() {
  const { inventoryBatches = [], items = [], products = [], currentLocation, disposeBatch } = useAppData();
  const [band, setBand] = useState("All");
  const [busyId, setBusyId] = useState("");

  const rows = useMemo(() => {
    const names = new Map<string, any>();
    for (const item of [...products, ...items]) names.set(item.id, item);
    return inventoryBatches
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
  }, [band, inventoryBatches, items, products]);

  const dispose = async (row: any) => {
    const reason = window.prompt("Disposal reason", row.band === "Expired" ? "Expired" : "Near expiry");
    if (!reason || reason.trim().length < 3) return;
    setBusyId(row.id);
    try {
      await disposeBatch({
        inventoryBatchId: row.id,
        quantity: Number(row.remainingQuantity),
        reason: reason.trim(),
        locationId: row.locationId || currentLocation?.id,
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Disposal failed.");
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
                <td className="px-4 py-3 font-bold">{row.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{row.batchCode || "—"}</td>
                <td className="px-4 py-3">{row.expireDate ? String(row.expireDate).slice(0, 10) : "—"}</td>
                <td className="px-4 py-3">{row.days ?? "—"}</td>
                <td className="px-4 py-3">{row.remainingQuantity} {row.unit}</td>
                <td className="px-4 py-3">{row.reservedQuantity || 0} {row.unit}</td>
                <td className="px-4 py-3">{row.buyingPrice} / {row.unit}</td>
                <td className={`px-4 py-3 font-bold ${isBatchExpired(row.expireDate) ? "text-rose-600" : ""}`}>{row.band}</td>
                <td className="px-4 py-3 text-right">
                  <button type="button" disabled={busyId === row.id} onClick={() => dispose(row)} className="rounded-xl bg-rose-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-60">
                    Dispose
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No batches in this band.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
