"use client";

import React, { Suspense, useState } from "react";
import { Save, Barcode, Layers, Tag, X, ChevronDown } from "lucide-react";
import { CodeScanButton } from "@/components/code-scanner";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppData } from "@/lib/client/useAppData";
import { motion, AnimatePresence } from "motion/react";
import { NumericInput } from "@/components/numeric-input";
import { formatUnitLabel } from "@/lib/item-display";
import { wholeQuantity } from "@/lib/units";
import { allocateItemCode, suggestItemCode } from "@/lib/item-code";
import { useBusinessDraft } from "@/lib/client/useBusinessDraft";
import { BackButton } from "@/components/back-button";

export default function CreateItemPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs font-black uppercase tracking-widest text-slate-500">Loading item…</div>}>
      <CreateItemForm />
    </Suspense>
  );
}

function CreateItemForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const { addItem, updateItem, addCategory, addUnit, categories = [], units = [], products = [], items = [], inventoryBatches = [], sales = [], purchases = [], currentLocation, loading } = useAppData();
  const visibleCategories = React.useMemo(
    () => categories.filter((category: any) => String(category?.name || "").trim()),
    [categories],
  );
  const editingItem = React.useMemo(
    () =>
      editId
        ? products.find((item: any) => item.id === editId) || items.find((item: any) => item.id === editId) || null
        : null,
    [editId, items, products],
  );
  const emptyItemForm = () => ({
    name: "",
    code: "",
    barcode: "",
    categoryId: "",
    stock: 0,
    unitId: "",
    buyingPrice: 0,
    sellingPrice: 0,
    lowStockAlert: 10,
    status: "Active",
    genericName: "",
    brandName: "",
    dosageForm: "",
    strength: "",
    packSize: "",
    manufacturer: "",
    countryOfOrigin: "",
    requiresPrescription: false,
    isControlled: false,
  });
  const { draft: formData, setDraft: setFormData, clearDraft, draftReady } = useBusinessDraft(
    "items-create",
    emptyItemForm,
    { enabled: !editId },
  );
  const selectedUnitName = formatUnitLabel(units.find((unit: any) => unit.id === formData.unitId) || editingItem);
  const unitLocked = Boolean(
    editId && (
      inventoryBatches.some((batch: any) => batch.itemId === editId)
      || sales.some((sale: any) => (sale.items || []).some((line: any) => line.itemId === editId))
      || purchases.some((purchase: any) => (purchase.items || []).some((line: any) => line.itemId === editId))
    ),
  );

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newUnitName, setNewUnitName] = useState("");
  const [newUnitShortName, setNewUnitShortName] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [codeManual, setCodeManual] = useState(false);
  const codeManualRef = React.useRef(false);
  const markCodeManual = (next: boolean) => {
    codeManualRef.current = next;
    setCodeManual(next);
  };
  const fieldClass =
    "h-auto min-h-12 w-full rounded-xl bg-white px-4 py-3 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-indigo-500/15 dark:bg-zinc-950";
  const namePlaceholder = "e.g. Paracetamol 500mg";
  const selectedCategoryName =
    visibleCategories.find((category: any) => category.id === formData.categoryId)?.name || "";
  const existingCodes = React.useMemo(
    () =>
      [...products, ...items]
        .filter((item: any) => item?.id !== editId)
        .map((item: any) => item?.code)
        .filter(Boolean),
    [editId, items, products],
  );
  const suggestedCode = React.useMemo(
    () =>
      suggestItemCode({
        name: formData.name,
        category: selectedCategoryName,
        locationId: currentLocation?.id,
      }),
    [currentLocation?.id, formData.name, selectedCategoryName],
  );

  React.useLayoutEffect(() => {
    if (!draftReady || editId) return;
    if (!formData.code) return;
    const generated = allocateItemCode({
      name: formData.name,
      category: selectedCategoryName,
      locationId: currentLocation?.id,
      existingCodes,
    }).code;
    if (formData.code !== generated) markCodeManual(true);
  }, [draftReady]);

  React.useEffect(() => {
    if (!draftReady || editId || codeManualRef.current) return;
    const next = suggestedCode
      ? allocateItemCode({
          name: formData.name,
          category: selectedCategoryName,
          locationId: currentLocation?.id,
          existingCodes,
        }).code
      : "";
    if (next !== formData.code) {
      setFormData((current) => ({ ...current, code: next }));
    }
  }, [
    currentLocation?.id,
    draftReady,
    editId,
    existingCodes,
    formData.code,
    formData.name,
    selectedCategoryName,
    setFormData,
    suggestedCode,
  ]);

  React.useEffect(() => {
    if (!editId || !editingItem) return;
    markCodeManual(true);
    setFormData({
      name: editingItem.name || "",
      code: editingItem.code || "",
      barcode: editingItem.barcode || "",
      categoryId: editingItem.categoryId || "",
      stock: 0,
      unitId: editingItem.unitId || "",
      buyingPrice: Number(editingItem.buyingPrice || 0),
      sellingPrice: Number(editingItem.sellingPrice ?? editingItem.price ?? 0),
      lowStockAlert: Number(editingItem.lowStockAlert ?? 10),
      status: editingItem.status === "Inactive" ? "Inactive" : "Active",
      genericName: editingItem.genericName || "",
      brandName: editingItem.brandName || "",
      dosageForm: editingItem.dosageForm || "",
      strength: editingItem.strength || "",
      packSize: editingItem.packSize || "",
      manufacturer: editingItem.manufacturer || "",
      countryOfOrigin: editingItem.countryOfOrigin || "",
      requiresPrescription: Boolean(editingItem.requiresPrescription),
      isControlled: Boolean(editingItem.isControlled),
    });
  }, [editId, editingItem, setFormData]);

  const handleSave = async () => {
    if (editId && !editingItem) {
      setSaveError("This item could not be found in the current business.");
      return;
    }
    if (!formData.name) return;
    if (!formData.unitId) {
      setSaveError("Select the unit this medicine is stocked and sold in.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      if (editId) {
        await updateItem({
          id: editId,
          name: formData.name,
          code: formData.code,
          barcode: formData.barcode,
          categoryId: formData.categoryId,
          unitId: formData.unitId,
          buyingPrice: formData.buyingPrice,
          sellingPrice: formData.sellingPrice,
          lowStockAlert: formData.lowStockAlert,
          status: formData.status,
          locationId: currentLocation?.id,
          genericName: formData.genericName,
          brandName: formData.brandName,
          dosageForm: formData.dosageForm,
          strength: formData.strength,
          packSize: formData.packSize,
          manufacturer: formData.manufacturer,
          countryOfOrigin: formData.countryOfOrigin,
          requiresPrescription: formData.requiresPrescription,
          isControlled: formData.isControlled,
        });
      } else {
        const allocated = allocateItemCode({
          requested: formData.code,
          name: formData.name,
          category: selectedCategoryName,
          locationId: currentLocation?.id,
          existingCodes,
        });
        if (allocated.duplicate) {
          setSaveError("Another item already uses this code.");
          setSaving(false);
          return;
        }
        await addItem({
          ...formData,
          code: allocated.code,
          price: formData.sellingPrice,
          categoryId: formData.categoryId,
          unitId: formData.unitId,
          locationId: currentLocation?.id,
        });
      }
      if (!editId) clearDraft();
      router.push("/items");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : editId ? "Failed to update item." : "Failed to create item.");
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAddCategory = () => {
    const name = newCategoryName.trim();
    if (name) {
      addCategory({ name })
        .then((result: any) => {
          if (result?.id) {
            setFormData((current) => ({ ...current, categoryId: result.id }));
          }
          setShowCategoryModal(false);
          setNewCategoryName("");
        })
        .catch(() => undefined);
    }
  };

  const handleQuickAddUnit = () => {
    const name = newUnitName.trim();
    if (name) {
      addUnit({ name, shortName: newUnitShortName.trim() || name.slice(0, 3).toUpperCase() })
        .then((result: any) => {
          if (result?.id) {
            setFormData((current) => ({ ...current, unitId: result.id }));
          }
          setShowUnitModal(false);
          setNewUnitName("");
          setNewUnitShortName("");
        })
        .catch(() => undefined);
    }
  };


  const handleCancel = () => {
    if (!editId) clearDraft();
    router.push("/items");
  };

  return (
    <div className="mx-auto flex min-h-full max-w-4xl flex-col animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex-1 space-y-6">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4 pb-6 dark:border-zinc-800">
          <div className="min-w-0">
            <h1 className="px-1 text-3xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
              {editId ? "Edit Item" : "Create New Item"}
            </h1>
            <p className="mt-1 px-1 text-[10px] font-semibold uppercase tracking-widest text-slate-700 dark:text-zinc-300">
              {editId ? "Update item details for this business" : "Inventory Asset Registration"}
            </p>
          </div>
          <BackButton onClick={handleCancel} />
      </div>

      {editId && loading && !editingItem ? (
        <p className="px-4 text-xs font-semibold uppercase tracking-widest text-slate-700">Loading item details…</p>
      ) : null}
      {editId && !loading && !editingItem ? (
        <p className="px-4 text-xs font-semibold uppercase tracking-widest text-rose-600">This item was not found in the current business.</p>
      ) : null}

      <div className="p-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
          <h3 className="mb-6 border-b border-slate-100 pb-4 text-sm font-bold uppercase tracking-widest text-slate-800 dark:border-zinc-800 dark:text-zinc-200">General Information</h3>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-12">
            <div className="space-y-2 sm:col-span-2 lg:col-span-8">
              <label className="px-1 text-[11px] font-semibold uppercase tracking-widest text-slate-800 dark:text-zinc-200">Item Name</label>
              <input
                type="text"
                placeholder={namePlaceholder}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={fieldClass}
              />
            </div>

            <div className="space-y-2 sm:col-span-1 lg:col-span-4">
              <label className="px-1 text-[11px] font-semibold uppercase tracking-widest text-slate-800 dark:text-zinc-200">Asset Code</label>
              <div className="relative">
                <Barcode className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                <input
                  type="text"
                  placeholder={suggestedCode || "Auto from name"}
                  value={formData.code}
                  onChange={(event) => {
                    const code = event.target.value;
                    markCodeManual(code.trim().length > 0);
                    setFormData({ ...formData, code });
                  }}
                  className={`${fieldClass} pl-11 font-mono`}
                />
              </div>
              <p className="px-1 text-[10px] font-semibold text-slate-600 dark:text-zinc-400">
                {codeManual ? "Custom code" : formData.code ? "Generated from the item name" : "Leave blank and the system fills this"}
              </p>
            </div>

            <div className="space-y-2 sm:col-span-2 lg:col-span-12">
              <label className="px-1 text-[11px] font-semibold uppercase tracking-widest text-slate-800 dark:text-zinc-200">Pack code</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Barcode on every pack"
                  value={formData.barcode || ""}
                  onChange={(event) => setFormData({ ...formData, barcode: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.preventDefault();
                  }}
                  className={`${fieldClass} font-mono`}
                />
                <CodeScanButton
                  label="Scan pack code"
                  onScan={(code) => setFormData({ ...formData, barcode: code.trim() })}
                />
              </div>
              <p className="px-1 text-[10px] font-semibold text-slate-600 dark:text-zinc-400">
                The code that is the same on every pack. A scan at the till uses it. Leave it blank if the pack has no code.
              </p>
            </div>

            <div className="space-y-2 sm:col-span-1 lg:col-span-4">
              <label className="px-1 text-[11px] font-semibold uppercase tracking-widest text-slate-800 dark:text-zinc-200">Generic name</label>
              <input value={formData.genericName || ""} onChange={(e) => setFormData({ ...formData, genericName: e.target.value })} className={fieldClass} placeholder="Amoxicillin" />
            </div>
            <div className="space-y-2 sm:col-span-1 lg:col-span-4">
              <label className="px-1 text-[11px] font-semibold uppercase tracking-widest text-slate-800 dark:text-zinc-200">Brand</label>
              <input value={formData.brandName || ""} onChange={(e) => setFormData({ ...formData, brandName: e.target.value })} className={fieldClass} />
            </div>
            <div className="space-y-2 sm:col-span-1 lg:col-span-4">
              <label className="px-1 text-[11px] font-semibold uppercase tracking-widest text-slate-800 dark:text-zinc-200">Dosage form</label>
              <select value={formData.dosageForm || ""} onChange={(e) => setFormData({ ...formData, dosageForm: e.target.value })} className={fieldClass}>
                <option value="">Select</option>
                {["Tablet", "Capsule", "Syrup", "Suspension", "Cream", "Drops", "Injection", "Sachet"].map((form) => (
                  <option key={form} value={form}>{form}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-1 lg:col-span-3">
              <label className="px-1 text-[11px] font-semibold uppercase tracking-widest text-slate-800 dark:text-zinc-200">Strength</label>
              <input value={formData.strength || ""} onChange={(e) => setFormData({ ...formData, strength: e.target.value })} className={fieldClass} placeholder="500mg" />
            </div>
            <div className="space-y-2 sm:col-span-1 lg:col-span-3">
              <label className="px-1 text-[11px] font-semibold uppercase tracking-widest text-slate-800 dark:text-zinc-200">Pack size</label>
              <input value={formData.packSize || ""} onChange={(e) => setFormData({ ...formData, packSize: e.target.value })} className={fieldClass} placeholder="20" />
              <p className="px-1 text-[10px] font-semibold text-slate-500">Informational only. It does not change quantity or price.</p>
            </div>
            <div className="space-y-2 sm:col-span-1 lg:col-span-3">
              <label className="px-1 text-[11px] font-semibold uppercase tracking-widest text-slate-800 dark:text-zinc-200">Manufacturer</label>
              <input value={formData.manufacturer || ""} onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })} className={fieldClass} />
            </div>
            <div className="space-y-2 sm:col-span-1 lg:col-span-3">
              <label className="px-1 text-[11px] font-semibold uppercase tracking-widest text-slate-800 dark:text-zinc-200">Country</label>
              <input value={formData.countryOfOrigin || ""} onChange={(e) => setFormData({ ...formData, countryOfOrigin: e.target.value })} className={fieldClass} />
            </div>
            <label className="flex items-center gap-2 px-1 text-xs font-bold text-slate-700 sm:col-span-2 lg:col-span-6">
              <input type="checkbox" checked={Boolean(formData.requiresPrescription)} onChange={(e) => setFormData({ ...formData, requiresPrescription: e.target.checked })} />
              Requires prescription
            </label>
            <label className="flex items-center gap-2 px-1 text-xs font-bold text-slate-700 sm:col-span-2 lg:col-span-6">
              <input type="checkbox" checked={Boolean(formData.isControlled)} onChange={(e) => setFormData({ ...formData, isControlled: e.target.checked })} />
              Controlled medicine
            </label>

            <div className="space-y-2 sm:col-span-1 lg:col-span-5">
              <div className="flex items-center justify-between px-1">
                <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-800 dark:text-zinc-200">Category</label>
                <button
                  onClick={() => setShowCategoryModal(true)}
                  className="rounded-lg px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                >
                  + NEW
                </button>
              </div>
              <div className="relative">
                <Tag className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className={`${fieldClass} appearance-none pl-11 pr-10`}
                >
                  <option value="">No Category</option>
                  {visibleCategories.map((cat: any) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-700" />
              </div>
            </div>

            <div className="space-y-2 lg:col-span-4">
              <div className="flex items-center justify-between px-1">
                <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-800 dark:text-zinc-200">Unit</label>
              </div>
              <div className="relative">
                <Layers className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                <select
                  value={formData.unitId}
                  disabled={unitLocked}
                  onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
                  className={`${fieldClass} appearance-none pl-11 pr-10 disabled:cursor-not-allowed disabled:opacity-70`}
                >
                  <option value="" disabled>Select Unit</option>
                  {units.map((u: any) => (
                    <option key={u.id} value={u.id}>{formatUnitLabel(u)}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-700" />
              </div>
              <p className="px-1 text-[10px] font-semibold text-slate-500">
                {unitLocked
                  ? "This unit stays fixed because the medicine already has stock or transactions."
                  : "Every purchase, batch, sale, and stock count uses this one unit."}
              </p>
            </div>

            <div className="space-y-2 lg:col-span-3">
              <label className="px-1 text-[11px] font-semibold uppercase tracking-widest text-slate-800 dark:text-zinc-200">Status</label>
              <div className="relative">
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className={`${fieldClass} appearance-none pr-10`}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-700" />
              </div>
            </div>

            <div className="space-y-2 lg:col-span-4">
              <label className="px-1 text-[11px] font-semibold uppercase tracking-widest text-slate-800 dark:text-zinc-200">Buying Price{selectedUnitName ? ` (ETB / ${selectedUnitName})` : ""}</label>
              <NumericInput
                value={formData.buyingPrice}
                onValueChange={(buyingPrice) => setFormData({ ...formData, buyingPrice })}
                className={fieldClass}
              />
            </div>
            <div className="space-y-2 lg:col-span-4">
              <label className="px-1 text-[11px] font-semibold uppercase tracking-widest text-slate-800 dark:text-zinc-200">Selling Price{selectedUnitName ? ` (ETB / ${selectedUnitName})` : ""}</label>
              <NumericInput
                value={formData.sellingPrice}
                onValueChange={(sellingPrice) => setFormData({ ...formData, sellingPrice })}
                className={fieldClass}
              />
            </div>
            <div className="space-y-2 lg:col-span-4">
              <label className="px-1 text-[11px] font-semibold uppercase tracking-widest text-slate-800 dark:text-zinc-200">Low Stock At{selectedUnitName ? ` (${selectedUnitName})` : ""}</label>
              <NumericInput
                min={0}
                step={1}
                value={formData.lowStockAlert ?? 10}
                onValueChange={(lowStockAlert) => setFormData({ ...formData, lowStockAlert: wholeQuantity(lowStockAlert, selectedUnitName) })}
                className={fieldClass}
              />
              <p className="px-1 text-[10px] font-medium text-slate-500">Alert when shop + store qty is at or below this.</p>
            </div>
          </div>
        </div>
      </div>
      </div>

      <div className="create-actions">
          {saveError && <p className="mr-auto w-full text-xs font-bold text-rose-500 sm:w-auto">{saveError}</p>}
          <button 
             type="button"
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
                {editId ? "Save Changes" : "Save Item"}
              </>
            )}
          </button>
      </div>

      {/* Category Modal */}
      <AnimatePresence>
        {showCategoryModal && (
          <div className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain flex justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCategoryModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 my-auto max-h-[min(92dvh,calc(100dvh-2rem))] overflow-y-auto"
            >
              <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter">Quick Add Category</h3>
                <button onClick={() => setShowCategoryModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-800 dark:text-zinc-200">Category Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Analgesics"
                    className={fieldClass}
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
              <div className="p-6 bg-slate-50/50 dark:bg-zinc-950/50 flex gap-3">
                <button 
                  onClick={() => setShowCategoryModal(false)}
                  className="btn-cancel flex-1"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleQuickAddCategory}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-900/20 hover:bg-indigo-500 transition-all uppercase tracking-widest"
                >
                  Create & Select
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Unit Modal */}
      <AnimatePresence>
        {showUnitModal && (
          <div className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain flex justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUnitModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 my-auto max-h-[min(92dvh,calc(100dvh-2rem))] overflow-y-auto"
            >
              <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter">Quick Add Unit</h3>
                <button onClick={() => setShowUnitModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-800 dark:text-zinc-200">Unit Label</label>
                  <input
                    type="text"
                    placeholder="e.g. Tablet"
                    className={fieldClass}
                    value={newUnitName}
                    onChange={(e) => setNewUnitName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-800 dark:text-zinc-200">Short Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Tab"
                    className={`${fieldClass} font-mono uppercase`}
                    value={newUnitShortName}
                    onChange={(e) => setNewUnitShortName(e.target.value)}
                  />
                </div>
              </div>
              <div className="p-6 bg-slate-50/50 dark:bg-zinc-950/50 flex gap-3">
                <button 
                    onClick={() => setShowUnitModal(false)}
                    className="btn-cancel flex-1"
                  >
                    Cancel
                  </button>
                <button 
                  onClick={handleQuickAddUnit}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-900/20 hover:bg-indigo-500 transition-all uppercase tracking-widest"
                >
                  Create & Select
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
