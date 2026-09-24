import { z } from "zod";

const transferLineSchema = z.object({
  itemId: z.string().trim().min(1, "Each transfer line must select an item."),
  quantity: z.coerce.number().finite().positive("Transfer quantity must be greater than zero."),
});

export const transferSchema = z.object({
  fromLocationId: z.string().trim().min(1, "Select a source location."),
  toLocationId: z.string().trim().min(1, "Select a destination location."),
  date: z.coerce.date(),
  status: z.literal("COMPLETED").default("COMPLETED"),
  note: z.string().trim().max(500).optional().nullable(),
  items: z.array(transferLineSchema).optional(),
  itemId: z.string().trim().optional(),
  quantity: z.coerce.number().finite().positive().optional(),
}).superRefine((transfer, context) => {
  if (transfer.fromLocationId === transfer.toLocationId) {
    context.addIssue({ code: "custom", path: ["toLocationId"], message: "Source and destination locations must be different." });
  }
  const lines = transfer.items?.length
    ? transfer.items
    : transfer.itemId && transfer.quantity
      ? [{ itemId: transfer.itemId, quantity: transfer.quantity }]
      : [];
  if (lines.length === 0) context.addIssue({ code: "custom", path: ["items"], message: "Add at least one item to the transfer." });
  const seen = new Set<string>();
  lines.forEach((line, index) => {
    if (seen.has(line.itemId)) context.addIssue({ code: "custom", path: ["items", index, "itemId"], message: "Combine duplicate items into one transfer line." });
    seen.add(line.itemId);
  });
});

