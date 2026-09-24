"use client";

import React, { useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, AlertCircle, Landmark } from "lucide-react";
import { NumericInput } from "@/components/numeric-input";
import { formatCurrency } from "@/lib/utils";
import { useAppData } from "@/lib/client/useAppData";
import { SearchableSelect } from "@/components/searchable-select";
import { BankAccountSelect } from "@/components/bank-account-select";
import { useBusinessDraft } from "@/lib/client/useBusinessDraft";
import { useToast } from "@/components/toast-provider";

function SupplierPayForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { suppliers, bankAccounts, addSupplierPayment, currentLocation } = useAppData();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emptyDebtForm = () => ({
    supplierId: "",
    amount: 0,
    method: "CASH" as "CASH" | "BANK",
    bankAccountId: "",
    note: "",
    date: new Date().toISOString().split("T")[0],
  });
  const { draft: formData, setDraft: setFormData, clearDraft } = useBusinessDraft("suppliers-debts", emptyDebtForm);

  React.useEffect(() => {
    const supplierId = searchParams.get("supplierId") || "";
    if (!supplierId) return;
    const supplier = suppliers.find((s) => s.id === supplierId);
    setFormData({
      supplierId,
      amount: supplier?.debt || 0,
      method: "CASH",
      bankAccountId: bankAccounts[0]?.id || "",
      note: "Debt settlement payment",
      date: new Date().toISOString().split("T")[0],
    });
  }, [searchParams, suppliers, bankAccounts, setFormData]);

  const activeSuppliers = useMemo(() => suppliers.filter((s) => s.debt > 0), [suppliers]);
  const searchableSuppliers = useMemo(
    () => activeSuppliers.map((s) => ({ value: s.id, label: s.name, meta: `Outstanding: ${formatCurrency(s.debt)}` })),
    [activeSuppliers],
  );
  const selectedSupplier = useMemo(() => suppliers.find((s) => s.id === formData.supplierId), [suppliers, formData.supplierId]);
  const maxPayable = selectedSupplier?.debt || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.supplierId || formData.amount <= 0) return;
    const currentDebt = suppliers.find((s) => s.id === formData.supplierId)?.debt || 0;
    const finalAmount = Math.min(formData.amount, currentDebt);
    if (finalAmount <= 0) {
      setError("This supplier has no outstanding debt.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await addSupplierPayment({
        supplierId: formData.supplierId,
        amount: finalAmount,
        method: formData.method,
        bankAccountId: formData.method === "BANK" ? formData.bankAccountId : undefined,
        locationId: currentLocation?.id,
        date: new Date(formData.date),
        note: formData.note || undefined,
      });
      toast.success(`Payment of ${formatCurrency(finalAmount)} recorded.`);
      clearDraft();
      router.push("/suppliers/debts");
    } catch (err: any) {
      setError(err?.message || "Failed to record supplier payment.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div>
        <Link href="/suppliers/debts" className="mb-2 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600">
          <ArrowLeft className="h-4 w-4" /> Supplier Debts
        </Link>
        <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          <Landmark className="h-7 w-7 text-indigo-600" />
          Record Supplier Payment
        </h1>
        <p className="mt-1 text-sm text-slate-500">Settle outstanding payables.</p>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4 dark:border-rose-900/30 dark:bg-rose-950/20">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
            <div className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Supplier</label>
          <SearchableSelect
            placeholder="Choose supplier to pay..."
            value={formData.supplierId}
            onChange={(val) => {
              const supp = suppliers.find((s) => s.id === val);
              setFormData((prev) => ({ ...prev, supplierId: val, amount: supp ? supp.debt : 0 }));
            }}
            options={searchableSuppliers}
          />
          {selectedSupplier && (
            <p className="text-[10px] font-bold text-indigo-500">Max Payable: {formatCurrency(maxPayable)}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Payment Amount</label>
            <NumericInput
              required
              value={formData.amount}
              onValueChange={(amount) => {
                const clamped = maxPayable > 0 ? Math.min(maxPayable, amount) : amount;
                setFormData((prev) => ({ ...prev, amount: clamped }));
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Payment Date</label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Payment Method</label>
            <select
              value={formData.method}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  method: e.target.value as "CASH" | "BANK",
                  bankAccountId: e.target.value === "BANK" ? bankAccounts[0]?.id || "" : "",
                })
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="CASH">Cash Drawer</option>
              <option value="BANK">Bank Account</option>
            </select>
          </div>
          {formData.method === "BANK" && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Bank Account</label>
              <BankAccountSelect
                value={formData.bankAccountId}
                onChange={(bankAccountId) => setFormData({ ...formData, bankAccountId })}
                accounts={bankAccounts}
              />
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Note</label>
          <input
            type="text"
            value={formData.note}
            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
            placeholder="Memo details..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
          />
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-zinc-800">
          <Link href="/suppliers/debts" className="btn-cancel">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSaving || !formData.supplierId || formData.amount <= 0 || (formData.method === "BANK" && !formData.bankAccountId)}
            className="rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 disabled:bg-slate-700 dark:disabled:bg-zinc-800"
          >
            {isSaving ? "Processing..." : "Submit Payment"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function SupplierPayPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm font-bold text-slate-500">Loading...</div>}>
      <SupplierPayForm />
    </Suspense>
  );
}
