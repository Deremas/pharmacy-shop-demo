"use client";

import React, { useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, AlertCircle, ShieldAlert } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { NumericInput } from "@/components/numeric-input";
import { formatCurrency } from "@/lib/utils";
import { useAppData } from "@/lib/client/useAppData";
import { SearchableSelect } from "@/components/searchable-select";
import { BankAccountSelect } from "@/components/bank-account-select";
import { unpaidCreditSales } from "@/lib/finance/credit-ledger";
import { useBusinessDraft } from "@/lib/client/useBusinessDraft";

function CreditPayForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { customers, sales, customerPayments, bankAccounts, settleCredit, currentLocation } = useAppData();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emptyCreditForm = () => ({
    customerId: "",
    saleId: "",
    scope: "ALL" as "ALL" | "SALE",
    amount: 0,
    method: "CASH" as "CASH" | "BANK",
    bankAccountId: "",
    note: "",
    date: new Date().toISOString().split("T")[0],
  });
  const { draft: formData, setDraft: setFormData, clearDraft } = useBusinessDraft("customers-credits", emptyCreditForm);

  const bankOptions = useMemo(
    () => (bankAccounts || []).filter((account: any) => account.accountType === "BANK"),
    [bankAccounts],
  );
  const paymentAllocations = useMemo(
    () => (customerPayments || []).flatMap((payment: any) => payment.allocations || []),
    [customerPayments],
  );

  React.useEffect(() => {
    const customerId = searchParams.get("customerId") || "";
    const saleId = searchParams.get("saleId") || "";
    if (!customerId) return;
    const cust = customers.find((c) => c.id === customerId);
    const unpaid = unpaidCreditSales(customerId, sales, customerPayments, paymentAllocations);
    const sale = saleId ? unpaid.find((s) => s.saleId === saleId) : null;
    setFormData({
      customerId,
      saleId: saleId || "",
      scope: saleId ? "SALE" : "ALL",
      amount: sale ? sale.outstandingAmount : cust?.balance || 0,
      method: "CASH",
      bankAccountId: bankOptions[0]?.id || "",
      note: saleId ? "Credit settlement for selected sale" : "Customer credit settlement",
      date: new Date().toISOString().split("T")[0],
    });
  }, [searchParams, customers, sales, customerPayments, paymentAllocations, bankOptions, setFormData]);

  const activeCustomers = useMemo(() => customers.filter((c) => c.balance > 0), [customers]);
  const searchableCustomers = useMemo(
    () => activeCustomers.map((c) => ({ value: c.id, label: c.name, meta: `Outstanding: ${formatCurrency(c.balance)}` })),
    [activeCustomers],
  );
  const selectedCustomer = useMemo(() => customers.find((c) => c.id === formData.customerId), [customers, formData.customerId]);
  const selectedUnpaidSales = useMemo(() => {
    if (!formData.customerId) return [];
    return unpaidCreditSales(formData.customerId, sales, customerPayments, paymentAllocations);
  }, [formData.customerId, sales, customerPayments, paymentAllocations]);
  const selectedSale = useMemo(
    () => selectedUnpaidSales.find((sale) => sale.saleId === formData.saleId) || null,
    [selectedUnpaidSales, formData.saleId],
  );
  const selectedBalance = formData.scope === "SALE" ? selectedSale?.outstandingAmount || 0 : selectedCustomer?.balance || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerId || formData.amount <= 0) return;
    if (formData.scope === "SALE" && !formData.saleId) {
      setError("Select an unpaid sale to settle.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const res = await settleCredit({
        customerId: formData.customerId,
        saleId: formData.scope === "SALE" ? formData.saleId : null,
        amount: formData.amount,
        method: formData.method,
        bankAccountId: formData.method === "BANK" ? formData.bankAccountId : undefined,
        locationId: currentLocation?.id,
        date: new Date(formData.date),
        note: formData.note || "Settle Customer Credit",
      });
      toast.success(res.message || "Customer credit settled successfully.");
      clearDraft();
      router.push("/customers/credits");
    } catch (err: any) {
      setError(err?.message || "Failed to record customer credit payment.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div>
        <Link href="/customers/credits" className="mb-2 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600">
          <ArrowLeft className="h-4 w-4" /> Customer Credits
        </Link>
        <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          <ShieldAlert className="h-7 w-7 text-indigo-600" />
          Record Credit Payment
        </h1>
        <p className="mt-1 text-sm text-slate-500">Settle one unpaid sale or all outstanding credit.</p>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4 dark:border-rose-900/30 dark:bg-rose-950/20">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
            <div className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Customer</label>
          <SearchableSelect
            placeholder="Choose customer to pay..."
            value={formData.customerId}
            onChange={(val) => {
              const cust = customers.find((c) => c.id === val);
              setFormData((prev) => ({
                ...prev,
                customerId: val,
                saleId: "",
                scope: "ALL",
                amount: cust ? cust.balance : 0,
              }));
            }}
            options={searchableCustomers}
          />
          {selectedCustomer && (
            <p className="text-[10px] font-bold text-indigo-500">
              Current Outstanding Credit: {formatCurrency(selectedCustomer.balance)}
            </p>
          )}
        </div>

        {selectedCustomer && (
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Settlement Scope</label>
            <select
              value={formData.scope}
              onChange={(e) => {
                const scope = e.target.value as "ALL" | "SALE";
                setFormData((prev) => ({
                  ...prev,
                  scope,
                  saleId: scope === "ALL" ? "" : prev.saleId,
                  amount: scope === "ALL" ? selectedCustomer.balance || 0 : selectedSale?.outstandingAmount || 0,
                }));
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="ALL">All outstanding sales ({formatCurrency(selectedCustomer.balance || 0)})</option>
              <option value="SALE">Individual unpaid sale</option>
            </select>
            {formData.scope === "SALE" && (
              <select
                required
                value={formData.saleId}
                onChange={(e) => {
                  const nextSale = selectedUnpaidSales.find((sale) => sale.saleId === e.target.value);
                  setFormData((prev) => ({
                    ...prev,
                    saleId: e.target.value,
                    amount: nextSale?.outstandingAmount || 0,
                  }));
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <option value="">Select unpaid sale</option>
                {selectedUnpaidSales.map((sale) => (
                  <option key={sale.saleId} value={sale.saleId}>
                    {(sale.saleDate ? new Date(sale.saleDate).toLocaleDateString() : "Sale")} · outstanding {formatCurrency(sale.outstandingAmount)}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {selectedCustomer && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Amount Collected</label>
              <NumericInput
                required
                value={formData.amount}
                onValueChange={(amount) => setFormData((prev) => ({ ...prev, amount }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
              />
              <p className="text-[9px] font-bold text-slate-400">Up to {formatCurrency(selectedBalance)}.</p>
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
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Payment Method</label>
            <select
              value={formData.method}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  method: e.target.value as "CASH" | "BANK",
                  bankAccountId: e.target.value === "BANK" ? bankOptions[0]?.id || "" : "",
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
                accounts={bankOptions}
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
          <Link href="/customers/credits" className="btn-cancel">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={
              isSaving ||
              !formData.customerId ||
              formData.amount <= 0 ||
              formData.amount > selectedBalance ||
              (formData.scope === "SALE" && !formData.saleId) ||
              (formData.method === "BANK" && !formData.bankAccountId)
            }
            className="rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 disabled:bg-slate-700 dark:disabled:bg-zinc-800"
          >
            {isSaving ? "Settling..." : "Settle Customer Credit"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function CreditPayPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm font-bold text-slate-500">Loading...</div>}>
      <CreditPayForm />
    </Suspense>
  );
}
