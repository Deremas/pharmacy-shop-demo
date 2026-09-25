"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, X } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { useAppData } from "@/lib/client/useAppData";
import { NumericInput } from "@/components/numeric-input";
import { useSession } from "next-auth/react";
import { formatItemChoiceLabel, formatUnitLabel } from "@/lib/item-display";
import { shopLocationIdFor, stockLocationIdsFor, stockLocationLabel, storeLocationIdFor } from "@/lib/businesses";
import { StockLocationToggle } from "@/components/stock-location-toggle";
import { controlClass, lineHeaderClass } from "@/lib/field-styles";
import { cn } from "@/lib/utils";
import { updateDraftField, useBusinessDraft } from "@/lib/client/useBusinessDraft";

export default function CreateTransferPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user as any;
  const { items, addTransfer, currentLocation } = useAppData();
  const canCreateTransfer = user?.role === "Super Admin" || user?.permissions?.includes("inventory.transfers.create");

  const { draft, setDraft, clearDraft } = useBusinessDraft("store-transfers", () => ({
    fromLocationId: currentLocation?.id ? shopLocationIdFor(currentLocation.id) : "",
    toLocationId: currentLocation?.id ? storeLocationIdFor(currentLocation.id) : "",
    note: "",
    transferItems: [{ itemId: "", quantity: 1 }] as Array<{ itemId: string; quantity: number }>,
  }));
  const fromLocationId = draft.fromLocationId;
  const toLocationId = draft.toLocationId;
  const note = draft.note;
  const transferItems = draft.transferItems;
  const setFromLocationId = updateDraftField(setDraft, "fromLocationId");
  const setToLocationId = updateDraftField(setDraft, "toLocationId");
  const setNote = updateDraftField(setDraft, "note");
  const setTransferItems = updateDraftField(setDraft, "transferItems");

  React.useEffect(() => {
    if (!currentLocation?.id) return;
    const shop = shopLocationIdFor(currentLocation.id);
    const store = storeLocationIdFor(currentLocation.id);
    setDraft((current) => {
      const from = stockLocationIdsFor(currentLocation.id).includes(current.fromLocationId)
        ? current.fromLocationId
        : shop;
      const to = from === shop ? store : shop;
      if (current.fromLocationId === from && current.toLocationId === to) return current;
      return { ...current, fromLocationId: from, toLocationId: to };
    });
  }, [currentLocation?.id, setDraft]);

  const availableItems = items.filter((i: any) => i.locationId === fromLocationId);

  const isFormValid = React.useMemo(() => {
    if (!fromLocationId || !toLocationId || fromLocationId === toLocationId) return false;
    if (transferItems.length === 0) return false;
    for (const item of transferItems) {
      if (!item.itemId || item.quantity <= 0) return false;
      const refItem = items.find((i: any) => i.id === item.itemId && i.locationId === fromLocationId);
      if (!refItem || item.quantity > refItem.stock) return false;
    }
    return true;
  }, [fromLocationId, toLocationId, transferItems, items]);

  if (!canCreateTransfer) {
    return (
      <div className="flex items-start justify-between gap-3 p-6">
        <p className="text-sm font-bold text-slate-500">You do not have permission to create transfers.</p>
        <BackButton href="/store/transfers" />
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    addTransfer({
      id: "TR-" + Math.random().toString(36).substr(2, 6).toUpperCase(),
      fromLocationId,
      toLocationId,
      items: transferItems.map((item) => ({ itemId: item.itemId, quantity: item.quantity })),
      date: new Date(),
      note,
      status: "COMPLETED",
    })
      .then(() => {
        clearDraft();
        router.push("/store/transfers");
      })
      .catch((error: unknown) => {
        alert(error instanceof Error ? error.message : "Transfer failed.");
      });
  };

  return (
    <div className="space-y-6 p-4 md:p-6 animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-3 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            <ArrowRightLeft className="h-7 w-7 text-indigo-600" />
            New Stock Transfer
          </h1>
          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-500">
            Move inventory between shop and store in {currentLocation?.name || "this business"}
          </p>
        </div>
        <BackButton href="/store/transfers" />
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-8">
        <div className="relative grid grid-cols-2 gap-6 rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="absolute left-1/2 top-1/2 z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <ArrowRightLeft className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Origin</label>
            <StockLocationToggle
              businessId={currentLocation?.id}
              value={fromLocationId}
              onChange={(id) => {
                if (!currentLocation?.id) return;
                const shop = shopLocationIdFor(currentLocation.id);
                const store = storeLocationIdFor(currentLocation.id);
                setFromLocationId(id);
                setToLocationId(id === shop ? store : shop);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Destination</label>
            <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-xs font-black uppercase tracking-widest text-slate-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
              {stockLocationLabel(toLocationId) || "Select origin"}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Items to Transfer</label>
            <button
              type="button"
              onClick={() => setTransferItems([...transferItems, { itemId: "", quantity: 1 }])}
              className="text-xs font-black uppercase tracking-widest text-indigo-600 hover:underline dark:text-indigo-400"
            >
              + Add Item
            </button>
          </div>
          <div className="grid grid-cols-[1fr_128px_40px] items-end gap-2 px-2">
            <div className={lineHeaderClass}>Item</div>
            <div className={lineHeaderClass}>Qty</div>
            <div />
          </div>
          <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {transferItems.map((item, index) => {
              const refItem = items.find((i: any) => i.id === item.itemId && i.locationId === fromLocationId);
              const maxStock = refItem?.stock || 0;
              return (
                <div key={index} className="grid grid-cols-[1fr_128px_40px] items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2 dark:border-zinc-800 dark:bg-zinc-950">
                  <select
                    required
                    aria-label="Item"
                    className={cn(controlClass, "appearance-none")}
                    value={item.itemId}
                    onChange={(e) => {
                      const updated = [...transferItems];
                      updated[index] = { ...updated[index], itemId: e.target.value, quantity: 1 };
                      setTransferItems(updated);
                    }}
                  >
                    <option value="" disabled>Select Item</option>
                    {availableItems.map((i: any) => {
                      const isSelectedElsewhere = transferItems.some((other, oi) => other.itemId === i.id && oi !== index);
                      return (
                        <option key={i.id} value={i.id} disabled={isSelectedElsewhere}>
                          {formatItemChoiceLabel(i, fromLocationId)} ({i.stock} {formatUnitLabel(i)})
                        </option>
                      );
                    })}
                  </select>
                  <div>
                    <NumericInput
                      aria-label={`Qty, max ${maxStock}`}
                      min={1}
                      max={maxStock}
                      required
                      className="font-mono"
                      value={item.quantity}
                      onValueChange={(quantity) => {
                        const updated = [...transferItems];
                        updated[index] = { ...updated[index], quantity };
                        setTransferItems(updated);
                      }}
                    />
                    <p className="mt-0.5 h-3 text-[9px] font-semibold leading-3 text-slate-500">
                      {item.itemId ? `max ${maxStock}` : ""}
                    </p>
                  </div>
                  <div className="flex h-11 justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        if (transferItems.length > 1) setTransferItems(transferItems.filter((_, i) => i !== index));
                        else setTransferItems([{ itemId: "", quantity: 1 }]);
                      }}
                      className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Note / Remark</label>
          <textarea
            placeholder="Add any internal transfer notes..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-[80px] w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950"
          />
        </div>

        <div className="flex gap-4 pt-2">
          <Link href="/store/transfers" className="btn-cancel flex-1 px-6 py-4 text-center">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={!isFormValid}
            className="flex-[2] rounded-2xl bg-indigo-600 py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-indigo-500/20 transition-all hover:bg-indigo-700 disabled:bg-slate-700 dark:disabled:bg-zinc-800"
          >
            Process Transfer
          </button>
        </div>
      </form>
    </div>
  );
}
