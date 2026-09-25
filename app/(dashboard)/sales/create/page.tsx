"use client";

import React, { useState, useMemo } from "react";
import {
  Save,
  Trash2,
  X,
  PlusCircle,
  ChevronDown,
  BadgePercent,
  Tags,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useAppData } from "@/lib/client/useAppData";
import { useToast } from "@/components/toast-provider";
import { NumericInput } from "@/components/numeric-input";
import { cn, formatNumberWithCommas } from "@/lib/utils";
import { SearchableSelect } from "@/components/searchable-select";
import { ItemCodeBox } from "@/components/code-scanner";
import { BackButton } from "@/components/back-button";
import { PrescriptionFields } from "@/components/prescription-fields";
import { findItemByScan } from "@/lib/pack-scan";
import { AppModal } from "@/components/app-modal";
import { formatItemChoiceLabel, formatUnitLabel, itemSelectOption } from "@/lib/item-display";
import { capWholeQuantity } from "@/lib/units";
import { controlMutedClass, lineHeaderClass } from "@/lib/field-styles";
import { BankAccountSelect, bankAccountsOnly, needsBankAccount } from "@/components/bank-account-select";
import { paymentMethodLabel } from "@/lib/payment-display";
import { updateDraftField, useBusinessDraft } from "@/lib/client/useBusinessDraft";
import {
  WALK_IN_CUSTOMER_ID,
  WALK_IN_CUSTOMER_OPTION,
  isWalkInCustomer,
  resolveSaleCustomerId,
} from "@/lib/customer";
import { eatTodayYmd, parseBusinessDateInput } from "@/lib/eat-date";

interface SaleLine {
  id: string;
  itemId: string;
  itemName: string;
  qty: number;
  price: number;
  discount: number;
  discountType: "fixed" | "per_qty";
  unit: string;
}

const SALE_LINE_GRID =
  "grid grid-cols-[minmax(14rem,1.5fr)_5.25rem_minmax(7rem,1fr)_minmax(11.5rem,1.05fr)_minmax(7rem,0.9fr)_2.5rem] gap-3";

const emptySaleLine = (): SaleLine => ({
  id: Math.random().toString(36).slice(2, 11),
  itemId: "",
  itemName: "",
  qty: 1,
  price: 0,
  discount: 0,
  discountType: "fixed",
  unit: "",
});

type SaleDraft = {
  saleDate: string;
  selectedCustomerId: string;
  lines: SaleLine[];
  paymentMethod: "CASH" | "BANK" | "CREDIT" | "MIXED";
  selectedBankId: string;
  cashPaid: number;
  bankPaid: number;
  prescriptionNumber: string;
  patientName: string;
  prescriberName: string;
};

const emptySaleDraft = (): SaleDraft => ({
  saleDate: "",
  selectedCustomerId: WALK_IN_CUSTOMER_ID,
  lines: [emptySaleLine()],
  paymentMethod: "CASH",
  selectedBankId: "",
  cashPaid: 0,
  bankPaid: 0,
  prescriptionNumber: "",
  patientName: "",
  prescriberName: "",
});

export default function NewSalePage() {
  const router = useRouter();
  const toast = useToast();
  const { data: session } = useSession();
  const sessionUser = session?.user as { role?: string; permissions?: string[] } | undefined;
  const canSellBelowCost = sessionUser?.role === "Super Admin" || Boolean(sessionUser?.permissions?.includes("sales.sell_below_cost"));
  const {
    items,
    products = [],
    customers,
    addCustomer,
    bankAccounts,
    addSale,
    currentLocation,
    settings,
  } = useAppData();
  const { draft, setDraft, clearDraft, draftReady } = useBusinessDraft("sales-create", emptySaleDraft);
  const saleDate = draft.saleDate;
  const selectedCustomerId = draft.selectedCustomerId;
  const lines = draft.lines;
  const paymentMethod = draft.paymentMethod;
  const selectedBankId = draft.selectedBankId;
  const cashPaid = draft.cashPaid;
  const bankPaid = draft.bankPaid;
  const setSaleDate = updateDraftField(setDraft, "saleDate");
  const setSelectedCustomerId = updateDraftField(setDraft, "selectedCustomerId");
  const setLines = updateDraftField(setDraft, "lines");
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
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [mounted, setMounted] = useState(false);

  // Filter items available at current location
  const locationItems = useMemo(() => {
    if (!selectedLocationId) return [];
    return items.filter((i) => i.locationId === selectedLocationId);
  }, [items, selectedLocationId]);
  const lineNeedsPrescription = (itemId: string) => {
    if (!itemId) return false;
    const product = products.find((entry) => entry.id === itemId);
    const stock = locationItems.find((entry) => entry.id === itemId);
    return Boolean(product?.requiresPrescription || stock?.requiresPrescription);
  };
  const prescriptionSale = lines.some((line) => lineNeedsPrescription(line.itemId));
  const bankOptions = useMemo(() => bankAccountsOnly(bankAccounts), [bankAccounts]);

  // Modals state
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  // New Customer state
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: "",
  });
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!draftReady) return;
    const today = eatTodayYmd();
    setDraft((current) => {
      // Stale drafts kept yesterday's date and made "today's" sales vanish from the daily report.
      if (!current.saleDate || current.saleDate < today) {
        return { ...current, saleDate: today };
      }
      return current;
    });
  }, [draftReady, setDraft]);

  React.useEffect(() => {
    const needsAccount = paymentMethod === "BANK" || (paymentMethod === "MIXED" && Number(bankPaid) > 0);
    if (!needsAccount) return;
    if (selectedBankId && bankOptions.some((account) => account.id === selectedBankId)) return;
    setSelectedBankId(bankOptions[0]?.id || "");
  }, [paymentMethod, bankPaid, bankOptions, selectedBankId]);

  React.useEffect(() => {
    if (!currentLocation?.id) return;
    setSelectedLocationId(currentLocation.id);
  }, [currentLocation?.id]);

  React.useEffect(() => {
    if (!draftReady) return;
    setDraft((current) => {
      let changed = false;
      const nextLines = current.lines.map((line) => {
        if (!line.itemId) return line;
        if (items.some((item: any) => item.id === line.itemId)) return line;
        changed = true;
        return { ...line, itemId: "", itemName: "", price: 0, unit: "" };
      });
      return changed ? { ...current, lines: nextLines } : current;
    });
  }, [draftReady, items, setDraft]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce(
      (acc, line) => acc + line.qty * line.price,
      0,
    );
    const totalDiscount = lines.reduce((acc, line) => {
      const discountAmount =
        line.discountType === "per_qty"
          ? line.discount * line.qty
          : line.discount;
      return acc + discountAmount;
    }, 0);
    const netBeforeTax = Math.max(0, subtotal - totalDiscount);
    const taxRate = Math.max(0, Number(settings.taxRate) || 0);
    const taxAmount = netBeforeTax * (taxRate / 100);
    return {
      subtotal,
      discount: totalDiscount,
      taxRate,
      taxAmount,
      total: netBeforeTax + taxAmount,
    };
  }, [lines, settings.taxRate]);

  if (!mounted || !draftReady) return null;

  const addLine = () => {
    setLines([
      ...lines,
      {
        id: Math.random().toString(36).substr(2, 9),
        itemId: "",
        itemName: "",
        qty: 1,
        price: 0,
        discount: 0,
        discountType: "fixed",
        unit: "",
      },
    ]);
  };

  const removeLine = (id: string) => {
    if (lines.length > 1) {
      setLines(lines.filter((line) => line.id !== id));
      return;
    }
    // Last line: clear values instead of removing the row.
    setLines([emptySaleLine()]);
  };

  const handleCancel = () => {
    clearDraft();
    router.push("/sales");
  };

  const getAvailableStock = (itemId: string) => {
    return locationItems.find((item) => item.id === itemId)?.stock ?? 0;
  };

  const applyItemScan = (raw: string) => {
    const catalog = products.filter((entry) => !selectedLocationId || entry.locationId === selectedLocationId);
    const item = findItemByScan(catalog.length ? catalog : locationItems, raw);
    if (!item) {
      toast.error("No medicine uses this code. Save the pack code on the item first.");
      return;
    }
    const stockItem = locationItems.find((entry) => entry.id === item.id);
    const availableStock = Number(stockItem?.stock ?? item.stock ?? 0);
    if (availableStock <= 0) {
      toast.error("This medicine is out of stock.");
      return;
    }
    const unit = formatUnitLabel(item);
    const fill = (line: SaleLine): SaleLine => ({
      ...line,
      itemId: item.id,
      itemName: formatItemChoiceLabel(item, selectedLocationId || currentLocation?.id),
      unit,
      qty: availableStock > 0 ? capWholeQuantity(1, availableStock, unit) : 0,
      price: Number(stockItem?.price ?? item.price ?? 0),
    });
    const existing = lines.find((line) => line.itemId === item.id);
    if (existing) {
      updateLine(existing.id, "qty", Number(existing.qty) + 1);
      return;
    }
    const blank = lines.find((line) => !line.itemId);
    if (blank) {
      setLines(lines.map((line) => (line.id === blank.id ? fill(line) : line)));
      return;
    }
    setLines([...lines, fill(emptySaleLine())]);
  };

  const updateLine = (id: string, field: keyof SaleLine, value: any) => {
    setLines(
      lines.map((line) => {
        if (line.id === id) {
          if (field === "itemId") {
            const item = locationItems.find((i) => i.id === value);
            const availableStock = item?.stock ?? 0;
            return {
              ...line,
              itemId: value,
              itemName: item ? formatItemChoiceLabel(item, selectedLocationId || currentLocation?.id) : "",
              unit: formatUnitLabel(item),
              qty:
                availableStock > 0
                  ? capWholeQuantity(Math.max(1, line.qty), availableStock, formatUnitLabel(item))
                  : 0,
              price: item?.price || 0,
            };
          }
          if (field === "qty") {
            const availableStock = getAvailableStock(line.itemId);
            return { ...line, qty: capWholeQuantity(Number(value) || 0, availableStock, line.unit) };
          }
          return { ...line, [field]: value };
        }
        return line;
      }),
    );
  };

  const handleQuickAddCustomer = async () => {
    if (newCustomer.name) {
      try {
        const result = await addCustomer(newCustomer);
        setSelectedCustomerId(result.id);
        setShowCustomerModal(false);
        setNewCustomer({ name: "", phone: "", email: "" });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Customer could not be added.");
      }
    }
  };

  const handleSave = async (mode: "COMPLETE" | "HOLD" = "COMPLETE", allowBelowCost = false) => {
    if (!selectedLocationId) {
      toast.error("Please select a sale location");
      return;
    }
    if (lines.some((l) => !l.itemId)) {
      toast.error("Please select items for all lines");
      return;
    }
    const invalidQtyLine = lines.find((line) => line.qty <= 0);
    if (invalidQtyLine) {
      toast.error(
        "Quantity must be greater than zero for every selected item.",
      );
      return;
    }
    const overStockLine = lines.find(
      (line) => line.qty > getAvailableStock(line.itemId),
    );
    if (overStockLine) {
      toast.error({
        title: "Not enough stock",
        description: `${overStockLine.itemName} only has ${getAvailableStock(overStockLine.itemId)} ${overStockLine.unit} available.`,
      });
      return;
    }

    let cashAmount = 0;
    let bankAmount = 0;
    let creditAmount = 0;

    if (paymentMethod === "CASH") {
      cashAmount = totals.total;
    } else if (paymentMethod === "BANK") {
      bankAmount = totals.total;
    } else if (paymentMethod === "CREDIT") {
      creditAmount = totals.total;
    } else if (paymentMethod === "MIXED") {
      cashAmount = cashPaid;
      bankAmount = bankPaid;
      creditAmount = Math.max(0, totals.total - cashAmount - bankAmount);
    }

    if (prescriptionSale && !prescriptionNumber.trim()) {
      toast.error("This sale includes a prescription medicine. Enter the prescription number.");
      return;
    }

    if (mode === "COMPLETE") {
      if (needsBankAccount(paymentMethod, bankPaid) && !selectedBankId) {
        toast.error("Select the bank account for this bank amount.");
        return;
      }
      if (creditAmount > 0 && isWalkInCustomer(selectedCustomerId)) {
        toast.error("Credit sales require a customer. Walk-in cannot be used for credit.");
        return;
      }
    }

    const sale = {
      customerId: resolveSaleCustomerId(selectedCustomerId),
      locationId: selectedLocationId,
      saleDate: parseBusinessDateInput(saleDate),
      subTotal: totals.subtotal,
      discount: totals.discount,
      totalAmount: totals.total,
      cashAmount,
      bankAmount,
      creditAmount,
      paymentMethod,
      bankAccountId: needsBankAccount(paymentMethod, bankAmount) ? selectedBankId : undefined,
      submitMode: mode,
      allowBelowCost,
      prescriptionNumber: prescriptionSale ? prescriptionNumber.trim() : "",
      patientName: prescriptionSale ? patientName.trim() : "",
      prescriberName: prescriptionSale ? prescriberName.trim() : "",
      items: lines.map((line) => ({
        id: line.id,
        itemId: line.itemId,
        qty: line.qty,
        price: line.price,
        discount: line.discount,
        total:
          line.qty * line.price -
          (line.discountType === "per_qty"
            ? line.discount * line.qty
            : line.discount),
      })),
    };

    setSaving(true);
    try {
      const result = await addSale(sale);
      clearDraft();
      toast.success(mode === "HOLD" ? "Voucher sent to the cashier" : "Sale saved successfully");
      const telegram = result?.telegram;
      if (telegram && !telegram.ok) {
        toast.error({
          title: mode === "HOLD" ? "Voucher sent, but Telegram failed" : "Sale saved, but Telegram failed",
          description: telegram.error || telegram.skipped || "Check TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID on Vercel.",
        });
      }
      router.push(mode === "HOLD" ? "/sales/pending" : "/sales");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sale could not be saved.";
      if (canSellBelowCost && !allowBelowCost && message.toLowerCase().includes("selling below cost")) {
        const approved = window.confirm(`${message}\n\nApprove and continue?`);
        if (approved) {
          setSaving(false);
          return handleSave(mode, true);
        }
      }
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative mx-auto flex min-h-full max-w-5xl flex-col animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex-1 space-y-6">
      <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              New Sale
            </h1>
            <p className="mt-1 max-w-xl text-sm font-medium text-slate-500">
              Add the medicines here. Save sale takes the money now. Send to cashier holds the stock until the cashier is paid.
            </p>
          </div>
          <BackButton onClick={handleCancel} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            <div className="grid gap-6 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                  Sale Location
                </label>
                <div className="flex h-12 items-center rounded-lg border border-slate-200 bg-slate-50 px-4 text-xs font-black uppercase tracking-widest text-slate-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                  {currentLocation?.name || "Select a business in the top bar"}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                    Customer Name
                  </label>
                  <button
                    onClick={() => setShowCustomerModal(true)}
                    className="text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 px-2 py-0.5 rounded transition-colors"
                  >
                    + Quick Add
                  </button>
                </div>
                <SearchableSelect
                  value={selectedCustomerId}
                  onChange={setSelectedCustomerId}
                  placeholder="Select Customer"
                  options={[
                    WALK_IN_CUSTOMER_OPTION,
                    ...customers.map((c) => ({
                      value: c.id,
                      label: c.name,
                      meta: c.phone,
                    })),
                  ]}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                  Sale Date
                </label>
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className={controlMutedClass}
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            <div className="mb-6 space-y-3">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest underline decoration-indigo-500 underline-offset-8">
                Added Items
              </h3>
              <ItemCodeBox onCode={applyItemScan} placeholder="Scan the pack code to add the medicine" />
            </div>

            <div className="overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
              <div className="min-w-[44rem]">
              <div className={cn(SALE_LINE_GRID, "items-end px-3 pb-1")}>
                <div className={lineHeaderClass}>Item</div>
                <div className={lineHeaderClass}>Qty</div>
                <div className={lineHeaderClass}>Price</div>
                <div className={lineHeaderClass}>Discount</div>
                <div className={cn(lineHeaderClass, "text-center")}>Subtotal</div>
                <div />
              </div>
              <div className="space-y-2">
                {lines.map((line, index) => (
                  <div
                    key={line.id}
                    className={cn(
                      SALE_LINE_GRID,
                      "items-start rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50",
                    )}
                  >
                    <div className="min-w-0">
                      <SearchableSelect
                        aria-label="Item"
                        value={line.itemId}
                        onChange={(value) =>
                          updateLine(line.id, "itemId", value)
                        }
                        placeholder="Select Item"
                        options={locationItems
                          .filter((item) => item.stock > 0)
                          .map((item) =>
                            itemSelectOption(
                              item,
                              `${item.stock} ${formatUnitLabel(item)} available`,
                              selectedLocationId || currentLocation?.id,
                            ),
                          )}
                      />
                      <p className="mt-0.5 h-3 text-[9px] font-black uppercase tracking-widest text-indigo-600">
                        {lineNeedsPrescription(line.itemId) ? "Rx" : ""}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <NumericInput
                        aria-label={
                          line.itemId
                            ? `Qty, max ${Math.max(0, getAvailableStock(line.itemId))}`
                            : "Qty"
                        }
                        min={0}
                        step={1}
                        max={getAvailableStock(line.itemId)}
                        value={line.qty}
                        onValueChange={(qty) => updateLine(line.id, "qty", qty)}
                      />
                      <p className="mt-0.5 h-3 text-[9px] font-semibold leading-3 text-slate-500">
                        {line.itemId
                          ? `${line.unit || "units"} · max ${Math.max(0, getAvailableStock(line.itemId))}`
                          : ""}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <NumericInput
                        aria-label="Price"
                        value={line.price}
                        onValueChange={(price) => updateLine(line.id, "price", price)}
                        className="font-mono"
                      />
                      <p className="mt-0.5 h-3 text-[9px] font-semibold leading-3 text-slate-500">
                        {line.unit ? `ETB / ${line.unit}` : ""}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <div className="grid h-11 grid-cols-[minmax(0,1fr)_5.15rem] overflow-hidden rounded-lg bg-white dark:bg-zinc-900">
                        <NumericInput
                          aria-label="Discount"
                          value={line.discount}
                          onValueChange={(discount) => updateLine(line.id, "discount", discount)}
                          className="rounded-none bg-transparent font-mono focus:ring-0"
                        />
                        <div className="relative">
                          {line.discountType === "fixed" ? (
                            <Tags className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-amber-600 dark:text-amber-400 pointer-events-none" />
                          ) : (
                            <BadgePercent className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 pointer-events-none" />
                          )}
                          <select
                            value={line.discountType}
                            onChange={(e) =>
                              updateLine(
                                line.id,
                                "discountType",
                                e.target.value as SaleLine["discountType"],
                              )
                            }
                            className="h-11 w-full cursor-pointer appearance-none bg-slate-50 pl-6 pr-2 text-[10px] font-black uppercase tracking-tight text-slate-700 outline-none dark:bg-zinc-950 dark:text-zinc-200"
                            aria-label="Discount type"
                          >
                            <option value="fixed">Fixed</option>
                            <option value="per_qty">Per Qty</option>
                          </select>
                          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="flex h-11 items-center justify-center rounded-lg bg-white px-2 text-sm font-semibold font-mono text-slate-800 ring-1 ring-slate-500/70 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-500">
                        {formatNumberWithCommas(
                          line.qty * line.price -
                          (line.discountType === "per_qty"
                            ? line.discount * line.qty
                            : line.discount)
                        )}
                      </div>
                    </div>
                    <div className="flex h-11 w-9 shrink-0 items-center justify-center">
                      <button
                        type="button"
                        onClick={() => removeLine(line.id)}
                        className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all active:scale-90"
                        aria-label={index === 0 && lines.length === 1 ? "Clear item line" : "Remove item line"}
                        title={index === 0 && lines.length === 1 ? "Clear line" : "Remove line"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={addLine}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[11px] font-black shadow-lg shadow-indigo-900/30 hover:bg-indigo-500 transition-all active:scale-95 uppercase tracking-widest"
              >
                <PlusCircle className="w-4 h-4" />
                Add Item Line
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm sticky top-6 overflow-visible z-20">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-6 underline decoration-indigo-500 underline-offset-8">
              Summary & Payment
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <span>Gross Subtotal</span>
                <span className="text-slate-900 dark:text-white">
                  ETB {totals.subtotal.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <span>Total Discount</span>
                <span className="text-rose-600">
                  - ETB {totals.discount.toLocaleString()}
                </span>
              </div>
              {totals.taxRate > 0 ? (
                <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <span>VAT ({totals.taxRate}%)</span>
                  <span className="text-slate-900 dark:text-white">
                    ETB {totals.taxAmount.toLocaleString()}
                  </span>
                </div>
              ) : null}
              <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 flex justify-between items-center mb-6">
                <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                  Net Total
                </span>
                <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter italic">
                  ETB {totals.total.toLocaleString()}
                </span>
              </div>

              <div className="space-y-4 border-t border-slate-50 dark:border-zinc-800/50 pt-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                    Payment Method
                  </label>
                  <p className="text-xs font-medium leading-5 text-slate-500">
                    Used only by Save sale. Send to cashier leaves the payment for the cashier.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {["CASH", "BANK", "CREDIT", "MIXED"].map((method) => (
                      <button
                        key={method}
                        onClick={() => setPaymentMethod(method as any)}
                        className={cn(
                          "py-2 px-3 rounded-lg text-[10px] font-bold border transition-all",
                          paymentMethod === method
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-900/20"
                            : "bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-600 hover:border-indigo-500",
                        )}
                      >
                        {paymentMethodLabel(method)}
                      </button>
                    ))}
                  </div>
                </div>

                {paymentMethod === "BANK" ? (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                      Bank account
                    </label>
                    <BankAccountSelect
                      value={selectedBankId}
                      onChange={setSelectedBankId}
                      accounts={bankOptions}
                    />
                  </div>
                ) : null}

                {paymentMethod === "MIXED" && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                          Cash amount
                        </label>
                        <NumericInput
                          value={cashPaid}
                          onValueChange={setCashPaid}
                          className={cn(controlMutedClass, "font-mono")}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                          Bank amount
                        </label>
                        <NumericInput
                          value={bankPaid}
                          onValueChange={setBankPaid}
                          className={cn(controlMutedClass, "font-mono")}
                        />
                      </div>
                    </div>

                    {Number(bankPaid) > 0 ? (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                        <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                          Bank account
                        </label>
                        <BankAccountSelect
                          value={selectedBankId}
                          onChange={setSelectedBankId}
                          accounts={bankOptions}
                        />
                      </div>
                    ) : null}

                    <div className="p-3 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                      <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-slate-500">
                          Left on credit
                        </span>
                        <span className="text-indigo-600 font-black">
                          ETB {formatNumberWithCommas(Math.max(0, totals.total - cashPaid - bankPaid))}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      {prescriptionSale ? (
        <PrescriptionFields
          prescriptionNumber={prescriptionNumber}
          patientName={patientName}
          prescriberName={prescriberName}
          onPrescriptionNumber={setPrescriptionNumber}
          onPatientName={setPatientName}
          onPrescriberName={setPrescriberName}
        />
      ) : null}

      <div className="mt-auto flex flex-col gap-3 border-t border-slate-200 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-zinc-800">
          <p className="text-xs font-medium text-slate-500">
            Send to cashier holds the stock. Save sale takes the money now.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            onClick={handleCancel}
            className="btn-cancel w-full rounded-2xl px-6 sm:w-auto sm:px-8"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSave("HOLD")}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-black uppercase tracking-widest text-amber-800 disabled:opacity-60 sm:w-auto sm:px-8"
          >
            Send to cashier
          </button>
          <button
              onClick={() => handleSave("COMPLETE")}
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 px-4 py-3 bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-2xl text-xs font-black shadow-xl shadow-indigo-900/30 hover:bg-indigo-500 active:scale-95 transition-all uppercase tracking-widest sm:w-auto sm:px-8"
            >
              {saving ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8z"
                    />
                  </svg>
                  Saving…
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Sale
                </>
              )}
          </button>
          </div>
      </div>

      <AppModal
        open={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        labelledBy="quick-add-customer-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 p-6 dark:border-zinc-800">
          <h3
            id="quick-add-customer-title"
            className="text-lg font-black uppercase italic tracking-tighter text-slate-900 dark:text-white"
          >
            Quick Add Customer
          </h3>
          <button
            type="button"
            onClick={() => setShowCustomerModal(false)}
            className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 space-y-4 overflow-y-auto p-6">
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
              Customer Name
            </label>
            <input
              type="text"
              placeholder="Full Name"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-800 dark:bg-zinc-950"
              value={newCustomer.name}
              onChange={(e) =>
                setNewCustomer({ ...newCustomer, name: e.target.value })
              }
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
              Phone Number
            </label>
            <input
              type="text"
              placeholder="+251..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-800 dark:bg-zinc-950"
              value={newCustomer.phone}
              onChange={(e) =>
                setNewCustomer({ ...newCustomer, phone: e.target.value })
              }
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
              Email Address
            </label>
            <input
              type="email"
              placeholder="customer@example.com"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-800 dark:bg-zinc-950"
              value={newCustomer.email}
              onChange={(e) =>
                setNewCustomer({ ...newCustomer, email: e.target.value })
              }
            />
          </div>
        </div>
        <div className="flex shrink-0 gap-3 border-t border-slate-100 bg-slate-50/50 p-6 dark:border-zinc-800 dark:bg-zinc-950/50">
          <button
            type="button"
            onClick={() => setShowCustomerModal(false)}
            className="btn-cancel flex-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleQuickAddCustomer}
            className="flex-1 rounded-xl bg-indigo-600 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-900/20 transition-all hover:bg-indigo-500"
          >
            Create & Select
          </button>
        </div>
      </AppModal>
    </div>
  );
}
