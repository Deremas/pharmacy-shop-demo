"use client"

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { useAppData } from "@/lib/client/useAppData";
import { useSession } from "next-auth/react";
import { Package2 } from "lucide-react";
import { ACTIVE_BUSINESS_STORAGE_KEY, defaultBusinessForUser, homePathWhenLeavingBusiness } from "@/lib/businesses";

// ── App Loading Screen ────────────────────────────────────────────────────────
function AppLoadingScreen() {
  return (
    <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-slate-100 dark:bg-zinc-950">
      {/* Logo mark */}
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-2xl shadow-indigo-500/40">
          <Package2 className="w-10 h-10 text-white" />
        </div>
        {/* Spinner ring */}
        <svg
          className="absolute -inset-3 w-26 h-26 animate-spin"
          style={{ width: 104, height: 104, top: -12, left: -12 }}
          viewBox="0 0 104 104"
          fill="none"
        >
          <circle cx="52" cy="52" r="48" stroke="#e0e7ff" strokeWidth="4" />
          <path
            d="M52 4 A48 48 0 0 1 100 52"
            stroke="#6366f1"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Skeleton shimmer bars */}
      <div className="w-64 space-y-3">
        {["w-full", "w-4/5", "w-3/5"].map((w, i) => (
          <div
            key={i}
            className={`${w} h-2.5 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden`}
          >
            <div
              className="h-full bg-gradient-to-r from-transparent via-slate-300 dark:via-zinc-600 to-transparent animate-[shimmer_1.4s_ease-in-out_infinite]"
              style={{ animationDelay: `${i * 0.18}s` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

const routePermissions: { prefix: string; permission?: string; anyPermission?: string[] }[] = [
  { prefix: "/admin/permissions", permission: "admin.permissions.view" },
  { prefix: "/admin/roles", permission: "admin.roles.view" },
  { prefix: "/admin/users", permission: "admin.users.view" },
  { prefix: "/admin/settings", permission: "admin.settings.view" },
  { prefix: "/admin/transactions", permission: "admin.transactions.view" },
  { prefix: "/admin/locations", permission: "admin.locations.view" },
  { prefix: "/admin/backup", permission: "admin.backup.manage" },
  {
    prefix: "/admin",
    anyPermission: [
      "admin.users.view",
      "admin.roles.view",
      "admin.permissions.view",
      "admin.settings.view",
      "admin.locations.view",
      "admin.transactions.view",
      "admin.backup.manage",
      "reports.view",
    ],
  },
  { prefix: "/reports/audit", permission: "reports.audit.view" },
  { prefix: "/reports/finance", permission: "reports.finance.view" },
  { prefix: "/reports/inventory", permission: "reports.inventory.view" },
  { prefix: "/reports/sales", permission: "reports.sales.view" },
  { prefix: "/reports", permission: "reports.view" },
  { prefix: "/finance/cash-to-bank", permission: "finance.cash_to_bank.view" },
  { prefix: "/finance/expenses", permission: "finance.expenses.view" },
  { prefix: "/finance/banks", permission: "finance.banks.view" },
  { prefix: "/finance/transactions", permission: "finance.transactions.view" },
  { prefix: "/finance/tax", permission: "finance.tax.view" },
  { prefix: "/finance", permission: "finance.overview.view" },
  { prefix: "/purchases/items", permission: "purchases.view" },
  { prefix: "/purchases/create", permission: "purchases.create" },
  { prefix: "/purchases/add", permission: "purchases.create" },
  { prefix: "/purchases", permission: "purchases.view" },
  { prefix: "/sales/create", permission: "sales.create" },
  { prefix: "/sales/pos", permission: "sales.pos" },
  { prefix: "/sales/sold-items", permission: "sales.view" },
  { prefix: "/sales", permission: "sales.view" },
  { prefix: "/customers", permission: "customers.view" },
  { prefix: "/suppliers", permission: "suppliers.view" },
  { prefix: "/store/transfers", permission: "inventory.transfers.view" },
  { prefix: "/store/movements", permission: "inventory.movements.view" },
  { prefix: "/store/damage", permission: "inventory.stock.view" },
  { prefix: "/store", permission: "inventory.stock.view" },
  { prefix: "/items/create", anyPermission: ["inventory.items.create", "inventory.items.update"] },
  { prefix: "/items/categories", permission: "inventory.categories.view" },
  { prefix: "/items/low-stock", permission: "inventory.stock.view" },
  { prefix: "/items", permission: "inventory.items.view" },
  { prefix: "/dashboard", permission: "dashboard.view" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const user = session?.user as any;
  const { locations, availableLocations, currentLocation, setCurrentLocation, refresh, loading } = useAppData();
  const businesses = availableLocations?.length ? availableLocations : locations;

  React.useEffect(() => {
    if (status === "loading") return;

    if (status === "authenticated") {
      refresh().catch((error: unknown) => console.error(error));
    }
    setAuthChecked(true);
  }, [refresh, status]);

  React.useEffect(() => {
    if (!user) return;
    const storedId = typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_BUSINESS_STORAGE_KEY) : null;
    const next = defaultBusinessForUser(user, businesses, currentLocation?.id || storedId);
    if (next && next.id !== currentLocation?.id) {
      setCurrentLocation(next);
    }
  }, [businesses, currentLocation, setCurrentLocation, user]);

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const businessName = currentLocation?.name;
    document.title = businessName ? `${businessName} · Pharmacy` : "Pharmacy";
  }, [currentLocation?.name]);

  const previousBusinessId = React.useRef(currentLocation?.id);
  React.useEffect(() => {
    const previousId = previousBusinessId.current;
    const nextId = currentLocation?.id;
    previousBusinessId.current = nextId;
    if (!previousId || !nextId || previousId === nextId) return;
    const home = homePathWhenLeavingBusiness(
      pathname,
      typeof window !== "undefined" ? window.location.search : "",
    );
    if (home) router.replace(home);
  }, [currentLocation?.id, pathname, router]);

  // Auth Guard
  React.useEffect(() => {
    if (!authChecked) return;

    if (status === "unauthenticated" || !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    const requiredRoute = routePermissions
      .filter((entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`))
      .sort((a, b) => b.prefix.length - a.prefix.length)[0];
    const permissionKeys = new Set<string>(user.permissions || []);
    const allowed =
      user.role === "Super Admin" ||
      !requiredRoute ||
      (requiredRoute.permission ? permissionKeys.has(requiredRoute.permission) : false) ||
      Boolean(requiredRoute.anyPermission?.some((permission) => permissionKeys.has(permission)));
    if (!allowed) {
      router.replace("/dashboard");
    }
  }, [authChecked, pathname, router, status, user]);

  // Set initial state based on window size
  React.useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        setIsSidebarOpen(window.innerWidth >= 1024);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close sidebar on mobile/tablet when route changes
  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, [pathname]);

  React.useEffect(() => {
    if (!isSidebarOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSidebarOpen]);

  if (!authChecked || (loading && status === "authenticated")) {
    return <AppLoadingScreen />;
  }

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-slate-100 text-slate-950 transition-colors relative dark:bg-zinc-950 dark:text-zinc-50">
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 z-[60] lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <Sidebar isOpen={isSidebarOpen} toggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      <div className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden transition-all duration-300",
        isSidebarOpen ? "lg:pl-64" : "lg:pl-0"
      )}>
        <Topbar toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-slate-100 p-3 dark:bg-zinc-950 sm:p-4 md:p-8">
          <div className="mx-auto flex min-h-full w-full max-w-7xl flex-1 flex-col">
            <div key={currentLocation?.id || "no-business"} className="flex flex-1 flex-col">
              {children}
            </div>
            <p className="mt-auto shrink-0 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-8 text-center text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-zinc-500">
              Built by{" "}
              <a
                href="https://blueoceancreatives.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-500 underline-offset-2 transition hover:text-indigo-600 hover:underline dark:text-zinc-400 dark:hover:text-indigo-400"
              >
                Blue Ocean Creatives
              </a>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
