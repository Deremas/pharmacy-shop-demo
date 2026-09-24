"use client";

import React from "react";
import { cn, formatNumberWithCommas, formatNumericDraft, parseCommaNumber } from "@/lib/utils";
import { controlClass } from "@/lib/field-styles";

type NumericInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number | string;
  onValueChange: (value: number) => void;
  step?: number;
};

function toNumber(value: number | string) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  return parseCommaNumber(value);
}

function toBound(value: string | number | undefined): number | undefined {
  if (value === undefined || value === "") return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function sanitizeDraft(value: string) {
  const raw = value.replace(/,/g, "");
  if (raw === "" || raw === "-" || raw === "." || raw === "-.") return raw;
  if (!/^-?\d*\.?\d*$/.test(raw)) return null;
  return raw;
}

function decimalPlaces(value: number) {
  if (!Number.isFinite(value)) return 0;
  const text = String(value);
  if (text.includes("e") || text.includes("E")) return 0;
  const decimals = text.split(".")[1];
  return decimals ? decimals.length : 0;
}

function nudge(value: number, direction: 1 | -1, step: number, large: boolean) {
  const size = large ? step * 10 : step;
  const places = Math.max(decimalPlaces(step), decimalPlaces(size), decimalPlaces(value));
  const factor = 10 ** places;
  return Math.round((value + direction * size) * factor) / factor;
}

function clamp(value: number, min?: number, max?: number) {
  let next = value;
  if (min != null && next < min) next = min;
  if (max != null && next > max) next = max;
  return next;
}

function caretIndexFor(formatted: string, nonCommaCount: number) {
  if (nonCommaCount <= 0) return 0;
  let counted = 0;
  for (let index = 0; index < formatted.length; index += 1) {
    if (formatted[index] !== ",") counted += 1;
    if (counted >= nonCommaCount) return index + 1;
  }
  return formatted.length;
}

export function NumericInput({
  value,
  onValueChange,
  className,
  placeholder = "0",
  min,
  max,
  step = 1,
  onFocus,
  onBlur,
  onKeyDown,
  ...rest
}: NumericInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [focused, setFocused] = React.useState(false);
  const [draft, setDraft] = React.useState<string | null>(null);
  const blank = typeof value === "string" && value.trim() === "";
  const numeric = blank ? 0 : toNumber(value);
  const minBound = toBound(min) ?? 0;
  const maxBound = toBound(max);
  const stepSize = Number(step);
  const resolvedStep = Number.isFinite(stepSize) && stepSize > 0 ? stepSize : 1;
  const display = draft !== null
    ? draft
    : numeric === 0 || blank
      ? ""
      : formatNumberWithCommas(numeric);

  const commit = React.useCallback((next: number, keepDraft = true) => {
    const clamped = clamp(next, minBound, maxBound);
    onValueChange(clamped);
    if (keepDraft) setDraft(clamped === 0 ? "" : formatNumberWithCommas(clamped));
    return clamped;
  }, [maxBound, minBound, onValueChange]);

  const beginEdit = React.useCallback(() => {
    setFocused(true);
    setDraft(numeric === 0 || blank ? "" : formatNumberWithCommas(numeric));
  }, [blank, numeric]);

  return (
    <input
      {...rest}
      ref={inputRef}
      data-numeric-input=""
      inputMode="decimal"
      role="spinbutton"
      aria-valuenow={numeric}
      aria-valuemin={minBound}
      aria-valuemax={maxBound}
      value={display}
      placeholder={focused ? "" : placeholder}
      className={cn(controlClass, "text-slate-950 dark:text-zinc-50", className)}
      onMouseDown={() => {
        if (!focused) beginEdit();
      }}
      onFocus={(event) => {
        beginEdit();
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        setDraft(null);
        const raw = event.currentTarget.value.trim();
        commit(raw === "" || raw === "-" ? minBound : parseCommaNumber(raw), false);
        onBlur?.(event);
      }}
      onChange={(event) => {
        const next = sanitizeDraft(event.target.value);
        if (next === null) return;
        const formatted = formatNumericDraft(next);
        const caret = event.target.selectionStart ?? event.target.value.length;
        const nonCommaCount = event.target.value.slice(0, caret).replace(/,/g, "").length;
        setDraft(formatted);
        if (next === "" || next === "-" || next === "." || next === "-.") {
          onValueChange(minBound);
        } else {
          onValueChange(clamp(parseCommaNumber(next), minBound, maxBound));
        }
        requestAnimationFrame(() => {
          const node = inputRef.current;
          if (!node) return;
          const pos = caretIndexFor(formatted, nonCommaCount);
          node.setSelectionRange(pos, pos);
        });
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        const direction = event.key === "ArrowUp" ? 1 : -1;
        const next = commit(nudge(numeric, direction, resolvedStep, event.shiftKey));
        requestAnimationFrame(() => {
          const node = inputRef.current;
          if (!node) return;
          const shown = next === 0 ? "" : formatNumberWithCommas(next);
          node.setSelectionRange(shown.length, shown.length);
        });
      }}
    />
  );
}
