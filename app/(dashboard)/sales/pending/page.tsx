"use client";

import React, { useState } from "react";
import { useAppData } from "@/lib/client/useAppData";
import { BankAccountSelect, bankAccountsOnly, needsBankAccount } from "@/components/bank-account-select";
import { useToast } from "@/components/toast-provider";
import { formatItemChoiceLabel } from "@/lib/item-display";
import { isWalkInCustomer } from "@/lib/customer";

export default function PendingSalesPage() {
  const { pendingSales = [], bankAccounts = [], products = [], items = [], currentLocation, completePendingSale, cancelPendingSale } = useAppData();
  const toast = useToast();
  const [busyId, setBusyId] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [method, setMethod] = useState<"CASH" | "BANK" | "CREDIT">("CASH");

  const catalog = [...products, ...items];
  const waiting = pendingSales.filter((voucher: any) => voucher.status !== "CHECKING_OUT");

  const lineLabel = (line: any) => {
    const item = catalog.find((entry: any) => entry.id === line.itemId);
    const name = item ? formatItemChoiceLabel(item, currentLocation?.id) : "Medicine";
    return `${line.qty} × ${name}${item?.requiresPrescription ? " · Rx" : ""}`;
  };

  const checkout = async (voucher: any) => {
    if (method === "CREDIT" && isWalkInCustomer(voucher.customerId)) {
      toast.error("Credit needs a customer. This voucher is Walk-in. Choose Cash or Bank.");
      return;
    }
    if (needsBankAccount(method, method === "BANK" ? voucher.totalAmount : 0) && !bankAccountId) {
      toast.error("Select a bank account.");
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
      toast.success("Payment taken. The sale is recorded and the reserved stock is removed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Checkout failed.");
    } finally {
      setBusyId("");
    }
  };

  const cancel = async (voucher: any) => {
    const confirmed = window.confirm(
      `Cancel ${voucher.voucherCode}? The reserved stock goes back on the shelf. No sale and no payment are recorded.`,
    );
    if (!confirmed) return;
    setBusyId(voucher.id);
    try {
      await cancelPendingSale({ pendingSaleId: voucher.id });
      toast.success("Voucher cancelled. The stock is sellable again.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The voucher could not be cancelled.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Cashier queue</h1>
        <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500">
          Vouchers sent from New Sale wait here. The stock is reserved, so nobody else can sell it. Take payment to record the sale, or cancel to put the stock back.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Payment for the next voucher</p>
        <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
          Choose Cash, Bank, or Credit before you press Take payment. This is the only place the money is recorded.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
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
          {method === "CREDIT" ? (
            <p className="pb-2 text-xs font-medium text-slate-500">Credit needs a named customer. Walk-in cannot be used.</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        {waiting.map((voucher: any) => (
          <article key={voucher.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-mono text-sm font-black">{voucher.voucherCode}</p>
                <p className="mt-1 text-sm font-bold text-slate-700 dark:text-zinc-200">
                  {voucher.customerName || "Walk-in"} · ETB {Number(voucher.totalAmount).toLocaleString()}
                </p>
                <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-zinc-300">
                  {(voucher.lines || []).map((line: any, index: number) => (
                    <li key={`${voucher.id}-${line.itemId}-${index}`}>{lineLabel(line)}</li>
                  ))}
                </ul>
                {voucher.prescriptionNumber || voucher.patientName || voucher.prescriberName ? (
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    {[
                      voucher.prescriptionNumber ? `Prescription ${voucher.prescriptionNumber}` : "",
                      voucher.patientName ? `Patient ${voucher.patientName}` : "",
                      voucher.prescriberName ? `Prescriber ${voucher.prescriberName}` : "",
                    ].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" disabled={busyId === voucher.id} onClick={() => cancel(voucher)} className="rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-60">
                  Cancel
                </button>
                <button type="button" disabled={busyId === voucher.id} onClick={() => checkout(voucher)} className="rounded-xl bg-indigo-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-60">
                  Take payment
                </button>
              </div>
            </div>
          </article>
        ))}
        {waiting.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">No vouchers waiting.</p>
            <p className="mt-1 max-w-xl text-sm font-medium leading-6 text-slate-500">
              On New Sale, add the medicines and press Send to cashier. The voucher appears here with its stock held until you take payment or cancel.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
