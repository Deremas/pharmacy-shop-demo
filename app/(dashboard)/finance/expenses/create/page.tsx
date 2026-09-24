"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Wallet, Banknote, ChevronDown, X } from "lucide-react";
import { AppModal } from "@/components/app-modal";
import { NumericInput } from "@/components/numeric-input";
import { cn } from "@/lib/utils";
import { useAppData } from "@/lib/client/useAppData";
import { BankAccountSelect } from "@/components/bank-account-select";
import { useBusinessDraft } from "@/lib/client/useBusinessDraft";

export default function CreateExpensePage() {
  const router = useRouter();
  const { expenses, expenseCategories = [], addExpense, addExpenseCategory, bankAccounts, currentLocation } = useAppData();
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [saving, setSaving] = useState(false);

  const emptyExpense = () => ({
    category: "",
    amount: 0,
    description: "",
    paymentMethod: "CASH" as "CASH" | "BANK",
    bankAccountId: "",
  });
  const { draft: formData, setDraft: setFormData, clearDraft } = useBusinessDraft("finance-expenses", emptyExpense);

  const categoryOptions = React.useMemo<string[]>(() => {
    const names = new Set<string>();
    for (const category of expenseCategories) {
      const name = String(category?.name || "").trim();
      if (name) names.add(name);
    }
    for (const expense of expenses || []) {
      const name = String(expense?.category || "").trim();
      if (name) names.add(name);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [expenseCategories, expenses]);

  const handleSave = async () => {
    if (!formData.category || formData.amount <= 0 || !currentLocation?.id) return;
    if (formData.paymentMethod === "BANK" && !formData.bankAccountId) {
      alert("Please select a bank account for this expense.");
      return;
    }
    setSaving(true);
    try {
      await addExpense({
        ...formData,
        locationId: currentLocation.id,
        date: new Date(),
      });
      clearDraft();
      router.push("/finance/expenses");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to record expense.");
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name || savingCategory) return;
    setSavingCategory(true);
    try {
      const result = await addExpenseCategory({ name });
      setFormData({ ...formData, category: result?.name || name });
      setShowCategoryModal(false);
      setNewCategoryName("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add category.");
    } finally {
      setSavingCategory(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="page-heading">
        <div>
          <Link href="/finance/expenses" className="mb-2 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-rose-600">
            <ArrowLeft className="h-4 w-4" /> Expenses
          </Link>
          <h1 className="flex items-center gap-2 text-xl font-black tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            <Wallet className="h-6 w-6 text-rose-500" />
            Record Expense
          </h1>
          <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-400">
            {currentLocation?.name || "Current business"}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="space-y-1.5">
          <label className="px-1 text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Charge To</label>
          <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-widest dark:border-zinc-800 dark:bg-zinc-950">
            {currentLocation?.name || "Current business"}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Category</label>
              <button type="button" onClick={() => setShowCategoryModal(true)} className="rounded-lg px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20">
                + New
              </button>
            </div>
            <div className="relative">
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-10 text-sm font-bold outline-none transition-all focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <option value="">Select category</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Amount (ETB)</label>
            <NumericInput
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm font-bold text-rose-600 outline-none transition-all focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 dark:border-zinc-800 dark:bg-zinc-950"
              value={formData.amount}
              onValueChange={(amount) => setFormData({ ...formData, amount })}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Description</label>
          <textarea
            placeholder="What was this for?"
            rows={3}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-all focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 dark:border-zinc-800 dark:bg-zinc-950"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Payment Method</label>
          <div className="grid grid-cols-2 gap-2">
            {(["CASH", "BANK"] as const).map((method) => (
              <button
                key={method}
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    paymentMethod: method,
                    bankAccountId:
                      method === "BANK"
                        ? formData.bankAccountId ||
                          bankAccounts.find((account) => String(account.accountType || "").toUpperCase() !== "CASH")?.id ||
                          ""
                        : "",
                  })
                }
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[10px] font-bold transition-all",
                  formData.paymentMethod === method
                    ? "border-rose-600 bg-rose-600 text-white shadow-lg shadow-rose-900/20"
                    : "border-slate-200 bg-slate-50 text-slate-600 dark:border-zinc-800 dark:bg-zinc-950",
                )}
              >
                {method === "CASH" ? <Banknote className="h-3 w-3" /> : <Wallet className="h-3 w-3" />}
                {method}
              </button>
            ))}
          </div>
        </div>

        {formData.paymentMethod === "BANK" && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Withdraw From</label>
            <BankAccountSelect
              value={formData.bankAccountId}
              onChange={(bankAccountId) => setFormData({ ...formData, bankAccountId })}
              accounts={bankAccounts}
            />
          </div>
        )}

        <div className="flex gap-3 border-t border-slate-100 pt-5 dark:border-zinc-800">
          <Link href="/finance/expenses" className="btn-cancel flex-1 text-center">
            Cancel
          </Link>
          <button
            type="button"
            disabled={saving || !formData.category || formData.amount <= 0}
            onClick={() => void handleSave()}
            className="flex-1 rounded-xl bg-rose-600 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-rose-900/20 transition-all hover:bg-rose-500 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Confirm Expense"}
          </button>
        </div>
      </div>

      <AppModal
        open={showCategoryModal}
        onClose={() => {
          if (savingCategory) return;
          setShowCategoryModal(false);
        }}
        labelledBy="expense-category-modal-title"
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-zinc-800">
          <h3 id="expense-category-modal-title" className="text-lg font-black uppercase tracking-tighter text-slate-900 dark:text-white">
            Quick Add Category
          </h3>
          <button type="button" onClick={() => setShowCategoryModal(false)} className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-zinc-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-6">
          <input
            autoFocus
            value={newCategoryName}
            placeholder="e.g. Rent"
            onChange={(event) => setNewCategoryName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleQuickAddCategory();
              }
            }}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-rose-500 dark:border-zinc-800 dark:bg-zinc-900"
          />
        </div>
        <div className="flex gap-3 border-t border-slate-100 bg-slate-50/50 p-6 dark:border-zinc-800 dark:bg-zinc-950/50">
          <button type="button" onClick={() => setShowCategoryModal(false)} className="btn-cancel flex-1">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleQuickAddCategory()}
            disabled={!newCategoryName.trim() || savingCategory}
            className="flex-1 rounded-xl bg-rose-600 py-3 text-xs font-black uppercase tracking-widest text-white disabled:opacity-50"
          >
            {savingCategory ? "Saving..." : "Create & Select"}
          </button>
        </div>
      </AppModal>
    </div>
  );
}
