"use client";

import React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckSquare2, ChevronDown, Loader2, Save, Square } from "lucide-react";
import { useAppData } from "@/lib/client/useAppData";
import { cn } from "@/lib/utils";
import { formatPermissionLabel, groupPermissions } from "@/lib/permission-catalog";

export default function EditRolePage() {
  const router = useRouter();
  const params = useParams();
  const roleId = String(params.id || "");
  const { roles, permissions: storePermissions, updateRole, refresh, loading } = useAppData();
  const role = (roles || []).find((r: any) => r.id === roleId);
  const [allPermissions, setAllPermissions] = React.useState<any[]>(Array.isArray(storePermissions) ? storePermissions : []);
  const [form, setForm] = React.useState({ id: "", name: "", description: "", permissionIds: [] as string[] });
  const [ready, setReady] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [expandedModules, setExpandedModules] = React.useState<Set<string>>(new Set());

  const groupedPermissions = React.useMemo(() => groupPermissions(allPermissions), [allPermissions]);
  const allPermissionIds = React.useMemo(() => allPermissions.map((p) => p.id), [allPermissions]);
  const isSuperAdmin = form.name === "Super Admin";
  const allFormSelected = allPermissionIds.length > 0 && allPermissionIds.every((id) => form.permissionIds.includes(id));
  const selectedCount = isSuperAdmin ? allPermissionIds.length : form.permissionIds.length;

  React.useEffect(() => {
    if (Array.isArray(storePermissions) && storePermissions.length > 0) setAllPermissions(storePermissions);
  }, [storePermissions]);

  React.useEffect(() => {
    if (!role || ready) return;
    setForm({
      id: role.id,
      name: role.name,
      description: role.description || "",
      permissionIds: role.name === "Super Admin" ? allPermissionIds : role.permissionIds || [],
    });
    setReady(true);
  }, [role, allPermissionIds, ready]);

  React.useEffect(() => {
    if (isSuperAdmin && allPermissionIds.length > 0) {
      setForm((current) => ({ ...current, permissionIds: allPermissionIds }));
    }
  }, [allPermissionIds, isSuperAdmin]);

  const saveRole = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await updateRole(form);
      await refresh();
      router.push("/admin/roles");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Role could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !role) return <div className="p-6 text-sm font-bold text-slate-500">Loading role...</div>;
  if (!role) {
    return (
      <div className="p-6">
        <p className="text-sm font-bold text-slate-500">Role not found.</p>
        <Link href="/admin/roles" className="mt-4 inline-flex text-xs font-black uppercase tracking-widest text-indigo-600">Back</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <Link href="/admin/roles" className="mb-2 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600">
          <ArrowLeft className="h-4 w-4" /> Roles
        </Link>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Edit Role</h1>
        <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500">{role.name}</p>
      </div>

      <form onSubmit={saveRole} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="space-y-6 p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Role Name</span>
              <input required disabled={isSuperAdmin} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950" />
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Description</span>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950" />
            </label>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-950">
            <span className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">
              Permissions Selected: {selectedCount} / {allPermissions.length}
            </span>
            {!isSuperAdmin ? (
              <button
                type="button"
                onClick={() => setForm((current) => ({ ...current, permissionIds: allFormSelected ? [] : allPermissionIds }))}
                className={cn("inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[11px] font-black uppercase tracking-widest", allFormSelected ? "bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300" : "bg-indigo-600 text-white")}
              >
                {allFormSelected ? <Square className="h-3 w-3" /> : <CheckSquare2 className="h-3 w-3" />}
                {allFormSelected ? "Deselect All" : "Select All"}
              </button>
            ) : (
              <span className="text-[11px] font-black uppercase tracking-widest text-amber-600">Super Admin has all permissions</span>
            )}
          </div>

          <div className="space-y-4">
            {Object.entries(groupedPermissions).map(([moduleName, modulePermissions]) => {
              const moduleIds = (modulePermissions as any[]).map((p) => p.id);
              const allModuleSelected = moduleIds.every((id) => form.permissionIds.includes(id));
              const someModuleSelected = moduleIds.some((id) => form.permissionIds.includes(id));
              const expanded = expandedModules.has(moduleName);
              return (
                <section key={moduleName} className="overflow-hidden rounded-lg border border-slate-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-2 bg-slate-50 px-4 py-3 dark:bg-zinc-950">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedModules((current) => {
                          const next = new Set(current);
                          if (next.has(moduleName)) next.delete(moduleName);
                          else next.add(moduleName);
                          return next;
                        })
                      }
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-500 transition-transform", expanded ? "rotate-0" : "-rotate-90")} />
                      <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">{moduleName}</h3>
                    </button>
                    {!isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            permissionIds: allModuleSelected
                              ? current.permissionIds.filter((id) => !moduleIds.includes(id))
                              : Array.from(new Set([...current.permissionIds, ...moduleIds])),
                          }))
                        }
                        className={cn("inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[10px] font-black uppercase tracking-widest", allModuleSelected ? "bg-indigo-100 text-indigo-700" : someModuleSelected ? "bg-slate-200 text-slate-800" : "bg-slate-100 text-slate-500")}
                      >
                        {allModuleSelected ? "All" : someModuleSelected ? "Some" : "None"}
                      </button>
                    )}
                  </div>
                  {expanded ? (
                    <div className="grid grid-cols-1 gap-2 border-t border-slate-200 p-3 sm:grid-cols-2 xl:grid-cols-3 dark:border-zinc-800">
                      {(modulePermissions as any[]).map((permission) => {
                        const checked = isSuperAdmin || form.permissionIds.includes(permission.id);
                        return (
                          <label key={permission.id} className={cn("flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2 text-xs font-bold", checked ? "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-300" : "border-slate-200 bg-white text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300", isSuperAdmin ? "cursor-not-allowed opacity-75" : "cursor-pointer")}>
                            <input
                              type="checkbox"
                              disabled={isSuperAdmin}
                              checked={checked}
                              onChange={() =>
                                setForm((current) => ({
                                  ...current,
                                  permissionIds: checked
                                    ? current.permissionIds.filter((id) => id !== permission.id)
                                    : [...current.permissionIds, permission.id],
                                }))
                              }
                              className="h-4 w-4 shrink-0 rounded accent-indigo-600"
                            />
                            <span className="flex-1 leading-snug break-words">{formatPermissionLabel(permission)}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 dark:border-zinc-800">
          {error ? <p className="text-xs font-bold text-red-600">{error}</p> : <p className="text-xs font-bold text-slate-400">{selectedCount} of {allPermissions.length} selected</p>}
          <div className="flex gap-3">
            <Link href="/admin/roles" className="btn-cancel">Cancel</Link>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white hover:bg-indigo-500 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Role
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
