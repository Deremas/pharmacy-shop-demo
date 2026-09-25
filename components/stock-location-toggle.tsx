"use client";

import { useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { isStoreLocationId, shopLocationIdFor, storeLocationIdFor } from "@/lib/businesses";
import { useCan } from "@/lib/client/useCan";
import { controlMutedClass } from "@/lib/field-styles";
import { cn } from "@/lib/utils";

export function StockLocationToggle({
  businessId,
  value,
  onChange,
  placeholder,
}: {
  businessId?: string;
  value: string;
  onChange: (locationId: string) => void;
  placeholder?: string;
}) {
  const can = useCan();
  const canViewStore = can("inventory.store.view");
  const counterId = businessId ? shopLocationIdFor(businessId) : "";

  useEffect(() => {
    if (!canViewStore && isStoreLocationId(value) && counterId) onChange(counterId);
  }, [canViewStore, counterId, onChange, value]);

  if (!businessId) {
    return (
      <div className={cn(controlMutedClass, "flex items-center text-xs font-black uppercase tracking-widest text-slate-500")}>
        Select a business
      </div>
    );
  }

  const options = [
    { id: shopLocationIdFor(businessId), label: "Counter" },
    ...(canViewStore ? [{ id: storeLocationIdFor(businessId), label: "Store" }] : []),
  ];
  const allowed = options.map((option) => option.id);
  const selected = allowed.includes(value) ? value : placeholder ? "" : options[0]?.id || "";

  return (
    <div className="relative">
      <select
        required={Boolean(placeholder)}
        value={selected}
        onChange={(event) => onChange(event.target.value)}
        className={cn(controlMutedClass, "appearance-none pr-10")}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
    </div>
  );
}
