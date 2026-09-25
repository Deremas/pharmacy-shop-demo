"use client";

import React, { useState, useMemo, useEffect } from "react";
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  ChevronDown,
  User,
  UserPlus,
  X,
} from "lucide-react";
import { useAppData } from "@/lib/client/useAppData";
import { useToast } from "@/components/toast-provider";
import { NumericInput } from "@/components/numeric-input";
import { cn, formatCurrency } from "@/lib/utils";
import { formatUnitLabel, itemSearchText, itemVariant } from "@/lib/item-display";
import { controlMutedClass } from "@/lib/field-styles";
import { BankAccountSelect, bankAccountsOnly, needsBankAccount } from "@/components/bank-account-select";
import { paymentMethodLabel } from "@/lib/payment-display";
import { AppModal } from "@/components/app-modal";
import { PrescriptionFields } from "@/components/prescription-fields";
import { CodeScanButton } from "@/components/code-scanner";
import { findItemByScan } from "@/lib/pack-scan";
import { updateDraftField, useBusinessDraft } from "@/lib/client/useBusinessDraft";
import {
  WALK_IN_CUSTOMER_ID,
  isWalkInCustomer,
  resolveSaleCustomerId,
} from "@/lib/customer";

const emptyPosDraft = () => ({
  cart: [] as any[],
  search: "",
  selectedCustomerId: WALK_IN_CUSTOMER_ID,
  paymentMethod: "CASH" as "CASH" | "BANK" | "CREDIT" | "MIXED",
  selectedBankId: "",
  cashPaid: 0,
  bankPaid: 0,
  prescriptionNumber: "",
  patientName: "",
  prescriberName: "",
});

export default function PosPage() {
  const { items, products = [], customers, addCustomer, currentLocation, addSale, settings, bankAccounts } = useAppData();
  const toast = useToast();
  const { draft, setDraft, clearDraft, draftReady } = useBusinessDraft("sales-pos", emptyPosDraft);
  const cart = draft.cart;
  const search = draft.search;
  const selectedCustomerId = draft.selectedCustomerId;
  const paymentMethod = draft.paymentMethod;
  const selectedBankId = draft.selectedBankId;
  const cashPaid = draft.cashPaid;
  const bankPaid = draft.bankPaid;
  const setCart = updateDraftField(setDraft, "cart");
  const setSearch = updateDraftField(setDraft, "search");
  const setSelectedCustomerId = updateDraftField(setDraft, "selectedCustomerId");
  const setPaymentMethod = updateDraftField(setDraft, "paymentMethod");
  const setSelectedBankId = updateDraftField(setDraft, "selectedBankId");
  const setCashPaid = updateDraftField(setDraft, "cashPaid");
  const setBankPaid = updateDraftField(setDraft, "bankPaid");
  const prescriptionNumber = draft.prescriptionNumber || "";
  const patientName = draft.patientName || "";
  const prescriberName = draft.prescriberName || "";
  const setPrescriptionNumber = updateDraftField(setDraft, "prescriptionNumber");
  const setPatientName = updateDraftField(setDraft, "patientName");
  const setPrescriberName = updateDraftField(setDraft, "prescriberName");
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", email: "" });
  const bankOptions = useMemo(() => bankAccountsOnly(bankAccounts), [bankAccounts]);

  useEffect(() => {
    const needsAccount = paymentMethod === "BANK" || (paymentMethod === "MIXED" && Number(bankPaid) > 0);
    if (!needsAccount) return;
    if (selectedBankId && bankOptions.some((account) => account.id === selectedBankId)) return;
    setSelectedBankId(bankOptions[0]?.id || "");
  }, [paymentMethod, bankPaid, bankOptions, selectedBankId]);

  // Filter items available at current location
  const locationItems = useMemo(
    () => items.filter((i) => i.locationId === currentLocation?.id),
    [items, currentLocation?.id],
  );
  const itemNeedsPrescription = (item: { id?: string; requiresPrescription?: boolean }) =>
    Boolean(item?.requiresPrescription || products.find((entry) => entry.id === item?.id)?.requiresPrescription);

  useEffect(() => {
    if (!draftReady) return;
    setDraft((current) => {
      const nextCart = current.cart
        .map((line: any) => {
          const live = locationItems.find((item: any) => item.id === line.id);
          if (!live || live.stock <= 0) return null;
          return { ...live, quantity: Math.min(Math.max(1, Number(line.quantity) || 1), live.stock) };
        })
        .filter(Boolean);
      if (nextCart.length === current.cart.length && nextCart.every((item: any, index: number) => item.id === current.cart[index]?.id && item.quantity === current.cart[index]?.quantity)) {
        return current;
      }
      return { ...current, cart: nextCart };
    });
  }, [draftReady, locationItems, setDraft]);

  const addToCart = (item: any) => {
    if (item.stock <= 0) return;

    const existing = cart.find(i => i.id === item.id);
    if (existing) {
      if (existing.quantity >= item.stock) return;
      setCart(cart.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(i => i.id !== id));
  };

  const setCartQuantity = (id: string, quantity: number) => {
    setCart(cart.map((item) => {
      if (item.id !== id) return item;
      return { ...item, quantity: Math.min(item.stock, Math.max(1, quantity)) };
    }));
  };

  const updateQuantity = (id: string, delta: number) => {
    const current = cart.find((item) => item.id === id);
    if (!current) return;
    setCartQuantity(id, current.quantity + delta);
  };

  const handleQuickAddCustomer = async () => {
    const name = newCustomer.name.trim();
    if (!name) {
      toast.error("Customer name is required.");
      return;
    }

    try {
      const result = await addCustomer({
        name,
        phone: newCustomer.phone.trim() || "-",
        email: newCustomer.email.trim() || "-",
      });
      setSelectedCustomerId(result.id);
      setNewCustomer({ name: "", phone: "", email: "" });
      setShowCustomerModal(false);
      toast.success("Customer added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Customer could not be added.");
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0 || !currentLocation) return;

    const overStockItem = cart.find(item => {
      const liveStock = items.find(i => i.id === item.id && i.locationId === currentLocation.id)?.stock ?? 0;
      return item.quantity > liveStock;
    });

    if (overStockItem) {
      const liveStock = items.find(i => i.id === overStockItem.id && i.locationId === currentLocation.id)?.stock ?? 0;
      toast.error({
        title: "Not enough stock",
        description: `${overStockItem.name} only has ${liveStock} ${formatUnitLabel(overStockItem)} available.`,
      });
      return;
    }

    if (needsBankAccount(paymentMethod, bankPaid) && !selectedBankId) {
      toast.error("Select the bank account for this bank amount.");
      return;
    }

    const cashAmount = paymentMethod === "CASH"
      ? total
      : paymentMethod === "MIXED"
        ? Math.min(cashPaid, total)
        : 0;
    const bankAmount = paymentMethod === "BANK"
      ? total
      : paymentMethod === "MIXED"
        ? Math.min(bankPaid, Math.max(0, total - cashAmount))
        : 0;
    const creditAmount = paymentMethod === "CREDIT"
      ? total
      : paymentMethod === "MIXED"
        ? Math.max(0, total - cashAmount - bankAmount)
        : 0;

    if (creditAmount > 0 && isWalkInCustomer(selectedCustomerId)) {
      toast.error("Credit sales require a customer. Walk-in cannot be used for credit.");
      return;
    }

    const prescriptionSale = cart.some((item) => itemNeedsPrescription(item));
    if (prescriptionSale && !prescriptionNumber.trim()) {
      toast.error("This sale includes a prescription medicine. Enter the prescription number.");
      return;
    }

    const sale = {
      customerId: resolveSaleCustomerId(selectedCustomerId),
      locationId: currentLocation.id,
      saleDate: new Date(),
      subTotal: subtotal,
      discount: 0,
      totalAmount: total,
      cashAmount,
      bankAmount,
      creditAmount,
      paymentMethod,
      bankAccountId: needsBankAccount(paymentMethod, bankAmount) ? selectedBankId : undefined,
      prescriptionNumber: prescriptionSale ? prescriptionNumber.trim() : "",
      patientName: prescriptionSale ? patientName.trim() : "",
      prescriberName: prescriptionSale ? prescriberName.trim() : "",
      items: cart.map(item => ({
        itemId: item.id,
        qty: item.quantity,
        price: item.price,
        discount: 0,
        total: item.price * item.quantity
      }))
    };

    try {
      const result = await addSale(sale);
      clearDraft();
      toast.success({
        title: "Sale completed",
        description: `${formatCurrency(total)} sale recorded successfully.`,
      });
      const telegram = result?.telegram;
      if (telegram && !telegram.ok) {
        toast.error({
          title: "Sale saved, but Telegram failed",
          description: telegram.error || telegram.skipped || "Check TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID on Vercel.",
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sale could not be completed.");
    }
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const taxRate = Math.max(0, Number(settings.taxRate) || 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const applyScan = (raw: string) => {
    const catalog = products.filter((entry) => entry.locationId === currentLocation?.id);
    const match = findItemByScan(catalog.length ? catalog : locationItems, raw);
    if (!match) {
      toast.error("No medicine uses this code. Save the pack code on the item first.");
      return;
    }
    const item = locationItems.find((entry) => entry.id === match.id) || match;
    if (Number(item.stock || 0) <= 0) {
      toast.error("This medicine is out of stock.");
      return;
    }
    addToCart(item);
    setSearch("");
  };

  if (!draftReady) return null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-8 lg:flex-row">
      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-zinc-500" />
              <input
                type="text"
                placeholder="Search or scan a pack code"
                className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-zinc-200 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  applyScan(search);
                }}
              />
            </div>
            <CodeScanButton label="Scan" showLabel onScan={applyScan} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto grid auto-rows-max grid-cols-[repeat(auto-fill,minmax(135px,1fr))] items-start gap-3 pb-4 px-1">
          {locationItems.filter((i) => itemSearchText(i, currentLocation?.id).toLowerCase().includes(search.toLowerCase())).map(item => {
            const variant = itemVariant(item, currentLocation?.id);
            return (
            <button
              type="button"
              key={item.id}
              disabled={item.stock <= 0}
              onClick={() => addToCart(item)}
              className={cn(
                "group relative flex min-h-[182px] flex-col rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-950/10 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-500/50",
                item.stock <= 0 && "cursor-not-allowed opacity-55 hover:translate-y-0 hover:border-slate-200 hover:shadow-sm dark:hover:border-zinc-800",
              )}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1">
                  <span
                    className={cn(
                      "rounded-full bg-slate-50 px-2 py-1 text-[9px] font-black text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-zinc-950 dark:text-zinc-400 dark:ring-zinc-800",
                      item.stock <= 0 && "bg-rose-50 text-rose-600 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/50",
                    )}
                  >
                    {item.stock > 0 ? `${item.stock} ${formatUnitLabel(item)}` : "Out"}
                  </span>
                  {itemNeedsPrescription(item) ? (
                    <span className="rounded-full bg-indigo-50 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-900/40">Rx</span>
                  ) : null}
                </span>
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 transition-all group-hover:scale-105 group-hover:bg-indigo-500",
                    item.stock <= 0 && "bg-slate-200 shadow-none group-hover:scale-100 group-hover:bg-slate-200 dark:bg-zinc-700",
                  )}
                >
                  <Plus className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="flex flex-1 flex-col">
                {item.category && item.category !== variant.style ? (
                  <p className="mb-1 truncate text-[9px] font-black uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-400">
                    {item.category}
                  </p>
                ) : null}
                <h4 className="min-h-[1.1rem] text-[13px] font-black leading-[1.1rem] text-slate-900 dark:text-zinc-100">
                  {variant.style}
                </h4>
                {variant.badge ? (
                  <p className="mt-1 text-[11px] font-black text-indigo-700 dark:text-indigo-300">
                    {variant.badge}
                  </p>
                ) : null}
                {variant.code && variant.code !== variant.badge ? (
                  <p className="mt-0.5 text-[10px] font-bold text-slate-600 dark:text-zinc-400">
                    {variant.code}
                  </p>
                ) : null}
                <div className="mt-auto rounded-2xl bg-slate-50 px-2.5 py-2 ring-1 ring-slate-100 dark:bg-zinc-950 dark:ring-zinc-800">
                  <p className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-zinc-500">Price</p>
                  <p className="mt-0.5 whitespace-nowrap text-sm font-black tracking-tight text-slate-950 dark:text-white">
                    {formatCurrency(item.price)}
                  </p>
                </div>
              </div>
            </button>
            );
          })}
        </div>
      </div>

      <div
        className={cn(
          "flex min-h-0 w-full flex-col overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl transition-colors dark:border-zinc-800 dark:bg-zinc-950 lg:w-[400px]",
        )}
      >
        <div className="shrink-0 p-6 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-sm">Sale Terminal</h3>
          <button type="button" onClick={() => clearDraft()} className="text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 bg-rose-500/10 px-2.5 py-1.5 rounded transition-colors">RESET</button>
        </div>

        <div className="shrink-0 border-b border-slate-200 p-4 dark:border-zinc-800">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400">Customer</p>
            <button
              type="button"
              onClick={() => setShowCustomerModal(true)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <select
              value={selectedCustomerId}
              onChange={(event) => setSelectedCustomerId(event.target.value)}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-9 text-xs font-bold text-slate-900 outline-none transition focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value={WALK_IN_CUSTOMER_ID}>Walk-in</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          </div>
        </div>

        <div
          className={cn(
            "min-h-0 space-y-3 p-4 font-bold",
            cart.length === 0 ? "flex-1" : "shrink-0",
          )}
        >
          {cart.length === 0 ? (
            <div className="flex h-full min-h-[128px] flex-col items-center justify-center space-y-3 text-slate-300 dark:text-zinc-700">
              <ShoppingCart className="h-12 w-12 stroke-[1]" />
              <p className="text-xs uppercase font-bold tracking-widest">Cart is empty</p>
            </div>
          ) : (
            cart.map(item => {
              const variant = itemVariant(item, currentLocation?.id);
              return (
              <div key={item.id} className="flex gap-4 p-3 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-xl relative group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 pr-7">
                    <div className="flex min-w-0 items-center gap-2">
                      <h4 className="min-w-0 truncate text-xs font-bold text-slate-800 dark:text-zinc-200">{variant.style}</h4>
                      {itemNeedsPrescription(item) ? (
                        <span className="shrink-0 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">Rx</span>
                      ) : null}
                      {variant.badge ? (
                        <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-900 dark:text-zinc-100 dark:bg-zinc-800">
                          {variant.badge}
                        </span>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-[11px] font-black text-slate-700 dark:text-zinc-300">{formatCurrency(item.price)}</p>
                  </div>
                  <p className="mb-2 mt-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-500">
                    Max {Math.max(0, item.stock)} {formatUnitLabel(item)}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-md">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        disabled={item.quantity <= 1}
                        className="p-1 text-slate-400 hover:text-slate-900 disabled:opacity-35 disabled:hover:text-slate-400 dark:hover:text-white"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <NumericInput
                        min={1}
                        max={item.stock}
                        step={1}
                        value={item.quantity}
                        onValueChange={(quantity) => setCartQuantity(item.id, quantity)}
                        className="h-8 w-16 border-0 bg-transparent px-1 text-center text-xs font-bold shadow-none"
                      />
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        disabled={item.quantity >= item.stock}
                        className="p-1 text-slate-400 hover:text-slate-900 disabled:opacity-35 disabled:hover:text-slate-400 dark:hover:text-white"
                        title={item.quantity >= item.stock ? `Only ${item.stock} ${formatUnitLabel(item)} available` : "Increase quantity"}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-xs font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(item.price * item.quantity)}</p>
                  </div>
                </div>
                <button onClick={() => removeFromCart(item.id)} className="absolute top-2 right-2 rounded-md p-1 text-rose-500 transition-all hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              );
            })
          )}
        </div>

        <div className="shrink-0 space-y-3 border-t border-slate-200 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="space-y-2.5 rounded-2xl bg-white p-3 ring-1 ring-slate-200 dark:bg-zinc-950 dark:ring-zinc-800">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400">Payment Method</p>
            <div className="grid grid-cols-4 gap-1.5">
              {(["CASH", "BANK", "CREDIT", "MIXED"] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={cn(
                    "rounded-xl border px-2 py-1.5 text-[9px] font-black uppercase tracking-tight transition",
                    paymentMethod === method
                      ? "border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                      : "border-slate-200 bg-slate-50 text-slate-500 hover:border-indigo-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
                  )}
                >
                  {paymentMethodLabel(method)}
                </button>
              ))}
            </div>

            {paymentMethod === "BANK" ? (
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                  Bank account
                </p>
                <BankAccountSelect
                  value={selectedBankId}
                  onChange={setSelectedBankId}
                  accounts={bankOptions}
                />
              </div>
            ) : null}

            {paymentMethod === "MIXED" ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Cash amount</label>
                  <NumericInput
                    value={cashPaid}
                    onValueChange={setCashPaid}
                    className={cn(controlMutedClass, "rounded-xl")}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Bank amount</label>
                  <NumericInput
                    value={bankPaid}
                    onValueChange={setBankPaid}
                    className={cn(controlMutedClass, "rounded-xl")}
                  />
                </div>
                {Number(bankPaid) > 0 ? (
                  <div className="col-span-2 space-y-1">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Bank account</p>
                    <BankAccountSelect
                      value={selectedBankId}
                      onChange={setSelectedBankId}
                      accounts={bankOptions}
                    />
                  </div>
                ) : null}
                <div className="col-span-2 rounded-xl bg-indigo-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-300">
                  Left on credit: {formatCurrency(Math.max(0, total - cashPaid - bankPaid))}
                </div>
              </div>
            ) : null}
          </div>

          {cart.some((item) => itemNeedsPrescription(item)) ? (
            <PrescriptionFields
              prescriptionNumber={prescriptionNumber}
              patientName={patientName}
              prescriberName={prescriberName}
              onPrescriptionNumber={setPrescriptionNumber}
              onPatientName={setPatientName}
              onPrescriberName={setPrescriberName}
            />
          ) : null}
          <div className="space-y-2">
            {taxRate > 0 ? (
              <>
                <div className="flex justify-between text-[11px] text-slate-500 font-bold uppercase tracking-widest">
                  <span>Subtotal</span>
                  <span className="text-slate-900 dark:text-white">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 font-bold uppercase tracking-widest">
                  <span>VAT ({taxRate}%)</span>
                  <span className="text-slate-900 dark:text-white">{formatCurrency(taxAmount)}</span>
                </div>
              </>
            ) : null}
            <div className="flex justify-between text-[11px] text-slate-500 font-bold uppercase tracking-widest">
              <span>Grand Total</span>
              <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(total)}</span>
            </div>
          </div>
          <button 
            onClick={handleCheckout}
            disabled={cart.length === 0} 
            className="w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-bold uppercase tracking-widest text-white shadow-lg shadow-indigo-500/20 active:scale-[0.98] disabled:opacity-30"
          >
            Checkout
          </button>
        </div>
      </div>

      <AppModal
        open={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        labelledBy="pos-quick-add-customer-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 p-6 dark:border-zinc-800">
          <div>
            <h3 id="pos-quick-add-customer-title" className="text-lg font-black text-slate-950 dark:text-white">
              Quick Add Customer
            </h3>
            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
              Available immediately in POS
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCustomerModal(false)}
            className="rounded-full p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 space-y-4 overflow-y-auto p-6">
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-300">
              Customer Name
            </label>
            <input
              type="text"
              value={newCustomer.name}
              onChange={(event) => setNewCustomer({ ...newCustomer, name: event.target.value })}
              placeholder="Full name"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none transition focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-300">
                Phone
              </label>
              <input
                type="text"
                value={newCustomer.phone}
                onChange={(event) => setNewCustomer({ ...newCustomer, phone: event.target.value })}
                placeholder="+251..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none transition focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-300">
                Email
              </label>
              <input
                type="email"
                value={newCustomer.email}
                onChange={(event) => setNewCustomer({ ...newCustomer, email: event.target.value })}
                placeholder="optional"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none transition focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
              />
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-3 border-t border-slate-100 bg-slate-50 p-6 dark:border-zinc-800 dark:bg-zinc-950/60">
          <button
            type="button"
            onClick={() => setShowCustomerModal(false)}
            className="btn-cancel h-12 flex-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleQuickAddCustomer}
            className="h-12 flex-1 rounded-xl bg-indigo-600 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-900/20 transition hover:bg-indigo-500"
          >
            Save Customer
          </button>
        </div>
      </AppModal>
    </div>
  );
}
