"use client";

import React from "react";
import { useSession } from "next-auth/react";
import { ACTIVE_BUSINESS_STORAGE_KEY, belongsToBusiness, defaultBusinessForUser, isTenantBusiness, locationsForCurrentBusiness, resolveAvailableLocations } from "@/lib/businesses";

type AppData = Record<string, any>;

const initialAppData: AppData = {
  currentLocation: null,
  locations: [],
  categories: [],
  units: [],
  products: [],
  items: [],
  inventoryBatches: [],
  suppliers: [],
  customers: [],
  bankAccounts: [],
  bankTransactions: [],
  sales: [],
  purchases: [],
  customerPayments: [],
  supplierPayments: [],
  expenses: [],
  expenseCategories: [],
  cashTransfers: [],
  transfers: [],
  inventoryMovements: [],
  auditLogs: [],
  users: [],
  roles: [],
  permissions: [],
  settings: {},
  settingsByLocation: {},
  pendingSales: [],
  saleReturns: [],
  purchaseReturns: [],
};

type AppDataContextValue = AppData & {
  loading: boolean;
  filterLocationIds: string[];
  setFilterLocationIds: (ids: string[]) => void;
  setCurrentLocation: (location: any) => void;
  refresh: () => Promise<AppData | undefined>;
  addCustomer: (payload: any) => Promise<any>;
  updateCustomer: (payload: any) => Promise<any>;
  addSupplier: (payload: any) => Promise<any>;
  updateSupplier: (payload: any) => Promise<any>;
  addLocation: (payload: any) => Promise<any>;
  updateSettings: (payload: any) => Promise<any>;
  addCategory: (payload: any) => Promise<any>;
  updateCategory: (payload: any) => Promise<any>;
  deleteCategory: (payload: any) => Promise<any>;
  addUnit: (payload: any) => Promise<any>;
  addSale: (payload: any) => Promise<any>;
  addExpense: (payload: any) => Promise<any>;
  addExpenseCategory: (payload: any) => Promise<any>;
  addCashTransfer: (payload: any) => Promise<{ success: boolean; error?: string }>;
  addPurchase: (payload: any) => Promise<any>;
  addItem: (payload: any) => Promise<any>;
  updateItem: (payload: any) => Promise<any>;
  updateUser: (payload: any) => Promise<any>;
  updateUserStatus: (id: string, isActive: boolean) => Promise<any>;
  changePassword: (payload: any) => Promise<any>;
  addUser: (payload: any) => Promise<any>;
  addRole: (payload: any) => Promise<any>;
  updateRole: (payload: any) => Promise<any>;
  deleteRole: (id: string) => Promise<any>;
  updateBankAccount: (payload: any) => Promise<any>;
  addBankAccount: (payload: any) => Promise<any>;
  deleteBankAccount: (id: string) => Promise<any>;
  addCustomerPayment: (payload: any) => Promise<any>;
  settleCredit: (payload: any) => Promise<any>;
  addSupplierPayment: (payload: any) => Promise<any>;
  addTransfer: (payload: any) => Promise<any>;
  adjustStock: (payload: any) => Promise<any>;
  addStockEntry: (payload: any) => Promise<any>;
  recordDamage: (payload: any) => Promise<any>;
  updateItemPrice: (payload: any) => Promise<any>;
  deleteSale: (id: string) => Promise<any>;
  deletePurchase: (id: string) => Promise<any>;
  deleteItem: (id: string) => Promise<{ success: boolean }>;
  deleteSupplier: (id: string) => Promise<{ success: boolean }>;
  deleteCustomer: (id: string) => Promise<{ success: boolean }>;
  deleteUser: (id: string) => Promise<{ success: boolean }>;
  updateItemStock: (id: string, locationId: string, quantity: number) => Promise<any>;
  completePendingSale: (payload: any) => Promise<any>;
  cancelPendingSale: (payload: any) => Promise<any>;
  disposeBatch: (payload: any) => Promise<any>;
  voidSale: (id: string) => Promise<any>;
  createSaleReturn: (payload: any) => Promise<any>;
  createPurchaseReturn: (payload: any) => Promise<any>;
};

const AppDataContext = React.createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const sessionUser = session?.user as any;
  const sessionUserRef = React.useRef(sessionUser);
  sessionUserRef.current = sessionUser;
  const [state, setState] = React.useState<AppData>(initialAppData);
  const [loading, setLoading] = React.useState(true);
  const [filterLocationIds, setFilterLocationIds] = React.useState<string[]>([]);
  const pendingLoadRef = React.useRef<Promise<AppData | undefined> | null>(null);

  const loadData = React.useCallback(async () => {
    if (pendingLoadRef.current) return pendingLoadRef.current;
    const user = sessionUserRef.current;

    const pendingLoad = (async () => {
      try {
        const response = await fetch("/api/app", { cache: "no-store" });
        if (response.status === 401) {
          if (typeof window !== "undefined") window.location.href = "/login";
          return undefined;
        }
        if (!response.ok) throw new Error("Failed to load application data.");

        const data = await response.json();
        let nextState: AppData = data;
        setState((current) => {
          const storedId = typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_BUSINESS_STORAGE_KEY) : null;
          const allowedLocations = resolveAvailableLocations(user, data.locations || []);
          const preferred = defaultBusinessForUser(
            user,
            allowedLocations,
            current.currentLocation?.id || storedId || data.currentLocation?.id,
          ) || data.currentLocation || allowedLocations[0] || null;

          nextState = {
            ...initialAppData,
            ...data,
            locations: allowedLocations.length ? allowedLocations : (data.locations || []),
            currentLocation: preferred,
          };
          return nextState;
        });
        return nextState;
      } catch (error) {
        console.error("Failed to load app data:", error);
        const fallbackLocations = resolveAvailableLocations(user, []);
        const fallbackBusiness = defaultBusinessForUser(user, fallbackLocations);
        if (fallbackBusiness) {
          setState((current) => ({
            ...current,
            locations: current.locations?.length ? current.locations : fallbackLocations,
            currentLocation: current.currentLocation || fallbackBusiness,
          }));
        }
        return undefined;
      } finally {
        setLoading(false);
        pendingLoadRef.current = null;
      }
    })();

    pendingLoadRef.current = pendingLoad;
    return pendingLoad;
  }, []);

  React.useEffect(() => {
    const user = sessionUserRef.current;
    const fallback = defaultBusinessForUser(user, []);
    if (!fallback) return;
    setState((current) => {
      if (current.currentLocation?.id) return current;
      const storedId = typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_BUSINESS_STORAGE_KEY) : null;
      const next = defaultBusinessForUser(user, current.locations, storedId) || fallback;
      return {
        ...current,
        locations: current.locations?.length ? current.locations : [next],
        currentLocation: next,
      };
    });
  }, [sessionUser?.id, sessionUser?.locationId]);

  const runAction = React.useCallback(async (action: string, payload: any) => {
    const response = await fetch("/api/app", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });
    if (response.status === 401) {
      if (typeof window !== "undefined") window.location.href = "/login";
      throw new Error("Session expired.");
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) {
      throw new Error(body.error || `Action failed: ${action}`);
    }
    await loadData();
    return body;
  }, [loadData]);

  const scopedState = React.useMemo(() => {
    const locationId = state.currentLocation?.id as string | undefined;
    const settings = locationId && state.settingsByLocation?.[locationId]
      ? state.settingsByLocation[locationId]
      : state.settings;
    const allLocations = state.locations || [];
    const availableLocations = allLocations.filter(isTenantBusiness);
    const businessLocations = locationsForCurrentBusiness(state.currentLocation, allLocations);
    if (!locationId) return { ...state, settings, availableLocations, locations: availableLocations };

    const inThisBusiness = (row: any) => belongsToBusiness(row?.locationId, locationId);
    return {
      ...state,
      settings,
      availableLocations,
      locations: businessLocations,
      categories: (state.categories || []).filter(inThisBusiness),
      units: (state.units || []).filter(inThisBusiness),
      products: (state.products || []).filter(inThisBusiness),
      items: (state.items || []).filter(inThisBusiness),
      inventoryBatches: (state.inventoryBatches || []).filter(inThisBusiness),
      suppliers: (state.suppliers || []).filter(inThisBusiness),
      customers: (state.customers || []).filter(inThisBusiness),
      bankAccounts: (state.bankAccounts || []).filter(inThisBusiness),
      bankTransactions: (state.bankTransactions || []).filter(inThisBusiness),
      sales: (state.sales || []).filter(inThisBusiness),
      purchases: (state.purchases || []).filter(inThisBusiness),
      customerPayments: (state.customerPayments || []).filter(inThisBusiness),
      supplierPayments: (state.supplierPayments || []).filter(inThisBusiness),
      expenses: (state.expenses || []).filter(inThisBusiness),
      expenseCategories: (state.expenseCategories || []).filter(inThisBusiness),
      cashTransfers: (state.cashTransfers || []).filter(inThisBusiness),
      inventoryMovements: (state.inventoryMovements || []).filter(inThisBusiness),
      auditLogs: (state.auditLogs || []).filter((row: any) => !row.locationId || belongsToBusiness(row.locationId, locationId)),
      pendingSales: (state.pendingSales || []).filter(inThisBusiness),
      saleReturns: (state.saleReturns || []).filter(inThisBusiness),
      purchaseReturns: (state.purchaseReturns || []).filter(inThisBusiness),
      transfers: (state.transfers || []).filter((row: any) =>
        belongsToBusiness(row.sourceLocationId || row.fromLocationId, locationId)
        && belongsToBusiness(row.destinationLocationId || row.toLocationId, locationId)
      ),
    };
  }, [state]);

  const withBusiness = React.useCallback((payload: any = {}) => ({
    ...payload,
    locationId: payload.locationId || state.currentLocation?.id,
  }), [state.currentLocation?.id]);

  const value = React.useMemo<AppDataContextValue>(() => ({
    ...scopedState,
    loading,
    filterLocationIds,
    setFilterLocationIds,
    setCurrentLocation: (currentLocation: any) => {
      if (typeof window !== "undefined" && currentLocation?.id) {
        window.localStorage.setItem(ACTIVE_BUSINESS_STORAGE_KEY, currentLocation.id);
      }
      setFilterLocationIds([]);
      setState((current) => ({ ...current, currentLocation }));
    },
    refresh: loadData,
    addCustomer: (payload: any) => runAction("addCustomer", withBusiness(payload)),
    updateCustomer: (payload: any) => runAction("updateCustomer", payload),
    addSupplier: (payload: any) => runAction("addSupplier", withBusiness(payload)),
    updateSupplier: (payload: any) => runAction("updateSupplier", payload),
    addLocation: (payload: any) => runAction("addLocation", payload),
    updateSettings: (payload: any) => runAction("updateSettings", withBusiness(payload)),
    addCategory: (payload: any) => runAction("addCategory", withBusiness(payload)),
    updateCategory: (payload: any) => runAction("updateCategory", payload),
    deleteCategory: (payload: any) => runAction("deleteCategory", payload),
    addUnit: (payload: any) => runAction("addUnit", withBusiness(payload)),
    addSale: (payload: any) => runAction("addSale", withBusiness(payload)),
    addExpense: (payload: any) => runAction("addExpense", withBusiness(payload)),
    addExpenseCategory: (payload: any) => runAction("addExpenseCategory", withBusiness(payload)),
    addCashTransfer: async (payload: any) => {
      try {
        await runAction("addCashTransfer", withBusiness(payload));
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Cash transfer failed." };
      }
    },
    addPurchase: (payload: any) => runAction("addPurchase", withBusiness(payload)),
    addItem: (payload: any) => runAction("addItem", withBusiness(payload)),
    updateItem: (payload: any) => runAction("updateItem", withBusiness(payload)),
    updateUser: (payload: any) => runAction("updateUser", payload),
    updateUserStatus: (id: string, isActive: boolean) => runAction("updateUserStatus", { id, isActive }),
    changePassword: (payload: any) => runAction("changePassword", payload),
    addUser: (payload: any) => runAction("addUser", payload),
    addRole: (payload: any) => runAction("addRole", payload),
    updateRole: (payload: any) => runAction("updateRole", payload),
    deleteRole: (id: string) => runAction("deleteRole", { id }),
    updateBankAccount: (payload: any) => runAction("updateBankAccount", payload),
    addBankAccount: (payload: any) => runAction("addBankAccount", withBusiness(payload)),
    deleteBankAccount: (id: string) => runAction("deleteBankAccount", { id }),
    addCustomerPayment: (payload: any) => runAction("addCustomerPayment", withBusiness(payload)),
    settleCredit: (payload: any) => runAction("settleCredit", withBusiness(payload)),
    addSupplierPayment: (payload: any) => runAction("addSupplierPayment", withBusiness(payload)),
    addTransfer: (payload: any) => runAction("addTransfer", withBusiness(payload)),
    adjustStock: (payload: any) => runAction("adjustStock", payload),
    addStockEntry: (payload: any) => runAction("addStockEntry", payload),
    recordDamage: (payload: any) => runAction("recordDamage", payload),
    updateItemPrice: (payload: any) => runAction("updateItemPrice", payload),
    deleteSale: (id: string) => runAction("deleteSale", { id }),
    deletePurchase: (id: string) => runAction("deletePurchase", { id }),
    deleteItem: async (id: string) => {
      await runAction("deleteItem", { id });
      return { success: true };
    },
    deleteSupplier: async (id: string) => {
      await runAction("deleteSupplier", { id });
      return { success: true };
    },
    deleteCustomer: async (id: string) => {
      await runAction("deleteCustomer", { id });
      return { success: true };
    },
    deleteUser: async (id: string) => {
      await runAction("deleteUser", { id });
      return { success: true };
    },
    updateItemStock: (id: string, locationId: string, quantity: number) => runAction("updateItemStock", { id, locationId, quantity }),
    completePendingSale: (payload: any) => runAction("completePendingSale", payload),
    cancelPendingSale: (payload: any) => runAction("cancelPendingSale", payload),
    disposeBatch: (payload: any) => runAction("disposeBatch", payload),
    voidSale: (id: string) => runAction("voidSale", { id }),
    createSaleReturn: (payload: any) => runAction("createSaleReturn", payload),
    createPurchaseReturn: (payload: any) => runAction("createPurchaseReturn", payload),
    reportData: state,
  }), [filterLocationIds, loadData, loading, runAction, scopedState, state, withBusiness]);

  return React.createElement(AppDataContext.Provider, { value }, children);
}

export function useAppData(): any {
  const context = React.useContext(AppDataContext);
  if (!context) {
    throw new Error("useAppData must be used within AppDataProvider.");
  }
  return context;
}

export function useReportData(): any {
  return useAppData();
}

export function calculateLocationCashBalance(state: {
  sales: any[];
  purchases: any[];
  expenses: any[];
  customerPayments: any[];
  supplierPayments: any[];
  cashTransfers?: any[];
  saleReturns?: any[];
  purchaseReturns?: any[];
}, locationId: string) {
  const cashSales = (state.sales || [])
    .filter((sale) => sale.locationId === locationId && sale.status !== "VOIDED")
    .reduce((sum, sale) => sum + Number(sale.cashAmount || 0), 0);
  const cashSaleRefunds = (state.saleReturns || [])
    .filter((entry) => entry.locationId === locationId && String(entry.refundMethod || "").toUpperCase() === "CASH")
    .reduce((sum, entry) => sum + Number(entry.totalAmount || 0), 0);
  const cashPurchaseRefunds = (state.purchaseReturns || [])
    .filter((entry) => entry.locationId === locationId && String(entry.refundMethod || "").toUpperCase() === "CASH")
    .reduce((sum, entry) => sum + Number(entry.totalAmount || 0), 0);
  const cashCollected = (state.customerPayments || [])
    .filter((payment) => payment.locationId === locationId && String(payment.method || "").toUpperCase() === "CASH")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const cashPurchases = (state.purchases || [])
    .filter((purchase) => purchase.locationId === locationId && (purchase.paymentMethod === "CASH" || purchase.paymentMethod === "MIXED"))
    .reduce((sum, purchase) => sum + Number(purchase.cashAmount ?? (purchase.paymentMethod === "CASH" ? purchase.paidAmount : 0)), 0);
  const cashPaidSuppliers = (state.supplierPayments || [])
    .filter((payment) => payment.locationId === locationId && String(payment.method || "").toUpperCase() === "CASH")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const cashExpenses = (state.expenses || [])
    .filter((expense) => expense.locationId === locationId && expense.paymentMethod === "CASH")
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const deposits = (state.cashTransfers || [])
    .filter((transfer) => transfer.locationId === locationId)
    .reduce((sum, transfer) => sum + Number(transfer.amount || 0), 0);

  return cashSales + cashCollected + cashPurchaseRefunds - cashSaleRefunds - cashPurchases - cashPaidSuppliers - cashExpenses - deposits;
}
