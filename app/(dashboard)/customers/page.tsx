"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Plus, Search, Mail, Phone, Eye, X, Edit3, Trash2 } from "lucide-react";
import { AppModal } from "@/components/app-modal";
import { cn, formatCurrency } from "@/lib/utils";
import { useAppData } from "@/lib/client/useAppData";
import { useSession } from "next-auth/react";

export default function CustomersPage() {
  const { customers, addCustomer, updateCustomer, deleteCustomer } = useAppData();
  const { data: session } = useSession();
  const user = session?.user as any;
  const permissionKeys = new Set<string>(user?.permissions || []);
  const can = (permission: string) => user?.role === "Super Admin" || permissionKeys.has(permission);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState("");
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", email: "", allowCredit: true, creditLimit: "" });

  const handleSave = async () => {
    if (!newCustomer.name) return;
    try {
      if (editingCustomerId) {
        await updateCustomer({ ...newCustomer, id: editingCustomerId });
      } else {
        await addCustomer({ ...newCustomer, balance: 0 });
      }
      setShowModal(false);
      setEditingCustomerId("");
      setNewCustomer({ name: "", phone: "", email: "", allowCredit: true, creditLimit: "" });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save customer.");
    }
  };

  const openEdit = (customer: any) => {
    setEditingCustomerId(customer.id);
    setNewCustomer({
      name: customer.name,
      phone: customer.phone === "-" ? "" : customer.phone,
      email: customer.email || "",
      allowCredit: customer.allowCredit !== false,
      creditLimit: customer.creditLimit == null ? "" : String(customer.creditLimit),
    });
    setShowModal(true);
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.phone.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="page-heading">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl lg:text-3xl">Customers</h1>
          <p className="text-slate-500 mt-1 uppercase text-[10px] font-black tracking-widest text-left">Centralized Client Management</p>
        </div>
        <div className="flex items-center gap-3">
          {can("customers.create") && <button 
            onClick={() => {
              setEditingCustomerId("");
              setNewCustomer({ name: "", phone: "", email: "", allowCredit: true, creditLimit: "" });
              setShowModal(true);
            }}
            className="page-action gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-900/20 hover:bg-indigo-500 active:scale-95 transition-all uppercase tracking-widest"
          >
            <Plus className="w-4 h-4" /> Add Customer
          </button>}
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 text-xs transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-zinc-950/50 border-b border-slate-100 dark:border-zinc-800">
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">Customer</th>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">Contact</th>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">Credit</th>
                <th className="px-6 py-4 text-right text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">Outstanding</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredCustomers.map((cur) => (
                <tr key={cur.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors group cursor-pointer">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 font-black text-xs uppercase tracking-widest transition-colors">
                        {cur.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{cur.name}</h4>
                        <p className="text-[10px] font-mono text-slate-400">{cur.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500"><Mail className="w-3 h-3" /> {cur.email}</div>
                      <div className="flex items-center gap-2 text-xs text-slate-500"><Phone className="w-3 h-3" /> {cur.phone}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded bg-slate-100 dark:bg-zinc-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                      {cur.allowCredit === false ? "Blocked" : cur.creditLimit == null ? "Open" : formatCurrency(cur.creditLimit)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-black text-sm">
                    <span className={cn(cur.balance > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600")}>
                      {formatCurrency(cur.balance)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/customers/${cur.id}`}
                        aria-label={`View ${cur.name} details`}
                        className="p-2 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-colors text-slate-400 hover:text-indigo-600"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      {can("customers.update") && (
                        <button onClick={() => openEdit(cur)} className="p-2 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-colors text-slate-400 hover:text-indigo-600" aria-label={`Edit ${cur.name}`}>
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                      {can("customers.delete") && (
                        <button onClick={() => window.confirm(`Archive ${cur.name}?`) && deleteCustomer(cur.id)} className="p-2 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-colors text-slate-400 hover:text-rose-600" aria-label={`Archive ${cur.name}`}>
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

      <AppModal open={showModal} onClose={() => setShowModal(false)} labelledBy="customer-modal-title">
              <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between shrink-0">
                <h3 id="customer-modal-title" className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter">{editingCustomerId ? "Edit Customer" : "Quick Add Customer"}</h3>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4 overflow-y-auto min-h-0">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Customer Name</label>
                  <input 
                    autoFocus
                    type="text" 
                    placeholder="Full Name" 
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Phone Number</label>
                  <input 
                    type="text" 
                    placeholder="+251..." 
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={newCustomer.allowCredit}
                      onChange={(e) => setNewCustomer({ ...newCustomer, allowCredit: e.target.checked })}
                    />
                    Allow credit
                  </label>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Credit limit</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="No limit"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                      value={newCustomer.creditLimit}
                      onChange={(e) => setNewCustomer({ ...newCustomer, creditLimit: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Email Address</label>
                  <input 
                    type="email" 
                    placeholder="customer@example.com" 
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
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
                  {editingCustomerId ? "Update Customer" : "Save Customer"}
                </button>
              </div>
      </AppModal>
    </>
  );
}
