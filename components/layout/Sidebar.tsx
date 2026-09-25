"use client";

import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  Users,
  UserRound,
  Wallet,
  Settings,
  ChevronDown,
  LogOut,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { signOut, useSession } from "next-auth/react";
import { useAppData } from "@/lib/client/useAppData";
import { defaultBusinessForUser, getBusinessBrand } from "@/lib/businesses";
import { BusinessIdentity } from "@/components/layout/BusinessBrand";

interface MenuItem {
  icon: any;
  label: string;
  path: string;
  color: string;
  permission?: string;
  anyPermission?: string[];
  children?: { label: string; path: string; permission?: string; anyPermission?: string[] }[];
}

const menuItems: MenuItem[] = [
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    path: "/dashboard",
    color: "text-indigo-600 dark:text-indigo-400",
    permission: "dashboard.view",
  },
  {
    icon: Package,
    label: "Inventory",
    path: "/items",
    color: "text-violet-600 dark:text-violet-400",
    permission: "inventory.items.view",
    children: [
      {
        label: "Item List",
        path: "/items",
        permission: "inventory.items.view",
      },
      // { label: "Create Item", path: "/items/create", permission: "inventory.items.create" },
      {
        label: "Counter Stock",
        path: "/store/locations",
        permission: "inventory.stock.view",
      },
      {
        label: "Store Stock",
        path: "/store",
        permission: "inventory.store.view",
      },
      {
        label: "Low Stock",
        path: "/items/low-stock",
        permission: "inventory.stock.view",
      },
      {
        label: "Expiry",
        path: "/items/expiry",
        permission: "inventory.expiry.view",
      },
      {
        label: "Damage",
        path: "/store/damage",
        permission: "inventory.stock.view",
      },
      {
        label: "Transfers",
        path: "/store/transfers",
        permission: "inventory.transfers.view",
      },
      {
        label: "Stock Movements",
        path: "/store/movements",
        permission: "inventory.movements.view",
      },
      {
        label: "Categories",
        path: "/items/categories",
        permission: "inventory.categories.view",
      },
    ],
  },
  {
    icon: Truck,
    label: "Purchases",
    path: "/purchases",
    color: "text-amber-600 dark:text-amber-400",
    permission: "purchases.view",
    children: [
      {
        label: "Purchase List",
        path: "/purchases",
        permission: "purchases.view",
      },
      {
        label: "Purchase Items",
        path: "/purchases/items",
        permission: "purchases.view",
      },
      {
        label: "New Purchase",
        path: "/purchases/create",
        permission: "purchases.create",
      },
    ],
  },
  {
    icon: ShoppingCart,
    label: "Sales",
    path: "/sales",
    color: "text-emerald-600 dark:text-emerald-400",
    permission: "sales.view",
    children: [
      { label: "Sales List", path: "/sales", permission: "sales.view" },
      {
        label: "Sold Items",
        path: "/sales/sold-items",
        permission: "sales.view",
      },
      { label: "New Sale", path: "/sales/create", permission: "sales.create" },
      { label: "Cashier Queue", path: "/sales/pending", permission: "sales.create" },
      // { label: "POS", path: "/sales/pos", permission: "sales.pos" },
    ],
  },
  {
    icon: UserRound,
    label: "Customers",
    path: "/customers",
    color: "text-sky-600 dark:text-sky-400",
    permission: "customers.view",
    children: [
      {
        label: "Customer List",
        path: "/customers",
        permission: "customers.view",
      },
      {
        label: "Credit Customers",
        path: "/customers/credits",
        permission: "customers.view",
      },
    ],
  },
  {
    icon: Users,
    label: "Suppliers",
    path: "/suppliers",
    color: "text-orange-600 dark:text-orange-400",
    permission: "suppliers.view",
    children: [
      {
        label: "Supplier List",
        path: "/suppliers",
        permission: "suppliers.view",
      },
      {
        label: "Supplier Debts",
        path: "/suppliers/debts",
        permission: "suppliers.view",
      },
    ],
  },
  {
    icon: Wallet,
    label: "Finance",
    path: "/finance",
    color: "text-rose-600 dark:text-rose-400",
    permission: "finance.overview.view",
    children: [
      {
        label: "Finance Overview",
        path: "/finance",
        permission: "finance.overview.view",
      },
      {
        label: "Transactions",
        path: "/finance/transactions",
        permission: "finance.transactions.view",
      },
      {
        label: "Cash to Bank",
        path: "/finance/cash-to-bank",
        permission: "finance.cash_to_bank.view",
      },
      {
        label: "Expenses",
        path: "/finance/expenses",
        permission: "finance.expenses.view",
      },
      {
        label: "Bank Accounts",
        path: "/finance/banks",
        permission: "finance.banks.view",
      },
      {
        label: "Tax Report",
        path: "/finance/tax",
        permission: "finance.tax.view",
      },
    ],
  },
  {
    icon: Settings,
    label: "Admin",
    path: "/admin",
    color: "text-slate-600 dark:text-slate-400",
    permission: "admin.users.view",
    children: [
      {
        label: "Reports",
        path: "/reports",
        anyPermission: ["reports.view", "reports.sales.view", "reports.inventory.view", "reports.finance.view", "reports.audit.view"],
      },
      {
        label: "User Management",
        path: "/admin/users",
        permission: "admin.users.view",
      },
      {
        label: "Role Management",
        path: "/admin/roles",
        permission: "admin.roles.view",
      },
      {
        label: "System Settings",
        path: "/admin/settings",
        permission: "admin.settings.view",
      },
      // { label: "Backup & Restore", path: "/admin/backup" },
    ],
  },
];

function SidebarItem({
  item,
  pathname,
  isExpanded,
  onToggle,
}: {
  item: MenuItem;
  pathname: string;
  isExpanded: boolean;
  onToggle: (label: string) => void;
}) {
  const hasChildren = Boolean(item.children && item.children.length > 0);

  const childIsActive = (childPath: string) => {
    if (pathname === childPath) return true;
    if (!pathname.startsWith(`${childPath}/`)) return false;
    // Prefer a more specific sibling (e.g. /finance/transactions over /finance).
    return !item.children?.some(
      (other) =>
        other.path !== childPath &&
        other.path.length > childPath.length &&
        (pathname === other.path || pathname.startsWith(`${other.path}/`)),
    );
  };

  const isActive =
    (!hasChildren && pathname === item.path) ||
    (hasChildren && Boolean(item.children?.some((c) => childIsActive(c.path))));

  const itemClassName = cn(
    "flex w-full items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group relative cursor-pointer text-left",
    isActive
      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/45 dark:text-indigo-300"
      : "text-slate-800 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-900 hover:text-slate-950 dark:hover:text-zinc-100",
  );

  const iconClassName = cn(
    "w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110",
    isActive ? "text-indigo-700 dark:text-indigo-300" : item.color,
  );

  const labelRow = (
    <div className="flex-1 flex items-center justify-between overflow-hidden">
      <span className="text-sm font-medium truncate">{item.label}</span>
      {hasChildren && (
        <ChevronDown
          className={cn(
            "w-4 h-4 transition-transform duration-200",
            isExpanded ? "rotate-180" : "",
          )}
        />
      )}
    </div>
  );

  return (
    <div>
      {hasChildren ? (
        <button
          type="button"
          onClick={() => onToggle(item.label)}
          aria-expanded={isExpanded}
          className={itemClassName}
        >
          <item.icon className={iconClassName} />
          {labelRow}
        </button>
      ) : (
        <Link href={item.path} className={itemClassName}>
          <item.icon className={iconClassName} />
          {labelRow}
        </Link>
      )}

      {hasChildren && (
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="mt-1 ml-4 pl-4 border-l border-slate-200 dark:border-zinc-800 space-y-1">
                {item.children?.map((child) => (
                  <Link
                    key={child.label}
                    href={child.path}
                    className={cn(
                      "block px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer",
                      childIsActive(child.path)
                        ? "text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/45"
                        : "text-slate-800 dark:text-zinc-200 hover:text-slate-950 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-900",
                    )}
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

export function Sidebar({
  isOpen,
  toggle,
}: {
  isOpen: boolean;
  toggle: () => void;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as any;
  const { currentLocation, locations, availableLocations } = useAppData();
  const activeBusiness = currentLocation || defaultBusinessForUser(user, availableLocations?.length ? availableLocations : locations);
  const brand = getBusinessBrand(activeBusiness);
  const permissionKeys = new Set<string>(user?.permissions || []);
  const isSuperAdmin = user?.role === "Super Admin";
  const can = (permission?: string, anyPermission?: string[]) =>
    isSuperAdmin ||
    (!permission && !anyPermission?.length) ||
    Boolean(permission && permissionKeys.has(permission)) ||
    Boolean(anyPermission?.some((key) => permissionKeys.has(key)));
  const visibleMenuItems = React.useMemo(
    () =>
      menuItems
        .map((item) => ({
          ...item,
          children: item.children?.filter((child) => can(child.permission, child.anyPermission)),
        }))
        .filter(
          (item) => can(item.permission, item.anyPermission) || Boolean(item.children?.length),
        ),
    [isSuperAdmin, user?.permissions],
  );
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  // Auto-expand the current section on mount or pathname change
  useEffect(() => {
    const currentSection = visibleMenuItems.find((item) =>
      item.children?.some((child) => pathname === child.path),
    );
    if (currentSection) {
      setExpandedItem(currentSection.label);
    }
  }, [pathname, visibleMenuItems]);

  const handleToggle = (label: string) => {
    setExpandedItem((prev) => (prev === label ? null : label));
  };

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-[70] flex h-full w-64 flex-col border-r border-slate-200 bg-white shadow-xl transition-transform duration-300 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-black/30",
        isOpen ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="shrink-0 border-b border-slate-200 dark:border-zinc-800">
        <div className={cn("h-1.5 w-full", brand.bar)} />
        <div className="flex items-start justify-between gap-2 px-3 py-4 sm:px-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-zinc-100 mb-2.5">
              Working in
            </p>
            <BusinessIdentity business={activeBusiness} />
          </div>
          <button
            type="button"
            onClick={toggle}
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-100 lg:hidden dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto scrollbar-hide py-2">
        {visibleMenuItems.map((item) => (
          <SidebarItem
            key={item.label}
            item={item}
            pathname={pathname}
            isExpanded={expandedItem === item.label}
            onToggle={handleToggle}
          />
        ))}
      </nav>

      <div className="p-3 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shrink-0">
        <button
          onClick={() => {
            signOut({ callbackUrl: "/login" });
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-900 dark:text-zinc-100 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-300 transition-colors group"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}
