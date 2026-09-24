"use client";

import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { controlClass } from "@/lib/field-styles";

export type SearchableSelectOption = {
  value: string;
  label: string;
  size?: string;
  meta?: string;
  searchText?: string;
  disabled?: boolean;
};

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select",
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  
  const selected = options.find((option) => option.value === value);
  const filteredOptions = options.filter((option) =>
    `${option.searchText || ""} ${option.label} ${option.size || ""} ${option.meta || ""}`.toLowerCase().includes(query.toLowerCase())
  );

  const updatePosition = () => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const width = Math.max(rect.width, 320);
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));
    const spaceBelow = Math.max(120, window.innerHeight - rect.bottom - 16);
    const maxHeight = Math.min(320, spaceBelow);
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 6,
      left,
      width,
      maxHeight,
      zIndex: 400,
      pointerEvents: "auto",
    });
  };

  useEffect(() => {
    if (open) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!wrapperRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const chooseOption = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={wrapperRef} className={cn("relative z-30", className)}>
      <button
        type="button"
        data-field-control=""
        aria-label={ariaLabel || placeholder}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((next) => !next)}
        className={cn(
          controlClass,
          "relative z-10 flex cursor-pointer items-center justify-between gap-2 text-left",
          open && "border-indigo-600 ring-2 ring-indigo-500/20",
        )}
        title={selected ? `${selected.label}${selected.size ? ` ${selected.size}` : ""}` : undefined}
      >
        <span className={cn("flex min-w-0 items-center gap-2", !selected && "text-slate-600 dark:text-zinc-300")}>
          {selected ? (
            <>
              <span className="min-w-0 truncate">{selected.label}</span>
              {selected.size ? (
                <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-900 dark:bg-zinc-800 dark:text-zinc-100">
                  {selected.size}
                </span>
              ) : null}
            </>
          ) : (
            <span className="truncate">{placeholder}</span>
          )}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-500 transition", open && "rotate-180")} />
      </button>

      {open && typeof document !== "undefined" ? createPortal(
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          onMouseDown={(event) => event.stopPropagation()}
          className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="shrink-0 border-b border-slate-100 p-2 dark:border-zinc-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs font-bold outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5" role="listbox">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-8 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                No results
              </div>
            ) : filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={value === option.value}
                disabled={option.disabled}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (option.disabled) return;
                  chooseOption(option.value);
                }}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-bold transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:hover:bg-zinc-800",
                  value === option.value && "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40"
                )}
              >
                <span className="min-w-0">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 truncate">{option.label}</span>
                    {option.size ? (
                      <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-900 dark:bg-zinc-800 dark:text-zinc-100">
                        {option.size}
                      </span>
                    ) : null}
                  </span>
                  {option.meta ? <span className="mt-0.5 block truncate text-[10px] font-medium text-slate-600 dark:text-zinc-400">{option.meta}</span> : null}
                </span>
                {value === option.value ? <Check className="h-4 w-4 shrink-0" /> : null}
              </button>
            ))}
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}
