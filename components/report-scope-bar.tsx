"use client";

import React from "react";
import { useSession } from "next-auth/react";
import { resolveAvailableLocations } from "@/lib/businesses";

export function matchesReportScope(row: { locationId?: string | null } | null | undefined, scopeId: string) {
  if (!scopeId) return false;
  return String(row?.locationId || "") === scopeId;
}

export function useReportScope(locations: Array<{ id: string; name?: string }> = [], currentLocation?: { id?: string; name?: string } | null) {
  const { data: session } = useSession();
  const user = session?.user as any;
  const available = resolveAvailableLocations(user, locations);
  const scopeId = String(currentLocation?.id || available[0]?.id || "");

  return {
    isAdmin: user?.role === "Super Admin",
    scopeId,
    locations: available,
    label: currentLocation?.name || available[0]?.name || "Current business",
    matches: (row: { locationId?: string | null } | null | undefined) =>
      matchesReportScope(row, scopeId),
  };
}

export function ReportScopeBar({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-500 dark:border-zinc-800 dark:bg-zinc-900">
      Reports for <span className="font-black text-slate-950 dark:text-white">{label}</span>
      <span className="mt-0.5 block text-[11px] font-semibold text-slate-400">
        Switch company with the business control in the top bar.
      </span>
    </div>
  );
}
