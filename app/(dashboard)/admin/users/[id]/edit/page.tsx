"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Building2, ChevronDown, UserCircle2 } from "lucide-react";
import { useAppData } from "@/lib/client/useAppData";
import { PasswordInput } from "@/components/password-input";
import { cn } from "@/lib/utils";

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = String(params.id || "");
  const { users, locations, availableLocations, roles, updateUser, loading } = useAppData();
  const businesses = availableLocations?.length ? availableLocations : locations;
  const editingUser = users.find((u: any) => u.id === userId);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    role: "Sales",
    roleId: "",
    assignedLocations: [] as string[],
    username: "",
    phone: "",
    password: "",
  });

  const roleOptions = React.useMemo(() => {
    const unique = Array.from(new Map((roles || []).map((role: any) => [role.id, role])).values())
      .filter((role: any) => role?.id && String(role.name || "").trim()) as Array<{ id: string; name: string }>;
    return unique.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [roles]);

  React.useEffect(() => {
    if (!editingUser || ready) return;
    setFormData({
      firstName: editingUser.firstName || "",
      lastName: editingUser.lastName || "",
      role: editingUser.role || "",
      roleId: editingUser.roleId || roles?.find((role: any) => role.name === editingUser.role)?.id || "",
      assignedLocations: editingUser.assignedLocations || [],
      username: editingUser.username || "",
      phone: editingUser.phone || "",
      password: "",
    });
    setReady(true);
  }, [editingUser, roles, ready]);

  const toggleLocation = (locationId: string) => {
    setFormData((prev) => ({
      ...prev,
      assignedLocations: prev.assignedLocations.includes(locationId)
        ? prev.assignedLocations.filter((id) => id !== locationId)
        : [...prev.assignedLocations, locationId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSaving(true);
    setError("");
    try {
      const selectedRole = roles?.find((role: any) => role.id === formData.roleId);
      await updateUser({ ...editingUser, ...formData, role: selectedRole?.name || formData.role });
      router.push("/admin/users");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user.");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !editingUser) {
    return <div className="p-6 text-sm font-bold text-slate-500">Loading user...</div>;
  }
  if (!editingUser) {
    return (
      <div className="p-6">
        <p className="text-sm font-bold text-slate-500">User not found.</p>
        <Link href="/admin/users" className="mt-4 inline-flex text-xs font-black uppercase tracking-widest text-indigo-600">Back</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 animate-in fade-in duration-500">
      <div>
        <Link href="/admin/users" className="mb-2 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600">
          <ArrowLeft className="h-4 w-4" /> Users
        </Link>
        <h1 className="flex items-center gap-3 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
          <UserCircle2 className="h-7 w-7 text-indigo-600" />
          Edit User
        </h1>
        <p className="mt-1 text-[11px] font-black uppercase tracking-widest text-slate-500">{editingUser.firstName} {editingUser.lastName}</p>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-8">
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-600">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="px-1 text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">First Name</label>
            <input required className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <label className="px-1 text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Last Name</label>
            <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="px-1 text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Username</label>
            <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <label className="px-1 text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Phone Number</label>
            <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="px-1 text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Password (leave blank to keep)</label>
          <PasswordInput autoComplete="new-password" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
        </div>

        <div className="space-y-1.5">
          <label className="px-1 text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Access Role</label>
          <div className="relative">
            <select
              required
              value={formData.roleId}
              onChange={(event) => {
                const selected = roleOptions.find((role) => role.id === event.target.value);
                setFormData({ ...formData, roleId: event.target.value, role: selected?.name || "" });
              }}
              className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-11 text-xs font-bold outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="">Select a role</option>
              {roleOptions.map((role) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="px-1 text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Assigned Pharmacies</label>
          <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
            {businesses.map((location) => {
              const isChecked = formData.assignedLocations.includes(location.id);
              return (
                <label key={location.id} className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-3", isChecked ? "border-indigo-200 bg-white text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/20 dark:text-indigo-300" : "border-slate-200 bg-white text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-slate-300")}>
                  <input type="checkbox" checked={isChecked} onChange={() => toggleLocation(location.id)} className="h-5 w-5 shrink-0 rounded accent-indigo-600" />
                  <Building2 className={cn("h-4 w-4 shrink-0", isChecked ? "text-indigo-500" : "text-slate-400")} />
                  <span className="min-w-0 flex-1 text-xs font-black uppercase tracking-wide">{location.name}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex gap-4 border-t border-slate-100 pt-6 dark:border-zinc-800">
          <Link href="/admin/users" className="btn-cancel flex-1 px-6 py-4 text-center">Cancel</Link>
          <button type="submit" disabled={saving} className="flex-[2] rounded-2xl bg-indigo-600 py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-indigo-500/20 disabled:opacity-60">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
