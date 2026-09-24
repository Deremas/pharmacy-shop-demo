import { Prisma } from "@/lib/generated/prisma/client";

export const MONEY_SCALE = 2;

export function asMoney(value: unknown): Prisma.Decimal {
  const normalized = value === null || value === undefined || value === "" ? 0 : value;
  return new Prisma.Decimal(String(normalized)).toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP);
}

export function moneyNumber(value: unknown): number {
  return asMoney(value).toNumber();
}

export function historicalSaleUnitCost(storedCost: unknown, batchCost: unknown): Prisma.Decimal {
  const stored = asMoney(storedCost);
  return stored.isZero() ? asMoney(batchCost) : stored;
}
