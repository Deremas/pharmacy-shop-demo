"use client";

import React from "react";
import {
  ArrowRightLeft,
  Banknote,
  Calendar,
  Landmark,
  Save,
} from "lucide-react";
import { BankAccountSelect } from "@/components/bank-account-select";
import { useToast } from "@/components/toast-provider";
import { NumericInput } from "@/components/numeric-input";
import { formatCurrency } from "@/lib/utils";
import { isTenantBusiness, locationsForCurrentBusiness } from "@/lib/businesses";
import { calculateLocationCashBalance, useAppData } from "@/lib/client/useAppData";
import { useCan } from "@/lib/client/useCan";
import { updateDraftField, useBusinessDraft } from "@/lib/client/useBusinessDraft";

export default function CashToBankPage() {
  const state = useAppData();
  const can = useCan();
  const toast = useToast();
  const bankAccounts = state.bankAccounts.filter((account) => account.accountType === "BANK");
  const cashLocations = locationsForCurrentBusiness(state.currentLocation, state.locations).filter(isTenantBusiness);
  const locationId = state.currentLocation?.id || cashLocations[0]?.id || "";
  const { draft, setDraft, clearDraft } = useBusinessDraft("finance-cash-to-bank", () => ({
    bankAccountId: "",
    amount: 0,
    referenceNo: "",
  }));
  const bankAccountId = draft.bankAccountId || bankAccounts[0]?.id || "";
  const amount = draft.amount;
  const referenceNo = draft.referenceNo;
  const setBankAccountId = updateDraftField(setDraft, "bankAccountId");
  const setAmount = updateDraftField(setDraft, "amount");
  const setReferenceNo = updateDraftField(setDraft, "referenceNo");

  const availableCash = calculateLocationCashBalance(state, locationId);
  const selectedBank = bankAccounts.find((account) => account.id === bankAccountId);
  const recentTransfers = state.cashTransfers
    .filter((transfer) => transfer.locationId === locationId)
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const handleSubmit = async () => {
    const result = await state.addCashTransfer({
      locationId,
      bankAccountId,
      amount,
      referenceNo: referenceNo.trim() || `DEP-${Date.now()}`,
      date: new Date(),
    });

    if (!result.success) {
      toast.error({ title: "Deposit blocked", description: result.error });
      return;
    }

    toast.success({
      title: "Cash deposited",
      description: `${formatCurrency(amount)} moved to ${selectedBank?.displayName || "bank account"}.`,
    });
    clearDraft();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-20 font-sans animate-in fade-in slide-in-from-bottom-5 duration-500">
      <div className="page-heading">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/25">
            <ArrowRightLeft className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-950 dark:text-white sm:text-2xl lg:text-3xl">Cash To Bank</h1>
            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
              Deposit this business cash drawer to a bank account
            </p>
          </div>
        </div>
        {can("finance.cash_to_bank.create") ? (
          <button
            type="button"
            onClick={handleSubmit}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-indigo-500/30 transition hover:bg-indigo-500 active:scale-95"
          >
            <Save className="h-4 w-4" />
            Save Deposit
          </button>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-widest text-slate-600">Source Pharmacy</label>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-black text-slate-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white">
                {state.currentLocation?.name || cashLocations[0]?.name || "Current business"}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-widest text-slate-600">Destination Bank</label>
              <BankAccountSelect
                value={bankAccountId}
                onChange={setBankAccountId}
                accounts={bankAccounts}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-widest text-slate-600">Deposit Amount</label>
              <div className="relative">
                <Banknote className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                <NumericInput
                  value={amount}
                  onValueChange={setAmount}
                  className="h-auto min-h-14 w-full rounded-2xl bg-slate-50 py-4 pl-12 pr-4 text-xl font-black outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-zinc-950"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-widest text-slate-600">Slip / Reference</label>
              <input
                type="text"
                value={referenceNo}
                onChange={(event) => setReferenceNo(event.target.value)}
                placeholder="DEP-102938"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-800 dark:bg-zinc-950"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Available Location Cash</p>
            <p className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">{formatCurrency(availableCash)}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <InfoTile label="After Deposit" value={formatCurrency(Math.max(0, availableCash - amount))} />
              <InfoTile label="Bank Increase" value={formatCurrency(amount)} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex items-center gap-2">
              <Landmark className="h-4 w-4 text-slate-400" />
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-600">Recent Deposits</h2>
            </div>
            <div className="space-y-2">
              {recentTransfers.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-xs font-bold text-slate-400">No deposits recorded for this location.</p>
              ) : recentTransfers.map((transfer) => {
                const bank = bankAccounts.find((account) => account.id === transfer.bankAccountId);
                return (
                  <div key={transfer.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(transfer.amount)}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">{transfer.referenceNo}</p>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-slate-400">
                      <span>{bank?.displayName || "Bank account"}</span>
                      <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(transfer.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 dark:bg-zinc-950">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
