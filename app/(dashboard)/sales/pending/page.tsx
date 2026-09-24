"use client";

import React, { useState } from "react";
import { useAppData } from "@/lib/client/useAppData";
import { BankAccountSelect, bankAccountsOnly, needsBankAccount } from "@/components/bank-account-select";

export default function PendingSalesPage() {
  const { pendingSales = [], bankAccounts = [], products = [], items = [], completePendingSale, cancelPendingSale } = useAppData();
  const [busyId, setBusyId] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [method, setMethod] = useState<"CASH" | "BANK" | "CREDIT">("CASH");

  const checkout = async (voucher: any) => {
    if (needsBankAccount(method, method === "BANK" ? voucher.totalAmount : 0) && !bankAccountId) {
      window.alert("Select a bank account.");
      return;
    }
    setBusyId(voucher.id);
    try {
      await completePendingSale({
        pendingSaleId: voucher.id,
        paymentMethod: method,
        cashAmount: method === "CASH" ? voucher.totalAmount : 0,
        bankAmount: method === "BANK" ? voucher.totalAmount : 0,
        creditAmount: method === "CREDIT" ? voucher.totalAmount : 0,
        bankAccountId: method === "BANK" ? bankAccountId : undefined,
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Checkout failed.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Cashier queue</h1>
        <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-500">Pharmacist vouchers with stock reserved.</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-black uppercase tracking-widest text-slate-500">
          Payment
          <select value={method} onChange={(event) => setMethod(event.target.value as "CASH" | "BANK" | "CREDIT")} className="mt-1 block h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold dark:border-zinc-700 dark:bg-zinc-950">
            <option value="CASH">Cash</option>
            <option value="BANK">Bank</option>
            <option value="CREDIT">Credit</option>
          </select>
        </label>
        {method === "BANK" ? (
          <BankAccountSelect accounts={bankAccountsOnly(bankAccounts)} value={bankAccountId} onChange={setBankAccountId} />
        ) : null}
      </div>
      <div className="space-y-3">
        {pendingSales.map((voucher: any) => (
          <article key={voucher.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-black">{voucher.voucherCode}</p>
                <p className="text-xs font-bold text-slate-500">{voucher.customerName || "Walk-in"} · ETB {Number(voucher.totalAmount).toLocaleString()}{voucher.patientName ? ` · ${voucher.patientName}` : ""}</p>
                <p className="mt-1 text-xs text-slate-600">{(voucher.lines || []).map((line: any) => {
                  const item = [...products, ...items].find((entry: any) => entry.id === line.itemId);
                  return `${line.qty} × ${item?.name || "Medicine"}`;
                }).join(", ")}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={busyId === voucher.id} onClick={() => cancelPendingSale({ pendingSaleId: voucher.id })} className="rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest">Cancel</button>
                <button type="button" disabled={busyId === voucher.id} onClick={() => checkout(voucher)} className="rounded-xl bg-indigo-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white">Take payment</button>
              </div>
            </div>
          </article>
        ))}
        {pendingSales.length === 0 ? <p className="text-sm font-bold text-slate-500">No vouchers waiting.</p> : null}
      </div>
    </div>
  );
}
