"use client";

import Link from "next/link";
import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar, CreditCard, MapPin, Package, ReceiptText, Truck } from "lucide-react";

import { useAppData } from "@/lib/client/useAppData";
import { useCan } from "@/lib/client/useCan";
import { BankAccountSelect, bankAccountsOnly } from "@/components/bank-account-select";
import { cn, formatCurrency } from "@/lib/utils";

export default function PurchaseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { purchases, suppliers, locations, items, bankAccounts, products, createPurchaseReturn } = useAppData();
  const can = useCan();
  const [qtyByLine, setQtyByLine] = useState<Record<string, string>>({});
  const [refundMethod, setRefundMethod] = useState("CASH");
  const [bankAccountId, setBankAccountId] = useState("");
  const [reason, setReason] = useState("");
  const [returnError, setReturnError] = useState("");
  const [returning, setReturning] = useState(false);
  const purchase = purchases.find((entry) => entry.id === params.id);

  if (!purchase) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-4 py-24 text-center">
        <ReceiptText className="h-12 w-12 text-slate-300" />
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Purchase not found</h1>
        <Link href="/purchases" className="rounded-xl bg-indigo-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white">
          Back to purchases
        </Link>
      </div>
    );
  }

  const supplier = suppliers.find((entry) => entry.id === purchase.supplierId);
  const location = locations.find((entry) => entry.id === purchase.locationId);
  const bankAccount = purchase.bankAccountId
    ? bankAccounts.find((entry) => entry.id === purchase.bankAccountId)
    : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="page-heading">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-600">Purchase Details</p>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">{purchase.id}</h1>
          </div>
        </div>
        <Link href="/purchases" className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
          Purchase list
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard icon={Truck} label="Supplier" value={supplier?.name ?? "-"} />
        <SummaryCard icon={Calendar} label="Date" value={new Date(purchase.purchaseDate).toLocaleDateString()} />
        <SummaryCard icon={MapPin} label="Location" value={location?.name ?? "-"} />
        <SummaryCard
          icon={CreditCard}
          label="Payment"
          value={purchase.paymentMethod}
          detail={[
            Number(purchase.cashAmount || 0) > 0 ? `Cash ${formatCurrency(purchase.cashAmount)}` : null,
            Number(purchase.bankAmount || 0) > 0 ? `Bank ${formatCurrency(purchase.bankAmount)}` : null,
            Number(purchase.debtAmount || 0) > 0 ? `Debt ${formatCurrency(purchase.debtAmount)}` : null,
          ].filter(Boolean).join(" · ") || undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-slate-100 px-6 py-5 dark:border-zinc-800">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Received Items</h2>
          </div>
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[720px] text-left">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-zinc-950 dark:text-zinc-400">
                <tr>
                  <th className="px-6 py-4 w-1/3 min-w-[220px]">Item</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4 text-right">Qty</th>
                  <th className="px-6 py-4 text-right">Buying Price</th>
                  <th className="px-6 py-4 text-right">Selling Price</th>
                  <th className="px-6 py-4 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {purchase.items.map((line) => {
                  const product = products?.find((p) => p.id === line.itemId);
                  const item = items.find((entry) => entry.id === line.itemId) || product;
                  const categoryName = item?.category || "General";
                  return (
                    <tr key={line.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/10 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-300">
                            <Package className="h-4.5 w-4.5" />
                          </div>
                          <span className="text-sm font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                            {item?.name ?? line.itemId}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 rounded-lg text-[9px] font-black uppercase tracking-widest border border-indigo-100/40 dark:border-indigo-900/30">
                          {categoryName}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-black">{line.qty}</td>
                      <td className="px-6 py-4 text-right text-sm font-bold text-slate-600 dark:text-zinc-300">{formatCurrency(line.unitCost)}</td>
                      <td className="px-6 py-4 text-right text-sm font-bold text-slate-600 dark:text-zinc-300">{formatCurrency(line.sellingPrice)}</td>
                      <td className="px-6 py-4 text-right text-sm font-black text-indigo-600">{formatCurrency(line.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-5 text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Payment Summary</h2>
          <div className="space-y-3">
            <MoneyRow label="Grand Total" value={purchase.totalAmount} highlight />
            <MoneyRow label="Cash" value={Number(purchase.cashAmount || 0)} />
            <MoneyRow label="Bank" value={Number(purchase.bankAmount || 0)} />
            <MoneyRow label="Paid" value={purchase.paidAmount} />
            <MoneyRow label="Supplier Debt" value={purchase.debtAmount} tone={purchase.debtAmount > 0 ? "warning" : "default"} />
            {bankAccount ? <InfoBlock label="Bank Account" value={`${bankAccount.displayName} (${bankAccount.bankName})`} /> : null}
          </div>
        </div>
      </div>
      {can("purchases.update") ? (
      <form
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        onSubmit={async (event) => {
          event.preventDefault();
          setReturning(true);
          setReturnError("");
          try {
            await createPurchaseReturn({
              purchaseId: purchase.id,
              reason,
              refundMethod,
              bankAccountId: refundMethod === "BANK" ? bankAccountId : undefined,
              lines: purchase.items
                .map((line) => ({ purchaseItemId: line.id, quantity: Number(qtyByLine[line.id] || 0) }))
                .filter((line) => line.quantity > 0),
            });
            setQtyByLine({});
            setReason("");
          } catch (error) {
            setReturnError(error instanceof Error ? error.message : "Return failed.");
          } finally {
            setReturning(false);
          }
        }}
      >
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Purchase return</h2>
        <p className="mt-1 text-xs font-semibold text-slate-500">Returned quantity leaves the original batch. Cash, bank, or mobile money comes back, or supplier debt goes down.</p>
        <div className="mt-4 space-y-2">
          {purchase.items.map((line) => {
            const product = products?.find((entry) => entry.id === line.itemId);
            return (
              <label key={line.id} className="flex items-center justify-between gap-3 text-sm font-bold">
                <span>{product?.name || line.itemName || "Medicine"} · received {line.qty}</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={qtyByLine[line.id] || ""}
                  onChange={(event) => setQtyByLine({ ...qtyByLine, [line.id]: event.target.value })}
                  placeholder="0"
                  className="h-10 w-24 rounded-xl border border-slate-200 px-3 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-xs font-black uppercase tracking-widest text-slate-500">
            Settlement
            <select value={refundMethod} onChange={(event) => setRefundMethod(event.target.value)} className="mt-1 block h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold dark:border-zinc-700 dark:bg-zinc-950">
              <option value="CASH">Cash back</option>
              <option value="BANK">Bank or mobile money</option>
              <option value="CREDIT">Reduce supplier debt</option>
            </select>
          </label>
          {refundMethod === "BANK" ? (
            <BankAccountSelect accounts={bankAccountsOnly(bankAccounts)} value={bankAccountId} onChange={setBankAccountId} />
          ) : null}
          <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason" className="h-11 min-w-48 flex-1 rounded-xl border border-slate-200 px-3 text-sm font-bold dark:border-zinc-700 dark:bg-zinc-950" />
          <button type="submit" disabled={returning} className="h-11 rounded-xl bg-indigo-600 px-4 text-[10px] font-black uppercase tracking-widest text-white">Save return</button>
        </div>
        {returnError ? <p className="mt-3 text-sm font-bold text-rose-600">{returnError}</p> : null}
      </form>
      ) : null}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, detail }: { icon: any; label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <Icon className="mb-3 h-5 w-5 text-indigo-600" />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-slate-900 dark:text-white">{value}</p>
      {detail ? <p className="mt-1 text-[10px] font-bold text-slate-400">{detail}</p> : null}
    </div>
  );
}

function MoneyRow({ label, value, tone = "default", highlight = false }: { label: string; value: number; tone?: "default" | "warning"; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{label}</span>
      <span className={cn("text-sm font-black", highlight && "text-xl text-indigo-600", tone === "warning" && "text-amber-600", tone === "default" && !highlight && "text-slate-900 dark:text-white")}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 dark:bg-zinc-950">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-xs font-bold text-slate-700 dark:text-zinc-300">{value}</p>
    </div>
  );
}
