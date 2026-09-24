"use client";

import React from "react";
import { Filter, KeyRound, Loader2, Search } from "lucide-react";
import { groupPermissions } from "@/lib/permission-catalog";

type PermissionView = {
  id: string;
  key: string;
  name?: string;
  label?: string;
  module: string;
  description?: string | null;
  usedByRoles?: string[];
  usageCount?: number;
};

function permissionName(permission: PermissionView) {
  return permission.name || permission.label || permission.key;
}

export default function PermissionsPage() {
  const [permissions, setPermissions] = React.useState<PermissionView[]>([]);
  const [search, setSearch] = React.useState("");
  const [moduleFilter, setModuleFilter] = React.useState("all");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    fetch("/api/permissions", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Permissions could not be loaded.");
        return response.json();
      })
      .then((data) => setPermissions(Array.isArray(data.permissions) ? data.permissions : []))
      .catch((err) => setError(err instanceof Error ? err.message : "Permissions could not be loaded."))
      .finally(() => setLoading(false));
  }, []);

  const modules = React.useMemo(
    () => Array.from(new Set(permissions.map((permission) => permission.module))).sort(),
    [permissions],
  );

  const filteredPermissions = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return permissions.filter((permission) => {
      const matchesModule = moduleFilter === "all" || permission.module === moduleFilter;
      const haystack = `${permission.module} ${permission.key} ${permissionName(permission)}`.toLowerCase();
      return matchesModule && (!query || haystack.includes(query));
    });
  }, [moduleFilter, permissions, search]);

  const groupedPermissions = groupPermissions(filteredPermissions);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Permissions</h1>
          <p className="text-slate-500 mt-1 text-xs font-bold uppercase tracking-widest">Read-only lookup for system permission keys</p>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Permissions</p>
          <p className="text-lg font-black text-slate-900 dark:text-white">
            {filteredPermissions.length} / {permissions.length}
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_240px]">
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by permission name, key, or module"
            className="w-full rounded-lg border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
          />
        </label>
        <label className="relative block">
          <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <select
            value={moduleFilter}
            onChange={(event) => setModuleFilter(event.target.value)}
            className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
          >
            <option value="all">All Modules</option>
            {modules.map((moduleName) => (
              <option key={moduleName} value={moduleName}>{moduleName}</option>
            ))}
          </select>
        </label>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white py-12 text-slate-500 dark:border-zinc-800 dark:bg-zinc-900">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-bold">Loading permissions...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedPermissions).map(([moduleName, modulePermissions]) => (
            <section key={moduleName} className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-950">
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">{moduleName}</h2>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{modulePermissions.length} permissions</span>
              </div>
              <div className="grid gap-2 p-4 md:grid-cols-2 xl:grid-cols-3">
                {(modulePermissions as PermissionView[]).map((permission) => (
                  <div key={permission.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-lg bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/30">
                        <KeyRound className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black leading-snug text-slate-900 dark:text-white">{permissionName(permission)}</p>
                        <p className="mt-1 break-all font-mono text-[11px] font-bold text-slate-500">{permission.key}</p>
                        {permission.usedByRoles && permission.usedByRoles.length > 0 && (
                          <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            Used by {permission.usedByRoles.join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {filteredPermissions.length === 0 && (
            <div className="rounded-lg border border-slate-200 bg-white py-12 text-center text-sm font-bold text-slate-500 dark:border-zinc-800 dark:bg-zinc-900">
              No permissions match the current filters.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
