"use client";

import React from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type MultiSelectOption = {
  value: string;
  label: string;
};

export function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  allLabel = "All",
}: {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  allLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectedOptions = options.filter((option) => selected.includes(option.value));
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(query.toLowerCase())
  );

  const toggleValue = (value: string) => {
    onChange(selected.includes(value)
      ? selected.filter((entry) => entry !== value)
      : [...selected, value]
    );
  };

  return (
    <div ref={wrapperRef} className="relative min-w-[220px]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-black uppercase tracking-widest text-slate-600 outline-none transition hover:border-indigo-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
      >
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {selectedOptions.length === 0 ? (
            <span>{allLabel} {label}</span>
          ) : selectedOptions.slice(0, 2).map((option) => (
            <span key={option.value} className="inline-flex max-w-[130px] items-center gap-1 truncate rounded-lg bg-white px-2 py-1 text-[9px] text-indigo-600 ring-1 ring-indigo-100 dark:bg-zinc-900 dark:ring-zinc-800">
              <span className="truncate">{option.label}</span>
              <X
                className="h-3 w-3 shrink-0"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleValue(option.value);
                }}
              />
            </span>
          ))}
          {selectedOptions.length > 2 ? (
            <span className="rounded-lg bg-indigo-600 px-2 py-1 text-[9px] text-white">
              +{selectedOptions.length - 2}
            </span>
          ) : null}
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-full min-w-[280px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-slate-100 p-3 dark:border-zinc-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${label.toLowerCase()}...`}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs font-bold outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto p-2">
            {filteredOptions.map((option) => {
              const active = selected.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleValue(option.value)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold transition hover:bg-slate-50 dark:hover:bg-zinc-800",
                    active && "text-indigo-600"
                  )}
                >
                  <span>{option.label}</span>
                  {active ? <Check className="h-4 w-4" /> : null}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 p-3 dark:border-zinc-800">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              {selected.length} selected
            </span>
            <button
              type="button"
              onClick={() => onChange([])}
              className="rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-widest text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              Clear all
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
