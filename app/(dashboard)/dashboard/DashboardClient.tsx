"use client";

import React from "react";
import Link from "next/link";
import {
  TrendingUp,
  Package,
  Users,
  ShoppingCart,
  AlertTriangle,
  ArrowUpRight,
  History,
  Bell,
  BarChart3,
  PackagePlus,
  UserPlus,
  Receipt,
  Truck,
  ArrowRightLeft,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useAppData } from "@/lib/client/useAppData";
import { useSession } from "next-auth/react";
import { saleProfit } from "@/lib/sales-utils";
import { formatUnitLabel, itemVariant } from "@/lib/item-display";
import { aggregateCatalogStock, thresholdForItem, uniqueCatalogItems } from "@/lib/stock";
import {
  formatPurchasePaymentSummary,
  formatSalePaymentSummary,
} from "@/lib/payment-display";

const DASHBOARD_LIST_LIMIT = 4;

export default function Dashboard() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const { currentLocation, sales, items, products = [], customers, suppliers, purchases } =
    useAppData();
  const permissionKeys = new Set<string>(user?.permissions || []);
  const can = (permission: string) =>
    user?.role === "Super Admin" || permissionKeys.has(permission);

  // Filter data by current location if specified
  const locationSales = can("sales.view")
    ? currentLocation
      ? sales.filter((s) => s.locationId === currentLocation.id)
      : sales
    : [];
  const locationItems =
    can("inventory.stock.view") || can("inventory.items.view")
      ? aggregateCatalogStock(uniqueCatalogItems<any>(products, items), items)
      : [];
  const locationPurchases = can("purchases.view")
    ? currentLocation
      ? purchases.filter((p) => p.locationId === currentLocation.id)
      : purchases
    : [];

  // Calculate stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todaySales = locationSales.filter((s) => new Date(s.saleDate) >= today);
  const totalTodaySales = todaySales.reduce((acc, s) => acc + s.totalAmount, 0);
  const totalTodayProfit = todaySales.reduce((acc, s) => acc + saleProfit(s), 0);

  const inventoryValue = locationItems.reduce(
    (acc, i) => acc + i.price * i.stock,
    0,
  );
  const totalProducts = locationItems.length;
  const lowStockItems = locationItems.filter(
    (i) => i.stock <= thresholdForItem(i),
  ).length;

  const totalCustomers = can("customers.view") ? customers.length : 0;
  const totalSuppliers = can("suppliers.view") ? suppliers.length : 0;
  const totalCustomerCredit = can("customers.view")
    ? customers.reduce((acc, c) => acc + c.balance, 0)
    : 0;

  const recentTransactions = [
    ...locationSales.map((s) => ({
      id: s.id,
      date: s.saleDate,
      totalAmount: s.totalAmount,
      paymentMethod: s.paymentMethod,
      paymentDetail: formatSalePaymentSummary(
        {
          paymentMethod: s.paymentMethod,
          cashAmount: s.cashAmount,
          bankAmount: s.bankAmount,
          creditAmount: s.creditAmount,
        },
        formatCurrency,
      ),
      type: "SALE" as const,
    })),
    ...locationPurchases.map((p) => ({
      id: p.id,
      date: p.purchaseDate,
      totalAmount: p.totalAmount,
      paymentMethod: p.paymentMethod,
      paymentDetail: formatPurchasePaymentSummary(
        {
          paymentMethod: p.paymentMethod,
          cashAmount: p.cashAmount,
          bankAmount: p.bankAmount,
          debtAmount: p.debtAmount,
        },
        formatCurrency,
      ),
      type: "PURCHASE" as const,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, DASHBOARD_LIST_LIMIT);

  const lowStockAlerts = locationItems
    .filter((item) => item.stock <= thresholdForItem(item))
    .sort((left, right) => Number(left.stock || 0) - Number(right.stock || 0));
  const visibleLowStock = lowStockAlerts.slice(0, DASHBOARD_LIST_LIMIT);
  const extraLowStock = Math.max(0, lowStockAlerts.length - visibleLowStock.length);

  const quickActions = [
    {
      href: "/sales/create",
      icon: Receipt,
      label: "New Sale",
      color: "indigo",
      permission: "sales.create",
    },
    {
      href: "/items/create",
      icon: PackagePlus,
      label: "Add Item",
      color: "emerald",
      permission: "inventory.items.create",
    },
    {
      href: "/purchases/create",
      icon: Truck,
      label: "Purchase",
      color: "amber",
      permission: "purchases.create",
    },
    {
      href: "/store/transfers",
      icon: ArrowRightLeft,
      label: "Transfer",
      color: "blue",
      permission: "inventory.transfers.create",
    },
    {
      href: "/sales",
      icon: History,
      label: "History",
      color: "rose",
      permission: "sales.view",
    },
    {
      href: "/customers",
      icon: UserPlus,
      label: "Customer",
      color: "indigo",
      permission: "customers.view",
    },
    {
      href: "/suppliers",
      icon: Users,
      label: "Supplier",
      color: "emerald",
      permission: "suppliers.view",
    },
    {
      href: "/reports",
      icon: BarChart3,
      label: "Reports",
      color: "slate",
      permission: "reports.view",
    },
  ].filter((action) => can(action.permission));

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        {quickActions.map((action) => (
          <QuickAction key={action.href} {...action} />
        ))}
      </div>

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {can("sales.view") && (
          <SmallStatCard
            title="TODAY'S SALES"
            value={formatCurrency(totalTodaySales)}
            change={`${todaySales.length} txns`}
            icon={ShoppingCart}
            action="VIEW SALES"
            actionHref="/sales"
          />
        )}
        {(can("reports.view") || can("reports.sales.view")) && can("sales.view") && (
          <SmallStatCard
            title="TODAY'S PROFIT"
            value={formatCurrency(totalTodayProfit)}
            change={`${todaySales.length} txns`}
            icon={TrendingUp}
            action="VIEW ANALYSIS"
            actionHref="/reports?module=Sales"
            trend="up"
          />
        )}
        {(can("inventory.stock.view") || can("inventory.items.view")) && (
          <SmallStatCard
            title="ACTIVE INVENTORY"
            value={totalProducts.toString()}
            change={`${locationItems.length} items`}
            icon={Package}
            action="VIEW PRODUCTS"
            actionHref="/items"
          />
        )}
      </div>

      {/* Secondary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {can("inventory.stock.view") && (
          <DashboardCard
            title="INVENTORY VALUE"
            value={formatCurrency(inventoryValue)}
            icon={TrendingUp}
            color="amber"
            action="VIEW STOCK"
            actionHref="/store/locations"
          />
        )}
        {can("inventory.stock.view") && (
          <DashboardCard
            title="SALES VALUE"
            value={formatCurrency(inventoryValue)}
            color="indigo"
          />
        )}
        {can("inventory.stock.view") && (
          <DashboardCard
            title="LOW STOCK ALERTS"
            value={lowStockItems.toString()}
            subtitle="ITEMS BELOW THRESHOLD"
            icon={AlertTriangle}
            color={lowStockItems > 0 ? "amber" : "indigo"}
            action="REPLENISH"
            actionHref="/items/low-stock"
          />
        )}
        <div className="hidden lg:block" />
      </div>

      {/* Third Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {can("customers.view") && (
          <DashboardCard
            title="CUSTOMERS"
            value={totalCustomers.toString()}
            subtitle={`CREDIT: ${formatCurrency(totalCustomerCredit)}`}
            icon={Users}
            color="indigo"
            action="VIEW CRM"
            actionHref="/customers"
          />
        )}
        {can("suppliers.view") && (
          <DashboardCard
            title="SUPPLIERS"
            value={totalSuppliers.toString()}
            icon={Package}
            color="indigo"
            action="VIEW SUPPLIERS"
            actionHref="/suppliers"
          />
        )}
        {can("customers.view") && (
          <DashboardCard
            title="CREDIT EXPOSURE"
            value={formatCurrency(totalCustomerCredit)}
            subtitle="UNCOLLECTED BALANCES"
            icon={TrendingUp}
            color="amber"
            action="VIEW CREDITS"
            actionHref="/customers/credits"
            trend="up"
          />
        )}
        {(can("sales.view") || can("purchases.view")) && (
          <DashboardCard
            title="SYSTEM LOGS"
            value={recentTransactions.length.toString()}
            subtitle="RECENT ACTIVITIES"
            icon={Bell}
            color="indigo"
            action="REVIEW LOGS"
            actionHref="/reports?module=Administrative&report=audit-security"
          />
        )}
      </div>

      {/* Bottom Grid: Transactions & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(can("sales.view") || can("purchases.view")) && (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-slate-50 px-5 py-4 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-indigo-50 p-2 dark:bg-indigo-900/20">
                  <History className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h4 className="font-black uppercase tracking-tight text-slate-800 dark:text-white">
                    Recent Transactions
                  </h4>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300">
                    Latest activities
                  </p>
                </div>
              </div>
              <Link
                href="/sales"
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:gap-2 dark:text-indigo-400"
              >
                Full History <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-slate-50 dark:divide-zinc-800/50">
              {recentTransactions.length === 0 ? (
                <div className="flex min-h-[8.5rem] items-center justify-center px-6 py-6">
                  <div className="text-center opacity-30">
                    <History className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                    <p className="text-[10px] font-black uppercase tracking-widest">
                      No activities found
                    </p>
                  </div>
                </div>
              ) : (
                recentTransactions.map((tx: any) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between px-5 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/20"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-black",
                          tx.type === "SALE"
                            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20"
                            : "bg-amber-50 text-amber-600 dark:bg-amber-900/20",
                        )}
                      >
                        {tx.type[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black uppercase tracking-tight text-slate-900 dark:text-white">
                          {tx.id}
                        </p>
                        <p className="text-[10px] font-bold uppercase text-slate-700 dark:text-slate-300">
                          {new Date(tx.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-black text-slate-900 dark:text-white">
                        {formatCurrency(tx.totalAmount)}
                      </p>
                      <p className="text-[10px] font-bold uppercase text-slate-700 dark:text-slate-300">
                        {tx.paymentDetail || tx.paymentMethod}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {can("inventory.stock.view") && (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-slate-50 px-5 py-4 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-amber-50 p-2 dark:bg-amber-900/20">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h4 className="font-black uppercase tracking-tight text-slate-800 dark:text-white">
                    Stock Alerts
                  </h4>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300">
                    Lowest stock first
                  </p>
                </div>
              </div>
              <Link
                href="/items/low-stock"
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-600 hover:gap-2 dark:text-amber-400"
              >
                Manage Stock <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-slate-50 dark:divide-zinc-800/50">
              {visibleLowStock.length === 0 ? (
                <div className="flex min-h-[8.5rem] items-center justify-center px-6 py-6">
                  <div className="text-center opacity-30">
                    <Package className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                    <p className="text-[10px] font-black uppercase tracking-widest">
                      Inventory levels optimal
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {visibleLowStock.map((item) => {
                    const variant = itemVariant(item, currentLocation?.id);
                    return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 px-5 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/20"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-[11px] font-black text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
                          {item.stock}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-black uppercase tracking-tight text-slate-900 dark:text-white">
                            {variant.style}
                            {variant.badge ? ` · ${variant.badge}` : ""}
                          </p>
                          <p className="truncate text-[10px] font-bold uppercase text-slate-700 dark:text-slate-300">
                            {[variant.code !== variant.badge ? variant.code : "", formatUnitLabel(item)].filter(Boolean).join(" · ") || item.category}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-lg bg-red-50 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-red-600 dark:bg-red-900/20 dark:text-red-400">
                        Low
                      </span>
                    </div>
                    );
                  })}
                  {extraLowStock > 0 ? (
                    <Link
                      href="/items/low-stock"
                      className="block px-5 py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/20"
                    >
                      +{extraLowStock} more alerts
                    </Link>
                  ) : null}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SmallStatCard({
  title,
  value,
  change,
  icon: Icon,
  action,
  actionHref,
  trend,
}: any) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm hover:shadow-xl transition-all group">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
          {title}
        </p>
        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl group-hover:scale-110 transition-transform">
          <Icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        </div>
      </div>
      <h2 className="mt-3 text-xl font-black tracking-tighter text-slate-900 dark:text-white sm:mt-4 sm:text-2xl lg:text-3xl">
        {value}
      </h2>

      <div className="mt-6 border-t border-slate-50 dark:border-zinc-800 pt-6">
        <div>
          <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
            {change.split(" ")[1] || "TXNS"}
          </p>
          <p className="text-xs font-black text-slate-900 dark:text-white mt-0.5">
            {change.split(" ")[0]}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <Link
          href={actionHref || "#"}
          className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase flex items-center gap-2 group/btn tracking-widest"
        >
          {action}{" "}
          <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
        </Link>
      </div>
    </div>
  );
}

function DashboardCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  action,
  actionHref,
  trend,
}: any) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-xl shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              color === "amber" ? "bg-amber-500" : "bg-indigo-500",
            )}
          />
          <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
            {title}
          </p>
        </div>
        {Icon && (
          <Icon
            className={cn(
              "w-4 h-4",
              color === "amber" ? "text-amber-500" : "text-indigo-500",
            )}
          />
        )}
      </div>

      <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-3 tracking-tighter uppercase">
        {value}
      </h3>

      {subtitle && (
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest opacity-60">
            {subtitle}
          </p>
          {trend === "up" && (
            <ArrowUpRight className="w-3 h-3 text-indigo-500" />
          )}
        </div>
      )}

      {action && (
        <div className="mt-6 border-t border-slate-50 dark:border-zinc-800 pt-4">
          <Link
            href={actionHref || "#"}
            className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase flex items-center gap-2 group tracking-widest"
          >
            {action}{" "}
            <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
          </Link>
        </div>
      )}
    </div>
  );
}

function QuickAction({ href, icon: Icon, label, color }: any) {
  const colors: any = {
    indigo:
      "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30",
    emerald:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30",
    amber:
      "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 border-amber-100 dark:border-amber-900/30",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border-blue-100 dark:border-blue-900/30",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400 border-rose-100 dark:border-rose-900/30",
    slate:
      "bg-slate-50 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400 border-slate-100 dark:border-zinc-700",
  };

  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border bg-white p-3 transition-all duration-300 group hover:shadow-lg active:scale-95 dark:bg-zinc-900 sm:p-4",
        "border-slate-200 dark:border-zinc-800",
      )}
    >
      <div
        className={cn(
          "mb-2 flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 sm:mb-3 sm:h-12 sm:w-12",
          colors[color] || colors.indigo,
          "group-hover:scale-110 group-hover:rotate-3",
        )}
      >
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
      </div>
      <span className="text-[11px] font-bold text-slate-700 transition-colors group-hover:text-indigo-600 dark:text-zinc-300 dark:group-hover:text-indigo-400 sm:text-xs">
        {label}
      </span>
    </Link>
  );
}
