import { multiplyMoney, subtractMoney, sumMoney } from "@/lib/utils";

export function saleCost(sale: { items?: any[] }) {
  return sumMoney((sale.items || []).map((line) => multiplyMoney(Number(line.buyingPrice || 0), Number(line.qty || 0))));
}

export function saleProfit(sale: { items?: any[] }) {
  return sumMoney((sale.items || []).map((line) => {
    if (line.profit !== undefined && line.profit !== null) return Number(line.profit || 0);
    return subtractMoney(Number(line.total || 0), multiplyMoney(Number(line.buyingPrice || 0), Number(line.qty || 0)));
  }));
}

export function saleItemSummary(sale: { items?: any[] }, products: any[] = [], items: any[] = []) {
  const names = (sale.items || []).map((line) => {
    const product = products.find((entry) => entry.id === line.itemId);
    const stockItem = items.find((entry) => entry.id === line.itemId);
    return line.itemName || product?.name || stockItem?.name || line.itemId;
  });

  if (names.length === 0) return "No items";
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
}

export function paginateRows<T>(rows: T[], page: number, pageSize: number) {
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(rows.length / safePageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * safePageSize;
  return {
    page: currentPage,
    totalPages,
    rows: rows.slice(start, start + safePageSize),
  };
}
