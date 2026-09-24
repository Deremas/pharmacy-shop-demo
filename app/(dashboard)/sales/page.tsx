"use client";

import React, { useState } from "react";
import { 
  ShoppingCart, Plus, Search, ArrowUpRight, Calendar,
  User, CreditCard, Store, Eye, Trash2, X, Package
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { cn, formatCurrency, sumMoney } from "@/lib/utils";
import { useAppData } from "@/lib/client/useAppData";
import { AppModal } from "@/components/app-modal";
import { paginateRows, saleCost, saleItemSummary, saleProfit } from "@/lib/sales-utils";
import { formatSalePaymentPartsDetail } from "@/lib/payment-display";

export default function SalesListPage() {
  const { sales, currentLocation, locations, customers, products = [], items = [], saleReturns = [], deleteSale, voidSale } = useAppData();
  const { data: session } = useSession();
  const user = session?.user as any;
  const permissionKeys = new Set<string>(user?.permissions || []);
  const canDeleteSale = user?.role === "Super Admin" || permissionKeys.has("sales.delete");
  const canCreateSale = user?.role === "Super Admin" || permissionKeys.has("sales.create");
  const [search, setSearch] = useState("");
  const [locationId, setLocationId] = useState(currentLocation?.id || "");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [viewSale, setViewSale] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const saleToDelete = deleteId ? sales.find((sale: any) => sale.id === deleteId) : null;
  const deleteRestoreQty = saleToDelete?.items?.reduce((sum: number, item: any) => sum + Number(item.qty || 0), 0) || 0;
  const deleteHasCredit = Number(saleToDelete?.creditAmount || 0) > 0;
  const deleteHasBank = Number(saleToDelete?.bankAmount || 0) > 0;

  const closeDeleteModal = () => {
    if (isDeleting) return;
    setDeleteId(null);
    setDeleteError("");
  };

  const confirmDeleteSale = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    setDeleteError("");
    try {
      await deleteSale(deleteId);
      setDeleteId(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Failed to delete sale.");
    } finally {
      setIsDeleting(false);
    }
  };

  React.useEffect(() => {
    setLocationId(currentLocation?.id || "");
  }, [currentLocation?.id]);

  const filteredSales = sales
    .map((sale, index) => ({ sale, index }))
    .filter(({ sale }) => {
      const customer = customers.find(c => c.id === sale.customerId);
      const q = search.toLowerCase();
      const itemNames = saleItemSummary(sale, products, items).toLowerCase();
      const matchesSearch = sale.id.toLowerCase().includes(q) ||
        customer?.name.toLowerCase().includes(q) ||
        itemNames.includes(q);
      const saleTime = new Date(sale.saleDate).getTime();
      const matchesDateFrom = !dateFrom || saleTime >= new Date(dateFrom).getTime();
      const matchesDateTo = !dateTo || saleTime <= new Date(dateTo).getTime() + 86400000 - 1;
      return matchesSearch && (!locationId || sale.locationId === locationId) && matchesDateFrom && matchesDateTo;
    })
    .sort((a, b) => {
      const dateDiff = new Date(b.sale.saleDate).getTime() - new Date(a.sale.saleDate).getTime();
      return dateDiff || b.index - a.index;
    })
    .map(({ sale }) => sale);
  const pagedSales = paginateRows<any>(filteredSales, page, pageSize);

  const countedSales = filteredSales.filter((sale) => sale.status !== "VOIDED");
  const countedIds = new Set(countedSales.map((sale) => sale.id));
  const returnedTotal = sumMoney(saleReturns.filter((entry) => countedIds.has(entry.saleId)).map((entry) => entry.totalAmount));
  const stats = {
    total: sumMoney(countedSales.map((sale) => sale.totalAmount)) - returnedTotal,
    cost: sumMoney(countedSales.map((sale) => saleCost(sale))),
    profit: sumMoney(countedSales.map((sale) => saleProfit(sale))),
    completed: countedSales.length,
    outstanding: countedSales.reduce((acc, s) => acc + s.creditAmount, 0),
    count: filteredSales.length
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 p-4 md:p-6 pb-20 font-bold">
      <div className="page-heading">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white sm:text-2xl lg:text-3xl">
            <ShoppingCart className="h-5 w-5 text-indigo-600 sm:h-7 sm:w-7" />
            Sales List
          </h1>
          <p className="text-slate-600 dark:text-zinc-400 mt-1 uppercase text-[10px] font-black tracking-widest">
            {currentLocation ? `${currentLocation.name} Sales Fulfillment` : "Global Revenue Transaction Management"}
          </p>
        </div>
        {canCreateSale ? (
          <div className="flex items-center gap-3">
            <Link 
              href="/sales/create"
              className="page-action gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black shadow-lg shadow-indigo-900/20 hover:bg-indigo-500 active:scale-95 transition-all uppercase tracking-widest cursor-pointer"
            >
              <Plus className="w-4 h-4" /> New Sale
            </Link>
          </div>
        ) : null}
      </div>

      <div className="page-stats xl:grid-cols-6">
        <StatCard title="Total Revenue" value={formatCurrency(stats.total)} icon={ShoppingCart} />
        <StatCard title="Buying Cost" value={formatCurrency(stats.cost)} icon={Package} color="amber" />
        <StatCard title="Total Profit" value={formatCurrency(stats.profit)} icon={ArrowUpRight} color="emerald" />
        <StatCard title="Tx Volume" value={stats.completed} icon={ArrowUpRight} color="emerald" />
        <StatCard title="Consumer Debt" value={formatCurrency(stats.outstanding)} icon={CreditCard} color="amber" />
        <StatCard title="Pharmacy" value={currentLocation?.name || "1"} icon={Store} color="rose" />
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm transition-colors">
        <div className="page-filters border-b border-slate-100 p-4 dark:border-zinc-800">
          <div className="relative filter-grow" data-filter-grow>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by item, ID or customer..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-xs transition-all font-bold"
            />
          </div>
          <input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold outline-none dark:border-zinc-800 dark:bg-zinc-950" />
          <input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold outline-none dark:border-zinc-800 dark:bg-zinc-950" />
        </div>

        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[960px] border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-zinc-950/50 border-b border-slate-100 dark:border-zinc-800">
                <th className="px-6 py-4 text-left text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Items Sold</th>
                {!locationId && <th className="px-6 py-4 text-left text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Dispensary/Store</th>}
                <th className="px-6 py-4 text-left text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Consumer</th>
                <th className="px-6 py-4 text-left text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Timeline</th>
                <th className="px-6 py-4 text-left text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Payment Method</th>
                <th className="px-6 py-4 text-left text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Bank Account</th>
                <th className="px-6 py-4 text-center text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Qty</th>
                <th className="px-6 py-4 text-right text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Unit Selling Price</th>
                <th className="px-6 py-4 text-right text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Total Price</th>
                <th className="px-6 py-4 text-right text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Buying Total</th>
                <th className="px-6 py-4 text-right text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Profit</th>
                <th className="px-6 py-4 text-center text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-center text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={!locationId ? 13 : 12} className="px-6 py-12 text-center text-slate-500 font-black uppercase text-[10px] tracking-widest">
                    No transactions captured
                  </td>
                </tr>
              ) : (
                pagedSales.rows.map((sale) => {
                  const customer = customers.find(c => c.id === sale.customerId);
                  return (
                    <tr key={sale.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors group">
                      <td className="px-6 py-4">
                        <SaleLineList sale={sale} products={products} items={items} field="name" />
                        <p className="mt-1 font-mono text-[9px] font-bold uppercase text-slate-400">{sale.id}</p>
                      </td>
                      {!locationId && (
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase">
                            {locations.find(b => b.id === sale.locationId)?.name}
                          </span>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center">
                            <User className="w-4 h-4 text-slate-500" />
                          </div>
                          <span className="text-xs font-black text-slate-700 dark:text-zinc-200 uppercase">{customer?.name ?? "Walk-in"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 font-bold">{new Date(sale.saleDate).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-[9px] font-black text-slate-500 uppercase tracking-widest">
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
                            <p className="mt-1 text-[9px] font-bold text-slate-400">{detail}</p>
                          ) : null;
                        })()}
                      </td>
                      <td className="px-6 py-4">
                        {sale.bankAccount?.displayName ? (
                          <span className="inline-flex items-center rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-indigo-700 dark:border-indigo-900/40 dark:bg-indigo-950/30 dark:text-indigo-300">
                            {sale.bankAccount.displayName}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <SaleLineList sale={sale} products={products} items={items} field="qty" align="center" />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <SaleLineList sale={sale} products={products} items={items} field="price" align="right" />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <SaleLineList sale={sale} products={products} items={items} field="total" align="right" />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <SaleLineList sale={sale} products={products} items={items} field="cost" align="right" />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <SaleLineList sale={sale} products={products} items={items} field="profit" align="right" />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider",
                          sale.status === "VOIDED" ? "bg-slate-200 text-slate-600" : sale.status === "RETURNED" || sale.status === "PARTIAL_RETURN" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-700/20 dark:text-emerald-400",
                        )}>
                          {sale.status || "COMPLETED"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <Link
                            href={`/sales/${sale.id}`}
                            title="View details"
                            className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-colors text-slate-400 hover:text-indigo-600 cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          {canDeleteSale && sale.status !== "VOIDED" ? (
                            <button
                              onClick={async () => {
                                if (!window.confirm("Void this sale? Stock goes back to the original batches, and cash, bank, mobile money, and credit are reversed. The sale stays on record.")) return;
                                try {
                                  await voidSale(sale.id);
                                } catch (error) {
                                  window.alert(error instanceof Error ? error.message : "Void failed.");
                                }
                              }}
                              title="Void"
                              className="p-2 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl transition-colors text-slate-400 hover:text-amber-600 cursor-pointer text-[10px] font-black"
                            >
                              Void
                            </button>
                          ) : null}
                          {canDeleteSale ? (
                            <button
                              onClick={() => {
                                setDeleteId(sale.id);
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
          <span>Page {pagedSales.page} of {pagedSales.totalPages} - {filteredSales.length} sales</span>
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
            <button type="button" disabled={pagedSales.page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40 dark:border-zinc-800">Prev</button>
            <button type="button" disabled={pagedSales.page >= pagedSales.totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40 dark:border-zinc-800">Next</button>
          </div>
        </div>
      </div>

      <AppModal open={Boolean(viewSale)} onClose={() => setViewSale(null)} contentClassName="max-w-lg rounded-3xl" labelledBy="sale-details-title">
        {viewSale ? (
          <>
            <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 id="sale-details-title" className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Sale Details</h3>
                <p className="text-[10px] font-mono text-slate-400">{viewSale.id}</p>
              </div>
              <button type="button" onClick={() => setViewSale(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label="Customer" value={customers.find(c => c.id === viewSale.customerId)?.name ?? "Walk-in"} />
                <InfoRow label="Date" value={new Date(viewSale.saleDate).toLocaleDateString()} />
                <InfoRow label="Payment" value={viewSale.paymentMethod} />
                <InfoRow
                  label="Bank Account"
                  value={
                    viewSale.bankAccount?.displayName
                      ? `${viewSale.bankAccount.displayName}${viewSale.bankAccount.bankName ? ` (${viewSale.bankAccount.bankName})` : ""}`
                      : viewSale.bankAccountId || "-"
                  }
                />
                <InfoRow label="Location" value={locations.find(l => l.id === viewSale.locationId)?.name ?? "-"} />
                <InfoRow label="Total" value={formatCurrency(viewSale.totalAmount)} highlight />
                <InfoRow label="Cash" value={formatCurrency(Number(viewSale.cashAmount || 0))} />
                <InfoRow label="Bank" value={formatCurrency(Number(viewSale.bankAmount || 0))} />
                <InfoRow label="Credit" value={formatCurrency(viewSale.creditAmount)} />
              </div>
              <div className="border-t border-slate-100 dark:border-zinc-800 pt-4">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Items ({viewSale.items.length})</p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {viewSale.items.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between text-xs bg-slate-50 dark:bg-zinc-800 rounded-lg px-3 py-2">
                      <span className="font-bold text-slate-700 dark:text-zinc-300">{item.itemName || item.itemId}</span>
                      <span className="font-mono text-slate-500">x{item.qty} - {formatCurrency(item.total)}</span>
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
        labelledBy="delete-sale-title"
      >
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-100 dark:bg-rose-900/30 rounded-xl"><Trash2 className="w-5 h-5 text-rose-600" /></div>
          <div>
            <h3 id="delete-sale-title" className="font-black text-slate-900 dark:text-white">Delete Sale & Restore Stock</h3>
            <p className="text-[11px] text-slate-500">This action cannot be undone.</p>
          </div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-[11px] font-bold leading-5 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          Deletes sale <span className="font-black">{saleToDelete?.voucherCode || deleteId}</span> and fully restores
          {" "}stock ({deleteRestoreQty} unit(s)), SALE movements
          {deleteHasBank ? ", bank payment balance" : ""}
          {deleteHasCredit ? ", and credit settlements (payments + cash/bank money)" : ", and any linked customer payments"}
          .
        </div>
        {deleteError && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-600 dark:bg-rose-950/30 dark:text-rose-300">
            {deleteError}
          </p>
        )}
        <div className="flex gap-3">
          <button type="button" disabled={isDeleting} onClick={closeDeleteModal} className="btn-cancel flex-1">Cancel</button>
          <button type="button" disabled={isDeleting} onClick={confirmDeleteSale} className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold cursor-pointer hover:bg-rose-700 transition-colors disabled:cursor-not-allowed disabled:opacity-60">
            {isDeleting ? "Deleting..." : "Delete & Restore"}
          </button>
        </div>
      </AppModal>
    </div>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className={cn("text-sm font-black mt-0.5", highlight ? "text-indigo-600 dark:text-indigo-400" : "text-slate-900 dark:text-white")}>{value}</p>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color = "indigo" }: any) {
  return (
    <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm transition-colors">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">{title}</p>
        <div className={cn(
          "p-2 rounded-xl",
          color === "indigo" && "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400",
          color === "emerald" && "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400",
          color === "amber" && "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400",
          color === "rose" && "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400"
        )}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <h4 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{value}</h4>
    </div>
  );
}

function SaleLineList({
  sale,
  products,
  items,
  field,
  align = "left",
}: {
  sale: any;
  products: any[];
  items: any[];
  field: "name" | "qty" | "price" | "total" | "cost" | "profit";
  align?: "left" | "right" | "center";
}) {
  const lines = sale.items || [];
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
      {lines.map((line: any) => {
        const product = products.find((entry) => entry.id === line.itemId);
        const stockItem = items.find((entry) => entry.id === line.itemId);
        const cost = Number(line.buyingPrice || 0) * Number(line.qty || 0);
        const profit = line.profit !== undefined && line.profit !== null
          ? Number(line.profit || 0)
          : Number(line.total || 0) - cost;
        const value =
          field === "name"
            ? line.itemName || product?.name || stockItem?.name || line.itemId
            : field === "qty"
              ? line.qty
              : field === "price"
                ? formatCurrency(line.price || 0)
                : field === "total"
                  ? formatCurrency(line.total || 0)
                  : field === "cost"
                    ? formatCurrency(cost)
                    : formatCurrency(profit);

        return (
          <span
            key={`${line.id}-${field}`}
            className={cn(
              "max-w-[260px] truncate rounded-lg bg-slate-50 px-2 py-1 text-[10px] font-black uppercase tracking-tight text-slate-700 dark:bg-zinc-800 dark:text-zinc-200",
              field === "qty" && "text-indigo-600 dark:text-indigo-300",
              field === "profit" && profit >= 0 && "text-emerald-600 dark:text-emerald-300",
              field === "profit" && profit < 0 && "text-rose-600 dark:text-rose-300",
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
