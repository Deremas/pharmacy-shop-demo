"use client";

import React from "react";
import Link from "next/link";
import { Edit3, Loader2, Lock, Shield, Trash2 } from "lucide-react";
import { useAppData } from "@/lib/client/useAppData";
import { useCan } from "@/lib/client/useCan";
import { cn } from "@/lib/utils";
import { formatPermissionLabel } from "@/lib/permission-catalog";

export default function RoleManagementPage() {
  const { roles, deleteRole, refresh, loading } = useAppData();
  const can = useCan();
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  const removeRole = async (role: any) => {
    if (!window.confirm(`Delete "${role.name}"? Only unused non-system roles can be deleted.`)) return;
    try {
      await deleteRole(role.id);
      await refresh();
      setSuccess("Role deleted successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Role could not be deleted.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="page-heading">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Role Management</h1>
          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-500">Global roles used by every business</p>
        </div>
        {can("admin.roles.manage") ? (
          <Link
            href="/admin/roles/create"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-900/20 transition-all hover:bg-indigo-500 active:scale-95"
          >
            <span className="text-base leading-none">+</span>
            Create Role
          </Link>
        ) : null}
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">{success}</div>}

      {loading && (roles || []).length === 0 ? (
        <div className="flex items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white py-16 text-slate-500 dark:border-zinc-800 dark:bg-zinc-900">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-bold">Loading roles...</span>
        </div>
      ) : (roles || []).length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white py-16 text-center text-sm font-bold text-slate-500 dark:border-zinc-800 dark:bg-zinc-900">
          No roles found.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {(roles || []).map((role: any) => (
            <div key={role.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className={cn("rounded-lg p-2", role.isSystem ? "bg-amber-50 text-amber-600 dark:bg-amber-900/20" : "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20")}>
                      <Shield className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-slate-900 dark:text-white">{role.name}</h4>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{role.userCount} users</p>
                        {role.isSystem && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            System
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-500">{role.description || "No description"}</p>
                </div>
                <div className="flex items-center gap-1">
                  {can("admin.roles.manage") ? (
                    <Link
                      href={`/admin/roles/${role.id}/edit`}
                      className="rounded-lg p-2 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/30"
                      title="Edit role"
                    >
                      <Edit3 className="h-4 w-4" />
                    </Link>
                  ) : null}
                  {can("admin.roles.manage") ? (
                  <button
                    type="button"
                    disabled={role.userCount > 0 || role.isSystem}
                    onClick={() => removeRole(role)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-red-950/20"
                    title={role.isSystem ? "System roles cannot be deleted." : role.userCount > 0 ? `Cannot delete: ${role.userCount} user(s) assigned.` : "Delete unused role."}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(role.permissions || []).slice(0, 8).map((permission: any) => (
                  <span key={permission.id} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                    <Lock className="h-3 w-3" /> {formatPermissionLabel(permission)}
                  </span>
                ))}
                {role.permissions?.length > 8 && (
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">
                    +{role.permissions.length - 8} more
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
