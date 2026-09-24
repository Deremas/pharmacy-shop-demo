"use client";

import React, { useState } from "react";
import {
  Truck,
  Plus,
  Search,
  Package,
  User,
  Warehouse,
  Eye,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { cn, formatCurrency } from "@/lib/utils";
import { useAppData } from "@/lib/client/useAppData";
import { AppModal } from "@/components/app-modal";
import { paginateRows } from "@/lib/sales-utils";

export default function PurchasesPage() {
  const { purchases, suppliers, currentLocation, locations, deletePurchase } =
    useAppData();
  const { data: session } = useSession();
  const user = session?.user as any;
  const permissionKeys = new Set<string>(user?.permissions || []);
  const canDeletePurchase =
    user?.role === "Super Admin" || permissionKeys.has("purchases.delete");
  const canCreatePurchase =
    user?.role === "Super Admin" || permissionKeys.has("purchases.create");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [viewPurchase, setViewPurchase] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const purchaseToDelete = deleteId
    ? purchases.find((purchase: any) => purchase.id === deleteId)
    : null;
  const deleteRestoreQty = (purchaseToDelete?.items || []).reduce(
    (sum: number, item: any) => sum + Number(item.qty || 0),
    0,
  );
  const deleteHasBank = Number(purchaseToDelete?.bankAmount || 0) > 0;
  const deleteHasDebt = Number(purchaseToDelete?.debtAmount || 0) > 0;

  const closeDeleteModal = () => {
    if (isDeleting) return;
    setDeleteId(null);
    setDeleteError("");
  };

  const confirmDeletePurchase = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    setDeleteError("");
    try {
      await deletePurchase(deleteId);
      setDeleteId(null);
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Failed to delete purchase.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredPurchases = purchases.filter((p) => {
    const supplier = suppliers.find((s) => s.id === p.supplierId);
    const query = search.toLowerCase();
    const itemNames = (p.items || []).map((item: any) => item.itemName || item.itemId).join(" ").toLowerCase();
    const matchesSearch =
      p.id.toLowerCase().includes(query) ||
      supplier?.name.toLowerCase().includes(query) ||
      itemNames.includes(query);
    if (currentLocation)
      return matchesSearch && p.locationId === currentLocation.id;
    return matchesSearch;
  });
  const pagedPurchases = paginateRows<any>(filteredPurchases, page, pageSize);
  const purchaseQty = (purchase: any) =>
    (purchase.items || []).reduce((sum: number, item: any) => sum + Number(item.qty || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 p-4 md:p-6 pb-20 font-bold">
      <div className="page-heading">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black tracking-tight text-slate-900 dark:text-white sm:text-2xl lg:text-3xl">
            <Truck className="h-5 w-5 text-indigo-600 sm:h-7 sm:w-7" />
            Purchases
          </h1>
          <p className="text-slate-600 dark:text-zinc-400 mt-1 uppercase text-[10px] font-black tracking-widest">
            {currentLocation
              ? `${currentLocation.name} Inventory Procurement`
              : "Global Supply Chain Management"}
          </p>
        </div>
        {canCreatePurchase ? (
          <div className="flex items-center gap-3">
            <Link
              href="/purchases/create"
              className="page-action gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black shadow-lg shadow-indigo-900/20 hover:bg-indigo-500 active:scale-95 transition-all uppercase tracking-widest cursor-pointer"
            >
              <Plus className="w-4 h-4" /> New Purchase
            </Link>
          </div>
        ) : null}
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="page-filters border-b border-slate-100 p-4 dark:border-zinc-800">
          <div className="relative filter-grow" data-filter-grow>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ID, supplier or item..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-xs transition-all font-bold"
            />
          </div>
        </div>

        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[960px]">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-zinc-950/50 border-b border-slate-100 dark:border-zinc-800">
                <th className="px-6 py-4 text-left text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                  Entry Detail
                </th>
                {!currentLocation && (
                  <th className="px-6 py-4 text-left text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                    Location
                  </th>
                )}
                <th className="px-6 py-4 text-left text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                  Supplier
                </th>
                <th className="px-6 py-4 text-left text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                  Item Name
                </th>
                <th className="px-6 py-4 text-center text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                  Qty
                </th>
                <th className="px-6 py-4 text-right text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                  Buying Price
                </th>
                <th className="px-6 py-4 text-right text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                  Total Price
                </th>
                <th className="px-6 py-4 text-center text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                  Status
                </th>
                <th className="px-6 py-4 text-center text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td
                    colSpan={!currentLocation ? 9 : 8}
                    className="px-6 py-12 text-center text-slate-500 font-black uppercase text-[10px] tracking-widest"
                  >
                    No procurement records found
                  </td>
                </tr>
              ) : (
                pagedPurchases.rows.map((p) => {
                  const supplier = suppliers.find((s) => s.id === p.supplierId);
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                            {p.id}
                          </span>
                          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                            {new Date(p.purchaseDate).toLocaleDateString()}
                          </span>
                        </div>
                      </td>
                      {!currentLocation && (
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase">
                            {locations.find((b) => b.id === p.locationId)?.name}
                          </span>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 font-black text-[10px]">
                            {supplier?.name?.charAt(0)}
                          </div>
                          <span className="text-xs font-black text-slate-700 dark:text-zinc-200 uppercase tracking-tight">
                            {supplier?.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <PurchaseLineList purchase={p} field="name" />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <PurchaseLineList purchase={p} field="qty" align="center" />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <PurchaseLineList purchase={p} field="price" align="right" />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <PurchaseLineList purchase={p} field="total" align="right" />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg text-[9px] font-black uppercase tracking-wider">
                          RECEIVED
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <Link
                            href={`/purchases/${p.id}`}
                            title="View details"
                            className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-colors text-slate-400 hover:text-indigo-600 cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          {canDeletePurchase ? (
                            <button
                              onClick={() => {
                                setDeleteId(p.id);
                                setDeleteError("");
                              }}
                              title="Delete"
                              className="p-2 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors text-slate-400 hover:text-rose-600 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500 dark:border-zinc-800">
          <span>Page {pagedPurchases.page} of {pagedPurchases.totalPages} - {filteredPurchases.length} purchases</span>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] font-black uppercase tracking-widest outline-none dark:border-zinc-800 dark:bg-zinc-950"
            >
              {[10, 15, 25, 50].map((size) => (
                <option key={size} value={size}>{size} / page</option>
              ))}
            </select>
            <button type="button" disabled={pagedPurchases.page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40 dark:border-zinc-800">Prev</button>
            <button type="button" disabled={pagedPurchases.page >= pagedPurchases.totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40 dark:border-zinc-800">Next</button>
          </div>
        </div>
      </div>

      <AppModal
        open={Boolean(viewPurchase)}
        onClose={() => setViewPurchase(null)}
        contentClassName="max-w-lg rounded-3xl"
        labelledBy="purchase-details-title"
      >
        {viewPurchase ? (
          <>
            <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3
                  id="purchase-details-title"
                  className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight"
                >
                  Purchase Details
                </h3>
                <p className="text-[10px] font-mono text-slate-400">
                  {viewPurchase.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewPurchase(null)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <InfoRow
                  label="Supplier"
                  value={
                    suppliers.find((s) => s.id === viewPurchase.supplierId)
                      ?.name ?? "-"
                  }
                />
                <InfoRow
                  label="Date"
                  value={new Date(
                    viewPurchase.purchaseDate,
                  ).toLocaleDateString()}
                />
                <InfoRow label="Payment" value={viewPurchase.paymentMethod} />
                <InfoRow
                  label="Location"
                  value={
                    locations.find((l) => l.id === viewPurchase.locationId)
                      ?.name ?? "-"
                  }
                />
                <InfoRow
                  label="Total"
                  value={formatCurrency(viewPurchase.totalAmount)}
                  highlight
                />
                <InfoRow
                  label="Cash"
                  value={formatCurrency(Number(viewPurchase.cashAmount || 0))}
                />
                <InfoRow
                  label="Bank"
                  value={formatCurrency(Number(viewPurchase.bankAmount || 0))}
                />
                <InfoRow
                  label="Paid"
                  value={formatCurrency(viewPurchase.paidAmount)}
                />
                <InfoRow
                  label="Debt"
                  value={formatCurrency(viewPurchase.debtAmount)}
                />
              </div>
              <div className="border-t border-slate-100 dark:border-zinc-800 pt-4">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  Items ({viewPurchase.items.length})
                </p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {viewPurchase.items.map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-xs bg-slate-50 dark:bg-zinc-800 rounded-lg px-3 py-2"
                    >
                      <span className="font-bold text-slate-700 dark:text-zinc-300">
                        {item.itemName || item.itemId}
                      </span>
                      <span className="font-mono text-slate-500">
                        ×{item.qty} @ {formatCurrency(item.unitCost)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </AppModal>

      <AppModal
        open={Boolean(deleteId)}
        onClose={closeDeleteModal}
        contentClassName="max-w-sm rounded-2xl p-6 space-y-4"
        labelledBy="delete-purchase-title"
      >
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-100 dark:bg-rose-900/30 rounded-xl">
            <Trash2 className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h3
              id="delete-purchase-title"
              className="font-black text-slate-900 dark:text-white"
            >
              Delete Purchase & Restore Stock
            </h3>
            <p className="text-[11px] text-slate-500">
              This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-[11px] font-bold leading-5 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          Deletes purchase{" "}
          <span className="font-black">
            {purchaseToDelete?.invoiceNo || deleteId}
          </span>{" "}
          and restores stock ({deleteRestoreQty} unit(s))
          {deleteHasBank ? ", reverses bank supplier payment" : ""}
          {deleteHasDebt ? ", clears supplier debt" : ""}
          , and removes linked supplier payments + money.
          <div className="mt-2 space-y-0.5 font-bold">
            <p>Blocked when:</p>
            <p>• Any stock from those batches was already sold/transferred/adjusted</p>
          </div>
        </div>
        {deleteError && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-600 dark:bg-rose-950/30 dark:text-rose-300">
            {deleteError}
          </p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            disabled={isDeleting}
            onClick={closeDeleteModal}
            className="btn-cancel flex-1"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={confirmDeletePurchase}
            className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold cursor-pointer hover:bg-rose-700 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? "Deleting..." : "Delete & Restore"}
          </button>
        </div>
      </AppModal>
    </div>
  );
}

function InfoRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
        {label}
      </p>
      <p
        className={cn(
          "text-sm font-black mt-0.5",
          highlight
            ? "text-indigo-600 dark:text-indigo-400"
            : "text-slate-900 dark:text-white",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function PurchaseLineList({
  purchase,
  field,
  align = "left",
}: {
  purchase: any;
  field: "name" | "price" | "qty" | "total";
  align?: "left" | "right" | "center";
}) {
  const lines = purchase.items || [];
  if (lines.length === 0) {
    return <span className="text-xs font-black text-slate-300">-</span>;
  }

  return (
    <div
      className={cn(
        "flex max-h-16 flex-col gap-1 overflow-y-auto pr-1",
        align === "right" && "items-end text-right",
        align === "center" && "items-center text-center",
      )}
    >
      {lines.map((item: any) => {
        const value =
          field === "name"
            ? item.itemName || item.itemId
            : field === "price"
              ? formatCurrency(item.unitCost || 0)
              : field === "total"
                ? formatCurrency(item.total || (Number(item.unitCost || 0) * Number(item.qty || 0)))
                : item.qty;

        return (
          <span
            key={`${item.id}-${field}`}
            className={cn(
              "max-w-[220px] truncate rounded-lg bg-slate-50 px-2 py-1 text-[10px] font-black uppercase tracking-tight text-slate-700 dark:bg-zinc-800 dark:text-zinc-200",
              field === "qty" && "text-indigo-600 dark:text-indigo-300",
            )}
            title={String(value)}
          >
            {value}
          </span>
        );
      })}
    </div>
  );
}
