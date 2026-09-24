"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Plus, Search, Truck, Eye, X, Edit3, Trash2 } from "lucide-react";
import { AppModal } from "@/components/app-modal";
import { formatCurrency } from "@/lib/utils";
import { useAppData } from "@/lib/client/useAppData";
import { useSession } from "next-auth/react";

export default function SuppliersPage() {
  const { suppliers, addSupplier, updateSupplier, deleteSupplier } = useAppData();
  const { data: session } = useSession();
  const user = session?.user as any;
  const permissionKeys = new Set<string>(user?.permissions || []);
  const can = (permission: string) => user?.role === "Super Admin" || permissionKeys.has(permission);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState("");
  const [newSupplier, setNewSupplier] = useState({ name: "", contact: "", phone: "" });

  const handleSave = async () => {
    if (!newSupplier.name) return;
    try {
      if (editingSupplierId) {
        await updateSupplier({ ...newSupplier, id: editingSupplierId });
      } else {
        await addSupplier({ ...newSupplier, debt: 0 });
      }
      setShowModal(false);
      setEditingSupplierId("");
      setNewSupplier({ name: "", contact: "", phone: "" });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save supplier.");
    }
  };

  const openEdit = (supplier: any) => {
    setEditingSupplierId(supplier.id);
    setNewSupplier({ name: supplier.name, contact: supplier.contact || "", phone: supplier.phone === "-" ? "" : supplier.phone });
    setShowModal(true);
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.contact.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="page-heading">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl lg:text-3xl">Suppliers & Vendors</h1>
          <p className="text-slate-500 mt-1 uppercase text-[10px] font-black tracking-widest">Procurement Relationships</p>
        </div>
        <div className="flex items-center gap-3">
          {can("suppliers.create") && <button 
            onClick={() => {
              setEditingSupplierId("");
              setNewSupplier({ name: "", contact: "", phone: "" });
              setShowModal(true);
            }}
            className="page-action gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-900/20 hover:bg-indigo-500 active:scale-95 transition-all uppercase tracking-widest"
          >
            <Plus className="w-4 h-4" /> Add Supplier
          </button>}
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-zinc-800">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search suppliers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-xs transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-zinc-950/50 border-b border-slate-100 dark:border-zinc-800">
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">Supplier Name</th>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">Primary Contact</th>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">Phone</th>
                <th className="px-6 py-4 text-right text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">Total Debt</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredSuppliers.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors group cursor-pointer">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500">
                        <Truck className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight leading-4 max-w-[200px]">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-500">{s.contact}</td>
                  <td className="px-6 py-4 text-xs text-slate-400 font-mono">{s.phone}</td>
                   <td className="px-6 py-4 text-right font-black text-rose-600 dark:text-rose-400">
                    {formatCurrency(s.debt)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/suppliers/${s.id}`}
                        aria-label={`View ${s.name} details`}
                        className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      {can("suppliers.update") && (
                        <button onClick={() => openEdit(s)} className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-colors" aria-label={`Edit ${s.name}`}>
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                      {can("suppliers.delete") && (
                        <button onClick={() => window.confirm(`Archive ${s.name}?`) && deleteSupplier(s.id)} className="p-2 text-slate-600 hover:text-rose-600 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-colors" aria-label={`Archive ${s.name}`}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      <AppModal open={showModal} onClose={() => setShowModal(false)} labelledBy="supplier-modal-title">
              <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between shrink-0">
                <h3 id="supplier-modal-title" className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter">{editingSupplierId ? "Edit Supplier" : "Quick Add Supplier"}</h3>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4 overflow-y-auto min-h-0">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Supplier Name</label>
                  <input 
                    autoFocus
                    type="text" 
                    placeholder="Company or Individual Name" 
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold"
                    value={newSupplier.name}
                    onChange={(e) => setNewSupplier({...newSupplier, name: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Contact Person</label>
                  <input 
                    type="text" 
                    placeholder="Full Name" 
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    value={newSupplier.contact}
                    onChange={(e) => setNewSupplier({...newSupplier, contact: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Phone Number</label>
                  <input 
                    type="text" 
                    placeholder="+251..." 
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                    value={newSupplier.phone}
                    onChange={(e) => setNewSupplier({...newSupplier, phone: e.target.value})}
                  />
                </div>
              </div>
              <div className="p-6 bg-slate-50/50 dark:bg-zinc-950/50 flex gap-3 shrink-0 border-t border-slate-100 dark:border-zinc-800">
                <button 
                  onClick={() => setShowModal(false)}
                  className="btn-cancel flex-1"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-900/20 hover:bg-indigo-500 transition-all uppercase tracking-widest"
                >
                  {editingSupplierId ? "Update Supplier" : "Save Supplier"}
                </button>
              </div>
      </AppModal>
    </>
  );
}
