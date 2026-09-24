"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Plus, ShieldCheck, Pencil, X, UserCircle2, Trash2, UserX, UserCheck, AlertCircle } from "lucide-react";
import { useAppData } from "@/lib/client/useAppData";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";

export default function UserManagementPage() {
  const { users, locations, availableLocations, deleteUser, updateUserStatus } = useAppData();
  const businesses = availableLocations?.length ? availableLocations : locations;
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [userToToggleStatus, setUserToToggleStatus] = useState<any>(null);
  const [error, setError] = useState("");

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(""), 5000);
  };

  return (
    <>
      <div className="space-y-6 animate-in fade-in duration-500 p-4 md:p-6">
        <div className="page-heading">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              <UserCircle2 className="h-8 w-8 text-indigo-600" />
              User Management
            </h1>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-zinc-400">
              Control access levels and pharmacy assignments. Users and roles are global across all branches.
            </p>
          </div>
          <Link
            href="/admin/users/create"
            className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-xl shadow-indigo-900/20 transition-all hover:bg-indigo-500 active:scale-95"
          >
            <Plus className="h-4 w-4" /> Add User
          </Link>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400"
            >
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span className="flex-1">{error}</span>
              <button type="button" onClick={() => setError("")} className="rounded-lg p-1 hover:bg-red-100 dark:hover:bg-red-900/30">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[860px] text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 dark:border-zinc-800 dark:bg-zinc-950/50">
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">User Details</th>
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Role</th>
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Assigned Pharmacies</th>
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Status</th>
                <th className="px-6 py-5 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {users.map((user) => (
                <tr key={user.id} className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-xs font-black text-indigo-600 dark:bg-indigo-900/20">
                        {user.firstName?.charAt(0)}
                        {user.lastName?.charAt(0) || ""}
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-tight text-slate-900 dark:text-white">
                          {user.firstName} {user.lastName || ""}
                        </h4>
                        <p className="font-mono text-[10px] text-slate-400">{user.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-widest",
                        user.role === "Super Admin" ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700",
                      )}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {user.role}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {(user.assignedLocations || []).map((bid: string) => {
                        const location = businesses.find((b) => b.id === bid);
                        return (
                          <span key={bid} className="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600 dark:bg-zinc-800 dark:text-zinc-400">
                            {location?.name}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[9px] font-black uppercase tracking-widest",
                        user.isActive
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                          : "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
                      )}
                    >
                      <div className={cn("h-1.5 w-1.5 rounded-full", user.isActive ? "bg-emerald-500" : "bg-red-500")} />
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setUserToToggleStatus(user);
                          setIsStatusModalOpen(true);
                        }}
                        title={user.isActive ? "Deactivate User" : "Activate User"}
                        className={cn(
                          "rounded-xl p-2 transition-all",
                          user.isActive
                            ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                            : "text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10",
                        )}
                      >
                        {user.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </button>
                      <Link
                        href={`/admin/users/${user.id}/edit`}
                        title="Edit User"
                        className="rounded-xl p-2 text-slate-600 transition-all hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/10"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setUserToDelete(user);
                          setIsDeleteDialogOpen(true);
                        }}
                        title="Delete User"
                        className="rounded-xl p-2 text-slate-600 transition-all hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isStatusModalOpen && userToToggleStatus && (
          <div className="fixed inset-0 z-[100] flex justify-center overflow-y-auto overscroll-contain p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsStatusModalOpen(false)} className="absolute inset-0 bg-white/40 backdrop-blur-md dark:bg-zinc-950/60" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative my-auto w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
              <div className={cn("mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl", userToToggleStatus.isActive ? "bg-amber-100 text-amber-600 dark:bg-amber-500/20" : "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20")}>
                {userToToggleStatus.isActive ? <UserX className="h-8 w-8" /> : <UserCheck className="h-8 w-8" />}
              </div>
              <h2 className="mb-2 text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
                {userToToggleStatus.isActive ? "Deactivate User?" : "Activate User?"}
              </h2>
              <p className="mb-8 text-sm font-bold text-slate-500">
                {userToToggleStatus.isActive
                  ? `Are you sure you want to deactivate ${userToToggleStatus.firstName}? They will no longer be able to log in.`
                  : `Are you sure you want to activate ${userToToggleStatus.firstName}? They will regain access to the system.`}
              </p>
              <div className="flex gap-4">
                <button type="button" onClick={() => setIsStatusModalOpen(false)} className="btn-cancel flex-1 py-4">Cancel</button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await updateUserStatus(userToToggleStatus.id, !userToToggleStatus.isActive);
                    } catch (err) {
                      showError(err instanceof Error ? err.message : "Failed to update user status.");
                    }
                    setIsStatusModalOpen(false);
                  }}
                  className={cn("flex-1 rounded-2xl py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl transition-all active:scale-[0.98]", userToToggleStatus.isActive ? "bg-amber-500 shadow-amber-500/20 hover:bg-amber-600" : "bg-emerald-500 shadow-emerald-500/20 hover:bg-emerald-600")}
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDeleteDialogOpen && userToDelete && (
          <div className="fixed inset-0 z-[100] flex justify-center overflow-y-auto overscroll-contain p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDeleteDialogOpen(false)} className="absolute inset-0 bg-white/40 backdrop-blur-md dark:bg-zinc-950/60" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative my-auto w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-red-100 text-red-600 dark:bg-red-500/20">
                <Trash2 className="h-8 w-8" />
              </div>
              <h2 className="mb-2 text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Delete User?</h2>
              <p className="mb-8 text-sm font-bold text-slate-500">
                Are you sure you want to permanently delete <strong>{userToDelete.firstName} {userToDelete.lastName}</strong>? This action cannot be undone.
              </p>
              <div className="flex gap-4">
                <button type="button" onClick={() => setIsDeleteDialogOpen(false)} className="btn-cancel flex-1 py-4">Cancel</button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await deleteUser(userToDelete.id);
                    } catch (err) {
                      showError(err instanceof Error ? err.message : "Failed to delete user.");
                    }
                    setIsDeleteDialogOpen(false);
                  }}
                  className="flex-1 rounded-2xl bg-red-500 py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-red-500/20 transition-all hover:bg-red-600 active:scale-[0.98]"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
