"use client";

import React, { useState } from "react";
import { 
  Plus, 
  MapPin, 
  Store, 
  MoreHorizontal, 
  X, 
  Warehouse 
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useAppData } from "@/lib/client/useAppData";
import { motion, AnimatePresence } from "motion/react";

export default function LocationsPage() {
  const { locations, availableLocations, addLocation, reportData, items, sales } = useAppData();
  const businesses = availableLocations?.length ? availableLocations : locations;
  const catalogItems = reportData?.items || items;
  const catalogSales = reportData?.sales || sales;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "BUSINESS" as "BUSINESS",
    location: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await addLocation(formData);
      setIsModalOpen(false);
      setFormData({ name: "", type: "BUSINESS", location: "" });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add location.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="space-y-8 animate-in fade-in duration-500 font-sans p-4 md:p-6 pb-20">
        <div className="page-heading">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Pharmacies</h1>
            <p className="text-slate-600 dark:text-zinc-400 text-sm font-bold uppercase tracking-widest mt-1 font-black text-[10px]">Three pharmacy branches. Switch in the top bar to work in one.</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-[1.5rem] text-sm font-black shadow-xl shadow-indigo-900/30 hover:bg-indigo-500 active:scale-95 transition-all uppercase tracking-widest"
          >
            <Plus className="w-5 h-5 font-bold" />
            ADD PHARMACY
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {businesses.map((location: any) => {
            const locationItems = catalogItems.filter((i: any) => i.locationId === location.id);
            const totalStock = locationItems.reduce((acc: number, i: any) => acc + (i.stock || 0), 0);
            const locationSales = catalogSales.filter((s: any) => s.locationId === location.id);
            const dailyRevenue = locationSales.reduce((acc: number, s: any) => acc + (s.totalAmount || 0), 0);

            return (
              <div key={location.id} className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-slate-200 dark:border-zinc-800 p-8 shadow-sm group hover:shadow-2xl hover:shadow-indigo-500/5 transition-all duration-300 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6">
                  <button className="p-2 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl">
                    <MoreHorizontal className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                
                <div className="flex items-start gap-6">
                  <div className={cn(
                    "w-16 h-16 rounded-[1.5rem] flex items-center justify-center border transition-transform group-hover:scale-110 group-hover:rotate-6",
                    location.type === 'STORE' ? "bg-amber-500/10 border-amber-500/20 text-amber-600" : "bg-indigo-500/10 border-indigo-500/20 text-indigo-600"
                  )}>
                    {location.type === 'STORE' ? <Warehouse className="w-8 h-8" /> : <Store className="w-8 h-8" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">{location.name}</h3>
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-[0.2em] leading-none text-white",
                        location.type === "BUSINESS" ? "bg-indigo-600" : location.type === "STORE" ? "bg-amber-600" : "bg-slate-900"
                      )}>
                        {location.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 text-slate-400 font-bold uppercase text-[10px]">
                      <MapPin className="w-3.5 h-3.5" />
                      <p className="tracking-widest">{location.id.toUpperCase()} - LOCATION</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-10">
                  <div className="p-4 bg-slate-50 dark:bg-zinc-950/50 rounded-2xl border border-slate-100 dark:border-zinc-800">
                    <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-1 leading-none">Sku Count</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white leading-none tracking-tighter">{locationItems.length}</p>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-zinc-950/50 rounded-2xl border border-slate-100 dark:border-zinc-800">
                    <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-1 leading-none">Total Stock</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white leading-none tracking-tighter">{totalStock}</p>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-zinc-950/50 rounded-2xl border border-slate-100 dark:border-zinc-800">
                    <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-1 leading-none">Revenue</p>
                    <p className="text-md font-black font-mono text-emerald-600 leading-none">{formatCurrency(dailyRevenue)}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-8 pt-8 border-t border-slate-50 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase">
                      SYS
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest leading-none">Lead Manager</p>
                      <p className="text-xs font-bold text-slate-700 dark:text-zinc-300 mt-1 uppercase">Automated Oversight</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Active Location</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain flex justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-white/60 dark:bg-zinc-950/60 backdrop-blur-md"
            />
            <motion.form 
              onSubmit={handleSubmit}
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-xl max-h-[90vh] flex flex-col bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-zinc-800 my-auto max-h-[min(92dvh,calc(100dvh-2rem))] overflow-y-auto"
            >
              <div className="p-8 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between shrink-0">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Add New Pharmacy</h2>
                  <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest mt-1">Each pharmacy has its own stock, sales, and finance</p>
                </div>
                <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="p-8 space-y-6 overflow-y-auto min-h-0">
                <div className="space-y-4 font-bold">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest px-1">Pharmacy Name</label>
                    <input 
                      type="text"
                      required
                      placeholder="e.g. Bole Pharmacy"
                      className="w-full px-5 py-3.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl text-xs font-black outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all uppercase"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest px-1">Type</label>
                    <div className="px-5 py-3.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600">
                      Pharmacy Branch
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest px-1">Geographic Location</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text"
                        placeholder="Addis Ababa, ..."
                        className="w-full pl-12 pr-5 py-3.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl text-xs font-black outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                        value={formData.location}
                        onChange={e => setFormData({ ...formData, location: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-slate-50/50 dark:bg-zinc-950/50 flex gap-4 shrink-0 border-t border-slate-100 dark:border-zinc-800">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-cancel flex-1 px-6 py-4"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={saving}
                  className="flex-[2] bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-[1.5rem] py-5 font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  {saving ? "CREATING..." : "CREATE BUSINESS"}
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
