import { isStoreLocationId, stockLocationIdsFor, tenantBusinessId } from "@/lib/businesses";

export function thresholdForItem(item: { lowStockAlert?: number | null }, fallback = 10) {
  const value = Number(item.lowStockAlert);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function alertLevelForStock(stock: number, threshold: number) {
  if (stock <= 0) return "Out of Stock";
  if (stock <= Math.max(1, Math.floor(threshold / 2))) return "Critical";
  if (stock <= threshold) return "Below Minimum";
  return "Healthy";
}

type StockDb = {
  inventoryBatch: {
    groupBy: (args: {
      by: ["itemId"];
      where: { itemId: { in: string[] }; locationId: { in: string[] } };
      _sum: { remainingQuantity: true };
    }) => Promise<Array<{ itemId: string; _sum: { remainingQuantity: number | null } }>>;
  };
};

/** Total remaining qty (shop + store) for each item in a business. */
export async function stockTotalsForItems(db: StockDb, businessId: string, itemIds: string[]) {
  const ids = [...new Set(itemIds.filter(Boolean))];
  const totals = new Map<string, number>();
  for (const id of ids) totals.set(id, 0);
  if (!ids.length) return totals;

  const bins = stockLocationIdsFor(tenantBusinessId(businessId));
  const rows = await db.inventoryBatch.groupBy({
    by: ["itemId"],
    where: { itemId: { in: ids }, locationId: { in: bins } },
    _sum: { remainingQuantity: true },
  });
  for (const row of rows) {
    totals.set(row.itemId, Number(row._sum.remainingQuantity || 0));
  }
  return totals;
}

export type LowStockCrossing = {
  itemId: string;
  name: string;
  code?: string | null;
  before: number;
  after: number;
  threshold: number;
  level: string;
};

/** Items that crossed from above threshold to at/below (or into a worse alert level). */
export function lowStockCrossings(input: {
  items: Array<{ id: string; name: string; code?: string | null; lowStockAlert?: number | null }>;
  before: Map<string, number>;
  after: Map<string, number>;
}): LowStockCrossing[] {
  const crossings: LowStockCrossing[] = [];
  for (const item of input.items) {
    const threshold = thresholdForItem(item);
    const before = Number(input.before.get(item.id) ?? 0);
    const after = Number(input.after.get(item.id) ?? 0);
    if (after >= before) continue;
    const beforeLevel = alertLevelForStock(before, threshold);
    const afterLevel = alertLevelForStock(after, threshold);
    const crossedMinimum = before > threshold && after <= threshold;
    const worsened =
      beforeLevel !== afterLevel &&
      afterLevel !== "Healthy" &&
      (afterLevel === "Out of Stock" ||
        afterLevel === "Critical" ||
        (afterLevel === "Below Minimum" && beforeLevel === "Healthy"));
    if (!crossedMinimum && !worsened) continue;
    crossings.push({
      itemId: item.id,
      name: item.name,
      code: item.code,
      before,
      after,
      threshold,
      level: afterLevel,
    });
  }
  return crossings;
}

export type ItemStockSplit = {
  itemId: string;
  shop: number;
  store: number;
  total: number;
};

export function stockSplitForItem(
  rows: Array<{ id?: string; locationId?: string; stock?: number }>,
  itemId: string,
): ItemStockSplit {
  let shop = 0;
  let store = 0;
  for (const row of rows) {
    if (row.id !== itemId) continue;
    const qty = Number(row.stock || 0);
    if (isStoreLocationId(row.locationId)) store += qty;
    else shop += qty;
  }
  return { itemId, shop, store, total: shop + store };
}

export function uniqueCatalogItems<T extends { id: string }>(products: T[] = [], items: T[] = []): T[] {
  if (products.length) return products;
  const byId = new Map<string, T>();
  items.forEach((item) => {
    if (!byId.has(item.id)) byId.set(item.id, item);
  });
  return [...byId.values()];
}

export function aggregateCatalogStock<T extends { id: string; lowStockAlert?: number | null }>(
  catalog: T[],
  stockRows: Array<{ id?: string; locationId?: string; stock?: number }>,
): Array<T & { shopStock: number; storeStock: number; stock: number }> {
  return catalog.map((item) => {
    const split = stockSplitForItem(stockRows, item.id);
    return {
      ...item,
      shopStock: split.shop,
      storeStock: split.store,
      stock: split.total,
    };
  });
}
