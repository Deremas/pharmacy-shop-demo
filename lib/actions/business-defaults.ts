import {
  cashAccountIdFor,
  DEFAULT_EXPENSE_CATEGORY_NAMES,
  defaultBankAccountIdFor,
  defaultBusinessSettings,
  defaultUnitsForBusiness,
  isTenantBusiness,
  storeLocationIdFor,
  uncategorizedCategoryIdFor,
} from "@/lib/businesses";

type LocationLike = { id: string; name: string; type?: string | null; location?: string | null };

export async function ensureDefaultPaymentAccounts(tx: any, location: LocationLike) {
  await tx.bankAccount.upsert({
    where: { id: defaultBankAccountIdFor(location.id) },
    update: {
      locationId: location.id,
      accountType: "BANK",
      displayName: `${location.name} Bank`,
      isActive: true,
    },
    create: {
      id: defaultBankAccountIdFor(location.id),
      locationId: location.id,
      accountType: "BANK",
      displayName: `${location.name} Bank`,
      bankName: "Main Bank",
      accountNumber: `BANK-${location.id.slice(-6).toUpperCase()}`,
      currentBalance: 0,
      isActive: true,
    },
  });

  await tx.bankAccount.upsert({
    where: { id: cashAccountIdFor(location.id) },
    update: {
      locationId: location.id,
      accountType: "CASH",
      displayName: `${location.name} Cash`,
      bankName: "Internal",
      accountNumber: `CASH-${location.id.slice(-6).toUpperCase()}`,
      isActive: true,
    },
    create: {
      id: cashAccountIdFor(location.id),
      locationId: location.id,
      accountType: "CASH",
      displayName: `${location.name} Cash`,
      bankName: "Internal",
      accountNumber: `CASH-${location.id.slice(-6).toUpperCase()}`,
      currentBalance: 0,
      isActive: true,
    },
  });
}

export async function ensureStockLocations(tx: any, location: LocationLike) {
  if (!isTenantBusiness(location)) return;
  const storeId = storeLocationIdFor(location.id);
  await tx.location.upsert({
    where: { id: storeId },
    update: {
      name: `${location.name} Store`,
      type: "STORE",
      isActive: true,
    },
    create: {
      id: storeId,
      name: `${location.name} Store`,
      type: "STORE",
      location: location.location || "Addis Ababa",
      isActive: true,
    },
  });
}

export async function ensureExpenseCategory(tx: any, locationId: string, name: string) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return null;
  const existing = await tx.expenseCategory.findFirst({
    where: { locationId, name: { equals: trimmed, mode: "insensitive" } },
  });
  if (existing) {
    if (!existing.isActive) {
      return tx.expenseCategory.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
    }
    return existing;
  }
  return tx.expenseCategory.create({
    data: { locationId, name: trimmed, isActive: true },
  });
}

export async function ensureExpenseCategories(tx: any, location: LocationLike) {
  if (!isTenantBusiness(location)) return;
  const names = new Set<string>(DEFAULT_EXPENSE_CATEGORY_NAMES);
  const used = await tx.expense.findMany({
    where: { locationId: location.id },
    select: { category: true },
  });
  for (const row of used) {
    const name = String(row.category || "").trim();
    if (name) names.add(name);
  }
  for (const name of names) {
    await ensureExpenseCategory(tx, location.id, name);
  }
}

export async function bootstrapBusinessDefaults(tx: any, location: LocationLike) {
  for (const unit of defaultUnitsForBusiness(location.id)) {
    await tx.unit.upsert({
      where: { id: unit.id },
      update: { name: unit.name, shortName: unit.shortName, locationId: location.id },
      create: {
        id: unit.id,
        locationId: location.id,
        name: unit.name,
        shortName: unit.shortName,
      },
    });
  }

  await tx.category.upsert({
    where: { id: uncategorizedCategoryIdFor(location.id) },
    update: { name: "Uncategorized", locationId: location.id, isActive: true },
    create: {
      id: uncategorizedCategoryIdFor(location.id),
      locationId: location.id,
      name: "Uncategorized",
      isActive: true,
    },
  });

  await ensureStockLocations(tx, location);
  await ensureDefaultPaymentAccounts(tx, location);
  await ensureExpenseCategories(tx, location);

  for (const setting of defaultBusinessSettings(location.name)) {
    await tx.setting.upsert({
      where: {
        locationId_key: {
          locationId: location.id,
          key: setting.key,
        },
      },
      update: setting.key === "companyName" ? { value: location.name } : {},
      create: {
        locationId: location.id,
        key: setting.key,
        value: setting.value,
      },
    });
  }
}
