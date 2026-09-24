"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ChevronDown, CreditCard, Mail, Package, Phone, Receipt, ShoppingBag, UserRound, WalletCards, AlertCircle } from "lucide-react";
import { NumericInput } from "@/components/numeric-input";
import { cn, formatCurrency } from "@/lib/utils";
import { useAppData } from "@/lib/client/useAppData";
import { useToast } from "@/components/toast-provider";
import { listCreditSales } from "@/lib/finance/credit-ledger";
import { formatSalePaymentPartsDetail } from "@/lib/payment-display";
import { BankAccountSelect } from "@/components/bank-account-select";
import { useBusinessDraft } from "@/lib/client/useBusinessDraft";

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const { customers, sales, customerPayments, items, bankAccounts, settleCredit, currentLocation } = useAppData();
  const customer = customers.find(c => c.id === decodeURIComponent(params.id));
  const { draft: paymentData, setDraft: setPaymentData, clearDraft } = useBusinessDraft(
    `customer-pay:${decodeURIComponent(params.id)}`,
    () => ({
      amount: 0,
      method: "CASH" as "CASH" | "BANK",
      bankId: "",
      date: new Date().toISOString().split("T")[0],
      note: "",
    }),
  );
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const detailSales = useMemo(() => customer ? sales.filter(s => s.customerId === customer.id) : [], [customer, sales]);
  const detailPayments = useMemo(() => customer ? customerPayments.filter(p => p.customerId === customer.id) : [], [customer, customerPayments]);
  const soldItems = useMemo(() => detailSales.flatMap(sale => sale.items.map(line => {
    const item = items.find(i => i.id === line.itemId);
    return { ...line, saleId: sale.id, itemName: item?.name || "Unknown item", unit: item?.unit || "" };
  })), [detailSales, items]);

  const salesWithCreditStatus = useMemo(() => {
    const creditById = new Map(
      listCreditSales(detailSales, detailPayments, detailPayments.flatMap((payment: any) => payment.allocations || []))
        .map((sale) => [sale.saleId, sale]),
    );
    return [...detailSales]
      .map((sale) => {
        const credit = creditById.get(sale.id);
        const originalCredit = credit?.originalCredit || Number(sale.creditAmount || 0);
        const outstanding = credit?.outstandingAmount ?? originalCredit;
        return {
          ...sale,
          originalCredit,
          paidAmount: credit?.paidAmount || 0,
          outstanding,
          status: originalCredit === 0 ? "PAID" : credit?.status || "PENDING",
        };
      })
      .sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime());
  }, [detailSales, detailPayments]);

  if (!customer) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <Link href="/customers" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600">
          <ArrowLeft className="w-4 h-4" /> Customers
        </Link>
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Customer not found</h1>
        </div>
      </div>
    );
  }

  const totalSales = detailSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const totalPaid = detailPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const selectedSale = salesWithCreditStatus.find((sale) => sale.id === selectedSaleId);
  const selectedBalance = selectedSale ? selectedSale.outstanding : customer.balance;
  const canSettle = selectedBalance > 0 && paymentData.amount > 0 && (paymentData.method === "CASH" || paymentData.bankId);

  const handleSettle = async () => {
    if (!canSettle) return;
    setIsSaving(true);
    setError(null);
    try {
      await settleCredit({
        customerId: customer.id,
        saleId: selectedSaleId,
        amount: Math.min(selectedBalance, paymentData.amount),
        method: paymentData.method,
        bankAccountId: paymentData.method === "BANK" ? paymentData.bankId : undefined,
        locationId: currentLocation?.id,
        date: new Date(paymentData.date),
        note: paymentData.note || undefined,
      });
      toast.success({ title: "Payment recorded successfully", description: selectedSaleId ? "The payment was applied to the selected sale." : "The payment was allocated to the oldest unpaid sales first." });
      clearDraft();
      setPaymentData({ amount: 0, method: "CASH", bankId: "", date: new Date().toISOString().split("T")[0], note: "" });
      setSelectedSaleId(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to process settlement");
      toast.error({ title: "Settlement Failed", description: err.message || "An unexpected error occurred" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectSaleForSettlement = (saleId: string, outstanding: number) => {
    setSelectedSaleId(saleId);
    setPaymentData(prev => ({ ...prev, amount: outstanding }));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-4">
          <Link href="/customers" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600">
            <ArrowLeft className="w-4 h-4" /> Customers
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600">
              <UserRound className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{customer.name}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs font-bold text-slate-500">
                <span>{customer.id}</span>
                <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {customer.phone || "-"}</span>
                <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {customer.email || "-"}</span>
              </div>
            </div>
          </div>
        </div>

        {customer.balance > 0 && (
          <div className="w-full lg:w-[460px] rounded-2xl border border-rose-100 dark:border-rose-900/30 bg-white dark:bg-zinc-900 p-4 shadow-sm relative overflow-visible">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">
                  {selectedSaleId ? "Selected unpaid sale" : "All outstanding sales"}
                </p>
                <p className="text-xl font-black text-rose-600">{formatCurrency(selectedBalance)}</p>
              </div>
              <CreditCard className="w-6 h-6 text-rose-500" />
            </div>
            <div className="flex flex-col gap-2">
              <NumericInput
                value={paymentData.amount}
                onValueChange={(amount) => setPaymentData({ ...paymentData, amount: Math.min(selectedBalance, amount) })}
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
                  onClick={handleSettle}
                  disabled={!canSettle || isSaving}
                  className="px-5 py-2 bg-emerald-600 disabled:bg-slate-700 disabled:shadow-none text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-900/20 transition-all active:scale-95 shrink-0"
                >
                  {isSaving ? "Settling..." : "Settle"}
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
            {selectedSaleId && (
              <div className="mt-2 flex items-center justify-between text-[10px] bg-amber-50 dark:bg-amber-950/20 text-amber-600 px-3 py-1.5 rounded-lg border border-amber-100 dark:border-amber-900/30">
                <span>Selected credit transaction: <strong>{selectedSaleId}</strong></span>
                <button onClick={() => setSelectedSaleId(null)} className="font-black underline uppercase hover:text-amber-800">Clear</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Total Sales", value: formatCurrency(totalSales), icon: Receipt, color: "text-indigo-600" },
          { label: "Payments", value: formatCurrency(totalPaid), icon: WalletCards, color: "text-emerald-600" },
          { label: "Outstanding", value: formatCurrency(customer.balance), icon: CreditCard, color: customer.balance > 0 ? "text-rose-600" : "text-emerald-600" },
          { label: "Items Sold", value: soldItems.reduce((sum, line) => sum + line.qty, 0).toLocaleString(), icon: Package, color: "text-slate-700 dark:text-slate-200" },
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
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Sales & Credit Transactions</h2>
          </div>
          {salesWithCreditStatus.length === 0 ? (
            <p className="p-5 text-sm font-bold text-slate-700 dark:text-slate-300">No sales recorded for this customer.</p>
          ) : (
            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full text-left min-w-[550px]">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-zinc-950/20 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-100 dark:border-zinc-800">
                    <th className="px-5 py-3">ID & Date</th>
                    <th className="px-5 py-3 text-right">Total</th>
                    <th className="px-5 py-3">Type / Credit</th>
                    <th className="px-5 py-3">Credit Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-xs">
                  {salesWithCreditStatus.map(sale => {
                    const isCreditSale = sale.originalCredit > 0;
                    return (
                      <tr key={sale.id} className={cn("hover:bg-slate-50/40 dark:hover:bg-zinc-800/10 transition-all", selectedSaleId === sale.id && "bg-indigo-50/30 dark:bg-indigo-950/10")}>
                        <td className="px-5 py-4">
                          <p className="font-black text-slate-900 dark:text-white">{sale.id}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{new Date(sale.saleDate).toLocaleDateString()}</p>
                        </td>
                        <td className="px-5 py-4 text-right font-black text-slate-900 dark:text-white">
                          {formatCurrency(sale.totalAmount)}
                        </td>
                        <td className="px-5 py-4">
                          {isCreditSale ? (
                            <div>
                              <p className="text-[9px] font-black text-amber-600 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 px-2 py-0.5 rounded uppercase tracking-wider inline-block">
                                {sale.paymentMethod === "MIXED" ? "Mixed" : "Credit"}
                              </p>
                              <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                                {formatSalePaymentPartsDetail(
                                  {
                                    cashAmount: sale.cashAmount,
                                    bankAmount: sale.bankAmount,
                                    creditAmount: sale.originalCredit || sale.creditAmount,
                                  },
                                  formatCurrency,
                                ) || formatCurrency(sale.originalCredit)}
                              </p>
                            </div>
                          ) : (
                            <div>
                              <span className="text-[9px] font-black text-slate-500 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded uppercase tracking-wider inline-block">
                                {sale.paymentMethod}
                              </span>
                              {(() => {
                                const detail = formatSalePaymentPartsDetail(
                                  {
                                    cashAmount: sale.cashAmount,
                                    bankAmount: sale.bankAmount,
                                    creditAmount: sale.creditAmount,
                                  },
                                  formatCurrency,
                                );
                                return detail ? (
                                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">{detail}</p>
                                ) : null;
                              })()}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {isCreditSale ? (
                            sale.outstanding > 0 ? (
                              <div>
                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-600 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 px-2.5 py-0.5 rounded-lg">
                                  {sale.status === "PARTIAL" ? "Partial · " : "Pending · "}{formatCurrency(sale.outstanding)}
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
                          {isCreditSale && sale.outstanding > 0 ? (
                            <button
                              onClick={() => handleSelectSaleForSettlement(sale.id, sale.outstanding)}
                              className="px-2.5 py-1 text-[9px] font-black text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/30 border border-emerald-100/80 dark:border-emerald-900/30 rounded-lg uppercase tracking-widest transition-all"
                            >
                              Settle Sale
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

        <DetailList title="Payment Details" icon={<WalletCards className="w-4 h-4 text-emerald-600" />} empty="No payments recorded for this customer.">
          {detailPayments.map(payment => {
            const bank = payment.bankAccount || bankAccounts.find(account => account.id === payment.bankAccountId);
            const bankLabel = bank
              ? `${bank.displayName}${bank.bankName ? ` (${bank.bankName})` : ""}`
              : "";
            return (
              <div key={payment.id} className="p-4 flex items-center justify-between gap-4 border-t border-slate-100 dark:border-zinc-800 first:border-t-0">
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-white">{payment.id}</p>
                  <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                    {new Date(payment.date).toLocaleDateString()} · {payment.method}
                    {bankLabel ? ` · ${bankLabel}` : ""}
                  </p>
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
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Items Sold</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500">
                <th className="px-5 py-4">Item</th>
                <th className="px-5 py-4">Sale</th>
                <th className="px-5 py-4 text-right">Qty</th>
                <th className="px-5 py-4 text-right">Price</th>
                <th className="px-5 py-4 text-right">Discount</th>
                <th className="px-5 py-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {soldItems.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-6 text-sm font-bold text-slate-700 dark:text-slate-300">No items sold to this customer yet.</td></tr>
              ) : soldItems.map(line => (
                <tr key={`${line.saleId}-${line.id}`}>
                  <td className="px-5 py-4 text-sm font-bold text-slate-900 dark:text-white">{line.itemName}</td>
                  <td className="px-5 py-4 text-xs font-mono text-slate-400">{line.saleId}</td>
                  <td className="px-5 py-4 text-right text-sm font-bold text-slate-600 dark:text-zinc-300">{line.qty} {line.unit}</td>
                  <td className="px-5 py-4 text-right text-sm font-bold text-slate-600 dark:text-zinc-300">{formatCurrency(line.price)}</td>
                  <td className="px-5 py-4 text-right text-sm font-bold text-rose-500">{formatCurrency(line.discount)}</td>
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

