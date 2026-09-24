"use client";

import React, { useState, useRef, useEffect } from "react";
import { Menu, Bell, User, ChevronDown, Moon, Sun, Settings, LogOut, Check } from "lucide-react";
import { useAppData } from "@/lib/client/useAppData";
import { cn } from "@/lib/utils";
import { defaultBusinessForUser, getBusinessBrand, resolveAvailableLocations } from "@/lib/businesses";
import { BusinessIdentity } from "@/components/layout/BusinessBrand";
import { useTheme } from "next-themes";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { createPortal } from "react-dom";
import { signOut, useSession } from "next-auth/react";

export function Topbar({ toggleSidebar }: { toggleSidebar: () => void }) {
  const { data: session } = useSession();
  const user = session?.user as any;
  const { currentLocation, locations, availableLocations: availableBusinesses, setCurrentLocation, bankAccounts } = useAppData();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const profileRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const locationRef = useRef<HTMLButtonElement>(null);
  const locationMenuRef = useRef<HTMLDivElement>(null);
  const [locationMenuPos, setLocationMenuPos] = useState({ top: 0, left: 0 });
  const [profileMenuPos, setProfileMenuPos] = useState({ top: 0, left: 0 });
  const pageTitle = getPageTitle(pathname, bankAccounts);
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || "Account";
  const displayRole = user?.role || "User";

  const availableLocations = resolveAvailableLocations(user, availableBusinesses?.length ? availableBusinesses : locations);
  const activeBusiness = currentLocation || defaultBusinessForUser(user, availableLocations);
  const brand = getBusinessBrand(activeBusiness);
  const canSwitchBusiness = availableLocations.length > 1;

  const placeLocationMenu = () => {
    const rect = locationRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuWidth = Math.min(300, window.innerWidth - 16);
    const padding = 8;
    let left = rect.left + rect.width / 2 - menuWidth / 2;
    if (left < padding) left = padding;
    if (left + menuWidth > window.innerWidth - padding) {
      left = Math.max(padding, window.innerWidth - padding - menuWidth);
    }
    setLocationMenuPos({ top: rect.bottom + 6, left });
  };

  const placeProfileMenu = () => {
    const rect = profileRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuWidth = Math.min(240, window.innerWidth - 16);
    const padding = 8;
    let left = rect.right - menuWidth;
    if (left < padding) left = padding;
    setProfileMenuPos({ top: rect.bottom + 6, left });
  };

  useEffect(() => {
    setMounted(true);
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const inProfile = profileRef.current?.contains(target) || profileMenuRef.current?.contains(target);
      if (!inProfile) setIsProfileOpen(false);
      const inTrigger = locationRef.current?.contains(target);
      const inMenu = locationMenuRef.current?.contains(target);
      if (!inTrigger && !inMenu) {
        setIsLocationOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isLocationOpen) return;
    placeLocationMenu();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onReposition = () => placeLocationMenu();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsLocationOpen(false);
    };
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [isLocationOpen]);

  useEffect(() => {
    if (!isProfileOpen) return;
    placeProfileMenu();
    const onReposition = () => placeProfileMenu();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [isProfileOpen]);

  return (
    <header className={cn(
      "relative z-50 grid h-16 w-full min-w-0 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 overflow-visible border-b border-slate-200 bg-white/95 px-2 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95 dark:shadow-black/20 sm:gap-3 sm:px-4 md:px-6",
      isLocationOpen && "z-[230]",
    )}>
      <div className={cn("absolute inset-x-0 top-0 h-1", brand.bar)} />
      <div className="flex min-w-0 items-center justify-start gap-1 sm:gap-2">
        <button 
          onClick={toggleSidebar}
          className="shrink-0 rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="hidden min-w-0 max-w-[14rem] xl:block">
          <h1 className="truncate text-lg font-black tracking-tight text-slate-900 dark:text-white">
            {pageTitle}
          </h1>
          <p className={cn("truncate text-[10px] font-black uppercase tracking-widest", brand.sub)}>
            {brand.name}
          </p>
        </div>
      </div>

      <div className="flex justify-center">
          <button 
            ref={locationRef}
            type="button"
            disabled={!canSwitchBusiness}
            aria-haspopup="listbox"
            aria-expanded={isLocationOpen}
            onClick={() => {
              if (!canSwitchBusiness) return;
              if (isLocationOpen) {
                setIsLocationOpen(false);
                return;
              }
              setIsProfileOpen(false);
              placeLocationMenu();
              setIsLocationOpen(true);
            }}
            className={cn(
              "relative z-[231] inline-flex w-max max-w-[min(100%,16rem)] shrink-0 items-center gap-1.5 rounded-2xl border px-2 py-1.5 shadow-sm transition-all select-none dark:shadow-none sm:gap-2 sm:px-3",
              brand.chip,
              canSwitchBusiness ? "hover:border-indigo-500 dark:hover:border-indigo-400 cursor-pointer" : "cursor-default",
              isLocationOpen && "border-indigo-400 ring-2 ring-indigo-500/25 dark:border-indigo-400 dark:ring-indigo-400/30",
            )}
          >
            <BusinessIdentity business={activeBusiness} size="sm" showSubtitle={false} />
            {canSwitchBusiness && (
              <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-slate-900 dark:text-zinc-200 transition-transform sm:h-4 sm:w-4", isLocationOpen ? "rotate-180" : "")} />
            )}
          </button>

          {mounted && createPortal(
            <AnimatePresence>
              {isLocationOpen && canSwitchBusiness ? (
                <motion.div
                  key="business-switcher-layer"
                  className="fixed inset-0 z-[200]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <button
                    type="button"
                    aria-label="Close business switcher"
                    className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
                    onClick={() => setIsLocationOpen(false)}
                  />
                  <div
                    ref={locationMenuRef}
                    role="listbox"
                    aria-label="Switch pharmacy"
                    style={{ top: locationMenuPos.top, left: locationMenuPos.left, width: Math.min(300, typeof window !== "undefined" ? window.innerWidth - 16 : 300) }}
                    className="absolute z-10 overflow-hidden rounded-2xl border border-slate-300 bg-white py-2 shadow-[0_24px_64px_rgba(15,23,42,0.28)] ring-1 ring-slate-900/10 dark:border-zinc-600 dark:bg-zinc-900 dark:shadow-black/60 dark:ring-white/10"
                  >
                  <div className="border-b border-slate-100 px-4 py-2 dark:border-zinc-800">
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-zinc-400">Switch Pharmacy</p>
                  </div>
                  {availableLocations.map((location) => {
                    const selected = activeBusiness?.id === location.id;
                    const itemBrand = getBusinessBrand(location);
                    return (
                    <button
                      key={location.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        setCurrentLocation(location);
                        setIsLocationOpen(false);
                      }}
                      className={cn(
                        "relative mx-2 mb-1 flex w-[calc(100%-1rem)] items-center justify-between gap-2 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-all",
                        selected
                          ? cn("pl-4", itemBrand.selected)
                          : "border-transparent text-slate-700 hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      )}
                    >
                      {selected && <span className={cn("absolute inset-y-0 left-0 w-1.5", itemBrand.bar)} />}
                      <BusinessIdentity business={location} size="sm" showSubtitle={false} />
                      {selected ? (
                        <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white", itemBrand.mark)}>
                          <Check className="h-3 w-3" strokeWidth={3} />
                          Current
                        </span>
                      ) : null}
                    </button>
                    );
                  })}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )}
      </div>

      <div className="flex min-w-0 items-center justify-end gap-1 sm:gap-2">
        <button 
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
          aria-label="Toggle theme"
        >
          {!mounted ? (
            <div className="h-5 w-5" />
          ) : theme === "dark" ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </button>
        
        <button className="relative hidden rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950 sm:inline-flex dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-indigo-500" />
        </button>

        <div className="mx-0.5 hidden h-8 w-px bg-slate-200 md:block dark:bg-zinc-800" />

        <div className="relative">
          <button
            ref={profileRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={isProfileOpen}
            onClick={() => {
              if (isProfileOpen) {
                setIsProfileOpen(false);
                return;
              }
              setIsLocationOpen(false);
              placeProfileMenu();
              setIsProfileOpen(true);
            }}
            className={cn(
              "inline-flex max-w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white py-1 pl-1.5 pr-2 shadow-sm transition-all select-none dark:border-zinc-700 dark:bg-zinc-950",
              isProfileOpen
                ? "border-indigo-300 ring-2 ring-indigo-500/20 dark:border-indigo-500"
                : "hover:border-slate-300 dark:hover:border-zinc-500",
            )}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-900 dark:bg-zinc-800 dark:text-zinc-100">
              <User className="h-4 w-4" />
            </span>
            <span className="hidden min-w-0 text-left leading-tight sm:block">
              <span className="block truncate text-xs font-black text-slate-900 dark:text-white">{displayName}</span>
              <span className="mt-0.5 block truncate font-mono text-[9px] font-bold uppercase tracking-widest text-slate-900 dark:text-zinc-200">{displayRole}</span>
            </span>
            <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-900 dark:text-zinc-200 transition-transform", isProfileOpen ? "rotate-180" : "")} />
          </button>

          {mounted && createPortal(
            <AnimatePresence>
              {isProfileOpen && (
                <motion.div
                  ref={profileMenuRef}
                  role="menu"
                  aria-label="Account menu"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  style={{ top: profileMenuPos.top, left: profileMenuPos.left, width: Math.min(240, typeof window !== "undefined" ? window.innerWidth - 16 : 240) }}
                  className="fixed z-[220] overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-2xl shadow-slate-200/70 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/40"
                >
                  <div className="border-b border-slate-100 px-4 py-3 dark:border-zinc-800">
                    <p className="truncate text-sm font-black text-slate-900 dark:text-zinc-200">{displayName}</p>
                    <p className="mt-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-900 dark:text-zinc-200">{displayRole}</p>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsProfileOpen(false);
                      router.push("/profile");
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    <User className="h-4 w-4" />
                    Profile
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsProfileOpen(false);
                      router.push("/admin/settings");
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </button>
                  <div className="my-1 h-px bg-slate-100 dark:bg-zinc-800" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-900/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </motion.div>
              )}
            </AnimatePresence>,
            document.body,
          )}
        </div>
      </div>
    </header>
  );
}

function getPageTitle(pathname: string, bankAccounts: Array<{ id: string; displayName?: string }> = []) {
  const titles: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/items": "Item List",
    "/items/create": "Add Item",
    "/items/low-stock": "Low Stock",
    "/items/categories": "Categories",
    "/store": "Store Stock",
    "/store/locations": "Dispensary Stock",
    "/store/transfers": "Stock Transfers",
    "/store/movements": "Stock Movements",
    "/purchases": "Purchases",
    "/purchases/create": "New Purchase",
    "/sales": "Sales",
    "/sales/create": "New Sale",
    "/sales/pos": "Point of Sale",
    "/customers": "Customers",
    "/suppliers": "Suppliers",
    "/finance": "Finance",
    "/finance/cash-to-bank": "Cash to Bank",
    "/finance/expenses": "Expenses",
    "/reports": "Reports",
    "/admin/locations": "Pharmacies",
    "/admin/users": "Users",
  };

  if (titles[pathname]) {
    return titles[pathname];
  }

  const bankDetailMatch = pathname.match(/^\/finance\/banks\/([^/]+)$/);
  if (bankDetailMatch) {
    return bankAccounts.find((account) => account.id === bankDetailMatch[1])?.displayName || "Bank Account";
  }

  const segment = pathname.split("/").filter(Boolean).at(-1);
  if (!segment) {
    return "Dashboard";
  }

  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
