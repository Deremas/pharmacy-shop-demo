"use client";

import { CodeScanButton } from "@/components/code-scanner";
import { expiryInputWarning, formatExpiryDay, internalBatchCode, isInternalBatchCode, toDateInputValue } from "@/lib/inventory/receipt-batch";
import { cleanPackCode } from "@/lib/pack-scan";

type ExistingBatch = {
  id: string;
  batchCode?: string | null;
  expireDate?: Date | string | null;
  remainingQuantity?: number | null;
};

export type ReceiptBatchValue = {
  batchChoice: string;
  batchCode: string;
  expireDate: string;
  noExpiry: boolean;
};

export function ReceiptBatchFields({
  value,
  existingBatches = [],
  takenCodes = [],
  onChange,
  compact = false,
  part,
}: {
  value: ReceiptBatchValue;
  existingBatches?: ExistingBatch[];
  takenCodes?: Array<string | null | undefined>;
  onChange: (next: ReceiptBatchValue) => void;
  compact?: boolean;
  part?: "batch" | "expiry";
}) {
  const warning = value.noExpiry ? "" : expiryInputWarning(value.expireDate);
  const usingExisting = value.batchChoice !== "new" && existingBatches.some((batch) => batch.id === value.batchChoice);

  const chooseBatch = (choice: string) => {
    if (choice === "new") {
      onChange({ ...value, batchChoice: "new", batchCode: "", expireDate: "", noExpiry: false });
      return;
    }
    const batch = existingBatches.find((entry) => entry.id === choice);
    if (!batch) return;
    onChange({
      batchChoice: batch.id,
      batchCode: batch.batchCode || "",
      expireDate: toDateInputValue(batch.expireDate),
      noExpiry: !batch.expireDate,
    });
  };

  const batchFields = (
    <div className="min-w-0 space-y-1.5">
      {existingBatches.length > 0 ? (
        <label className="block">
          {compact ? null : <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Open batch</span>}
          <select
            aria-label="Open batch"
            value={usingExisting ? value.batchChoice : "new"}
            onChange={(event) => chooseBatch(event.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="new">New batch</option>
            {existingBatches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.batchCode || "Batch"} · {formatExpiryDay(batch.expireDate)} · {Number(batch.remainingQuantity || 0)} left
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {usingExisting ? (
        <p className="text-[10px] font-semibold leading-4 text-slate-500">Receiving more of this batch.</p>
      ) : (
        <label className="block">
          {compact ? null : <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Batch number</span>}
          <span className="flex gap-1">
            <input
              aria-label="Batch number"
              value={value.batchCode}
              onChange={(event) => onChange({ ...value, batchChoice: "new", batchCode: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
              placeholder="From carton"
              className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-950"
            />
            <CodeScanButton
              label="Scan carton code"
              onScan={(code) => onChange({ ...value, batchChoice: "new", batchCode: cleanPackCode(code) || "" })}
            />
            <button
              type="button"
              onClick={() => onChange({
                ...value,
                batchChoice: "new",
                batchCode: internalBatchCode([
                  ...takenCodes,
                  ...existingBatches.map((batch) => batch.batchCode),
                  value.batchCode,
                ]),
              })}
              className="shrink-0 rounded-xl border border-slate-200 px-2 text-[10px] font-black uppercase tracking-wide text-slate-600 hover:border-indigo-300 hover:text-indigo-600 dark:border-zinc-700"
            >
              Internal
            </button>
          </span>
          {isInternalBatchCode(value.batchCode) ? (
            <p className="mt-1 text-[10px] font-semibold leading-4 text-amber-600">Shop code. This is not the number on the carton.</p>
          ) : null}
        </label>
      )}
    </div>
  );

  const expiryFields = (
    <div className="min-w-0 space-y-1.5">
      <label className="block">
        {compact ? null : <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Expiry</span>}
        <input
          aria-label="Expiry date"
          type="date"
          disabled={value.noExpiry || usingExisting}
          value={value.noExpiry ? "" : value.expireDate}
          onChange={(event) => onChange({ ...value, expireDate: event.target.value, noExpiry: false })}
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold outline-none focus:border-indigo-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      {usingExisting ? null : (
        <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
          <input
            type="checkbox"
            checked={value.noExpiry}
            onChange={(event) => onChange({ ...value, noExpiry: event.target.checked, expireDate: event.target.checked ? "" : value.expireDate })}
          />
          {compact || part ? "No expiry" : "No expiry on this pack"}
        </label>
      )}
      {warning ? <p className="text-[10px] font-bold leading-4 text-amber-600">{warning}</p> : null}
    </div>
  );

  if (part === "batch") return batchFields;
  if (part === "expiry") return expiryFields;
  return (
    <div className={compact ? "space-y-1.5" : "space-y-3"}>
      {batchFields}
      {expiryFields}
    </div>
  );
}
