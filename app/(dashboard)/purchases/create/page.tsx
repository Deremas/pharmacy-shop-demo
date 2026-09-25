"use client";

import React, { useState, useMemo } from "react";
import { Truck, ArrowLeft, Save, Plus, Search, User, Package, Trash2, X, PlusCircle, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/lib/client/useAppData";
import { NumericInput } from "@/components/numeric-input";
import { cn, formatNumberWithCommas } from "@/lib/utils";
import { SearchableSelect } from "@/components/searchable-select";
import { ItemCodeBox } from "@/components/code-scanner";
import { findItemByScan } from "@/lib/pack-scan";
import { AppModal } from "@/components/app-modal";
import { formatItemChoiceLabel, formatUnitLabel, itemSelectOption } from "@/lib/item-display";
import { wholeQuantity } from "@/lib/units";
import { allocateItemCode } from "@/lib/item-code";
import { controlMutedClass, lineHeaderClass } from "@/lib/field-styles";
import { BankAccountSelect, bankAccountsOnly, needsBankAccount } from "@/components/bank-account-select";
import { paymentMethodLabel } from "@/lib/payment-display";
import { StockLocationToggle } from "@/components/stock-location-toggle";
import { stockLocationIdsFor } from "@/lib/businesses";
import { updateDraftField, useBusinessDraft } from "@/lib/client/useBusinessDraft";
import { eatTodayYmd, parseBusinessDateInput } from "@/lib/eat-date";
import { expiryInputWarning, openBatches, parseReceiptBatch } from "@/lib/inventory/receipt-batch";
import { ReceiptBatchFields } from "@/components/receipt-batch-fields";

const NO_SUPPLIER_ID = "__NO_SUPPLIER__";

interface PurchaseLine {
  id: string;
  itemId: string;
  itemName: string;
  qty: number;
  unitCost: number;
  sellingPrice: number;
  unit: string;
  batchCode: string;
  expireDate: string;
  batchChoice: string;
  noExpiry: boolean;
}

const PURCHASE_LINE_GRID =
  "grid grid-cols-[minmax(12rem,1.4fr)_minmax(11rem,1fr)_9.5rem_4.5rem_minmax(6.5rem,1fr)_minmax(6.5rem,1fr)_minmax(6rem,1fr)_2.5rem] gap-3";

const emptyPurchaseLine = (): PurchaseLine => ({
  id: Math.random().toString(36).slice(2, 11),
  itemId: "",
  itemName: "",
  qty: 1,
  unitCost: 0,
  sellingPrice: 0,
  unit: "",
  batchCode: "",
  expireDate: "",
  batchChoice: "new",
  noExpiry: false,
});

type PurchaseDraft = {
  purchaseDate: string;
  selectedSupplierId: string;
  stockLocationId: string;
  lines: PurchaseLine[];
  paymentMethod: "CASH" | "BANK" | "CREDIT" | "MIXED";
  selectedBankId: string;
  cashPaid: number;
  bankPaid: number;
};

const emptyPurchaseDraft = (): PurchaseDraft => ({
  purchaseDate: "",
  selectedSupplierId: NO_SUPPLIER_ID,
  stockLocationId: "",
  lines: [emptyPurchaseLine()],
  paymentMethod: "CASH",
  selectedBankId: "",
  cashPaid: 0,
  bankPaid: 0,
});

export default function NewPurchasePage() {
  const router = useRouter();
  const { items = [], products = [], categories = [], units = [], suppliers, addSupplier, addItem, bankAccounts, addPurchase, currentLocation, inventoryBatches = [] } = useAppData();
  const { draft, setDraft, clearDraft, draftReady } = useBusinessDraft("purchases-create", emptyPurchaseDraft);
  const purchaseDate = draft.purchaseDate;
  const selectedSupplierId = draft.selectedSupplierId;
  const stockLocationId = draft.stockLocationId;
  const lines = draft.lines;
  const paymentMethod = draft.paymentMethod;
  const selectedBankId = draft.selectedBankId;
  const cashPaid = draft.cashPaid;
  const bankPaid = draft.bankPaid;
  const setPurchaseDate = updateDraftField(setDraft, "purchaseDate");
  const setSelectedSupplierId = updateDraftField(setDraft, "selectedSupplierId");
  const setStockLocationId = updateDraftField(setDraft, "stockLocationId");
  const setLines = updateDraftField(setDraft, "lines");
  const setPaymentMethod = updateDraftField(setDraft, "paymentMethod");
  const setSelectedBankId = updateDraftField(setDraft, "selectedBankId");
  const setCashPaid = updateDraftField(setDraft, "cashPaid");
  const setBankPaid = updateDraftField(setDraft, "bankPaid");
  const [selectedLocationId, setSelectedLocationId] = useState(currentLocation?.id || "");
  const [mounted, setMounted] = useState(false);

  // Modals state
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  
  // New Supplier state
  const [newSupplier, setNewSupplier] = useState({ name: "", contact: "", phone: "" });
  
  // New Item state
  const [newItem, setNewItem] = useState({ name: "", code: "", categoryId: "", price: 0, unitId: "" });
  const [saving, setSaving] = useState(false);

  const itemCatalog = useMemo(() => {
    if (products.length > 0) return products;
    const byId = new Map<string, any>();
    items.forEach((item: any) => {
      if (!byId.has(item.id)) byId.set(item.id, item);
    });
    return [...byId.values()];
  }, [items, products]);

  const bankOptions = useMemo(() => bankAccountsOnly(bankAccounts), [bankAccounts]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!draftReady) return;
    const today = eatTodayYmd();
    setDraft((current) => {
      if (!current.purchaseDate || current.purchaseDate < today) {
        return { ...current, purchaseDate: today };
      }
      return current;
    });
  }, [draftReady, setDraft]);

  React.useEffect(() => {
    if (!currentLocation?.id) return;
    setSelectedLocationId(currentLocation.id);
    setDraft((current) => {
      if (!current.stockLocationId || stockLocationIdsFor(currentLocation.id).includes(current.stockLocationId)) {
        return current;
      }
      return { ...current, stockLocationId: "" };
    });
  }, [currentLocation?.id, setDraft]);

  React.useEffect(() => {
    if (!draftReady) return;
    setDraft((current) => {
      let changed = false;
      const nextLines = current.lines.map((line) => {
        if (!line.itemId) return line;
        if (itemCatalog.some((item: any) => item.id === line.itemId)) return line;
        changed = true;
        return { ...line, itemId: "", itemName: "", unit: "" };
      });
      return changed ? { ...current, lines: nextLines } : current;
    });
  }, [draftReady, itemCatalog, setDraft]);

  React.useEffect(() => {
    const needsAccount = paymentMethod === "BANK" || (paymentMethod === "MIXED" && Number(bankPaid) > 0);
    if (!needsAccount) return;
    if (selectedBankId && bankOptions.some((account) => account.id === selectedBankId)) return;
    setSelectedBankId(bankOptions[0]?.id || "");
  }, [paymentMethod, bankPaid, bankOptions, selectedBankId]);

  const totals = useMemo(() => {
    return lines.reduce((acc, line) => acc + (line.qty * line.unitCost), 0);
  }, [lines]);

  if (!mounted || !draftReady) return null;

  const addLine = () => {
    setLines([
      ...lines,
      emptyPurchaseLine(),
    ]);
  };

  const removeLine = (id: string) => {
    if (lines.length > 1) {
      setLines(lines.filter(line => line.id !== id));
      return;
    }
    setLines([emptyPurchaseLine()]);
  };

  const handleCancel = () => {
    clearDraft();
    router.push("/purchases");
  };

  const applyItemScan = (raw: string) => {
    const item = findItemByScan(itemCatalog, raw);
    if (!item) {
      alert("No medicine uses this code. Save the pack code on the item first.");
      return;
    }
    const filled = {
      itemId: item.id,
      itemName: formatItemChoiceLabel(item, currentLocation?.id),
      unit: formatUnitLabel(item),
      sellingPrice: Number(item.price || 0),
      qty: wholeQuantity(1, formatUnitLabel(item)),
      batchChoice: "new",
      batchCode: "",
      expireDate: "",
      noExpiry: false,
    };
    const blank = lines.find((line) => !line.itemId);
    if (blank) {
      setLines(lines.map((line) => (line.id === blank.id ? { ...line, ...filled } : line)));
      return;
    }
    setLines([...lines, { ...emptyPurchaseLine(), ...filled }]);
  };

  const updateLine = (id: string, field: keyof PurchaseLine, value: any) => {
    setLines(lines.map(line => {
      if (line.id === id) {
        if (field === 'itemId') {
          const item = itemCatalog.find((entry: any) => entry.id === value);
          return { 
            ...line, 
            itemId: value, 
            itemName: item ? formatItemChoiceLabel(item, currentLocation?.id) : "", 
            unit: formatUnitLabel(item),
            sellingPrice: item?.price || 0,
            qty: wholeQuantity(line.qty || 1, formatUnitLabel(item)),
            batchChoice: "new",
            batchCode: "",
            expireDate: "",
            noExpiry: false,
          };
        }
        if (field === "qty") {
          return { ...line, qty: wholeQuantity(Number(value) || 0, line.unit) };
        }
        return { ...line, [field]: value };
      }
      return line;
    }));
  };

  const handleQuickAddSupplier = async () => {
    if (newSupplier.name) {
      try {
        const result = await addSupplier(newSupplier);
        setSelectedSupplierId(result.id);
        setShowSupplierModal(false);
        setNewSupplier({ name: "", contact: "", phone: "" });
      } catch (error) {
        alert(error instanceof Error ? error.message : "Supplier could not be added.");
      }
    }
  };

  const handleQuickAddItem = async () => {
    if (newItem.name && selectedLocationId && newItem.unitId) {
      const categoryName =
        categories.find((category: any) => category.id === newItem.categoryId)?.name || "";
      const allocated = allocateItemCode({
        requested: newItem.code,
        name: newItem.name,
        category: categoryName,
        locationId: selectedLocationId,
        existingCodes: itemCatalog.map((item: any) => item.code),
      });
      if (allocated.duplicate) {
        alert("Another item already uses this code.");
        return;
      }
      const fullItem = { 
        ...newItem, 
        price: 0,
        stock: 0, 
        status: "Active", 
        code: allocated.code,
        locationId: selectedLocationId,
        categoryId: newItem.categoryId,
        unitId: newItem.unitId,
      };
      const result = await addItem(fullItem);
      if (result?.id) {
        const firstEmptyLine = lines.find((line) => !line.itemId)?.id || lines[0]?.id;
        if (firstEmptyLine) {
          const unit = units.find((entry: any) => entry.id === newItem.unitId);
          setLines((current) =>
            current.map((line) =>
              line.id === firstEmptyLine
                ? {
                    ...line,
                    itemId: result.id,
                    itemName: newItem.name,
                    unit: formatUnitLabel(unit),
                    sellingPrice: 0,
                  }
                : line,
            ),
          );
        }
      }
      setShowItemModal(false);
      setNewItem({ name: "", code: "", categoryId: "", price: 0, unitId: "" });
    }
  };


  const handleSave = async () => {
    if (lines.some(l => !l.itemId)) return alert("Please select items for all lines");
    try {
      lines.forEach((line) => parseReceiptBatch(line));
    } catch (error) {
      return alert(error instanceof Error ? error.message : "Check the batch and expiry on each line.");
    }
    const soon = lines.filter((line) => !line.noExpiry && expiryInputWarning(line.expireDate).startsWith("Expires"));
    if (soon.length > 0 && !window.confirm(`${soon.length} line${soon.length === 1 ? "" : "s"} expire within 90 days. Save this purchase anyway?`)) {
      return;
    }
    if (!currentLocation?.id || !stockLocationIdsFor(currentLocation.id).includes(stockLocationId)) {
      return alert("Select Counter or Store to receive this stock.");
    }

    let paidAmount = 0;
    let debtAmount = 0;

    if (paymentMethod === 'CASH' || paymentMethod === 'BANK') {
      paidAmount = totals;
    } else if (paymentMethod === 'CREDIT') {
      debtAmount = totals;
    } else if (paymentMethod === 'MIXED') {
      paidAmount = cashPaid + bankPaid;
      debtAmount = Math.max(0, totals - paidAmount);
    }

    const hasSupplier = selectedSupplierId && selectedSupplierId !== NO_SUPPLIER_ID;
    if (debtAmount > 0 && !hasSupplier) {
      return alert("Please select a supplier for credit or remaining debt purchases.");
    }
    if (needsBankAccount(paymentMethod, bankPaid) && !selectedBankId) {
      return alert("Select the bank account for this bank amount.");
    }

    const purchase = {
      supplierId: hasSupplier ? selectedSupplierId : "",
      locationId: selectedLocationId,
      stockLocationId,
      purchaseDate: parseBusinessDateInput(purchaseDate),
      totalAmount: totals,
      paidAmount,
      cashAmount: paymentMethod === 'CASH' ? totals : paymentMethod === 'MIXED' ? cashPaid : 0,
      bankAmount: paymentMethod === 'BANK' ? totals : paymentMethod === 'MIXED' ? bankPaid : 0,
      debtAmount,
      paymentMethod,
      bankAccountId: needsBankAccount(paymentMethod, bankPaid) ? selectedBankId : undefined,
      items: lines.map(line => ({
        id: line.id,
        itemId: line.itemId,
        qty: line.qty,
        unitCost: line.unitCost,
        sellingPrice: line.sellingPrice,
        total: line.qty * line.unitCost,
        batchCode: line.batchCode.trim(),
        expireDate: line.noExpiry ? null : line.expireDate,
      }))
    };

    setSaving(true);
    try {
      await addPurchase(purchase);
      clearDraft();
      router.push("/purchases");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save purchase.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative mx-auto flex min-h-full max-w-5xl flex-col animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={handleCancel}
            className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">New Purchase</h1>
            <p className="text-slate-500 mt-1 uppercase text-[10px] font-black tracking-widest">Stock Procurement Entry</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 max-w-xs space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">Supplier</label>
                  <button 
                    onClick={() => setShowSupplierModal(true)}
                    className="text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-2 py-0.5 rounded transition-colors"
                  >
                    + Quick Add
                  </button>
                </div>
                <SearchableSelect
                  value={selectedSupplierId}
                  onChange={setSelectedSupplierId}
                  placeholder="Select Supplier"
                  options={[
                    { value: NO_SUPPLIER_ID, label: "No Supplier", meta: "Paid purchase only" },
                    ...suppliers.map(s => ({ value: s.id, label: s.name, meta: s.phone })),
                  ]}
                />
              </div>
              <div className="flex-1 max-w-xs space-y-2">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">Stock Location</label>
                <StockLocationToggle
                  businessId={currentLocation?.id}
                  value={stockLocationId}
                  onChange={setStockLocationId}
                  placeholder="Select location"
                />
              </div>
              <div className="flex-1 max-w-xs space-y-2">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">Purchase Date</label>
                <input 
                  type="date" 
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className={controlMutedClass} 
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            <div className="mb-6 space-y-3">
              <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest underline decoration-indigo-500 underline-offset-8">Ordered Items</h3>
              <button 
                onClick={() => setShowItemModal(true)}
                className="text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-2 py-0.5 rounded transition-colors"
              >
                + Quick Create Item
              </button>
              </div>
              <ItemCodeBox onCode={applyItemScan} placeholder="Scan the pack code to choose the medicine" />
            </div>
            
            <div className="overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
              <div className="min-w-[68rem]">
              <div className={cn(PURCHASE_LINE_GRID, "items-end px-3 pb-1")}>
                <div className={lineHeaderClass}>Item</div>
                <div className={lineHeaderClass}>Batch</div>
                <div className={lineHeaderClass}>Expiry</div>
                <div className={lineHeaderClass}>Qty</div>
                <div className={lineHeaderClass}>Buying Price</div>
                <div className={lineHeaderClass}>Selling Price</div>
                <div className={cn(lineHeaderClass, "text-center")}>Total</div>
                <div />
              </div>
              <div className="space-y-2">
                {lines.map((line, index) => (
                  <div
                    key={line.id}
                    className={cn(
                      PURCHASE_LINE_GRID,
                      "items-start rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50",
                    )}
                  >
                    <div className="min-w-0">
                      <SearchableSelect
                        aria-label="Item"
                        value={line.itemId}
                        onChange={(value) => updateLine(line.id, 'itemId', value)}
                        placeholder="Select Item"
                        options={itemCatalog.map((item: any) =>
                          itemSelectOption(item, undefined, currentLocation?.id),
                        )}
                      />
                    </div>
                    <ReceiptBatchFields
                      compact
                      part="batch"
                      takenCodes={[
                        ...inventoryBatches.map((batch: { batchCode?: string }) => batch.batchCode),
                        ...lines.map((entry) => entry.batchCode),
                      ]}
                      value={{
                        batchChoice: line.batchChoice || "new",
                        batchCode: line.batchCode || "",
                        expireDate: line.expireDate || "",
                        noExpiry: Boolean(line.noExpiry),
                      }}
                      existingBatches={stockLocationId ? openBatches(inventoryBatches, line.itemId, stockLocationId) : []}
                      onChange={(next) => {
                        setLines(lines.map((entry) => (entry.id === line.id ? { ...entry, ...next } : entry)));
                      }}
                    />
                    <ReceiptBatchFields
                      compact
                      part="expiry"
                      value={{
                        batchChoice: line.batchChoice || "new",
                        batchCode: line.batchCode || "",
                        expireDate: line.expireDate || "",
                        noExpiry: Boolean(line.noExpiry),
                      }}
                      existingBatches={stockLocationId ? openBatches(inventoryBatches, line.itemId, stockLocationId) : []}
                      onChange={(next) => {
                        setLines(lines.map((entry) => (entry.id === line.id ? { ...entry, ...next } : entry)));
                      }}
                    />
                    <div className="min-w-0">
                      <NumericInput
                        aria-label="Qty"
                        min={0}
                        step={1}
                        value={line.qty}
                        onValueChange={(qty) => updateLine(line.id, 'qty', qty)}
                      />
                      <p className="mt-0.5 h-3 text-[9px] font-semibold leading-3 text-slate-500">{line.unit || ""}</p>
                    </div>
                    <div className="min-w-0">
                      <NumericInput
                        aria-label="Buying Price"
                        value={line.unitCost}
                        onValueChange={(unitCost) => updateLine(line.id, 'unitCost', unitCost)}
                        className="font-mono"
                      />
                      <p className="mt-0.5 h-3 text-[9px] font-semibold leading-3 text-slate-500">{line.unit ? `ETB / ${line.unit}` : ""}</p>
                    </div>
                    <div className="min-w-0">
                      <NumericInput
                        aria-label="Selling Price"
                        value={line.sellingPrice}
                        onValueChange={(sellingPrice) => updateLine(line.id, 'sellingPrice', sellingPrice)}
                        className="font-mono text-indigo-600 dark:text-indigo-400"
                      />
                      <p className="mt-0.5 h-3 text-[9px] font-semibold leading-3 text-slate-500">{line.unit ? `ETB / ${line.unit}` : ""}</p>
                    </div>
                    <div className="min-w-0">
                      <div className="flex h-11 items-center justify-center rounded-lg bg-white px-2 text-sm font-semibold font-mono text-slate-800 ring-1 ring-slate-500/70 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-500">
                        {formatNumberWithCommas(line.qty * line.unitCost)}
                      </div>
                    </div>
                    <div className="flex h-11 w-10 shrink-0 items-center justify-center">
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
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-6 underline decoration-indigo-500 underline-offset-8">Purchase Summary</h3>
            <div className="space-y-4">
              <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <span>Item Count</span>
                <span className="text-slate-900 dark:text-white">{lines.length} Lines</span>
              </div>
              <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-50 dark:border-zinc-800/50 pb-4">
                <span>Grand Total</span>
                <span className="text-indigo-600 dark:text-indigo-400 text-lg font-black italic">ETB {formatNumberWithCommas(totals)}</span>
              </div>

              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Payment Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['CASH', 'BANK', 'CREDIT', 'MIXED'].map((method) => (
                      <button
                        key={method}
                        onClick={() => setPaymentMethod(method as any)}
                        className={cn(
                          "py-2 px-3 rounded-lg text-[10px] font-bold border transition-all",
                          paymentMethod === method 
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-900/20" 
                            : "bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-600 hover:border-indigo-500"
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

                {paymentMethod === 'MIXED' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Cash amount</label>
                        <NumericInput
                          value={cashPaid}
                          onValueChange={setCashPaid}
                          className={cn(controlMutedClass, "font-mono")}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Bank amount</label>
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
                        <span className="text-slate-500">Left to pay the supplier</span>
                        <span className="text-indigo-600 font-black">ETB {formatNumberWithCommas(Math.max(0, totals - cashPaid - bankPaid))}</span>
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

      <div className="create-actions">
          <button 
             onClick={handleCancel}
             className="btn-cancel flex-1 rounded-2xl px-6 sm:flex-none sm:px-8"
          >
            Cancel
          </button>
            <button 
              onClick={handleSave}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 px-6 py-3 bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-2xl text-xs font-black shadow-xl shadow-indigo-900/30 hover:bg-indigo-500 active:scale-95 transition-all uppercase tracking-widest sm:flex-none sm:px-10"
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Saving…
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Purchase
                </>
              )}
            </button>
      </div>

      <AppModal
        open={showSupplierModal}
        onClose={() => setShowSupplierModal(false)}
        labelledBy="quick-add-supplier-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 p-6 dark:border-zinc-800">
          <h3 id="quick-add-supplier-title" className="text-lg font-black uppercase italic tracking-tighter text-slate-900 dark:text-white">
            Quick Add Supplier
          </h3>
          <button type="button" onClick={() => setShowSupplierModal(false)} className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-zinc-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 space-y-4 overflow-y-auto p-6">
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Supplier Name</label>
            <input
              type="text"
              placeholder="Company or Individual Name"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-800 dark:bg-zinc-950"
              value={newSupplier.name}
              onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Contact Person</label>
            <input
              type="text"
              placeholder="Full Name"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-800 dark:bg-zinc-950"
              value={newSupplier.contact}
              onChange={(e) => setNewSupplier({ ...newSupplier, contact: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Phone Number</label>
            <input
              type="text"
              placeholder="+251..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-800 dark:bg-zinc-950"
              value={newSupplier.phone}
              onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
            />
          </div>
        </div>
        <div className="flex shrink-0 gap-3 border-t border-slate-100 bg-slate-50/50 p-6 dark:border-zinc-800 dark:bg-zinc-950/50">
          <button type="button" onClick={() => setShowSupplierModal(false)} className="btn-cancel flex-1">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleQuickAddSupplier}
            className="flex-1 rounded-xl bg-indigo-600 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-900/20 transition-all hover:bg-indigo-500"
          >
            Create & Select
          </button>
        </div>
      </AppModal>

      <AppModal
        open={showItemModal}
        onClose={() => setShowItemModal(false)}
        contentClassName="max-w-lg"
        labelledBy="quick-create-item-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 p-6 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h3 id="quick-create-item-title" className="text-lg font-black uppercase italic tracking-tighter text-slate-900 dark:text-white">
                Quick Create Item
              </h3>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300">New Inventory Asset</p>
            </div>
          </div>
          <button type="button" onClick={() => setShowItemModal(false)} className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-zinc-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 space-y-4 overflow-y-auto p-6">
          <div className="max-w-xs space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Item Name</label>
            <input
              type="text"
              placeholder="Product display name"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-800 dark:bg-zinc-950"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-widest text-nowrap text-slate-700 dark:text-slate-300">SKU / Code (Auto if empty)</label>
              <input
                type="text"
                placeholder="Auto from name"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm uppercase outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-800 dark:bg-zinc-950"
                value={newItem.code}
                onChange={(e) => setNewItem({ ...newItem, code: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Category</label>
              <div className="relative">
                <select
                  value={newItem.categoryId}
                  onChange={(e) => setNewItem({ ...newItem, categoryId: e.target.value })}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-10 text-sm font-bold outline-none dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <option value="">No Category</option>
                  {categories.map((category: any) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>
          </div>
          <div className="max-w-xs space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Base Unit</label>
            <div className="relative">
              <select
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-10 text-sm font-bold outline-none dark:border-zinc-800 dark:bg-zinc-950"
                value={newItem.unitId}
                onChange={(e) => setNewItem({ ...newItem, unitId: e.target.value })}
              >
                <option value="" disabled>Select Unit</option>
                {units.map((unit: any) => (
                  <option key={unit.id} value={unit.id}>{formatUnitLabel(unit)}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-3 border-t border-slate-100 bg-slate-50/50 p-6 dark:border-zinc-800 dark:bg-zinc-950/50">
          <button type="button" onClick={() => setShowItemModal(false)} className="btn-cancel flex-1">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleQuickAddItem}
            className="flex-1 rounded-xl bg-indigo-600 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-900/20 transition-all hover:bg-indigo-500 active:scale-95"
          >
            Save to System
          </button>
        </div>
      </AppModal>
    </div>
  );
}
