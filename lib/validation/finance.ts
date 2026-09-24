import { z } from "zod";

const positiveMoney = z.coerce.number().finite().positive("Amount must be greater than zero.");

export const expenseCategorySchema = z.object({
  locationId: z.string().trim().min(1, "Select a business."),
  name: z.string().trim().min(1, "Category name is required.").max(80, "Category name is too long."),
});

export const expenseSchema = z.object({
  locationId: z.string().trim().min(1, "Select an expense location."),
  category: z.string().trim().min(1, "Expense category is required."),
  description: z.string().trim().max(500).optional().nullable(),
  amount: positiveMoney,
  paymentMethod: z.enum(["CASH", "BANK"]),
  bankAccountId: z.string().trim().optional().nullable(),
  date: z.coerce.date(),
}).superRefine((expense, context) => {
  if (expense.paymentMethod === "BANK" && !expense.bankAccountId) {
    context.addIssue({ code: "custom", path: ["bankAccountId"], message: "Select the bank account used for this expense." });
  }
});

export const cashTransferSchema = z.object({
  locationId: z.string().trim().min(1, "Select a transfer location."),
  bankAccountId: z.string().trim().min(1, "Select a destination bank account."),
  amount: positiveMoney,
  referenceNo: z.string().trim().max(100).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
  date: z.coerce.date(),
});

export const supplierPaymentSchema = z.object({
  supplierId: z.string().trim().min(1, "Select a supplier."),
  locationId: z.string().trim().min(1, "Select a payment location."),
  purchaseId: z.string().trim().optional().nullable(),
  amount: positiveMoney,
  method: z.enum(["CASH", "BANK"]),
  bankAccountId: z.string().trim().optional().nullable(),
  date: z.coerce.date(),
  note: z.string().trim().max(500).optional().nullable(),
}).superRefine((payment, context) => {
  if (payment.method === "BANK" && !payment.bankAccountId) {
    context.addIssue({ code: "custom", path: ["bankAccountId"], message: "Select the bank account used for this payment." });
  }
});

export const customerPaymentSchema = z.object({
  customerId: z.string().trim().min(1, "Select a customer."),
  locationId: z.string().trim().optional().nullable(),
  saleId: z.string().trim().optional().nullable(),
  amount: positiveMoney,
  method: z.enum(["CASH", "BANK"]).optional(),
  paymentMethod: z.enum(["CASH", "BANK"]).optional(),
  bankAccountId: z.string().trim().optional().nullable(),
  date: z.coerce.date().optional(),
  note: z.string().trim().max(500).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
}).superRefine((payment, context) => {
  const method = payment.method || payment.paymentMethod;
  if (!method) context.addIssue({ code: "custom", path: ["method"], message: "Select a payment method." });
  if (method === "BANK" && !payment.bankAccountId) {
    context.addIssue({ code: "custom", path: ["bankAccountId"], message: "Select the bank account that received this payment." });
  }
});
