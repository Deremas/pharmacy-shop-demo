"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useReportData } from "@/lib/client/useAppData";
import { formatCurrency } from "@/lib/utils";
import { formatUnitLabel } from "@/lib/item-display";
import { isBatchExpired } from "@/lib/inventory/fefo";

const bands = [
  { label: "0–30 days", min: 0, max: 30 },
  { label: "31–90 days", min: 31, max: 90 },
  { label: "91–180 days", min: 91, max: 180 },
  { label: "Over 180 days", min: 181, max: Infinity },
];

export default function StockReportsPage() {
  const { inventoryBatches = [], sales = [], saleReturns = [], products = [], items = [] } = useReportData();
  const [tab, setTab] = useState<"profit" | "expiry" | "aging">("profit");
  const names = useMemo(() => {
    const map = new Map<string, any>();
    for (const item of [...products, ...items]) map.set(item.id, item);
    return map;
  }, [items, products]);

  const profitRows = useMemo(() => {
    const rows = new Map<string, { name: string; batchCode: string; unit: string; sold: number; returned: number; revenue: number; cost: number }>();
    const ensure = (batchId: string, itemId: string, batchCode = "") => {
      const current = rows.get(batchId);
      if (current) return current;
      const item = names.get(itemId);
      const next = {
        name: item?.name || "Medicine",
        batchCode,
        unit: formatUnitLabel(item),
        sold: 0,
        returned: 0,
        revenue: 0,
        cost: 0,
      };
      rows.set(batchId, next);
      return next;
    };
    for (const sale of sales) {
      if (sale.status === "VOIDED") continue;
      for (const line of sale.items || []) {
        const row = ensure(line.inventoryBatchId, line.itemId);
        const batch = inventoryBatches.find((entry) => entry.id === line.inventoryBatchId);
        if (batch?.batchCode) row.batchCode = batch.batchCode;
        row.sold += Number(line.qty || 0);
        row.revenue += Number(line.total || 0);
        row.cost += Number(line.buyingPrice || 0) * Number(line.qty || 0);
      }
    }
    for (const entry of saleReturns) {
      for (const line of entry.lines || []) {
        const row = ensure(line.inventoryBatchId, line.itemId);
        row.returned += Number(line.quantity || 0);
        row.revenue -= Number(line.totalAmount || 0);
        const saleLine = sales.flatMap((sale) => sale.items || []).find((item) => item.id === line.saleItemId);
        row.cost -= Number(saleLine?.buyingPrice || 0) * Number(line.quantity || 0);
      }
    }
    return [...rows.values()].filter((row) => row.sold > 0);
  }, [inventoryBatches, names, saleReturns, sales]);

  const expiryRows = useMemo(() => inventoryBatches
    .filter((batch) => Number(batch.remainingQuantity) > 0 && isBatchExpired(batch.expireDate))
    .map((batch) => {
      const item = names.get(batch.itemId);
      const qty = Number(batch.remainingQuantity || 0);
      return {
        id: batch.id,
        name: item?.name || "Medicine",
        unit: formatUnitLabel(item),
        batchCode: batch.batchCode || "—",
        expireDate: batch.expireDate ? String(batch.expireDate).slice(0, 10) : "—",
        qty,
        loss: qty * Number(batch.buyingPrice || 0),
      };
    }), [inventoryBatches, names]);

  const agingRows = useMemo(() => bands.map((band) => {
    const now = Date.now();
    const matches = inventoryBatches.filter((batch) => {
      if (Number(batch.remainingQuantity) <= 0) return false;
      const age = Math.floor((now - new Date(batch.createdAt).getTime()) / 86_400_000);
      return age >= band.min && age <= band.max;
    });
    return {
      label: band.label,
      batches: matches.length,
      qty: matches.reduce((sum, batch) => sum + Number(batch.remainingQuantity || 0), 0),
      value: matches.reduce((sum, batch) => sum + Number(batch.remainingQuantity || 0) * Number(batch.buyingPrice || 0), 0),
    };
  }), [inventoryBatches]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Stock reports</h1>
          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-500">Batch profit, expiry loss, and how long stock has been held.</p>
        </div>
        <Link href="/reports" className="text-xs font-black uppercase tracking-widest text-indigo-600">All reports</Link>
      </div>
      <div className="flex gap-2">
        {([
          ["profit", "Batch profit"],
          ["expiry", "Expiry loss"],
          ["aging", "Aging"],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-widest ${tab === id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-zinc-800"}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === "profit" ? (
        <ReportTable
          headers={["Medicine", "Batch", "Sold", "Returned", "Revenue", "Cost", "Profit"]}
          rows={profitRows.map((row) => [row.name, row.batchCode, `${row.sold} ${row.unit}`, `${row.returned} ${row.unit}`, formatCurrency(row.revenue), formatCurrency(row.cost), formatCurrency(row.revenue - row.cost)])}
        />
      ) : null}
      {tab === "expiry" ? (
        <ReportTable
          headers={["Medicine", "Batch", "Expiry", "Remaining", "Loss"]}
          rows={expiryRows.map((row) => [row.name, row.batchCode, row.expireDate, `${row.qty} ${row.unit}`, formatCurrency(row.loss)])}
          empty="No expired stock still on hand."
        />
      ) : null}
      {tab === "aging" ? (
        <ReportTable
          headers={["Age since received", "Batches", "Quantity", "Buying value"]}
          rows={agingRows.map((row) => [row.label, String(row.batches), String(row.qty), formatCurrency(row.value)])}
        />
      ) : null}
    </div>
  );
}

function ReportTable({ headers, rows, empty = "Nothing to show." }: { headers: string[]; rows: string[][]; empty?: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="text-left text-[11px] font-black uppercase tracking-widest text-slate-500">
          <tr>{headers.map((header) => <th key={header} className="px-4 py-3">{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-slate-100 dark:border-zinc-800">
              {row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3 font-bold">{cell}</td>)}
            </tr>
          ))}
          {rows.length === 0 ? <tr><td colSpan={headers.length} className="px-4 py-8 text-center text-slate-500">{empty}</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
