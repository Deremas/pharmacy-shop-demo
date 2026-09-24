"use client";

import React from "react";
import { ChevronDown } from "lucide-react";
import { CUSTOM_REASON_VALUE, resolveStockReason } from "@/lib/stock-reasons";
import { cn } from "@/lib/utils";

export function StockReasonSelect({
  presets,
  value,
  onChange,
  label = "Reason",
  placeholder = "Select a reason…",
  customPlaceholder = "Describe the reason…",
  className,
  required = true,
  minLength = 5,
}: {
  presets: readonly string[];
  value: string;
  onChange: (reason: string) => void;
  label?: string;
  placeholder?: string;
  customPlaceholder?: string;
  className?: string;
  required?: boolean;
  minLength?: number;
}) {
  const matchedPreset = presets.includes(value) ? value : "";
  const isCustom = Boolean(value) && !matchedPreset;
  const [preset, setPreset] = React.useState(
    isCustom ? CUSTOM_REASON_VALUE : matchedPreset,
  );
  const [custom, setCustom] = React.useState(isCustom ? value : "");
  const pendingValueRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (pendingValueRef.current === value) {
      pendingValueRef.current = null;
      return;
    }
    const nextMatched = presets.includes(value) ? value : "";
    const nextCustom = Boolean(value) && !nextMatched;
    setPreset(nextCustom ? CUSTOM_REASON_VALUE : nextMatched);
    setCustom(nextCustom ? value : "");
  }, [presets, value]);

  const emit = (nextPreset: string, nextCustom: string) => {
    const resolved = resolveStockReason(nextPreset, nextCustom);
    pendingValueRef.current = resolved;
    onChange(resolved);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <label className="block">
        <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
          {label}
        </span>
        <div className="relative">
          <select
            value={preset}
            onChange={(event) => {
              const next = event.target.value;
              setPreset(next);
              if (next === CUSTOM_REASON_VALUE) {
                emit(next, custom);
              } else {
                setCustom("");
                emit(next, "");
              }
            }}
            required={required}
            className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 pr-10 text-sm font-semibold outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value="" disabled>
              {placeholder}
            </option>
            {presets.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
            <option value={CUSTOM_REASON_VALUE}>Other / new reason…</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
      </label>

      {preset === CUSTOM_REASON_VALUE ? (
        <textarea
          value={custom}
          onChange={(event) => {
            const next = event.target.value;
            setCustom(next);
            emit(CUSTOM_REASON_VALUE, next);
          }}
          placeholder={customPlaceholder}
          className="min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
          required={required}
          minLength={minLength}
        />
      ) : null}
    </div>
  );
}
