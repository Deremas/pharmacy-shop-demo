import { z } from "zod";

const moneyInput = z.coerce.number().finite().nonnegative();

export const createPurchaseSchema = z.object({
  supplierId: z.string().trim().min(1, "Select a supplier."),
  locationId: z.string().trim().min(1, "Select a purchase location."),
  stockLocationId: z.string().trim().min(1, "Select Dispensary or Store to receive this stock."),
  purchaseDate: z.coerce.date(),
  totalAmount: moneyInput,
  paidAmount: moneyInput.default(0),
  cashAmount: moneyInput.default(0),
  bankAmount: moneyInput.default(0),
  debtAmount: moneyInput.default(0),
  paymentMethod: z.enum(["CASH", "BANK", "CREDIT", "MIXED"]),
  bankAccountId: z.string().trim().optional().nullable(),
  items: z.array(z.object({
    itemId: z.string().trim().min(1, "Each purchase line must select an item."),
    qty: z.coerce.number().finite().positive("Purchase quantity must be greater than zero."),
    unitCost: moneyInput,
    sellingPrice: moneyInput,
    total: moneyInput,
    batchCode: z.string().trim().min(1, "Enter the batch number."),
    expireDate: z.coerce.date(),
  })).min(1, "Add at least one item to the purchase."),
  fsNumber: z.string().trim().optional().nullable(),
}).superRefine((purchase, context) => {
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  purchase.items.forEach((line, index) => {
    const expiry = Date.UTC(line.expireDate.getUTCFullYear(), line.expireDate.getUTCMonth(), line.expireDate.getUTCDate());
    if (expiry <= todayUtc) {
      context.addIssue({ code: "custom", path: ["items", index, "expireDate"], message: "Expiry must be after today." });
    }
  });
  if (purchase.bankAmount > 0 && !purchase.bankAccountId) {
    context.addIssue({ code: "custom", path: ["bankAccountId"], message: "Select the bank account used for payment." });
  }
});

export type CreatePurchaseInput = z.output<typeof createPurchaseSchema>;

