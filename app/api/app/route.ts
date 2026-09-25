import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ensureDefaultPermissionsAndRoles } from "@/lib/permissions";
import { formatPermissionLabel } from "@/lib/permission-catalog";
import { asMoney, historicalSaleUnitCost, moneyNumber } from "@/lib/money";
import { allocateItemCode } from "@/lib/item-code";
import { createSale, deleteSale, completePendingSale, cancelPendingSale } from "@/lib/actions/sales";
import { createPurchaseReturn, createSaleReturn, voidSale } from "@/lib/actions/returns";
import { disposeBatch } from "@/lib/actions/disposal";
import { availableBatchQuantity, isSellableBatch } from "@/lib/inventory/fefo";
import { assertInternalBatchCodeAvailable } from "@/lib/inventory/internal-batch-guard";
import { parseReceiptBatch } from "@/lib/inventory/receipt-batch";
import { cleanPackCode } from "@/lib/pack-scan";
import { assertWholeQuantity } from "@/lib/units";
import { createPurchase, deletePurchase } from "@/lib/actions/purchases";
import { createTransfer } from "@/lib/actions/transfers";
import { createCashTransfer, createCustomerPayment, createExpense, createExpenseCategory, createSupplierPayment } from "@/lib/actions/finance";
import { isRetryableWriteConflict, runSerializableTransaction } from "@/lib/actions/transaction";
import { resolveActorLocationId } from "@/lib/actions/common";
import { bootstrapBusinessDefaults, ensureDefaultPaymentAccounts, ensureExpenseCategories, ensureStockLocations } from "@/lib/actions/business-defaults";
import { parseSettingRecord, BUSINESSES, isStoreLocationId, isTenantBusiness, normalizeAssignedLocationIds, remapLocationId, stockScopeIdsFor, tenantBusinessId } from "@/lib/businesses";
import { listCreditSales } from "@/lib/finance/credit-ledger";
import { formatUnitLabel } from "@/lib/item-display";
import { resolvePurchasePaymentMethod, resolveSalePaymentMethod } from "@/lib/payment-display";
import { lowStockCrossings, stockTotalsForItems } from "@/lib/stock";
import { voidNotifyAdjustment, voidNotifyDamage, voidNotifyLowStock } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CASH_ACCOUNT_TYPE = "CASH";
const UNCATEGORIZED_CATEGORY_NAME = "Uncategorized";
const actionRequestSchema = z.object({
  action: z.string().trim().min(1),
  payload: z.unknown().optional().default({}),
});

function isUncategorizedCategory(category?: { name?: string | null } | null) {
  return (category?.name || "").trim().toLowerCase() === UNCATEGORIZED_CATEGORY_NAME.toLowerCase();
}

function categoryDisplayName(category?: { name?: string | null } | null) {
  return isUncategorizedCategory(category) ? "-" : category?.name || "-";
}

function categoryDisplayId(categoryId: string, category?: { name?: string | null } | null) {
  return isUncategorizedCategory(category) ? "" : categoryId;
}

async function packCodeTaken(locationId: string, barcode: string | null, exceptId?: string) {
  if (!barcode) return false;
  const taken = await prisma.item.findFirst({
    where: {
      locationId,
      barcode: { equals: barcode, mode: "insensitive" },
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    select: { id: true },
  });
  return Boolean(taken);
}

function friendlyUniqueConstraintError(error: unknown) {
  const prismaError = error as { code?: string; meta?: { target?: string | string[] } };
  if (prismaError?.code !== "P2002") return null;
  const target = prismaError.meta?.target;
  const fields = (Array.isArray(target) ? target : [String(target || "")]).map((field) => field.toLowerCase());
  const joined = fields.join(" ");
  if (fields.includes("username")) return "This username is already taken. Choose a different username.";
  if (fields.includes("vouchercode")) return "This voucher number is already in use.";
  if (joined.includes("barcode")) return "This barcode is already in use.";
  if (fields.includes("code") || joined.includes("locationid") && fields.includes("code")) return "This code is already in use.";
  if (fields.includes("name") && fields.includes("locationid")) return "A record with this name already exists in this business.";
  if (fields.includes("name")) return "A record with this name already exists.";
  if (fields.includes("key")) return "This key is already in use.";
  return "This value is already in use.";
}

function toAppUser(user: {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  phone: string | null;
  role: string;
  roleId: string | null;
  locationId: string;
  assignedLocationIds?: string | null;
  isActive: boolean;
  roleRecord?: { name: string } | null;
}, locations: { id: string }[]) {
  const roleName = user.role === "ADMIN" ? "Super Admin" : user.roleRecord?.name || user.role;
  
  let assignedLocations: string[] = [];
  if (roleName === "Super Admin") {
    assignedLocations = locations.map((location) => location.id);
  } else if (user.assignedLocationIds) {
    assignedLocations = user.assignedLocationIds.split(",").map(s => s.trim()).filter(Boolean);
  }
  
  if (assignedLocations.length === 0 && user.locationId) {
    assignedLocations = [user.locationId];
  }

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    role: roleName,
    roleId: user.roleId || "",
    assignedLocations,
    username: user.username,
    phone: user.phone || "",
    isActive: user.isActive,
  };
}

async function getActorId(currentUser?: any) {
  const user = currentUser?.id ? await prisma.user.findUnique({ where: { id: currentUser.id } }) : null;
  if (!user || !user.isActive) throw new Error("You must be signed in.");
  return user.id;
}

function hasPermission(currentUser: any, key: string) {
  return currentUser?.role === "Super Admin" || currentUser?.permissions?.includes(key);
}

function denyStoreStock(currentUser: any, locationId?: string | null) {
  return isStoreLocationId(locationId) && !hasPermission(currentUser, "inventory.store.view");
}

const ACTION_PERMISSIONS: Record<string, string> = {
  addCustomer: "customers.create",
  updateCustomer: "customers.update",
  addSupplier: "suppliers.create",
  updateSupplier: "suppliers.update",
  addCategory: "inventory.categories.manage",
  updateCategory: "inventory.categories.manage",
  deleteCategory: "inventory.categories.manage",
  addUnit: "inventory.items.create",
  addItem: "inventory.items.create",
  updateItem: "inventory.items.update",
  updateItemPrice: "inventory.items.update",
  addLocation: "admin.locations.create",
  updateSettings: "admin.settings.update",
  addUser: "admin.users.create",
  updateUser: "admin.users.update",
  updateUserStatus: "admin.users.update",
  deleteUser: "admin.users.delete",
  addRole: "admin.roles.manage",
  updateRole: "admin.roles.manage",
  deleteRole: "admin.roles.manage",
  addBankAccount: "finance.banks.create",
  updateBankAccount: "finance.banks.update",
  deleteBankAccount: "finance.banks.delete",
  addExpense: "finance.expenses.create",
  addExpenseCategory: "finance.expenses.create",
  addCashTransfer: "finance.cash_to_bank.create",
  addPurchase: "purchases.create",
  addSale: "sales.create",
  addCustomerPayment: "customers.payments.create",
  settleCredit: "customers.payments.create",
  addSupplierPayment: "suppliers.payments.create",
  addTransfer: "inventory.transfers.create",
  adjustStock: "inventory.stock.adjust",
  addStockEntry: "inventory.stock.adjust",
  deleteSale: "sales.delete",
  deletePurchase: "purchases.delete",
  deleteItem: "inventory.items.delete",
  deleteSupplier: "suppliers.delete",
  deleteCustomer: "customers.delete",
  completePendingSale: "sales.create",
  cancelPendingSale: "sales.create",
  disposeBatch: "inventory.stock.adjust",
  voidSale: "sales.delete",
  createSaleReturn: "sales.update",
  createPurchaseReturn: "purchases.update",
  recordDamage: "inventory.stock.adjust",
};

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  await ensureDefaultPermissionsAndRoles();
  const activeLocations = await prisma.location.findMany({
    where: { isActive: true },
    select: { id: true, name: true, type: true, location: true },
  });
  await Promise.all(
    activeLocations
      .filter((location) => isTenantBusiness(location))
      .map(async (location) => {
        await ensureStockLocations(prisma, location);
        await ensureDefaultPaymentAccounts(prisma, location);
        try {
          await ensureExpenseCategories(prisma, location);
        } catch {
          // ExpenseCategory table may not exist until the migration is applied.
        }
      }),
  );

  if (currentUser.role !== "Super Admin") {
    const dbUser = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { locationId: true, assignedLocationIds: true },
    });
    currentUser.assignedLocations = normalizeAssignedLocationIds({
      assignedLocations: currentUser.assignedLocations?.length
        ? currentUser.assignedLocations
        : dbUser?.assignedLocationIds,
      assignedBusinesses: currentUser.assignedBusinesses,
      locationId: currentUser.locationId || dbUser?.locationId,
    });
    currentUser.locationId =
      remapLocationId(currentUser.locationId || dbUser?.locationId) ||
      currentUser.assignedLocations[0] ||
      BUSINESSES[0].id;
  }

  const assignedIds = currentUser.role === "Super Admin"
    ? []
    : (currentUser.assignedLocations?.filter(Boolean) || []).map((id) => tenantBusinessId(id));
  const assignedBusinessIds = assignedIds.length
    ? assignedIds
    : [tenantBusinessId(currentUser.locationId) || BUSINESSES[0].id];
  const catalogScope = currentUser.role === "Super Admin" ? undefined : { in: assignedBusinessIds };
  const stockScope = currentUser.role === "Super Admin" ? undefined : { in: stockScopeIdsFor(assignedBusinessIds) };

  let [
    locations,
    products,
    users,
    roles,
    permissions,
    settings,
    categories,
    units,
    batches,
    customers,
    suppliers,
    sales,
    purchases,
    expenses,
    customerPayments,
    supplierPayments,
    bankAccounts,
    bankTransactions,
    transfers,
    inventoryMovements,
    auditLogs,
    pendingSales,
  ] = await Promise.all([
    prisma.location.findMany({
      where: stockScope ? { id: stockScope } : { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.item.findMany({
      where: { isActive: true, ...(catalogScope ? { locationId: catalogScope } : {}) },
      include: { category: true, unit: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({ include: { location: true, roleRecord: true }, orderBy: { createdAt: "asc" } }),
    prisma.role.findMany({ where: { isActive: true }, include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } }, orderBy: { name: "asc" } }),
    prisma.permission.findMany({ include: { _count: { select: { roles: true, users: true } } }, orderBy: [{ module: "asc" }, { label: "asc" }] }),
    prisma.setting.findMany(catalogScope ? { where: { locationId: catalogScope } } : undefined),
    prisma.category.findMany({ where: { isActive: true, ...(catalogScope ? { locationId: catalogScope } : {}) }, orderBy: { name: "asc" } }),
    prisma.unit.findMany({ where: catalogScope ? { locationId: catalogScope } : {}, orderBy: { name: "asc" } }),
    prisma.inventoryBatch.findMany({
      where: stockScope ? { locationId: stockScope } : {},
      include: { item: { include: { category: true, unit: true } }, location: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.customer.findMany({ where: { isActive: true, ...(catalogScope ? { locationId: catalogScope } : {}) }, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ where: { isActive: true, ...(catalogScope ? { locationId: catalogScope } : {}) }, orderBy: { name: "asc" } }),
    prisma.sale.findMany({
      where: catalogScope ? { locationId: catalogScope } : {},
      include: { items: { include: { item: true, inventoryBatch: true } }, customer: true, location: true },
      orderBy: [{ saleDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.purchase.findMany({
      where: catalogScope ? { locationId: catalogScope } : {},
      include: { items: { include: { item: true } }, supplier: true, location: true },
      orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.expense.findMany({
      where: catalogScope ? { locationId: catalogScope } : {},
      include: { location: true },
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.customerPayment.findMany({
      where: catalogScope ? { locationId: catalogScope } : {},
      include: { customer: true, location: true },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.supplierPayment.findMany({
      where: catalogScope ? { locationId: catalogScope } : {},
      include: { supplier: true, location: true },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.bankAccount.findMany({
      where: { isActive: true, ...(catalogScope ? { locationId: catalogScope } : {}) },
      orderBy: [{ accountType: "asc" }, { displayName: "asc" }],
    }),
    prisma.bankTransaction.findMany({
      where: catalogScope ? { locationId: catalogScope } : {},
      include: { bankAccount: true, location: true },
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.transfer.findMany({
      where: stockScope
        ? { OR: [{ sourceLocationId: stockScope }, { destinationLocationId: stockScope }] }
        : {},
      include: { items: true },
      orderBy: [{ transferDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.inventoryMovement.findMany({
      where: stockScope ? { locationId: stockScope } : {},
      include: { item: { include: { category: true, unit: true } }, location: true },
      orderBy: { createdAt: "desc" },
    }),
    hasPermission(currentUser, "reports.audit.view")
      ? prisma.auditLog.findMany({
          where: catalogScope
            ? { OR: [{ locationId: catalogScope }, { locationId: null }] }
            : {},
          include: { user: true },
          orderBy: { createdAt: "desc" },
          take: 1000,
        })
      : Promise.resolve([]),
    prisma.pendingSale.findMany({
      where: {
        status: { in: ["PENDING", "CHECKING_OUT"] },
        ...(catalogScope ? { locationId: catalogScope } : {}),
      },
      include: { customer: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const [saleReturns, purchaseReturns] = await Promise.all([
    prisma.saleReturn.findMany({
      where: catalogScope ? { locationId: catalogScope } : {},
      include: { lines: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.purchaseReturn.findMany({
      where: catalogScope ? { locationId: catalogScope } : {},
      include: { lines: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  let paymentAllocationRows: Array<{ id: string; paymentId: string; saleId: string; amount: unknown }> = [];
  let expenseCategories: Array<{ id: string; name: string; locationId: string }> = [];
  try {
    paymentAllocationRows = await prisma.customerPaymentAllocation.findMany();
  } catch {
    paymentAllocationRows = [];
  }
  try {
    expenseCategories = await prisma.expenseCategory.findMany({
      where: { isActive: true, ...(catalogScope ? { locationId: catalogScope } : {}) },
      orderBy: { name: "asc" },
    });
  } catch {
    expenseCategories = [];
  }

  if (currentUser.role !== "Super Admin" && locations.length === 0) {
    const fallbackIds = stockScopeIdsFor(assignedBusinessIds);
    locations = await prisma.location.findMany({
      where: { id: { in: fallbackIds } },
      orderBy: { name: "asc" },
    });
    if (!locations.length) {
      const catalog = await prisma.location.findMany({
        where: { id: { in: BUSINESSES.map((business) => business.id) }, isActive: true },
        orderBy: { name: "asc" },
      });
      const preferredId = assignedBusinessIds[0] || remapLocationId(currentUser.locationId) || BUSINESSES[0].id;
      locations = catalog.filter((location) => location.id === preferredId);
      if (!locations.length && catalog[0]) locations = [catalog[0]];
    }
  }

  const saleBankAccountBySaleId = new Map<string, { id: string; displayName: string; bankName: string | null }>();
  bankTransactions.forEach((entry) => {
    if (entry.type !== "SALE_PAYMENT" || !entry.referenceNo) return;
    saleBankAccountBySaleId.set(entry.referenceNo, {
      id: entry.bankAccount.id,
      displayName: entry.bankAccount.displayName,
      bankName: entry.bankAccount.bankName || null,
    });
  });

  const salesWithBankAccounts = sales.map((sale) => {
    const bankAccount = saleBankAccountBySaleId.get(sale.id) || null;
    return {
      ...sale,
      bankAccount,
      bankAccountId: bankAccount?.id || null,
    };
  });

  const settingRowsByLocation = new Map<string, Record<string, string>>();
  settings.forEach((entry) => {
    const current = settingRowsByLocation.get(entry.locationId) || {};
    current[entry.key] = entry.value;
    settingRowsByLocation.set(entry.locationId, current);
  });
  const stockByItemLocation = new Map<string, any>();
  batches.forEach((batch) => {
    const key = `${batch.itemId}:${batch.locationId}`;
    const sellable = isSellableBatch(batch) ? availableBatchQuantity(batch) : 0;
    const existing = stockByItemLocation.get(key);
    if (existing) {
      existing.stock += sellable;
      existing.price = moneyNumber(batch.sellingPrice);
      existing.buyingPrice = moneyNumber(batch.buyingPrice);
      existing.sellingPrice = moneyNumber(batch.sellingPrice);
      return;
    }
    stockByItemLocation.set(key, {
      id: batch.itemId,
      name: batch.item.name,
      categoryId: categoryDisplayId(batch.item.categoryId, batch.item.category),
      category: categoryDisplayName(batch.item.category),
      price: moneyNumber(batch.sellingPrice),
      buyingPrice: moneyNumber(batch.buyingPrice),
      sellingPrice: moneyNumber(batch.sellingPrice),
      stock: sellable,
      unitId: batch.item.unitId,
      unitName: batch.item.unit.name,
      unitShortName: batch.item.unit.shortName,
      unit: formatUnitLabel(batch.item.unit),
      code: batch.item.code || "",
      barcode: batch.item.barcode || "",
      status: batch.item.isActive ? "Active" : "Inactive",
      locationId: batch.locationId,
      lowStockAlert: batch.item.lowStockAlert,
    });
  });

  // ─── Global Balance and Running Balance Calculations ────────────────
  const [
    globalCustomerSales,
    globalCustomerPayments,
    globalSupplierPurchases,
    globalSupplierPayments,
  ] = await Promise.all([
    prisma.sale.groupBy({
      by: ['customerId'],
      where: { customerId: { not: null }, status: { not: "VOIDED" } },
      _sum: { creditAmount: true },
    }),
    prisma.customerPayment.groupBy({
      by: ['customerId'],
      _sum: { amount: true },
    }),
    prisma.purchase.groupBy({
      by: ['supplierId'],
      _sum: { debtAmount: true },
    }),
    prisma.supplierPayment.groupBy({
      by: ['supplierId'],
      _sum: { amount: true },
    }),
  ]);

  const customerBalances = new Map<string, number>();
  globalCustomerSales.forEach((g) => {
    if (g.customerId) {
      customerBalances.set(g.customerId, moneyNumber(g._sum.creditAmount));
    }
  });
  globalCustomerPayments.forEach((g) => {
    customerBalances.set(g.customerId, (customerBalances.get(g.customerId) || 0) - moneyNumber(g._sum.amount));
  });

  const supplierDebts = new Map<string, number>();
  globalSupplierPurchases.forEach((g) => {
    supplierDebts.set(g.supplierId, moneyNumber(g._sum.debtAmount));
  });
  globalSupplierPayments.forEach((g) => {
    supplierDebts.set(g.supplierId, (supplierDebts.get(g.supplierId) || 0) - moneyNumber(g._sum.amount));
  });

  // Chronological running balance maps for ledger/payment outputs
  const [allGlobalSales, allGlobalCustomerPayments, allGlobalPurchases, allGlobalSupplierPayments] = await Promise.all([
    prisma.sale.findMany({
      where: { creditAmount: { gt: 0 }, status: { not: "VOIDED" } },
      select: { customerId: true, creditAmount: true, saleDate: true, createdAt: true },
    }),
    prisma.customerPayment.findMany({
      select: { id: true, customerId: true, amount: true, paymentDate: true, createdAt: true },
    }),
    prisma.purchase.findMany({
      where: { debtAmount: { gt: 0 } },
      select: { supplierId: true, debtAmount: true, purchaseDate: true, createdAt: true },
    }),
    prisma.supplierPayment.findMany({
      select: { id: true, supplierId: true, amount: true, paymentDate: true, createdAt: true },
    }),
  ]);

  const salesByCustomer = new Map<string, typeof allGlobalSales>();
  allGlobalSales.forEach(s => {
    if (!salesByCustomer.has(s.customerId)) salesByCustomer.set(s.customerId, []);
    salesByCustomer.get(s.customerId)!.push(s);
  });
  
  const paymentsByCustomer = new Map<string, typeof allGlobalCustomerPayments>();
  allGlobalCustomerPayments.forEach(p => {
    if (!paymentsByCustomer.has(p.customerId)) paymentsByCustomer.set(p.customerId, []);
    paymentsByCustomer.get(p.customerId)!.push(p);
  });

  const runningBalances = new Map<string, number>();
  customers.forEach(customer => {
    const custSales = salesByCustomer.get(customer.id) || [];
    const custPayments = paymentsByCustomer.get(customer.id) || [];
    
    const events: Array<{ type: 'CREDIT' | 'PAYMENT'; date: Date; amount: number; id?: string }> = [
      ...custSales.map(s => ({ type: 'CREDIT' as const, date: new Date(s.saleDate || s.createdAt), amount: moneyNumber(s.creditAmount) })),
      ...custPayments.map(p => ({ type: 'PAYMENT' as const, date: new Date(p.paymentDate || p.createdAt), amount: moneyNumber(p.amount), id: p.id }))
    ];
    
    events.sort((a, b) => {
      const timeDiff = a.date.getTime() - b.date.getTime();
      if (timeDiff !== 0) return timeDiff;
      if (a.type === 'CREDIT' && b.type === 'PAYMENT') return -1;
      if (a.type === 'PAYMENT' && b.type === 'CREDIT') return 1;
      return 0;
    });
    
    let bal = 0;
    events.forEach(e => {
      if (e.type === 'CREDIT') {
        bal += e.amount;
      } else {
        bal -= e.amount;
        if (e.id) {
          runningBalances.set(e.id, bal);
        }
      }
    });
  });

  const purchasesBySupplier = new Map<string, typeof allGlobalPurchases>();
  allGlobalPurchases.forEach(p => {
    if (!purchasesBySupplier.has(p.supplierId)) purchasesBySupplier.set(p.supplierId, []);
    purchasesBySupplier.get(p.supplierId)!.push(p);
  });

  const paymentsBySupplier = new Map<string, typeof allGlobalSupplierPayments>();
  allGlobalSupplierPayments.forEach(p => {
    if (!paymentsBySupplier.has(p.supplierId)) paymentsBySupplier.set(p.supplierId, []);
    paymentsBySupplier.get(p.supplierId)!.push(p);
  });

  const supplierRunningBalances = new Map<string, number>();
  suppliers.forEach(supplier => {
    const suppPurchases = purchasesBySupplier.get(supplier.id) || [];
    const suppPayments = paymentsBySupplier.get(supplier.id) || [];
    
    const events: Array<{ type: 'DEBT' | 'PAYMENT'; date: Date; amount: number; id?: string }> = [
      ...suppPurchases.map(p => ({ type: 'DEBT' as const, date: new Date(p.purchaseDate || p.createdAt), amount: moneyNumber(p.debtAmount) })),
      ...suppPayments.map(p => ({ type: 'PAYMENT' as const, date: new Date(p.paymentDate || p.createdAt), amount: moneyNumber(p.amount), id: p.id }))
    ];
    
    events.sort((a, b) => {
      const timeDiff = a.date.getTime() - b.date.getTime();
      if (timeDiff !== 0) return timeDiff;
      if (a.type === 'DEBT' && b.type === 'PAYMENT') return -1;
      if (a.type === 'PAYMENT' && b.type === 'DEBT') return 1;
      return 0;
    });
    
    let bal = 0;
    events.forEach(e => {
      if (e.type === 'DEBT') {
        bal += e.amount;
      } else {
        bal -= e.amount;
        if (e.id) {
          supplierRunningBalances.set(e.id, bal);
        }
      }
    });
  });

  const paymentAllocations = paymentAllocationRows.map((allocation) => {
    const payment = customerPayments.find((entry) => entry.id === allocation.paymentId);
    return {
      id: allocation.id,
      paymentId: allocation.paymentId,
      saleId: allocation.saleId,
      amount: moneyNumber(allocation.amount),
      customerId: payment?.customerId || "",
      locationId: payment?.locationId || "",
    };
  });
  const creditSales = listCreditSales(
    sales.map((sale) => ({
      id: sale.id,
      customerId: sale.customerId,
      creditAmount: moneyNumber(sale.creditAmount),
      saleDate: sale.saleDate,
      createdAt: sale.createdAt,
    })),
    customerPayments.map((payment) => ({
      id: payment.id,
      customerId: payment.customerId,
      saleId: payment.saleId,
      amount: moneyNumber(payment.amount),
    })),
    paymentAllocations,
  );
  const creditSaleById = new Map(creditSales.map((sale) => [sale.saleId, sale]));
  const tenantLocations = locations.filter((location) => isTenantBusiness(location));
  const availableLocationIds = currentUser.role === "Super Admin"
    ? tenantLocations.map((location) => location.id)
    : assignedBusinessIds;
  const currentLocation =
    tenantLocations.find((location) => location.id === remapLocationId(currentUser.locationId) && availableLocationIds.includes(location.id)) ||
    tenantLocations.find((location) => availableLocationIds.includes(location.id)) ||
    tenantLocations[0] ||
    BUSINESSES.find((business) => business.id === availableLocationIds[0]) ||
    BUSINESSES[0] ||
    null;

  const allPermissionIds = permissions.map((permission) => permission.id);
  const canViewUsers = hasPermission(currentUser, "admin.users.view");
  const canViewRoles = hasPermission(currentUser, "admin.roles.view");
  const canAssignRoles = canViewRoles || canViewUsers || hasPermission(currentUser, "admin.users.create") || hasPermission(currentUser, "admin.users.update");
  const canViewPermissions = hasPermission(currentUser, "admin.permissions.view") || canViewRoles;
  const userDisplayName = (userId?: string | null) => {
    const user = users.find((entry) => entry.id === userId);
    return user ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username : "System";
  };

  const canViewStoreStock = hasPermission(currentUser, "inventory.store.view");
  const showLocation = (locationId?: string | null) => canViewStoreStock || !isStoreLocationId(locationId);

  return NextResponse.json({
    currentLocation,
    locations: locations
      .filter((location) => showLocation(location.id))
      .map((location) => ({
      id: location.id,
      name: location.name,
      type: location.type,
      location: location.location,
    })),
    categories: categories
      .filter((category) => !isUncategorizedCategory(category))
      .map((category) => ({ id: category.id, name: category.name, locationId: category.locationId })),
    expenseCategories: expenseCategories.map((category) => ({
      id: category.id,
      name: category.name,
      locationId: category.locationId,
    })),
    units: units.map((unit) => ({ id: unit.id, name: unit.name, shortName: unit.shortName, locationId: unit.locationId })),
    products: products.map((item) => ({
      id: item.id,
      locationId: item.locationId,
      name: item.name,
      categoryId: categoryDisplayId(item.categoryId, item.category),
      category: categoryDisplayName(item.category),
      unitId: item.unitId,
      unitName: item.unit.name,
      unitShortName: item.unit.shortName,
      unit: formatUnitLabel(item.unit),
      code: item.code || "",
      barcode: item.barcode || "",
      price: moneyNumber(item.defaultSellingPrice),
      buyingPrice: moneyNumber(item.defaultBuyingPrice),
      sellingPrice: moneyNumber(item.defaultSellingPrice),
      lowStockAlert: item.lowStockAlert,
      status: item.isActive ? "Active" : "Inactive",
      genericName: item.genericName || "",
      brandName: item.brandName || "",
      dosageForm: item.dosageForm || "",
      strength: item.strength || "",
      packSize: item.packSize || "",
      manufacturer: item.manufacturer || "",
      countryOfOrigin: item.countryOfOrigin || "",
      requiresPrescription: item.requiresPrescription,
      isControlled: item.isControlled,
    })),
    items: [...stockByItemLocation.values()].filter((row) => showLocation(row.locationId)),
    inventoryBatches: batches.filter((batch) => showLocation(batch.locationId)).map((batch) => ({
      id: batch.id,
      itemId: batch.itemId,
      locationId: batch.locationId,
      purchaseItemId: batch.purchaseItemId,
      quantityIn: batch.quantityIn,
      remainingQuantity: batch.remainingQuantity,
      buyingPrice: moneyNumber(batch.buyingPrice),
      sellingPrice: moneyNumber(batch.sellingPrice),
      batchCode: batch.batchCode || "",
      expireDate: batch.expireDate,
      status: batch.status || "ACTIVE",
      reservedQuantity: batch.reservedQuantity || 0,
      createdAt: batch.createdAt,
    })),
    customers: customers.map((customer) => ({
      id: customer.id,
      locationId: customer.locationId,
      name: customer.name,
      phone: customer.phone || "-",
      email: "",
      balance: Math.max(0, customerBalances.get(customer.id) || 0),
      allowCredit: customer.allowCredit !== false,
      creditLimit: customer.creditLimit == null ? null : moneyNumber(customer.creditLimit),
    })),
    suppliers: suppliers.map((supplier) => ({
      id: supplier.id,
      locationId: supplier.locationId,
      name: supplier.name,
      contact: "",
      phone: supplier.phone || "-",
      debt: Math.max(0, supplierDebts.get(supplier.id) || 0),
    })),
    bankAccounts: bankAccounts.map((account) => ({
      id: account.id,
      locationId: account.locationId,
      displayName: account.displayName,
      bankName: account.bankName || "Internal",
      accountNumber: account.accountNumber || "",
      currentBalance: moneyNumber(account.currentBalance),
      accountType: account.accountType,
    })),
    sales: salesWithBankAccounts.map((sale) => ({
      id: sale.id,
      voucherCode: sale.voucherCode,
      customerId: sale.customerId,
      locationId: sale.locationId,
      saleDate: sale.saleDate,
      subTotal: moneyNumber(sale.subTotal),
      discount: moneyNumber(sale.discount),
      totalAmount: moneyNumber(sale.totalAmount),
      cashAmount: moneyNumber(sale.cashAmount),
      bankAmount: moneyNumber(sale.bankAmount),
      creditAmount: moneyNumber(sale.creditAmount),
      paymentStatus: sale.paymentStatus,
      status: sale.status || "COMPLETED",
      paidAmount: creditSaleById.get(sale.id)?.paidAmount || 0,
      outstandingAmount: creditSaleById.get(sale.id)?.outstandingAmount || 0,
      creditStatus: creditSaleById.get(sale.id)?.status || (moneyNumber(sale.creditAmount) > 0 ? "PENDING" : "SETTLED"),
      createdById: sale.createdById,
      createdByName: userDisplayName(sale.createdById),
      paymentMethod: resolveSalePaymentMethod({
        cashAmount: moneyNumber(sale.cashAmount),
        bankAmount: moneyNumber(sale.bankAmount),
        creditAmount: moneyNumber(sale.creditAmount),
      }),
      bankAccountId: sale.bankAccountId,
      bankAccount: sale.bankAccount,
      items: sale.items.map((line) => {
        // Older rows used zero as "cost not captured" and relied on the batch cost.
        // Preserve that historical meaning while new sales retain their stored cost.
        const unitBuyingPrice = historicalSaleUnitCost(line.buyingPrice, line.inventoryBatch.buyingPrice);
        return {
          id: line.id,
          itemId: line.itemId,
          itemName: line.item.name,
          qty: line.quantity,
          price: moneyNumber(line.sellingPrice),
          buyingPrice: moneyNumber(unitBuyingPrice),
          inventoryBatchId: line.inventoryBatchId,
          discount: moneyNumber(line.discount),
          total: moneyNumber(line.totalAmount),
          profit: moneyNumber(line.totalAmount.minus(unitBuyingPrice.mul(line.quantity))),
        };
      }),
    })),
    purchases: purchases.map((purchase) => {
      const bankTx = bankTransactions.find((tx) => tx.referenceNo === purchase.id && tx.type === "SUPPLIER_PAYMENT");
      const bankAmount = moneyNumber(bankTx?.amount);
      const cashAmount = Math.max(0, moneyNumber(purchase.paidAmount) - bankAmount);
      const debtAmount = moneyNumber(purchase.debtAmount);
      return {
        id: purchase.id,
        invoiceNo: purchase.invoiceNo || purchase.id,
        supplierId: purchase.supplierId,
        locationId: purchase.locationId,
        purchaseDate: purchase.purchaseDate,
        totalAmount: moneyNumber(purchase.totalAmount),
        paidAmount: moneyNumber(purchase.paidAmount),
        cashAmount,
        bankAmount,
        debtAmount,
        paymentStatus: purchase.paymentStatus,
        createdById: purchase.createdById,
        createdByName: userDisplayName(purchase.createdById),
        paymentMethod: resolvePurchasePaymentMethod({ cashAmount, bankAmount, debtAmount }),
        bankAccountId: bankTx?.bankAccountId,
        bankAccount: bankTx?.bankAccountId
          ? (() => {
              const account = bankAccounts.find((entry) => entry.id === bankTx.bankAccountId);
              return account
                ? {
                    id: account.id,
                    displayName: account.displayName,
                    bankName: account.bankName || null,
                  }
                : null;
            })()
          : null,
        items: purchase.items.map((line) => ({
          id: line.id,
          itemId: line.itemId,
          itemName: line.item.name,
          qty: line.quantity,
          unitCost: moneyNumber(line.buyingPrice),
          sellingPrice: moneyNumber(line.sellingPrice),
          total: moneyNumber(line.totalAmount),
        })),
      };
    }),
    expenses: expenses.map((expense) => ({
      id: expense.id,
      category: expense.category || "Expense",
      amount: moneyNumber(expense.amount),
      date: expense.expenseDate,
      name: expense.name,
      description: expense.note || "",
      paymentMethod: expense.paymentMethod,
      bankAccountId: expense.bankAccountId || undefined,
      locationId: expense.locationId,
      createdById: expense.createdById,
      createdByName: userDisplayName(expense.createdById),
    })),
    customerPayments: customerPayments.map((payment) => {
      const creator = users.find(u => u.id === payment.createdById);
      const bank = payment.bankAccountId
        ? bankAccounts.find((account) => account.id === payment.bankAccountId)
        : null;
      return {
        id: payment.id,
        customerId: payment.customerId,
        amount: moneyNumber(payment.amount),
        date: payment.paymentDate,
        method: payment.paymentMethod,
        bankAccountId: payment.bankAccountId || undefined,
        bankAccount: bank
          ? {
              id: bank.id,
              displayName: bank.displayName,
              bankName: bank.bankName || null,
            }
          : null,
        note: payment.note || undefined,
        createdBy: creator ? `${creator.firstName} ${creator.lastName || ""}`.trim() : "System",
        locationId: payment.locationId,
        saleId: payment.saleId,
        referenceNo: payment.referenceNo || "",
        remainingBalance: runningBalances.get(payment.id) ?? 0,
        allocations: paymentAllocations
          .filter((allocation) => allocation.paymentId === payment.id)
          .map((allocation) => ({
            id: allocation.id,
            paymentId: allocation.paymentId,
            saleId: allocation.saleId,
            amount: allocation.amount,
          })),
      };
    }),
    supplierPayments: supplierPayments.map((payment) => {
      const creator = users.find(u => u.id === payment.createdById);
      return {
        id: payment.id,
        supplierId: payment.supplierId,
        amount: moneyNumber(payment.amount),
        date: payment.paymentDate,
        method: payment.paymentMethod,
        bankAccountId: payment.bankAccountId || undefined,
        note: payment.note || undefined,
        createdBy: creator ? `${creator.firstName} ${creator.lastName || ""}`.trim() : "System",
        locationId: payment.locationId,
        purchaseId: payment.purchaseId,
        referenceNo: payment.referenceNo || "",
        remainingBalance: supplierRunningBalances.get(payment.id) ?? 0,
      };
    }),
    cashTransfers: bankTransactions.filter((tx) => tx.type === "CASH_TO_BANK").map((tx) => ({
      id: tx.id,
      locationId: tx.locationId,
      bankAccountId: tx.bankAccountId,
      amount: moneyNumber(tx.amount),
      referenceNo: tx.referenceNo || tx.id,
      date: tx.transactionDate,
      note: tx.description || "",
      createdById: tx.createdById,
      createdByName: userDisplayName(tx.createdById),
    })),
    bankTransactions: bankTransactions.map((tx) => ({
      id: tx.id,
      bankAccountId: tx.bankAccountId,
      bankAccountName: tx.bankAccount.displayName,
      accountNumber: tx.bankAccount.accountNumber || "",
      locationId: tx.locationId,
      type: tx.type,
      amount: moneyNumber(tx.amount),
      referenceNo: tx.referenceNo || "",
      description: tx.description || "",
      transactionDate: tx.transactionDate,
      createdAt: tx.createdAt,
      createdById: tx.createdById,
      createdByName: userDisplayName(tx.createdById),
    })),
    transfers: transfers.filter((transfer) => showLocation(transfer.sourceLocationId) && showLocation(transfer.destinationLocationId)).flatMap((transfer) => transfer.items.map((line) => ({
      id: transfer.id,
      fromLocationId: transfer.sourceLocationId,
      toLocationId: transfer.destinationLocationId,
      itemId: line.itemId,
      quantity: line.quantity,
      date: transfer.transferDate,
      status: transfer.status,
    }))),
    inventoryMovements: inventoryMovements.filter((movement) => showLocation(movement.locationId)).map((movement) => ({
      id: movement.id,
      itemId: movement.itemId,
      locationId: movement.locationId,
      itemName: movement.item.name,
      itemCode: movement.item.code || "",
      categoryId: categoryDisplayId(movement.item.categoryId, movement.item.category),
      category: categoryDisplayName(movement.item.category),
      unitId: movement.item.unitId,
      unitName: movement.item.unit.name,
      unitShortName: movement.item.unit.shortName,
      unit: formatUnitLabel(movement.item.unit),
      locationName: movement.location.name,
      locationType: movement.location.type,
      type: movement.type,
      quantity: movement.quantity,
      beforeQuantity: movement.beforeQuantity,
      afterQuantity: movement.afterQuantity,
      referenceType: movement.referenceType || "",
      referenceId: movement.referenceId || "",
      note: movement.note || "",
      inventoryBatchId: movement.inventoryBatchId || "",
      createdById: movement.createdById || "",
      createdByName: userDisplayName(movement.createdById),
      createdAt: movement.createdAt,
    })),
    auditLogs: auditLogs.map((log) => ({
      id: log.id,
      userId: log.userId,
      userName: [log.user.firstName, log.user.lastName].filter(Boolean).join(" ") || log.user.username,
      locationId: log.locationId || "",
      action: log.action,
      module: log.module,
      tableName: log.tableName || "",
      recordId: log.recordId || "",
      createdAt: log.createdAt,
    })),
    users: canViewUsers ? users.map((user) => toAppUser(user, locations)) : [],
    roles: canAssignRoles ? roles.map((role) => {
      const rolePermissions = role.name === "Super Admin"
        ? permissions
        : role.permissions.map((entry) => entry.permission).filter(Boolean);
      return {
        id: role.id,
        name: role.name,
        description: role.description || "",
        isSystem: role.isSystem,
        userCount: role._count.users,
        permissionIds: role.name === "Super Admin" ? allPermissionIds : role.permissions.map((entry) => entry.permissionId),
        permissions: rolePermissions.map((permission) => ({
          id: permission.id,
          key: permission.key,
          label: permission.label,
          module: permission.module,
          name: formatPermissionLabel(permission),
        })),
      };
    }) : [],
    permissions: canViewPermissions ? permissions.map((permission) => ({
      id: permission.id,
      key: permission.key,
      name: formatPermissionLabel(permission),
      label: permission.label,
      module: permission.module,
      usageCount: permission._count.roles + permission._count.users,
    })) : [],
    settingsByLocation: Object.fromEntries(
      locations.map((location) => [
        location.id,
        parseSettingRecord(settingRowsByLocation.get(location.id) || {}),
      ]),
    ),
    settings: parseSettingRecord(settingRowsByLocation.get(currentLocation?.id || "") || {}),
    saleReturns: saleReturns.map((entry) => ({
      id: entry.id,
      saleId: entry.saleId,
      locationId: entry.locationId,
      returnNumber: entry.returnNumber,
      refundMethod: entry.refundMethod,
      bankAccountId: entry.bankAccountId || "",
      totalAmount: moneyNumber(entry.totalAmount),
      reason: entry.reason,
      createdAt: entry.createdAt,
      lines: entry.lines.map((line) => ({
        id: line.id,
        saleItemId: line.saleItemId,
        itemId: line.itemId,
        inventoryBatchId: line.inventoryBatchId,
        quantity: line.quantity,
        totalAmount: moneyNumber(line.totalAmount),
      })),
    })),
    purchaseReturns: purchaseReturns.map((entry) => ({
      id: entry.id,
      purchaseId: entry.purchaseId,
      locationId: entry.locationId,
      returnNumber: entry.returnNumber,
      refundMethod: entry.refundMethod,
      bankAccountId: entry.bankAccountId || "",
      totalAmount: moneyNumber(entry.totalAmount),
      reason: entry.reason,
      createdAt: entry.createdAt,
      lines: entry.lines.map((line) => ({
        id: line.id,
        purchaseItemId: line.purchaseItemId,
        itemId: line.itemId,
        inventoryBatchId: line.inventoryBatchId,
        quantity: line.quantity,
        totalAmount: moneyNumber(line.totalAmount),
      })),
    })),
    pendingSales: pendingSales.map((entry) => ({
      id: entry.id,
      voucherCode: entry.voucherCode,
      locationId: entry.locationId,
      customerId: entry.customerId,
      customerName: entry.customer?.name || "",
      lines: entry.lines,
      subTotal: moneyNumber(entry.subTotal),
      discount: moneyNumber(entry.discount),
      totalAmount: moneyNumber(entry.totalAmount),
      status: entry.status,
      prescriptionNumber: entry.prescriptionNumber || "",
      patientName: entry.patientName || "",
      prescriberName: entry.prescriberName || "",
      createdAt: entry.createdAt,
    })),
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    await ensureDefaultPermissionsAndRoles();

    const requestBody = actionRequestSchema.safeParse(await request.json());
    if (!requestBody.success) {
      return NextResponse.json({ ok: false, error: requestBody.error.issues[0]?.message || "Invalid request." }, { status: 400 });
    }
    const { action, payload: unknownPayload } = requestBody.data;
    const payload: any = unknownPayload;
    const actorId = await getActorId(currentUser);
    const requiredPermission = ACTION_PERMISSIONS[action];
    if (requiredPermission && !hasPermission(currentUser, requiredPermission)) {
      return NextResponse.json({ ok: false, error: "You do not have permission to perform this action." }, { status: 403 });
    }

  if (action === "addCustomer") {
    const locationId = resolveActorLocationId(currentUser, payload.locationId);
    const customer = await prisma.customer.create({
      data: {
        locationId,
        name: payload.name,
        phone: payload.phone === "-" ? null : payload.phone,
        address: payload.email || null,
        allowCredit: payload.allowCredit !== false,
        creditLimit: payload.creditLimit === "" || payload.creditLimit == null ? null : asMoney(payload.creditLimit),
      },
    });
    return NextResponse.json({ ok: true, id: customer.id });
  }

  if (action === "updateCustomer") {
    const existing = await prisma.customer.findUnique({ where: { id: payload.id } });
    if (!existing) return NextResponse.json({ ok: false, error: "Customer was not found." }, { status: 404 });
    resolveActorLocationId(currentUser, existing.locationId);
    await prisma.customer.update({
      where: { id: payload.id },
      data: {
        name: payload.name,
        phone: payload.phone === "-" ? null : payload.phone || null,
        address: payload.email || null,
        note: payload.note || null,
        allowCredit: payload.allowCredit !== false,
        creditLimit: payload.creditLimit === "" || payload.creditLimit == null ? null : asMoney(payload.creditLimit),
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "addSupplier") {
    const locationId = resolveActorLocationId(currentUser, payload.locationId);
    const supplier = await prisma.supplier.create({
      data: {
        locationId,
        name: payload.name,
        phone: payload.phone === "-" ? null : payload.phone,
        note: payload.contact || null,
      },
    });
    return NextResponse.json({ ok: true, id: supplier.id });
  }

  if (action === "updateSupplier") {
    const existing = await prisma.supplier.findUnique({ where: { id: payload.id } });
    if (!existing) return NextResponse.json({ ok: false, error: "Supplier was not found." }, { status: 404 });
    resolveActorLocationId(currentUser, existing.locationId);
    await prisma.supplier.update({
      where: { id: payload.id },
      data: {
        name: payload.name,
        phone: payload.phone === "-" ? null : payload.phone || null,
        note: payload.contact || payload.note || null,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "addItem") {
    const locationId = resolveActorLocationId(currentUser, payload.locationId);
    const categoryName = String(payload.category || "").trim();
    const unitName = String(payload.unit || "").trim();
    const category =
      payload.categoryId
        ? await prisma.category.findFirst({ where: { id: payload.categoryId, locationId } })
        : categoryName
          ? await prisma.category.findFirst({ where: { name: categoryName, locationId } })
          : null;
    const categorySlug = categoryName ? categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "uncategorized";
    const resolvedCategory = category || await prisma.category.upsert({
      where: { id: `cat-${locationId}-${categorySlug}` },
      update: { name: categoryName || UNCATEGORIZED_CATEGORY_NAME, locationId },
      create: {
        id: `cat-${locationId}-${categorySlug}`,
        locationId,
        name: categoryName || UNCATEGORIZED_CATEGORY_NAME,
      },
    });
    const unit =
      payload.unitId
        ? await prisma.unit.findFirst({ where: { id: payload.unitId, locationId } })
        : unitName
          ? await prisma.unit.findFirst({ where: { name: unitName, locationId } })
          : null;
    if (!unit && !unitName) {
      return NextResponse.json({ ok: false, error: "Unit is required." }, { status: 400 });
    }
    const resolvedUnit = unit || await prisma.unit.create({
      data: {
        locationId,
        name: unitName,
        shortName: unitName,
      },
    });
    const existingCodes = (
      await prisma.item.findMany({
        where: { locationId },
        select: { code: true },
      })
    ).map((row) => row.code);
    const allocated = allocateItemCode({
      requested: payload.code,
      name: payload.name,
      category: isUncategorizedCategory(resolvedCategory) ? "" : resolvedCategory.name,
      locationId,
      existingCodes,
    });
    if (allocated.duplicate) {
      return NextResponse.json({ ok: false, error: "Another item already uses this code." }, { status: 400 });
    }
    const barcode = cleanPackCode(payload.barcode);
    if (await packCodeTaken(locationId, barcode)) {
      return NextResponse.json({ ok: false, error: "This pack code is already used by another medicine." }, { status: 400 });
    }
    const item = await prisma.item.create({
      data: {
        locationId,
        name: payload.name,
        code: allocated.code,
        barcode,
        categoryId: resolvedCategory.id,
        unitId: resolvedUnit.id,
        defaultBuyingPrice: asMoney(payload.buyingPrice || payload.price || 0),
        defaultSellingPrice: asMoney(payload.price || payload.sellingPrice || 0),
        lowStockAlert: Number(payload.lowStockAlert ?? 10),
        genericName: payload.genericName || null,
        brandName: payload.brandName || null,
        dosageForm: payload.dosageForm || null,
        strength: payload.strength || null,
        packSize: payload.packSize || null,
        manufacturer: payload.manufacturer || null,
        countryOfOrigin: payload.countryOfOrigin || null,
        requiresPrescription: Boolean(payload.requiresPrescription),
        isControlled: Boolean(payload.isControlled),
      },
    });
    if (Number(payload.stock || 0) > 0) {
      await prisma.inventoryBatch.create({
        data: {
          itemId: item.id,
          locationId,
          quantityIn: Number(payload.stock),
          remainingQuantity: Number(payload.stock),
          buyingPrice: asMoney(payload.buyingPrice || payload.price || 0),
          sellingPrice: asMoney(payload.price || payload.sellingPrice || 0),
          batchCode: "OPENING",
        },
      });
    }
    return NextResponse.json({ ok: true, id: item.id });
  }

  if (action === "updateItem") {
    if (!payload.id) {
      return NextResponse.json({ ok: false, error: "Item id is required." }, { status: 400 });
    }
    const existing = await prisma.item.findUnique({ where: { id: payload.id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Item not found." }, { status: 404 });
    }
    const locationId = resolveActorLocationId(currentUser, existing.locationId);
    if (existing.locationId !== locationId) {
      return NextResponse.json({ ok: false, error: "This item belongs to another business." }, { status: 403 });
    }

    const name = String(payload.name || "").trim();
    if (!name) {
      return NextResponse.json({ ok: false, error: "Item name is required." }, { status: 400 });
    }

    const unit = payload.unitId
      ? await prisma.unit.findFirst({ where: { id: payload.unitId, locationId } })
      : await prisma.unit.findFirst({ where: { id: existing.unitId, locationId } });
    if (!unit) {
      return NextResponse.json({ ok: false, error: "Unit is required." }, { status: 400 });
    }
    if (unit.id !== existing.unitId) {
      const [batches, saleItems, purchaseItems] = await Promise.all([
        prisma.inventoryBatch.count({ where: { itemId: existing.id } }),
        prisma.saleItem.count({ where: { itemId: existing.id } }),
        prisma.purchaseItem.count({ where: { itemId: existing.id } }),
      ]);
      if (batches + saleItems + purchaseItems > 0) {
        return NextResponse.json({
          ok: false,
          error: "This medicine already has stock or transactions. Create a new medicine to use a different unit.",
        }, { status: 400 });
      }
    }

    let categoryId = existing.categoryId;
    if (payload.categoryId) {
      const category = await prisma.category.findFirst({ where: { id: payload.categoryId, locationId } });
      if (!category) {
        return NextResponse.json({ ok: false, error: "Category was not found." }, { status: 400 });
      }
      categoryId = category.id;
    }

    const categoryRecord = await prisma.category.findFirst({ where: { id: categoryId, locationId } });
    const existingCodes = (
      await prisma.item.findMany({
        where: { locationId, NOT: { id: existing.id } },
        select: { code: true },
      })
    ).map((row) => row.code);
    const allocated = allocateItemCode({
      requested: payload.code,
      name,
      category: isUncategorizedCategory(categoryRecord) ? "" : categoryRecord?.name || "",
      locationId,
      existingCodes,
    });
    if (allocated.duplicate) {
      return NextResponse.json({ ok: false, error: "Another item already uses this code." }, { status: 400 });
    }
    const barcode = cleanPackCode(payload.barcode);
    if (await packCodeTaken(locationId, barcode, existing.id)) {
      return NextResponse.json({ ok: false, error: "This pack code is already used by another medicine." }, { status: 400 });
    }

    const sellingPrice = payload.sellingPrice ?? payload.price;
    await prisma.item.update({
      where: { id: existing.id },
      data: {
        name,
        code: allocated.code,
        barcode,
        categoryId,
        unitId: unit.id,
        defaultBuyingPrice:
          payload.buyingPrice == null ? existing.defaultBuyingPrice : asMoney(payload.buyingPrice),
        defaultSellingPrice:
          sellingPrice == null ? existing.defaultSellingPrice : asMoney(sellingPrice),
        lowStockAlert:
          payload.lowStockAlert == null ? existing.lowStockAlert : Number(payload.lowStockAlert),
        isActive: payload.status ? payload.status !== "Inactive" : existing.isActive,
        genericName: payload.genericName || null,
        brandName: payload.brandName || null,
        dosageForm: payload.dosageForm || null,
        strength: payload.strength || null,
        packSize: payload.packSize || null,
        manufacturer: payload.manufacturer || null,
        countryOfOrigin: payload.countryOfOrigin || null,
        requiresPrescription: Boolean(payload.requiresPrescription),
        isControlled: Boolean(payload.isControlled),
      },
    });
    return NextResponse.json({ ok: true, id: existing.id });
  }

  if (action === "addCategory") {
    const locationId = resolveActorLocationId(currentUser, payload.locationId);
    const name = String(payload.name || "").trim();
    if (!name) {
      return NextResponse.json({ ok: false, error: "Category name is required." }, { status: 400 });
    }
    const existing = await prisma.category.findFirst({
      where: { locationId, name: { equals: name, mode: "insensitive" } },
    });
    if (existing) {
      return NextResponse.json({ ok: true, id: existing.id });
    }
    const category = await prisma.category.create({ data: { name, locationId } });
    return NextResponse.json({ ok: true, id: category.id });
  }

  if (action === "updateCategory") {
    const name = String(payload.name || "").trim();
    if (!payload.id) {
      return NextResponse.json({ ok: false, error: "Category id is required." }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ ok: false, error: "Category name is required." }, { status: 400 });
    }
    if (isUncategorizedCategory({ name })) {
      return NextResponse.json({ ok: false, error: "That name is reserved." }, { status: 400 });
    }
    const existing = await prisma.category.findUnique({ where: { id: payload.id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Category was not found." }, { status: 404 });
    }
    if (isUncategorizedCategory(existing)) {
      return NextResponse.json({ ok: false, error: "The default uncategorized group cannot be renamed." }, { status: 400 });
    }
    const locationId = resolveActorLocationId(currentUser, existing.locationId);
    if (existing.locationId !== locationId) {
      return NextResponse.json({ ok: false, error: "This category belongs to another business." }, { status: 403 });
    }
    const duplicate = await prisma.category.findFirst({
      where: { locationId, name: { equals: name, mode: "insensitive" }, NOT: { id: existing.id } },
    });
    if (duplicate) {
      return NextResponse.json({ ok: false, error: "Another category already uses this name." }, { status: 400 });
    }
    await prisma.category.update({ where: { id: existing.id }, data: { name } });
    return NextResponse.json({ ok: true, id: existing.id });
  }

  if (action === "deleteCategory") {
    if (!payload.id) {
      return NextResponse.json({ ok: false, error: "Category id is required." }, { status: 400 });
    }
    const existing = await prisma.category.findUnique({ where: { id: payload.id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Category was not found." }, { status: 404 });
    }
    if (isUncategorizedCategory(existing)) {
      return NextResponse.json({ ok: false, error: "The default uncategorized group cannot be deleted." }, { status: 400 });
    }
    const locationId = resolveActorLocationId(currentUser, existing.locationId);
    if (existing.locationId !== locationId) {
      return NextResponse.json({ ok: false, error: "This category belongs to another business." }, { status: 403 });
    }
    const itemCount = await prisma.item.count({ where: { categoryId: existing.id } });
    if (itemCount > 0) {
      return NextResponse.json(
        { ok: false, error: `This category is used by ${itemCount} item${itemCount === 1 ? "" : "s"}, so it cannot be deleted.` },
        { status: 400 },
      );
    }
    await prisma.category.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true, id: existing.id });
  }

  if (action === "addUnit") {
    const locationId = resolveActorLocationId(currentUser, payload.locationId);
    const name = String(payload.name || "").trim();
    const shortName = String(payload.shortName || payload.name || "").trim();
    if (!name) {
      return NextResponse.json({ ok: false, error: "Unit name is required." }, { status: 400 });
    }
    const existing = await prisma.unit.findFirst({
      where: { locationId, name: { equals: name, mode: "insensitive" } },
    });
    if (existing) {
      return NextResponse.json({ ok: true, id: existing.id });
    }
    const unit = await prisma.unit.create({
      data: {
        locationId,
        name,
        shortName: shortName.slice(0, 12) || name.slice(0, 3).toUpperCase(),
      },
    });
    return NextResponse.json({ ok: true, id: unit.id });
  }

  if (action === "addLocation") {
    const location = await prisma.location.create({
      data: { name: payload.name, type: payload.type || "BUSINESS", location: payload.location || null },
    });
    await bootstrapBusinessDefaults(prisma, location);
    return NextResponse.json({ ok: true, id: location.id });
  }

  if (action === "updateSettings") {
    const locationId = resolveActorLocationId(currentUser, payload.locationId);
    const entries = Object.entries(payload).filter(([key]) => key !== "locationId");
    await Promise.all(entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { locationId_key: { locationId, key } },
        update: { value: String(value) },
        create: { locationId, key, value: String(value) },
      }),
    ));
    return NextResponse.json({ ok: true });
  }

  if (action === "addUser") {
    if (!payload.password || String(payload.password).length < 4) {
      return NextResponse.json({ ok: false, error: "Password is required and must be at least 4 characters long." }, { status: 400 });
    }
    const username = String(payload.username || "").trim();
    if (!username) {
      return NextResponse.json({ ok: false, error: "Username is required." }, { status: 400 });
    }
    const takenUsername = await prisma.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      select: { id: true },
    });
    if (takenUsername) {
      return NextResponse.json({ ok: false, error: "This username is already taken. Choose a different username." }, { status: 400 });
    }
    const passwordHash = await bcrypt.hash(String(payload.password), 10);
    const assigned = Array.isArray(payload.assignedLocations) ? payload.assignedLocations.filter(Boolean) : [];
    const locationId = assigned[0] || (await prisma.location.findFirstOrThrow({ where: { isActive: true } })).id;
    const assignedLocationIds = assigned.length > 0 ? assigned.join(",") : locationId;
    const role = payload.roleId
      ? await prisma.role.findUnique({ where: { id: payload.roleId } })
      : await prisma.role.findUnique({ where: { name: payload.role === "Super Admin" ? "Super Admin" : payload.role || "Sales" } });
    const user = await prisma.user.create({
      data: {
        firstName: payload.firstName,
        lastName: payload.lastName,
        username,
        phone: payload.phone || null,
        passwordHash,
        role: role?.name === "Super Admin" ? "ADMIN" : role?.name || payload.role || "SALES",
        assignedLocationIds,
        location: { connect: { id: locationId } },
        ...(role?.id ? { roleRecord: { connect: { id: role.id } } } : {})
      },
    });
    return NextResponse.json({ ok: true, id: user.id });
  }

  if (action === "updateUser") {
    const nextPassword = String(payload.password || "").trim();
    const data: {
      firstName: string;
      lastName: string | null;
      username: string;
      phone: string | null;
      role: string;
      roleId?: string | null;
      locationId?: string;
      assignedLocationIds?: string;
      passwordHash?: string;
    } = {
      firstName: payload.firstName,
      lastName: payload.lastName || null,
      username: payload.username,
      phone: payload.phone || null,
      role: payload.role === "Super Admin" ? "ADMIN" : payload.role || "SALES",
    };
    const username = String(payload.username || "").trim();
    if (!username) {
      return NextResponse.json({ ok: false, error: "Username is required." }, { status: 400 });
    }
    data.username = username;
    const takenUsername = await prisma.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" }, NOT: { id: payload.id } },
      select: { id: true },
    });
    if (takenUsername) {
      return NextResponse.json({ ok: false, error: "This username is already taken. Choose a different username." }, { status: 400 });
    }
    const role = payload.roleId
      ? await prisma.role.findUnique({ where: { id: payload.roleId } })
      : await prisma.role.findUnique({ where: { name: payload.role === "Super Admin" ? "Super Admin" : payload.role || "Sales" } });
    if (role) {
      data.role = role.name === "Super Admin" ? "ADMIN" : role.name;
      (data as any).roleRecord = { connect: { id: role.id } };
    } else {
      (data as any).roleRecord = { disconnect: true };
    }
    
    if (Array.isArray(payload.assignedLocations)) {
      const assigned = payload.assignedLocations.filter(Boolean);
      data.assignedLocationIds = assigned.join(",");
      if (assigned[0]) {
        (data as any).location = { connect: { id: assigned[0] } };
      }
    }
    
    if (nextPassword) {
      if (nextPassword.length < 4) {
        return NextResponse.json({ ok: false, error: "New password must be at least 4 characters long." }, { status: 400 });
      }
      data.passwordHash = await bcrypt.hash(nextPassword, 10);
    }
    await prisma.user.update({
      where: { id: payload.id },
      data: data as any,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "addRole" || action === "updateRole") {
    const name = String(payload.name || "").trim();
    if (!name) return NextResponse.json({ ok: false, error: "Role name is required." }, { status: 400 });

    const permissionIds = Array.isArray(payload.permissionIds) ? payload.permissionIds.filter(Boolean) : [];
    const data = {
      name,
      description: payload.description || null,
      isActive: true,
    };

    const existingRole = action === "updateRole" ? await prisma.role.findUnique({ where: { id: payload.id } }) : null;
    if (action === "updateRole" && !existingRole) {
      return NextResponse.json({ ok: false, error: "Role was not found." }, { status: 404 });
    }
    if (existingRole?.name === "Super Admin") {
      const role = await prisma.role.update({
        where: { id: existingRole.id },
        data: { description: payload.description || existingRole.description },
      });
      return NextResponse.json({ ok: true, id: role.id });
    }
    if (name.toLowerCase() === "super admin" && existingRole?.name !== "Super Admin") {
      return NextResponse.json({ ok: false, error: "The Super Admin role name is reserved." }, { status: 400 });
    }

    const duplicate = await prisma.role.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        ...(existingRole ? { NOT: { id: existingRole.id } } : {}),
      },
    });
    if (duplicate) {
      if (action === "addRole" && !duplicate.isActive) {
        const role = await prisma.role.update({
          where: { id: duplicate.id },
          data,
        });
        await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
        if (permissionIds.length > 0) {
          await prisma.rolePermission.createMany({
            data: permissionIds.map((permissionId: string) => ({ roleId: role.id, permissionId })),
            skipDuplicates: true,
          });
        }
        return NextResponse.json({ ok: true, id: role.id });
      }
      return NextResponse.json({
        ok: false,
        error: `A role named "${duplicate.name}" already exists. Open it from the list to edit instead.`,
      }, { status: 400 });
    }

    const role = action === "addRole"
      ? await prisma.role.create({ data })
      : await prisma.role.update({ where: { id: payload.id }, data });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (permissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId: string) => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({ ok: true, id: role.id });
  }

  if (action === "deleteRole") {
    const role = await prisma.role.findUnique({ where: { id: payload.id }, include: { _count: { select: { users: true } } } });
    if (!role) return NextResponse.json({ ok: false, error: "Role was not found." }, { status: 404 });
    if (role.isSystem || role.name === "Super Admin") return NextResponse.json({ ok: false, error: "System roles cannot be deleted." }, { status: 400 });
    if (role._count.users > 0) return NextResponse.json({ ok: false, error: "Only unused roles can be deleted." }, { status: 400 });
    await prisma.role.update({ where: { id: role.id }, data: { isActive: false } });
    return NextResponse.json({ ok: true });
  }

  if (action === "changePassword") {
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user || !user.isActive) {
      return NextResponse.json({ ok: false, error: "User account was not found." }, { status: 404 });
    }
    if (!(await bcrypt.compare(String(payload.currentPassword || ""), user.passwordHash))) {
      return NextResponse.json({ ok: false, error: "Current password does not match." }, { status: 400 });
    }
    if (String(payload.newPassword || "").length < 4) {
      return NextResponse.json({ ok: false, error: "New password must be at least 4 characters long." }, { status: 400 });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(String(payload.newPassword), 10) },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "addBankAccount") {
    const locationId = resolveActorLocationId(currentUser, payload.locationId);
    const account = await prisma.bankAccount.create({
      data: {
        locationId,
        displayName: payload.displayName,
        bankName: payload.bankName || null,
        accountNumber: payload.accountNumber || null,
        currentBalance: asMoney(payload.currentBalance || 0),
        accountType: payload.accountType === "MOBILE" ? "MOBILE" : "BANK",
      },
    });
    return NextResponse.json({ ok: true, id: account.id });
  }

  if (action === "updateBankAccount") {
    const account = await prisma.bankAccount.findUnique({ where: { id: payload.id } });
    if (!account) return NextResponse.json({ ok: false, error: "Bank account was not found." }, { status: 404 });
    resolveActorLocationId(currentUser, account.locationId);
    await prisma.bankAccount.update({
      where: { id: payload.id },
      data: {
        displayName: payload.displayName,
        bankName: payload.bankName || null,
        accountNumber: payload.accountNumber || null,
        currentBalance: asMoney(payload.currentBalance || 0),
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "deleteBankAccount") {
    const used = await prisma.bankTransaction.count({ where: { bankAccountId: payload.id } });
    const account = await prisma.bankAccount.findUnique({ where: { id: payload.id } });
    if (!account || account.accountType === CASH_ACCOUNT_TYPE || used > 0) {
      return NextResponse.json({ ok: false, error: "Only unused bank accounts can be deleted." }, { status: 400 });
    }
    resolveActorLocationId(currentUser, account.locationId);
    await prisma.bankAccount.update({ where: { id: payload.id }, data: { isActive: false } });
    return NextResponse.json({ ok: true });
  }

  if (action === "addExpense") {
    const result = await createExpense(payload, {
      id: actorId, role: currentUser.role, locationId: currentUser.locationId, assignedLocations: currentUser.assignedLocations,
    });
    return NextResponse.json({ ok: true, id: result.id });
  }

  if (action === "addExpenseCategory") {
    const result = await createExpenseCategory(payload, {
      id: actorId, role: currentUser.role, locationId: currentUser.locationId, assignedLocations: currentUser.assignedLocations,
    });
    return NextResponse.json({ ok: true, id: result.id, name: result.name });
  }

  if (action === "addCashTransfer") {
    const result = await createCashTransfer(payload, {
      id: actorId, role: currentUser.role, locationId: currentUser.locationId, assignedLocations: currentUser.assignedLocations,
    });
    return NextResponse.json({ ok: true, id: result.id });
  }

  if (action === "addPurchase") {
    const result = await createPurchase(payload, {
      id: actorId, role: currentUser.role, locationId: currentUser.locationId, assignedLocations: currentUser.assignedLocations,
    });
    return NextResponse.json({ ok: true, id: result.id, invoiceNo: result.invoiceNo });
  }

  if (action === "addSale") {
    const canSellBelowCost = hasPermission(currentUser, "sales.sell_below_cost");
    const result = await createSale({
      ...payload,
      allowBelowCost: canSellBelowCost ? Boolean(payload.allowBelowCost) : false,
    }, {
      id: actorId,
      role: currentUser.role,
      locationId: currentUser.locationId,
      assignedLocations: currentUser.assignedLocations,
    });
    return NextResponse.json({
      ok: true,
      id: result.id,
      voucherCode: result.voucherCode,
      telegram: result.telegram,
      pending: Boolean(result.pending),
    });
  }

  if (action === "completePendingSale") {
    const actor = {
      id: actorId,
      role: currentUser.role,
      locationId: currentUser.locationId,
      assignedLocations: currentUser.assignedLocations,
    };
    const result = await completePendingSale(String(payload.pendingSaleId || payload.id || ""), payload, actor);
    return NextResponse.json({
      ok: true,
      id: result.id,
      voucherCode: result.voucherCode,
      telegram: result.telegram,
    });
  }

  if (action === "cancelPendingSale") {
    const result = await cancelPendingSale(String(payload.pendingSaleId || payload.id || ""), {
      id: actorId,
      role: currentUser.role,
      locationId: currentUser.locationId,
      assignedLocations: currentUser.assignedLocations,
    });
    return NextResponse.json({ ok: true, id: result.id });
  }

  if (action === "disposeBatch") {
    const result = await disposeBatch(payload, {
      id: actorId,
      role: currentUser.role,
      locationId: currentUser.locationId,
      assignedLocations: currentUser.assignedLocations,
    });
    return NextResponse.json({ ok: true, id: result.id });
  }

  if (action === "addCustomerPayment" || action === "settleCredit") {
    const result = await createCustomerPayment(payload, {
      id: actorId, role: currentUser.role, locationId: currentUser.locationId, assignedLocations: currentUser.assignedLocations,
    });
    return NextResponse.json({
      ok: true,
      id: result.id,
      remainingBalance: result.remainingBalance,
      message: `Customer payment recorded successfully. Remaining credit balance: ETB ${result.remainingBalance.toLocaleString()}.`,
    });
  }

  if (action === "addSupplierPayment") {
    const result = await createSupplierPayment(payload, {
      id: actorId, role: currentUser.role, locationId: currentUser.locationId, assignedLocations: currentUser.assignedLocations,
    });
    return NextResponse.json({ ok: true, id: result.id });
  }

  if (action === "addTransfer") {
    const result = await createTransfer(payload, {
      id: actorId, role: currentUser.role, locationId: currentUser.locationId, assignedLocations: currentUser.assignedLocations,
    });
    return NextResponse.json({ ok: true, id: result.id });
  }

  if (action === "adjustStock") {
    if (currentUser.role !== "Super Admin") {
      return NextResponse.json({ ok: false, error: "Only Super Admin can adjust stock." }, { status: 403 });
    }

    const quantity = Number(payload.quantity);
    const reason = String(payload.reason || "").trim();
    if (!payload.itemId || !payload.locationId || !Number.isFinite(quantity) || quantity < 0) {
      return NextResponse.json({ ok: false, error: "A valid item, location, and non-negative quantity are required." }, { status: 400 });
    }
    if (reason.length < 5) {
      return NextResponse.json({ ok: false, error: "Adjustment reason is required and must be descriptive." }, { status: 400 });
    }

    const adjustment = await runSerializableTransaction(async (tx) => {
      const item = await tx.item.findUniqueOrThrow({
        where: { id: payload.itemId },
        select: { id: true, name: true, code: true, locationId: true, defaultBuyingPrice: true, defaultSellingPrice: true, lowStockAlert: true },
      });
      resolveActorLocationId(currentUser, payload.locationId);
      if (tenantBusinessId(item.locationId) !== tenantBusinessId(payload.locationId)) {
        throw new Error("This item belongs to another business.");
      }

      const businessId = tenantBusinessId(payload.locationId);
      const stockBefore = await stockTotalsForItems(tx, businessId, [payload.itemId]);

      const current = await tx.inventoryBatch.aggregate({
        where: { itemId: payload.itemId, locationId: payload.locationId },
        _sum: { remainingQuantity: true },
      });
      const beforeQuantity = current._sum.remainingQuantity || 0;
      const delta = quantity - beforeQuantity;

      let adjustedBatchId: string | undefined;
      const requestedBatchId = String(payload.inventoryBatchId || "").trim();
      if (requestedBatchId && requestedBatchId !== "new") {
        const batch = await tx.inventoryBatch.findFirst({
          where: { id: requestedBatchId, itemId: payload.itemId, locationId: payload.locationId, status: "ACTIVE" },
        });
        if (!batch) throw new Error("Choose a batch that is still open at this location.");
        if (delta < 0) {
          const decrease = Math.abs(delta);
          if (batch.remainingQuantity < decrease) {
            throw new Error(`Batch ${batch.batchCode || ""} only has ${batch.remainingQuantity} left.`);
          }
          const reduced = await tx.inventoryBatch.updateMany({
            where: { id: batch.id, remainingQuantity: { gte: decrease } },
            data: { remainingQuantity: { decrement: decrease } },
          });
          if (reduced.count !== 1) throw new Error("Stock changed while the adjustment was being processed. Please retry.");
        } else if (delta > 0) {
          await tx.inventoryBatch.update({
            where: { id: batch.id },
            data: {
              quantityIn: { increment: delta },
              remainingQuantity: { increment: delta },
            },
          });
        }
        adjustedBatchId = batch.id;
      } else if (delta > 0) {
        const openCount = await tx.inventoryBatch.count({
          where: { itemId: payload.itemId, locationId: payload.locationId, remainingQuantity: { gt: 0 }, status: "ACTIVE" },
        });
        if (openCount > 1 && requestedBatchId !== "new") {
          throw new Error("Choose which batch this adjustment applies to.");
        }
        const receipt = parseReceiptBatch(payload);
        const buyingInput = Number(payload.buyingPrice);
        const sellingInput = Number(payload.sellingPrice);
        if (!Number.isFinite(buyingInput) || buyingInput < 0 || !Number.isFinite(sellingInput) || sellingInput < 0) {
          throw new Error("Enter the buying price and the selling price for this batch.");
        }
        const buyingPrice = asMoney(buyingInput);
        const sellingPrice = asMoney(sellingInput);
        const existingBatch = await tx.inventoryBatch.findFirst({
          where: {
            itemId: payload.itemId,
            locationId: payload.locationId,
            batchCode: receipt.batchCode,
            expireDate: receipt.expireDate,
            buyingPrice,
            status: "ACTIVE",
          },
        });
        const batch = existingBatch
          ? await tx.inventoryBatch.update({
              where: { id: existingBatch.id },
              data: {
                quantityIn: { increment: delta },
                remainingQuantity: { increment: delta },
                sellingPrice,
              },
            })
          : await (async () => {
              await assertInternalBatchCodeAvailable(tx, receipt.batchCode);
              return tx.inventoryBatch.create({
              data: {
                itemId: payload.itemId,
                locationId: payload.locationId,
                quantityIn: delta,
                remainingQuantity: delta,
                buyingPrice,
                sellingPrice,
                batchCode: receipt.batchCode,
                expireDate: receipt.expireDate,
              },
            });
            })();
        adjustedBatchId = batch.id;
      } else if (delta < 0) {
        const openCount = await tx.inventoryBatch.count({
          where: { itemId: payload.itemId, locationId: payload.locationId, remainingQuantity: { gt: 0 }, status: "ACTIVE" },
        });
        if (openCount > 1) throw new Error("Choose which batch this adjustment applies to.");
        let remainingDecrease = Math.abs(delta);
        const batchesToReduce = await tx.inventoryBatch.findMany({
          where: { itemId: payload.itemId, locationId: payload.locationId, remainingQuantity: { gt: 0 } },
          orderBy: { createdAt: "asc" },
        });

        for (const batch of batchesToReduce) {
          if (remainingDecrease <= 0) break;
          const decrease = Math.min(remainingDecrease, batch.remainingQuantity);
          const reduced = await tx.inventoryBatch.updateMany({
            where: { id: batch.id, remainingQuantity: { gte: decrease } },
            data: { remainingQuantity: { decrement: decrease } },
          });
          if (reduced.count !== 1) throw new Error("Stock changed while the adjustment was being processed. Please retry.");
          remainingDecrease -= decrease;
        }
      }

      const movement = await tx.inventoryMovement.create({
        data: {
          itemId: payload.itemId,
          locationId: payload.locationId,
          inventoryBatchId: adjustedBatchId,
          type: "ADJUSTMENT",
          quantity: delta,
          beforeQuantity,
          afterQuantity: quantity,
          referenceType: "STOCK_ADJUSTMENT",
          referenceId: payload.referenceNo || null,
          note: reason,
          createdById: actorId,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          locationId: payload.locationId,
          action: "UPDATE",
          module: "Inventory/Adjustments",
          tableName: "InventoryMovement",
          recordId: movement.id,
          oldData: { quantity: beforeQuantity },
          newData: { quantity, delta, reason },
        },
      });

      const stockAfter = await stockTotalsForItems(tx, businessId, [payload.itemId]);
      const lowStock = lowStockCrossings({
        items: [item],
        before: stockBefore,
        after: stockAfter,
      });

      return {
        id: movement.id,
        locationId: businessId,
        itemName: item.name,
        itemCode: item.code,
        beforeQuantity,
        afterQuantity: quantity,
        reason,
        lowStock,
      };
    });

    voidNotifyAdjustment({
      locationId: adjustment.locationId,
      itemName: adjustment.itemName,
      itemCode: adjustment.itemCode,
      beforeQuantity: adjustment.beforeQuantity,
      afterQuantity: adjustment.afterQuantity,
      reason: adjustment.reason,
    });
    voidNotifyLowStock(adjustment.locationId, adjustment.lowStock);

    return NextResponse.json({ ok: true, id: adjustment.id });
  }

  if (action === "recordDamage") {
    const quantity = Number(payload.quantity);
    const reason = String(payload.reason || "").trim();
    if (!payload.itemId || !payload.locationId || !Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ ok: false, error: "A valid item, location, and positive quantity are required." }, { status: 400 });
    }
    if (reason.length < 5) {
      return NextResponse.json({ ok: false, error: "Damage reason is required and must be descriptive." }, { status: 400 });
    }
    if (denyStoreStock(currentUser, payload.locationId)) {
      return NextResponse.json({ ok: false, error: "You do not have access to store stock." }, { status: 403 });
    }

    try {
      const damage = await runSerializableTransaction(async (tx) => {
        const item = await tx.item.findUniqueOrThrow({
          where: { id: payload.itemId },
          select: {
            id: true,
            name: true,
            code: true,
            locationId: true,
            defaultBuyingPrice: true,
            lowStockAlert: true,
            unit: { select: { name: true } },
          },
        });
        assertWholeQuantity(quantity, item.unit?.name);
        resolveActorLocationId(currentUser, payload.locationId);
        if (tenantBusinessId(item.locationId) !== tenantBusinessId(payload.locationId)) {
          throw new Error("This item belongs to another business.");
        }

        const businessId = tenantBusinessId(payload.locationId);
        const stockBefore = await stockTotalsForItems(tx, businessId, [payload.itemId]);

        const current = await tx.inventoryBatch.aggregate({
          where: { itemId: payload.itemId, locationId: payload.locationId },
          _sum: { remainingQuantity: true },
        });
        const beforeQuantity = Number(current._sum.remainingQuantity || 0);
        if (quantity > beforeQuantity) {
          throw new Error(`Only ${beforeQuantity} available at this location.`);
        }

        let remainingDecrease = quantity;
        let costWritten = 0;
        const batchesToReduce = await tx.inventoryBatch.findMany({
          where: { itemId: payload.itemId, locationId: payload.locationId, remainingQuantity: { gt: 0 } },
          orderBy: { createdAt: "asc" },
        });

        for (const batch of batchesToReduce) {
          if (remainingDecrease <= 0) break;
          const decrease = Math.min(remainingDecrease, Number(batch.remainingQuantity));
          const reduced = await tx.inventoryBatch.updateMany({
            where: { id: batch.id, remainingQuantity: { gte: decrease } },
            data: { remainingQuantity: { decrement: decrease } },
          });
          if (reduced.count !== 1) {
            throw new Error("Stock changed while damage was being recorded. Please retry.");
          }
          costWritten += decrease * Number(batch.buyingPrice || item.defaultBuyingPrice || 0);
          remainingDecrease -= decrease;
        }
        if (remainingDecrease > 0) {
          throw new Error("Not enough stock to record this damage.");
        }

        const afterQuantity = beforeQuantity - quantity;
        const movement = await tx.inventoryMovement.create({
          data: {
            itemId: payload.itemId,
            locationId: payload.locationId,
            type: "DAMAGE",
            quantity: -quantity,
            beforeQuantity,
            afterQuantity,
            referenceType: "STOCK_DAMAGE",
            referenceId: payload.referenceNo || null,
            note: reason,
            createdById: actorId,
          },
        });
        await tx.auditLog.create({
          data: {
            userId: actorId,
            locationId: payload.locationId,
            action: "UPDATE",
            module: "Inventory/Damage",
            tableName: "InventoryMovement",
            recordId: movement.id,
            oldData: { quantity: beforeQuantity },
            newData: { quantity: afterQuantity, damaged: quantity, reason, costWritten },
          },
        });

        const stockAfter = await stockTotalsForItems(tx, businessId, [payload.itemId]);
        const lowStock = lowStockCrossings({
          items: [item],
          before: stockBefore,
          after: stockAfter,
        });

        return {
          id: movement.id,
          locationId: businessId,
          stockLocationId: payload.locationId,
          itemName: item.name,
          itemCode: item.code,
          beforeQuantity,
          afterQuantity,
          quantity,
          reason,
          costWritten,
          lowStock,
        };
      });

      voidNotifyDamage({
        locationId: damage.locationId,
        stockLocationId: damage.stockLocationId,
        itemName: damage.itemName,
        itemCode: damage.itemCode,
        quantity: damage.quantity,
        beforeQuantity: damage.beforeQuantity,
        afterQuantity: damage.afterQuantity,
        reason: damage.reason,
      });
      voidNotifyLowStock(damage.locationId, damage.lowStock);

      return NextResponse.json({ ok: true, id: damage.id });
    } catch (error) {
      return NextResponse.json(
        { ok: false, error: error instanceof Error ? error.message : "Failed to record damage." },
        { status: 400 },
      );
    }
  }

  if (action === "addStockEntry") {
    const quantity = Number(payload.quantity);
    const buyingPrice = Number(payload.buyingPrice || 0);
    const sellingPrice = Number(payload.sellingPrice || 0);
    const note = String(payload.note || "Opening stock entry").trim();

    if (!payload.itemId || !payload.locationId || !Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ ok: false, error: "A valid item, location, and positive quantity are required." }, { status: 400 });
    }
    if (denyStoreStock(currentUser, payload.locationId)) {
      return NextResponse.json({ ok: false, error: "You do not have access to store stock." }, { status: 403 });
    }
    if (!Number.isFinite(buyingPrice) || buyingPrice < 0 || !Number.isFinite(sellingPrice) || sellingPrice < 0) {
      return NextResponse.json({ ok: false, error: "Buying and selling prices must be non-negative numbers." }, { status: 400 });
    }
    let receipt: ReturnType<typeof parseReceiptBatch>;
    try {
      receipt = parseReceiptBatch(payload);
    } catch (error) {
      return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Batch details are invalid." }, { status: 400 });
    }

    const stockEntry = await runSerializableTransaction(async (tx) => {
      const item = await tx.item.findUniqueOrThrow({ where: { id: payload.itemId } });
      resolveActorLocationId(currentUser, payload.locationId);
      if (tenantBusinessId(item.locationId) !== tenantBusinessId(payload.locationId)) {
        throw new Error("This item belongs to another business.");
      }

      const before = await tx.inventoryBatch.aggregate({
        where: { itemId: payload.itemId, locationId: payload.locationId },
        _sum: { remainingQuantity: true },
      });
      const beforeQuantity = before._sum.remainingQuantity || 0;

      const buying = asMoney(buyingPrice);
      const selling = asMoney(sellingPrice);
      const existingBatch = await tx.inventoryBatch.findFirst({
        where: {
          itemId: payload.itemId,
          locationId: payload.locationId,
          batchCode: receipt.batchCode,
          expireDate: receipt.expireDate,
          buyingPrice: buying,
          status: "ACTIVE",
        },
      });
      const batch = existingBatch
        ? await tx.inventoryBatch.update({
            where: { id: existingBatch.id },
            data: {
              quantityIn: { increment: quantity },
              remainingQuantity: { increment: quantity },
              sellingPrice: selling,
            },
          })
        : await (async () => {
            await assertInternalBatchCodeAvailable(tx, receipt.batchCode);
            return tx.inventoryBatch.create({
            data: {
              itemId: payload.itemId,
              locationId: payload.locationId,
              quantityIn: quantity,
              remainingQuantity: quantity,
              buyingPrice: buying,
              sellingPrice: selling,
              batchCode: receipt.batchCode,
              expireDate: receipt.expireDate,
            },
          });
          })();

      await tx.item.update({
        where: { id: item.id },
        data: {
          defaultBuyingPrice: asMoney(buyingPrice),
          defaultSellingPrice: asMoney(sellingPrice),
        },
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          itemId: payload.itemId,
          locationId: payload.locationId,
          inventoryBatchId: batch.id,
          type: "OPENING_STOCK",
          quantity,
          beforeQuantity,
          afterQuantity: beforeQuantity + quantity,
          referenceType: "OPENING_STOCK",
          referenceId: batch.id,
          note,
          createdById: actorId,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          locationId: payload.locationId,
          action: "CREATE",
          module: "Inventory/Opening Stock",
          tableName: "InventoryBatch",
          recordId: batch.id,
          newData: { itemId: payload.itemId, quantity, buyingPrice, sellingPrice, note },
        },
      });

      return { batchId: batch.id, movementId: movement.id };
    });

    return NextResponse.json({ ok: true, ...stockEntry });
  }

  if (action === "updateItemPrice") {
    const buyingPrice = Number(payload.buyingPrice);
    const sellingPrice = Number(payload.sellingPrice);
    if (
      !payload.itemId
      || !Number.isFinite(buyingPrice)
      || buyingPrice < 0
      || !Number.isFinite(sellingPrice)
      || sellingPrice < 0
    ) {
      return NextResponse.json({ ok: false, error: "Valid non-negative buying and selling prices are required." }, { status: 400 });
    }

    const updatedOpenBatches = await runSerializableTransaction(async (tx) => {
      const item = await tx.item.findUniqueOrThrow({ where: { id: payload.itemId } });
      if (payload.locationId) resolveActorLocationId(currentUser, payload.locationId);
      if (payload.locationId && tenantBusinessId(item.locationId) !== tenantBusinessId(payload.locationId)) {
        throw new Error("This item belongs to another business.");
      }
      const batchWhere = {
        itemId: payload.itemId,
        ...(payload.locationId ? { locationId: payload.locationId } : {}),
        remainingQuantity: { gt: 0 },
      };

      await tx.item.update({
        where: { id: payload.itemId },
        data: {
          defaultBuyingPrice: asMoney(buyingPrice),
          defaultSellingPrice: asMoney(sellingPrice),
        },
      });

      const updatedBatches = await tx.inventoryBatch.updateMany({
        where: batchWhere,
        data: { buyingPrice: asMoney(buyingPrice), sellingPrice: asMoney(sellingPrice) },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          locationId: payload.locationId || null,
          action: "UPDATE",
          module: "Inventory",
          tableName: "Item",
          recordId: item.id,
          oldData: {
            defaultBuyingPrice: moneyNumber(item.defaultBuyingPrice),
            defaultSellingPrice: moneyNumber(item.defaultSellingPrice),
          },
          newData: {
            defaultBuyingPrice: buyingPrice,
            defaultSellingPrice: sellingPrice,
            updatedOpenBatches: updatedBatches.count,
            locationId: payload.locationId || null,
          },
        },
      });

      return updatedBatches.count;
    });

    return NextResponse.json({ ok: true, updatedOpenBatches });
  }

  if (action === "deleteCustomer") {
    const customer = await prisma.customer.findUnique({ where: { id: payload.id } });
    if (!customer) return NextResponse.json({ ok: false, error: "Customer was not found." }, { status: 404 });
    resolveActorLocationId(currentUser, customer.locationId);
    await prisma.customer.update({ where: { id: payload.id }, data: { isActive: false } });
    return NextResponse.json({ ok: true });
  }

  if (action === "deleteSupplier") {
    const supplier = await prisma.supplier.findUnique({ where: { id: payload.id } });
    if (!supplier) return NextResponse.json({ ok: false, error: "Supplier was not found." }, { status: 404 });
    resolveActorLocationId(currentUser, supplier.locationId);
    await prisma.supplier.update({ where: { id: payload.id }, data: { isActive: false } });
    return NextResponse.json({ ok: true });
  }

  if (action === "voidSale") {
    const result = await voidSale(String(payload.id || ""), {
      id: actorId,
      role: currentUser.role,
      locationId: currentUser.locationId,
      assignedLocations: currentUser.assignedLocations,
    });
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === "createSaleReturn") {
    const result = await createSaleReturn(payload, {
      id: actorId,
      role: currentUser.role,
      locationId: currentUser.locationId,
      assignedLocations: currentUser.assignedLocations,
    });
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === "createPurchaseReturn") {
    const result = await createPurchaseReturn(payload, {
      id: actorId,
      role: currentUser.role,
      locationId: currentUser.locationId,
      assignedLocations: currentUser.assignedLocations,
    });
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === "deleteSale") {
    const result = await deleteSale(String(payload.id || ""), {
      id: actorId,
      role: currentUser.role,
      locationId: currentUser.locationId,
      assignedLocations: currentUser.assignedLocations,
    });
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === "deletePurchase") {
    const result = await deletePurchase(String(payload.id || ""), {
      id: actorId,
      role: currentUser.role,
      locationId: currentUser.locationId,
      assignedLocations: currentUser.assignedLocations,
    });
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === "deleteItem") {
    if (!payload.id) {
      return NextResponse.json({ ok: false, error: "Item id is required." }, { status: 400 });
    }

    const item = await prisma.item.findUnique({ where: { id: payload.id } });
    if (!item) {
      return NextResponse.json({ ok: false, error: "Item not found." }, { status: 404 });
    }
    resolveActorLocationId(currentUser, item.locationId);

    const [batches, movements, purchaseItems, saleItems, transferItems] = await Promise.all([
      prisma.inventoryBatch.count({ where: { itemId: payload.id } }),
      prisma.inventoryMovement.count({ where: { itemId: payload.id } }),
      prisma.purchaseItem.count({ where: { itemId: payload.id } }),
      prisma.saleItem.count({ where: { itemId: payload.id } }),
      prisma.transferItem.count({ where: { itemId: payload.id } }),
    ]);
    const usageCount = batches + movements + purchaseItems + saleItems + transferItems;

    if (usageCount > 0) {
      return NextResponse.json(
        { ok: false, error: "This item has stock or transaction history, so it cannot be deleted. Only unused zero-stock items can be deleted." },
        { status: 400 },
      );
    }

    await runSerializableTransaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "DELETE",
          module: "Inventory",
          tableName: "Item",
          recordId: item.id,
          oldData: {
            id: item.id,
            name: item.name,
            code: item.code,
            categoryId: item.categoryId,
            unitId: item.unitId,
            defaultSellingPrice: item.defaultSellingPrice,
          },
        },
      });
      await tx.item.delete({ where: { id: item.id } });
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "updateUserStatus") {
    const userToUpdate = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!userToUpdate) return NextResponse.json({ ok: false, error: "User not found." }, { status: 404 });
    if (payload.isActive === false) {
      if (userToUpdate.username === "admin") {
        return NextResponse.json({ ok: false, error: "The main administrator account cannot be deactivated." }, { status: 400 });
      }
      if (userToUpdate.id === actorId) {
        return NextResponse.json({ ok: false, error: "You cannot deactivate your own account." }, { status: 400 });
      }
      if (userToUpdate.role === "ADMIN") {
        const activeAdminsCount = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });
        if (activeAdminsCount <= 1) {
          return NextResponse.json({ ok: false, error: "Cannot deactivate the last active administrator." }, { status: 400 });
        }
      }
    }
    await prisma.user.update({ where: { id: payload.id }, data: { isActive: payload.isActive } });
    return NextResponse.json({ ok: true });
  }

  if (action === "deleteUser") {
    const userToDelete = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!userToDelete) return NextResponse.json({ ok: false, error: "User not found." }, { status: 404 });
    if (userToDelete.username === "admin") {
      return NextResponse.json({ ok: false, error: "The main administrator account cannot be deleted." }, { status: 400 });
    }
    if (userToDelete.id === actorId) {
      return NextResponse.json({ ok: false, error: "You cannot delete your own account." }, { status: 400 });
    }
    if (userToDelete.role === "ADMIN") {
      const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) return NextResponse.json({ ok: false, error: "Cannot delete the last administrator." }, { status: 400 });
    }
    try {
      await runSerializableTransaction(async (tx) => {
        await tx.auditLog.deleteMany({ where: { userId: payload.id } });
        await tx.userPermission.deleteMany({ where: { userId: payload.id } });
        await tx.user.delete({ where: { id: payload.id } });
      });
      return NextResponse.json({ ok: true });
    } catch (error) {
      return NextResponse.json({ ok: false, error: "Cannot delete user. They have associated records (sales, purchases, etc.). Please deactivate them instead." }, { status: 400 });
    }
  }

    return NextResponse.json({ ok: false, error: `Unsupported action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error("App API error:", error);
    const msg = error instanceof Error ? error.message : "";
    const isDbUnreachable = msg.includes("Can't reach database server") || (error as any).code === "P1001" || (error as any).code === "P1003";
    const isWriteConflict = isRetryableWriteConflict(error);
    const uniqueError = friendlyUniqueConstraintError(error);
    const errorMsg = isDbUnreachable 
      ? "Database server is waking up or temporarily unreachable. Please wait 10 seconds and try saving again." 
      : isWriteConflict
        ? "Another update changed the same records. Please review the latest values and try again."
      : uniqueError
        || (error instanceof Error ? error.message : "Application API request failed.");
    return NextResponse.json(
      { ok: false, error: errorMsg },
      { status: isDbUnreachable ? 503 : isWriteConflict ? 409 : uniqueError ? 400 : 500 },
    );
  }
}
