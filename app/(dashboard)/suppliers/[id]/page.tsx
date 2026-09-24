"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, ChevronDown, AlertCircle, Package, Phone, Receipt, ShoppingBag, Truck, UserRound, WalletCards } from "lucide-react";
import { NumericInput } from "@/components/numeric-input";
import { cn, formatCurrency } from "@/lib/utils";
import { useAppData } from "@/lib/client/useAppData";
import { BankAccountSelect } from "@/components/bank-account-select";
import { useBusinessDraft } from "@/lib/client/useBusinessDraft";

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const { suppliers, purchases, supplierPayments, items, bankAccounts, addSupplierPayment, currentLocation } = useAppData();
  const supplier = suppliers.find(s => s.id === decodeURIComponent(params.id));
  const { draft: paymentData, setDraft: setPaymentData, clearDraft } = useBusinessDraft(
    `supplier-pay:${decodeURIComponent(params.id)}`,
    () => ({ amount: 0, method: "CASH" as "CASH" | "BANK", bankId: "" }),
  );
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [paySuccess, setPaySuccess] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  const detailPurchases = useMemo(() => supplier ? purchases.filter(p => p.supplierId === supplier.id) : [], [supplier, purchases]);
  const detailPayments = useMemo(() => supplier ? supplierPayments.filter(p => p.supplierId === supplier.id) : [], [supplier, supplierPayments]);
  const purchasedItems = useMemo(() => detailPurchases.flatMap(purchase => purchase.items.map(line => {
    const item = items.find(i => i.id === line.itemId);
    return { ...line, purchaseId: purchase.id, itemName: item?.name || "Unknown item", unit: item?.unit || "" };
  })), [detailPurchases, items]);

  // FIFO Dynamic Debt Outstanding Allocation
  const purchasesWithDebtStatus = useMemo(() => {
    let remainingPaymentPool = detailPayments.reduce((sum, p) => sum + p.amount, 0);
    // Sort oldest to newest to apply chronological FIFO settlement
    const sorted = [...detailPurchases].sort((a, b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime());
    
    const mapped = sorted.map(purchase => {
      const debt = purchase.debtAmount || 0;
      let allocatedPayment = 0;
      if (debt > 0 && remainingPaymentPool > 0) {
        allocatedPayment = Math.min(debt, remainingPaymentPool);
        remainingPaymentPool -= allocatedPayment;
      }
      const outstanding = debt - allocatedPayment;
      return {
        ...purchase,
        originalDebt: debt,
        outstanding,
        status: debt === 0 ? "PAID" : outstanding === 0 ? "SETTLED" : "PARTIAL",
      };
    });

    // Re-sort back to newest first for display
    return mapped.sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
  }, [detailPurchases, detailPayments]);

  if (!supplier) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <Link href="/suppliers" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600">
          <ArrowLeft className="w-4 h-4" /> Suppliers
        </Link>
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Supplier not found</h1>
        </div>
      </div>
    );
  }

  const totalPurchases = detailPurchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0);
  const totalPaid = detailPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const canPay = supplier.debt > 0 && paymentData.amount > 0 && (paymentData.method === "CASH" || paymentData.bankId) && !isSaving;

  const handlePay = async () => {
    if (!canPay) return;
    const finalAmount = Math.min(supplier.debt, paymentData.amount);
    if (finalAmount <= 0) return;
    setIsSaving(true);
    setPayError(null);
    setPaySuccess(null);
    try {
      await addSupplierPayment({
        supplierId: supplier.id,
        amount: finalAmount,
        date: new Date(),
        method: paymentData.method,
        bankAccountId: paymentData.method === "BANK" ? paymentData.bankId : undefined,
        locationId: currentLocation?.id,
        purchaseId: selectedPurchaseId || undefined,
      });
      setPaySuccess(`Payment of ${formatCurrency(finalAmount)} recorded successfully!`);
      clearDraft();
      setPaymentData({ amount: 0, method: "CASH", bankId: "" });
      setSelectedPurchaseId(null);
      setTimeout(() => setPaySuccess(null), 4000);
    } catch (err: any) {
      setPayError(err?.message || "Payment failed. Please try again.");
      setTimeout(() => setPayError(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectPurchaseForSettlement = (purchaseId: string, outstanding: number) => {
    setSelectedPurchaseId(purchaseId);
    setPaymentData(prev => ({ ...prev, amount: Math.min(supplier.debt, outstanding) }));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-4">
          <Link href="/suppliers" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600">
            <ArrowLeft className="w-4 h-4" /> Suppliers
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600">
              <Truck className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{supplier.name}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs font-bold text-slate-500">
                <span>{supplier.id}</span>
                <span className="flex items-center gap-1"><UserRound className="w-3 h-3" /> {supplier.contact || "-"}</span>
                <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {supplier.phone || "-"}</span>
              </div>
            </div>
          </div>
        </div>

        {supplier.debt > 0 && (
          <div className="w-full lg:w-[460px] rounded-2xl border border-rose-100 dark:border-rose-900/30 bg-white dark:bg-zinc-900 p-4 shadow-sm relative overflow-visible">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">
                  {selectedPurchaseId ? `Settle Transaction: ${selectedPurchaseId}` : "Supplier Debt"}
                </p>
                <p className="text-xl font-black text-rose-600">{formatCurrency(supplier.debt)}</p>
              </div>
              <Truck className="w-6 h-6 text-rose-500" />
            </div>
            <div className="flex flex-col gap-2">
              <NumericInput
                value={paymentData.amount}
                onValueChange={(amount) => setPaymentData({ ...paymentData, amount: Math.min(supplier.debt, amount) })}
                placeholder="Amount"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              <div className="flex gap-2">
                <div className="relative flex-1 min-w-0">
                  <select
                    value={paymentData.method}
                    onChange={(e) => {
                      const method = e.target.value as "CASH" | "BANK";
                      const firstBank = bankAccounts.find((account) => String(account.accountType || "BANK").toUpperCase() !== "CASH");
                      setPaymentData({
                        ...paymentData,
                        method,
                        bankId: method === "BANK" ? (paymentData.bankId || firstBank?.id || "") : "",
                      });
                    }}
                    className="w-full px-3 pr-8 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-black appearance-none"
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bank</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>
                <button
                  onClick={handlePay}
                  disabled={!canPay}
                  className="px-5 py-2 bg-emerald-600 disabled:bg-slate-700 disabled:shadow-none text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-900/20 transition-all active:scale-95 shrink-0"
                >
                  {isSaving ? "..." : "Pay"}
                </button>
              </div>
            </div>
            {paymentData.method === "BANK" && (
              <div className="mt-2 space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Bank account</p>
                <BankAccountSelect
                  value={paymentData.bankId}
                  onChange={(bankId) => setPaymentData({ ...paymentData, bankId })}
                  accounts={bankAccounts}
                />
              </div>
            )}
            {selectedPurchaseId && (
              <div className="mt-2 flex items-center justify-between text-[10px] bg-amber-50 dark:bg-amber-950/20 text-amber-600 px-3 py-1.5 rounded-lg border border-amber-100 dark:border-amber-900/30">
                <span>Selected debt transaction: <strong>{selectedPurchaseId}</strong></span>
                <button onClick={() => setSelectedPurchaseId(null)} className="font-black underline uppercase hover:text-amber-800">Clear</button>
              </div>
            )}
            {paySuccess && (
              <div className="mt-2 flex items-center gap-2 text-[11px] bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-900/30 animate-in fade-in duration-300">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="font-bold">{paySuccess}</span>
              </div>
            )}
            {payError && (
              <div className="mt-2 flex items-center gap-2 text-[11px] bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 px-3 py-2 rounded-lg border border-rose-200 dark:border-rose-900/30 animate-in fade-in duration-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-bold">{payError}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Total Purchases", value: formatCurrency(totalPurchases), icon: Receipt, color: "text-indigo-600" },
          { label: "Payments", value: formatCurrency(totalPaid), icon: WalletCards, color: "text-emerald-600" },
          { label: "Debt", value: formatCurrency(supplier.debt), icon: Truck, color: supplier.debt > 0 ? "text-rose-600" : "text-emerald-600" },
          { label: "Items Purchased", value: purchasedItems.reduce((sum, line) => sum + line.qty, 0).toLocaleString(), icon: Package, color: "text-slate-700 dark:text-slate-200" },
        ].map((stat) => (
          <div key={stat.label} className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm">
            <stat.icon className={cn("w-4 h-4 sm:w-5 sm:h-5 mb-2 sm:mb-4", stat.color)} />
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500">{stat.label}</p>
            <p className={cn("mt-1 sm:mt-2 text-lg sm:text-2xl font-black tracking-tight", stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm flex flex-col h-full">
          <div className="px-5 py-4 bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-indigo-600" />
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Purchases & Debt Transactions</h2>
          </div>
          {purchasesWithDebtStatus.length === 0 ? (
            <p className="p-5 text-sm font-bold text-slate-700 dark:text-slate-300">No purchases recorded from this supplier.</p>
          ) : (
            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full text-left min-w-[550px]">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-zinc-950/20 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-100 dark:border-zinc-800">
                    <th className="px-5 py-3">ID & Date</th>
                    <th className="px-5 py-3 text-right">Total</th>
                    <th className="px-5 py-3">Type / Debt</th>
                    <th className="px-5 py-3">Debt Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-xs">
                  {purchasesWithDebtStatus.map(purchase => {
                    const isDebtPurchase = purchase.originalDebt > 0;
                    return (
                      <tr key={purchase.id} className={cn("hover:bg-slate-50/40 dark:hover:bg-zinc-800/10 transition-all", selectedPurchaseId === purchase.id && "bg-indigo-50/30 dark:bg-indigo-950/10")}>
                        <td className="px-5 py-4">
                          <p className="font-black text-slate-900 dark:text-white">{purchase.id}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{new Date(purchase.purchaseDate).toLocaleDateString()}</p>
                        </td>
                        <td className="px-5 py-4 text-right font-black text-slate-900 dark:text-white">
                          {formatCurrency(purchase.totalAmount)}
                        </td>
                        <td className="px-5 py-4">
                          {isDebtPurchase ? (
                            <div>
                              <p className="text-[9px] font-black text-amber-600 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 px-2 py-0.5 rounded uppercase tracking-wider inline-block">Debt</p>
                              <p className="text-[10px] text-slate-400 font-bold mt-0.5">{formatCurrency(purchase.originalDebt)}</p>
                            </div>
                          ) : (
                            <div>
                              <span className="text-[9px] font-black text-slate-500 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded uppercase tracking-wider inline-block">
                                {purchase.paymentMethod}
                              </span>
                              {(Number(purchase.cashAmount || 0) > 0 || Number(purchase.bankAmount || 0) > 0) && (
                                <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                                  {[
                                    Number(purchase.cashAmount || 0) > 0 ? `Cash ${formatCurrency(purchase.cashAmount)}` : null,
                                    Number(purchase.bankAmount || 0) > 0 ? `Bank ${formatCurrency(purchase.bankAmount)}` : null,
                                  ].filter(Boolean).join(" · ")}
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {isDebtPurchase ? (
                            purchase.outstanding > 0 ? (
                              <div>
                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-600 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 px-2.5 py-0.5 rounded-lg">
                                  {formatCurrency(purchase.outstanding)}
                                </span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 px-2.5 py-0.5 rounded-lg uppercase tracking-widest">
                                Settled
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400 text-[10px] font-bold">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {isDebtPurchase && purchase.outstanding > 0 ? (
                            <button
                              onClick={() => handleSelectPurchaseForSettlement(purchase.id, purchase.outstanding)}
                              className="px-2.5 py-1 text-[9px] font-black text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/30 border border-emerald-100/80 dark:border-emerald-900/30 rounded-lg uppercase tracking-widest transition-all"
                            >
                              Settle Debt
                            </button>
                          ) : (
                            <span className="text-slate-300 dark:text-zinc-700 font-bold">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <DetailList title="Payment Details" icon={<WalletCards className="w-4 h-4 text-emerald-600" />} empty="No payments recorded for this supplier.">
          {detailPayments.map(payment => {
            const bank = bankAccounts.find(account => account.id === payment.bankAccountId);
            return (
              <div key={payment.id} className="p-4 flex items-center justify-between gap-4 border-t border-slate-100 dark:border-zinc-800 first:border-t-0">
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-white">{payment.id}</p>
                  <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">{new Date(payment.date).toLocaleDateString()} - {payment.method}{bank ? ` - ${bank.displayName}` : ""}</p>
                </div>
                <p className="text-sm font-black text-emerald-600">{formatCurrency(payment.amount)}</p>
              </div>
            );
          })}
        </DetailList>
      </div>

      <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
        <div className="px-5 py-4 bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-indigo-600" />
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Items Purchased</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500">
                <th className="px-5 py-4">Item</th>
                <th className="px-5 py-4">Purchase</th>
                <th className="px-5 py-4 text-right">Qty</th>
                <th className="px-5 py-4 text-right">Buying Price</th>
                <th className="px-5 py-4 text-right">Selling Price</th>
                <th className="px-5 py-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {purchasedItems.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-6 text-sm font-bold text-slate-700 dark:text-slate-300">No purchased items from this supplier yet.</td></tr>
              ) : purchasedItems.map(line => (
                <tr key={`${line.purchaseId}-${line.id}`}>
                  <td className="px-5 py-4 text-sm font-bold text-slate-900 dark:text-white">{line.itemName}</td>
                  <td className="px-5 py-4 text-xs font-mono text-slate-400">{line.purchaseId}</td>
                  <td className="px-5 py-4 text-right text-sm font-bold text-slate-600 dark:text-zinc-300">{line.qty} {line.unit}</td>
                  <td className="px-5 py-4 text-right text-sm font-bold text-slate-600 dark:text-zinc-300">{formatCurrency(line.unitCost)}</td>
                  <td className="px-5 py-4 text-right text-sm font-bold text-slate-600 dark:text-zinc-300">{formatCurrency(line.sellingPrice)}</td>
                  <td className="px-5 py-4 text-right text-sm font-black text-slate-900 dark:text-white">{formatCurrency(line.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function DetailList({ title, icon, empty, children }: { title: string; icon: React.ReactNode; empty: string; children: React.ReactNode }) {
  const hasItems = React.Children.count(children) > 0;
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm flex flex-col">
      <div className="px-5 py-4 bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 flex items-center gap-2 shrink-0">
        {icon}
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">{title}</h2>
      </div>
      <div className="overflow-y-auto max-h-[400px] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-slate-50 dark:[&::-webkit-scrollbar-track]:bg-zinc-900 [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-600 [&::-webkit-scrollbar-thumb]:rounded-full">
        {hasItems ? children : <p className="p-5 text-sm font-bold text-slate-700 dark:text-slate-300">{empty}</p>}
      </div>
    </section>
  );
}

