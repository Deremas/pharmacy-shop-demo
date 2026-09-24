"use client";

import { AppModal } from "@/components/app-modal";
import { expiryBand, expiryTone, formatExpiryDay, type OpenBatch } from "@/lib/inventory/receipt-batch";
import { formatCurrency } from "@/lib/utils";
import { X } from "lucide-react";

export function BatchListModal({
  open,
  title,
  subtitle,
  batches,
  onClose,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  batches: Array<OpenBatch & { locationName?: string }>;
  onClose: () => void;
}) {
  return (
    <AppModal open={open} onClose={onClose} contentClassName="max-w-2xl" labelledBy="batch-list-title">
      <div className="p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="batch-list-title" className="text-lg font-black text-slate-950 dark:text-white">{title}</h2>
            {subtitle ? <p className="mt-1 text-xs font-semibold text-slate-500">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <th className="px-3 py-2">Batch</th>
                <th className="px-3 py-2">Expiry</th>
                <th className="px-3 py-2">Band</th>
                <th className="px-3 py-2 text-right">Qty left</th>
                <th className="px-3 py-2 text-right">Buying price</th>
                <th className="px-3 py-2">Location</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-xs font-bold text-slate-500">No open batches.</td>
                </tr>
              ) : batches.map((batch) => (
                <tr key={batch.id} className="border-t border-slate-100 dark:border-zinc-800">
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-xs font-bold uppercase">{batch.batchCode || "—"}</td>
                  <td className={`whitespace-nowrap px-3 py-3 text-sm font-bold ${expiryTone(batch.expireDate)}`}>{formatExpiryDay(batch.expireDate)}</td>
                  <td className="px-3 py-3 text-xs font-bold text-slate-500">{expiryBand(batch.expireDate)}</td>
                  <td className="px-3 py-3 text-right text-sm font-black">{Number(batch.remainingQuantity || 0)}</td>
                  <td className="px-3 py-3 text-right text-sm font-bold">{formatCurrency(Number(batch.buyingPrice || 0))}</td>
                  <td className="px-3 py-3 text-xs font-semibold text-slate-500">{batch.locationName || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppModal>
  );
}
