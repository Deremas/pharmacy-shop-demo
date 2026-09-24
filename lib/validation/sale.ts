import { z } from "zod";
import { WALK_IN_CUSTOMER_ID } from "@/lib/customer";

const moneyInput = z.coerce.number().finite().nonnegative();

export const saleLineSchema = z.object({
  itemId: z.string().trim().min(1, "Each sale line must select an item."),
  qty: z.coerce.number().finite().positive("Sale quantity must be greater than zero."),
  price: moneyInput,
  discount: moneyInput.default(0),
  total: moneyInput,
});

export const createSaleSchema = z.object({
  locationId: z.string().trim().min(1, "Select a sale location."),
  customerId: z.string().trim().optional().nullable(),
  saleDate: z.coerce.date(),
  subTotal: moneyInput,
  discount: moneyInput.default(0),
  totalAmount: moneyInput,
  cashAmount: moneyInput.default(0),
  bankAmount: moneyInput.default(0),
  creditAmount: moneyInput.default(0),
  paymentMethod: z.enum(["CASH", "BANK", "CREDIT", "MIXED"]),
  bankAccountId: z.string().trim().optional().nullable(),
  submitMode: z.enum(["COMPLETE", "HOLD"]).default("COMPLETE"),
  allowBelowCost: z.boolean().default(false),
  prescriptionNumber: z.string().trim().optional().nullable(),
  patientName: z.string().trim().optional().nullable(),
  prescriberName: z.string().trim().optional().nullable(),
  items: z.array(saleLineSchema).min(1, "Add at least one item to the sale."),
}).superRefine((sale, context) => {
  const seen = new Set<string>();
  sale.items.forEach((line, index) => {
    if (seen.has(line.itemId)) {
      context.addIssue({ code: "custom", path: ["items", index, "itemId"], message: "Combine duplicate items into one sale line." });
    }
    seen.add(line.itemId);

    const gross = line.price * line.qty;
    if (line.total > gross + 0.005) {
      context.addIssue({ code: "custom", path: ["items", index, "total"], message: "A line total cannot exceed its price multiplied by quantity." });
    }
  });

  if (sale.submitMode !== "HOLD" && sale.bankAmount > 0 && !sale.bankAccountId) {
    context.addIssue({ code: "custom", path: ["bankAccountId"], message: "Select the bank account that received the payment." });
  }
  const customerId = sale.customerId?.trim();
  const hasCustomer = Boolean(customerId && customerId !== WALK_IN_CUSTOMER_ID);
  if (sale.submitMode !== "HOLD" && sale.creditAmount > 0 && !hasCustomer) {
    context.addIssue({ code: "custom", path: ["customerId"], message: "Credit sales require a customer." });
  }
});

export type CreateSaleInput = z.output<typeof createSaleSchema>;

