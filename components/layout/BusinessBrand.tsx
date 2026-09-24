"use client";

import { cn } from "@/lib/utils";
import { getBusinessBrand } from "@/lib/businesses";

type Business = {
  id?: string;
  name?: string;
  type?: string;
  location?: string | null;
} | null;

export function BusinessMark({
  business,
  size = "md",
}: {
  business?: Business;
  size?: "sm" | "md";
}) {
  const brand = getBusinessBrand(business);
  return (
    <div
      className={cn(
        "rounded-lg flex items-center justify-center font-black text-white flex-shrink-0",
        brand.mark,
        size === "sm" ? "h-8 w-8 text-[11px]" : "h-10 w-10 text-sm",
      )}
    >
      {brand.initials}
    </div>
  );
}

export function BusinessIdentity({
  business,
  size = "md",
  className,
  showSubtitle = true,
}: {
  business?: Business;
  size?: "sm" | "md";
  className?: string;
  showSubtitle?: boolean;
}) {
  const brand = getBusinessBrand(business);

  return (
    <div className={cn("flex w-max max-w-full min-w-0 items-center gap-2", className)}>
      <BusinessMark business={business} size={size} />
      <div className="min-w-0 leading-tight">
        <p
          className={cn(
            "font-black truncate text-slate-900 dark:text-white",
            size === "sm" ? "text-xs" : "text-sm",
          )}
        >
          {brand.name}
        </p>
        {showSubtitle && brand.place ? (
          <p
            className={cn(
              "font-bold uppercase tracking-widest truncate",
              brand.sub,
              size === "sm" ? "text-[9px]" : "text-[10px]",
            )}
          >
            {brand.place}
          </p>
        ) : null}
      </div>
    </div>
  );
}
