import dns from "node:dns";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  BUSINESSES,
  isStoreLocationId,
  isTenantBusiness,
  stockLocationLabel,
  tenantBusinessId,
} from "@/lib/businesses";
import { eatDayBounds, eatReportBounds } from "@/lib/eat-date";
import { formatTelegramItemLabel } from "@/lib/item-display";
import { listCreditSales } from "@/lib/finance/credit-ledger";
import {
  formatBankAccountLabel,
  formatMethodWithBank,
  formatPaymentSummary,
  purchasePaymentRows,
  resolvePurchasePaymentMethod,
  resolveSalePaymentMethod,
  salePaymentRows,
} from "@/lib/payment-display";
import type { LowStockCrossing } from "@/lib/stock";

export { eatDayBounds, eatReportBounds } from "@/lib/eat-date";

// Windows/Node undici often tries IPv6 first and times out to api.telegram.org.
dns.setDefaultResultOrder("ipv4first");

function cleanEnv(value: string | undefined) {
  return String(value || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\r?\n/g, "");
}

/** One or many chat ids: comma / semicolon / whitespace separated. */
function parseTelegramChatIds(raw: string) {
  return [
    ...new Set(
      String(raw || "")
        .split(/[,;\s]+/)
        .map((entry) => entry.trim().replace(/^['"]|['"]$/g, ""))
        .filter(Boolean),
    ),
  ];
}

function telegramConfig() {
  const token = cleanEnv(process.env.TELEGRAM_BOT_TOKEN);
  const chatIds = parseTelegramChatIds(cleanEnv(process.env.TELEGRAM_CHAT_ID));
  return { token, chatIds, ready: Boolean(token && chatIds.length) };
}

export function formatEtb(amount: number) {
  return `ETB ${Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: Number(amount || 0) % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export type TelegramQtyLine = { name: string; qty: number };

export type TelegramSendResult = {
  ok: boolean;
  skipped?: string;
  error?: string;
};

/** Escape dynamic text for Telegram HTML parse_mode. */
export function escapeHtml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Bold short title with emoji, e.g. `<b>🟢 SALE</b>`. */
export function tgTitle(emoji: string, label: string) {
  return `<b>${emoji} ${escapeHtml(label)}</b>`;
}

function lowStockTitle(level: string) {
  const value = String(level || "").trim();
  if (value === "Out of Stock") return tgTitle("⛔", "OUT");
  if (value === "Critical") return tgTitle("🔴", "CRITICAL");
  if (value === "Below Minimum") return tgTitle("🟠", "BELOW MIN");
  return tgTitle("🟠", "LOW STOCK");
}

export function formatQty(qty: number) {
  const n = Number(qty) || 0;
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return String(Math.round(n * 100) / 100);
}

/** Compact bullet list; Telegram messages max out around 4096 chars. */
export function formatItemListLines(items: TelegramQtyLine[], limit = 25): string[] {
  if (!items.length) return [];
  const merged = new Map<string, number>();
  for (const item of items) {
    const name = String(item.name || "Item").trim() || "Item";
    merged.set(name, (merged.get(name) || 0) + Number(item.qty || 0));
  }
  const sorted = [...merged.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const shown = sorted.slice(0, limit);
  const lines = shown.map(([name, qty]) => `• ${escapeHtml(name)} × ${formatQty(qty)}`);
  const rest = sorted.length - shown.length;
  if (rest > 0) lines.push(`• +${rest} more`);
  return lines;
}

function telegramErrorDetail(bodyText: string, fallback: string) {
  let detail = bodyText.slice(0, 300) || fallback;
  try {
    const parsed = JSON.parse(bodyText) as { description?: string; error_code?: number };
    if (parsed.description) detail = parsed.description;
  } catch {
    /* keep raw */
  }
  return detail;
}

async function postTelegramOnce(token: string, chatId: string, text: string, asNumber: boolean) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  const payloadChatId = asNumber && /^-?\d+$/.test(chatId) ? Number(chatId) : chatId;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: payloadChatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });
    const bodyText = await response.text().catch(() => "");
    return { response, bodyText };
  } finally {
    clearTimeout(timer);
  }
}

async function sendTelegramToChat(token: string, chatId: string, message: string): Promise<TelegramSendResult> {
  let lastError = "Telegram send failed.";

  // Try string chat_id, then numeric — covers personal chats and group ids.
  for (const asNumber of [false, true]) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const { response, bodyText } = await postTelegramOnce(token, chatId, message, asNumber);
        if (response.ok) return { ok: true };
        const detail = telegramErrorDetail(bodyText, `HTTP ${response.status}`);
        lastError = `Telegram API ${response.status}: ${detail}`;
        console.error("Telegram send failed:", response.status, detail, { chatId, asNumber, attempt });
        if (response.status === 401 || response.status === 403) {
          return { ok: false, error: lastError };
        }
        // Wrong type (string vs number) — try the other form next.
        if (response.status === 400 && /chat not found|chat_id/i.test(detail)) break;
      } catch (error) {
        lastError =
          error instanceof Error
            ? error.name === "AbortError"
              ? "Timed out connecting to Telegram."
              : error.message
            : "Network error talking to Telegram.";
        console.error(`Telegram send exception (chat=${chatId}, asNumber=${asNumber}, attempt=${attempt}):`, error);
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  return { ok: false, error: lastError };
}

export async function sendTelegramMessage(text: string): Promise<TelegramSendResult> {
  const { token, chatIds, ready } = telegramConfig();
  if (!ready) {
    console.error("Telegram config missing", {
      hasToken: Boolean(token),
      tokenLen: token.length,
      chatCount: chatIds.length,
    });
    return { ok: false, skipped: "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing on the server." };
  }
  if (!text.trim()) {
    return { ok: false, skipped: "Empty message." };
  }

  const message = text.trim().slice(0, 4000);
  const failures: string[] = [];
  let sent = 0;

  for (const chatId of chatIds) {
    const result = await sendTelegramToChat(token, chatId, message);
    if (result.ok) {
      sent += 1;
    } else {
      failures.push(`${chatId}: ${result.error || result.skipped || "failed"}`);
    }
  }

  if (sent === chatIds.length) return { ok: true };
  if (sent > 0) {
    return {
      ok: false,
      error: `Sent to ${sent}/${chatIds.length} chats. Failed: ${failures.join("; ")}`,
    };
  }
  return { ok: false, error: failures.join("; ") || "Telegram send failed." };
}

async function resolveBusinessLabel(locationId: string) {
  const businessId = tenantBusinessId(locationId);
  if (!businessId) return { business: null as null | { id: string; name: string }, skip: "Invalid business." };

  const location = await prisma.location.findFirst({
    where: { id: businessId, isActive: true },
    select: { id: true, name: true, type: true },
  });

  if (location && isTenantBusiness(location)) {
    return { business: { id: location.id, name: location.name }, skip: null as string | null };
  }

  // Catalog fallback so every known business can still notify even if DB type drifts.
  const catalog = BUSINESSES.find((entry) => entry.id === businessId);
  if (catalog) {
    return { business: { id: catalog.id, name: catalog.name }, skip: null };
  }

  return { business: null, skip: "Business not found." };
}

/** Prefixes with business name into the shared chat. Works for any tenant business. */
export async function notifyBusiness(locationId: string, lines: string[]): Promise<TelegramSendResult> {
  try {
    if (!telegramConfig().ready) {
      return { ok: false, skipped: "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing on the server." };
    }
    const { business, skip } = await resolveBusinessLabel(locationId);
    if (!business) return { ok: false, skipped: skip || "Skipped." };
    const bodyLines = lines.map((line) => String(line || "").trim()).filter(Boolean);
    if (bodyLines.length === 0) return { ok: false, skipped: "Empty message." };
    const [title, ...rest] = bodyLines;
    const text = [title, escapeHtml(business.name), ...rest].join("\n");
    return sendTelegramMessage(text);
  } catch (error) {
    console.error("Telegram notifyBusiness failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Telegram notify failed." };
  }
}

/** Keeps the serverless invocation alive until Telegram finishes (Vercel/Next after). */
export function voidNotifyBusiness(locationId: string, lines: string[]) {
  after(() => {
    void notifyBusiness(locationId, lines);
  });
}

export function voidNotifySale(input: {
  locationId: string;
  voucherCode: string;
  totalAmount: number;
  paymentMethod?: string;
  cashAmount?: number;
  bankAmount?: number;
  creditAmount?: number;
  bankAccountName?: string | null;
  items: TelegramQtyLine[];
}) {
  const method =
    input.paymentMethod ||
    resolveSalePaymentMethod({
      cashAmount: input.cashAmount,
      bankAmount: input.bankAmount,
      creditAmount: input.creditAmount,
    });
  const paymentLine = formatPaymentSummary(
    method,
    salePaymentRows({
      cashAmount: input.cashAmount,
      bankAmount: input.bankAmount,
      creditAmount: input.creditAmount,
    }),
    formatEtb,
  );
  const lines = [
    tgTitle("🟢", "SALE"),
    escapeHtml(String(input.voucherCode || "")),
    `Total: ${formatEtb(input.totalAmount)}`,
    `Payment: ${escapeHtml(paymentLine)}`,
  ];
  if (Number(input.bankAmount || 0) > 0 && input.bankAccountName) {
    lines.push(`Bank: ${escapeHtml(input.bankAccountName)}`);
  }
  lines.push(`Items: ${input.items.length}`, ...formatItemListLines(input.items));
  voidNotifyBusiness(input.locationId, lines);
}

export function voidNotifyPurchase(input: {
  locationId: string;
  invoiceNo: string;
  totalAmount: number;
  stockLocationId: string;
  paymentMethod?: string;
  cashAmount?: number;
  bankAmount?: number;
  debtAmount?: number;
  paidAmount?: number;
  bankAccountName?: string | null;
  items: TelegramQtyLine[];
}) {
  const method =
    input.paymentMethod ||
    resolvePurchasePaymentMethod({
      cashAmount: input.cashAmount,
      bankAmount: input.bankAmount,
      debtAmount: input.debtAmount,
    });
  const paymentLine = formatPaymentSummary(
    method,
    purchasePaymentRows({
      cashAmount: input.cashAmount,
      bankAmount: input.bankAmount,
      debtAmount: input.debtAmount,
    }),
    formatEtb,
  );
  const lines = [
    tgTitle("🔵", "PURCHASE"),
    escapeHtml(String(input.invoiceNo || "")),
    `Total: ${formatEtb(input.totalAmount)}`,
    `Payment: ${escapeHtml(paymentLine)}`,
  ];
  if (Number(input.bankAmount || 0) > 0 && input.bankAccountName) {
    lines.push(`Bank: ${escapeHtml(input.bankAccountName)}`);
  }
  lines.push(
    `Into: ${escapeHtml(stockLocationLabel(input.stockLocationId))}`,
    `Items: ${input.items.length}`,
    ...formatItemListLines(input.items),
  );
  voidNotifyBusiness(input.locationId, lines);
}

export function voidNotifyTransfer(input: {
  locationId: string;
  fromLocationId: string;
  toLocationId: string;
  items: TelegramQtyLine[];
}) {
  voidNotifyBusiness(input.locationId, [
    tgTitle("🔄", "TRANSFER"),
    `${escapeHtml(stockLocationLabel(input.fromLocationId))} → ${escapeHtml(stockLocationLabel(input.toLocationId))}`,
    `Items: ${input.items.length}`,
    ...formatItemListLines(input.items),
  ]);
}

export function voidNotifyAdjustment(input: {
  locationId: string;
  itemName: string;
  itemCode?: string | null;
  beforeQuantity: number;
  afterQuantity: number;
  reason: string;
}) {
  const delta = Number(input.afterQuantity) - Number(input.beforeQuantity);
  const deltaLabel = delta > 0 ? `+${formatQty(delta)}` : formatQty(delta);
  const label = formatTelegramItemLabel(
    { name: input.itemName, code: input.itemCode || undefined, locationId: input.locationId },
    input.locationId,
  );
  voidNotifyBusiness(input.locationId, [
    tgTitle("🛠", "ADJUST"),
    escapeHtml(label),
    `Qty: ${formatQty(input.beforeQuantity)} → ${formatQty(input.afterQuantity)} (${deltaLabel})`,
    `Reason: ${escapeHtml(input.reason)}`,
  ]);
}

export function voidNotifyDamage(input: {
  locationId: string;
  stockLocationId?: string;
  itemName: string;
  itemCode?: string | null;
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  reason: string;
}) {
  const label = formatTelegramItemLabel(
    { name: input.itemName, code: input.itemCode || undefined, locationId: input.locationId },
    input.locationId,
  );
  const where = input.stockLocationId
    ? escapeHtml(stockLocationLabel(input.stockLocationId))
    : "";
  voidNotifyBusiness(input.locationId, [
    tgTitle("🗑", "DAMAGE"),
    escapeHtml(label),
    where ? `At: ${where}` : "",
    `Qty: ${formatQty(input.beforeQuantity)} → ${formatQty(input.afterQuantity)} (−${formatQty(input.quantity)})`,
    `Reason: ${escapeHtml(input.reason)}`,
  ].filter(Boolean));
}

export function voidNotifyLowStock(locationId: string, crossings: LowStockCrossing[]) {
  if (!crossings.length) return;
  for (const row of crossings) {
    const label = formatTelegramItemLabel(
      { name: row.name, code: row.code || undefined, locationId },
      locationId,
    );
    voidNotifyBusiness(locationId, [
      lowStockTitle(row.level),
      escapeHtml(label),
      `Stock: ${formatQty(row.before)} → ${formatQty(row.after)} (min ${formatQty(row.threshold)})`,
    ]);
  }
}

export function voidNotifyCreditPayment(input: {
  locationId: string;
  customerName: string;
  amount: number;
  paymentMethod: string;
  remainingBalance: number;
  saleLabel?: string | null;
  bankAccountName?: string | null;
}) {
  const methodLabel = formatMethodWithBank(input.paymentMethod, input.bankAccountName);
  const lines = [
    tgTitle("💵", "CREDIT PAY"),
    escapeHtml(input.customerName),
    `Paid: ${formatEtb(input.amount)} (${escapeHtml(methodLabel)})`,
    `Remaining credit: ${formatEtb(input.remainingBalance)}`,
  ];
  if (input.saleLabel) lines.push(`Sale: ${escapeHtml(input.saleLabel)}`);
  voidNotifyBusiness(input.locationId, lines);
}

export function voidNotifyExpense(input: {
  locationId: string;
  category: string;
  description?: string | null;
  amount: number;
  paymentMethod: string;
  bankAccountName?: string | null;
}) {
  const method = formatMethodWithBank(input.paymentMethod, input.bankAccountName);
  const lines = [
    tgTitle("💸", "EXPENSE"),
    escapeHtml(input.category),
    `${formatEtb(input.amount)} · ${escapeHtml(method)}`,
  ];
  const note = String(input.description || "").trim();
  if (note && note !== input.category) lines.push(escapeHtml(note));
  voidNotifyBusiness(input.locationId, lines);
}

export function voidNotifyCashDeposit(input: {
  locationId: string;
  amount: number;
  accountName: string;
  note?: string | null;
}) {
  const lines = [
    tgTitle("🏦", "CASH TO BANK"),
    formatEtb(input.amount),
    `To: ${escapeHtml(input.accountName)}`,
  ];
  const note = String(input.note || "").trim();
  if (note) lines.push(escapeHtml(note));
  voidNotifyBusiness(input.locationId, lines);
}

export function voidNotifySupplierPayment(input: {
  locationId: string;
  supplierName: string;
  amount: number;
  paymentMethod: string;
  remainingDebt: number;
  bankAccountName?: string | null;
  purchaseLabel?: string | null;
}) {
  const method = formatMethodWithBank(input.paymentMethod, input.bankAccountName);
  const lines = [
    tgTitle("💵", "SUPPLIER PAY"),
    escapeHtml(input.supplierName),
    `Paid: ${formatEtb(input.amount)} (${escapeHtml(method)})`,
    `Remaining debt: ${formatEtb(input.remainingDebt)}`,
  ];
  if (input.purchaseLabel) lines.push(`Purchase: ${escapeHtml(input.purchaseLabel)}`);
  voidNotifyBusiness(input.locationId, lines);
}

export function voidNotifySaleVoid(input: {
  locationId: string;
  voucherCode: string;
  totalAmount: number;
  items: TelegramQtyLine[];
}) {
  voidNotifyBusiness(input.locationId, [
    tgTitle("🚫", "SALE VOID"),
    escapeHtml(input.voucherCode),
    `Total: ${formatEtb(input.totalAmount)}`,
    "Stock restored",
    `Items: ${input.items.length}`,
    ...formatItemListLines(input.items),
  ]);
}

export function voidNotifySaleDelete(input: {
  locationId: string;
  voucherCode: string;
  totalAmount: number;
  items: TelegramQtyLine[];
}) {
  voidNotifyBusiness(input.locationId, [
    tgTitle("🗑", "SALE DELETE"),
    escapeHtml(input.voucherCode),
    `Total: ${formatEtb(input.totalAmount)}`,
    "Stock and payments restored",
    `Items: ${input.items.length}`,
    ...formatItemListLines(input.items),
  ]);
}

export function voidNotifySaleReturn(input: {
  locationId: string;
  returnNumber: string;
  voucherCode: string;
  totalAmount: number;
  refundMethod: string;
  bankAccountName?: string | null;
  reason: string;
  items: TelegramQtyLine[];
}) {
  const method = formatMethodWithBank(input.refundMethod, input.bankAccountName);
  voidNotifyBusiness(input.locationId, [
    tgTitle("↩️", "SALE RETURN"),
    escapeHtml(input.returnNumber),
    `Sale: ${escapeHtml(input.voucherCode)}`,
    `Refund: ${formatEtb(input.totalAmount)} · ${escapeHtml(method)}`,
    `Reason: ${escapeHtml(input.reason)}`,
    `Items: ${input.items.length}`,
    ...formatItemListLines(input.items),
  ]);
}

export function voidNotifyPurchaseDelete(input: {
  locationId: string;
  invoiceNo: string;
  totalAmount: number;
  items: TelegramQtyLine[];
}) {
  voidNotifyBusiness(input.locationId, [
    tgTitle("🗑", "PURCHASE DELETE"),
    escapeHtml(input.invoiceNo),
    `Total: ${formatEtb(input.totalAmount)}`,
    "Stock and payments reversed",
    `Items: ${input.items.length}`,
    ...formatItemListLines(input.items),
  ]);
}

export function voidNotifyPurchaseReturn(input: {
  locationId: string;
  returnNumber: string;
  invoiceNo: string;
  totalAmount: number;
  refundMethod: string;
  bankAccountName?: string | null;
  reason: string;
  items: TelegramQtyLine[];
}) {
  const method = formatMethodWithBank(input.refundMethod, input.bankAccountName);
  voidNotifyBusiness(input.locationId, [
    tgTitle("↩️", "PURCHASE RETURN"),
    escapeHtml(input.returnNumber),
    `Purchase: ${escapeHtml(input.invoiceNo)}`,
    `Value: ${formatEtb(input.totalAmount)} · ${escapeHtml(method)}`,
    `Reason: ${escapeHtml(input.reason)}`,
    `Items: ${input.items.length}`,
    ...formatItemListLines(input.items),
  ]);
}

export function voidNotifyDisposal(input: {
  locationId: string;
  itemName: string;
  itemCode?: string | null;
  batchCode?: string | null;
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  loss: number;
  reason: string;
}) {
  const label = formatTelegramItemLabel(
    { name: input.itemName, code: input.itemCode || undefined, locationId: input.locationId },
    input.locationId,
  );
  voidNotifyBusiness(input.locationId, [
    tgTitle("🗑", "DISPOSAL"),
    escapeHtml(label),
    input.batchCode ? `Batch: ${escapeHtml(input.batchCode)}` : "",
    `Qty: ${formatQty(input.beforeQuantity)} → ${formatQty(input.afterQuantity)} (−${formatQty(input.quantity)})`,
    `Loss: ${formatEtb(input.loss)}`,
    `Reason: ${escapeHtml(input.reason)}`,
  ].filter(Boolean));
}

function sectionWithItems(emoji: string, label: string, items: TelegramQtyLine[]) {
  const list = formatItemListLines(items);
  const title = tgTitle(emoji, label);
  return list.length ? [title, ...list] : [title];
}

function money(n: number) {
  return formatEtb(Number(n || 0));
}

const DAILY_OVERVIEW_SETTING_KEY = "telegram.dailyOverview";

/** One report per pharmacy per business day, even if cron and the local timer both fire. */
async function claimDailyOverview(locationId: string, label: string) {
  const where = { locationId_key: { locationId, key: DAILY_OVERVIEW_SETTING_KEY } };
  const existing = await prisma.setting.findUnique({ where, select: { value: true } });
  if (existing?.value === label) return false;

  if (!existing) {
    try {
      await prisma.setting.create({
        data: { locationId, key: DAILY_OVERVIEW_SETTING_KEY, value: label },
      });
      return true;
    } catch (error) {
      const again = await prisma.setting.findUnique({ where, select: { value: true } });
      if (again?.value === label) return false;
      throw error;
    }
  }

  const updated = await prisma.setting.updateMany({
    where: { locationId, key: DAILY_OVERVIEW_SETTING_KEY, NOT: { value: label } },
    data: { value: label },
  });
  return updated.count === 1;
}

async function releaseDailyOverview(locationId: string, label: string) {
  await prisma.setting.updateMany({
    where: { locationId, key: DAILY_OVERVIEW_SETTING_KEY, value: label },
    data: { value: "" },
  });
}

export async function sendDailyOverviews(now = new Date()) {
  // 00:00 → 22:00 EAT so the 10pm cron includes all work done that day up to report time.
  const { start, end, label } = eatReportBounds(now);
  const businesses = await prisma.location.findMany({
    where: { isActive: true, type: "BUSINESS" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // One row per pharmacy. Counter and store bins share that pharmacy and must not send a second report.
  const byId = new Map<string, { id: string; name: string }>();
  for (const business of businesses) {
    const id = tenantBusinessId(business.id);
    if (!id || isStoreLocationId(id)) continue;
    if (!byId.has(id)) byId.set(id, { id, name: business.name });
  }
  for (const entry of BUSINESSES) {
    if (!byId.has(entry.id)) byId.set(entry.id, { id: entry.id, name: entry.name });
  }
  const targets = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));

  const results: Array<{ businessId: string; name: string; sent: boolean; error?: string; skipped?: string }> = [];

  for (const business of targets) {
    const location = await prisma.location.findUnique({
      where: { id: business.id },
      select: { id: true },
    });
    if (!location) {
      results.push({ businessId: business.id, name: business.name, sent: false, skipped: "Pharmacy is not in the database." });
      continue;
    }

    const bins = [business.id, `${business.id}-store`];
    // Match business date OR createdAt so stale saleDate drafts still count on the day they were done.
    const saleWhere = {
      locationId: business.id,
      OR: [{ saleDate: { gte: start, lt: end } }, { createdAt: { gte: start, lt: end } }],
    };
    const purchaseWhere = {
      locationId: business.id,
      OR: [{ purchaseDate: { gte: start, lt: end } }, { createdAt: { gte: start, lt: end } }],
    };
    const transferWhere = {
      OR: [{ sourceLocationId: { in: bins } }, { destinationLocationId: { in: bins } }],
      AND: [
        {
          OR: [{ transferDate: { gte: start, lt: end } }, { createdAt: { gte: start, lt: end } }],
        },
      ],
    };
    const adjustmentWhere = {
      locationId: { in: bins },
      type: "ADJUSTMENT" as const,
      createdAt: { gte: start, lt: end },
    };
    const damageWhere = {
      locationId: { in: bins },
      type: "DAMAGE" as const,
      createdAt: { gte: start, lt: end },
    };
    const expenseWhere = {
      locationId: business.id,
      OR: [{ expenseDate: { gte: start, lt: end } }, { createdAt: { gte: start, lt: end } }],
    };
    const customerPaymentWhere = {
      locationId: business.id,
      OR: [{ paymentDate: { gte: start, lt: end } }, { createdAt: { gte: start, lt: end } }],
    };
    const supplierPaymentWhere = {
      locationId: business.id,
      OR: [{ paymentDate: { gte: start, lt: end } }, { createdAt: { gte: start, lt: end } }],
    };
    const bankTxWhere = {
      locationId: business.id,
      OR: [{ transactionDate: { gte: start, lt: end } }, { createdAt: { gte: start, lt: end } }],
    };

    const [
      salesAgg,
      purchaseAgg,
      transferCount,
      adjustmentCount,
      damageCount,
      saleItems,
      purchaseItems,
      transferItems,
      adjustmentItems,
      damageItems,
      expenses,
      customerPayments,
      supplierPayments,
      bankTxs,
      bankAccounts,
    ] = await Promise.all([
      prisma.sale.aggregate({
        where: saleWhere,
        _count: { _all: true },
        _sum: { totalAmount: true, cashAmount: true, bankAmount: true, creditAmount: true },
      }),
      prisma.purchase.aggregate({
        where: purchaseWhere,
        _count: { _all: true },
        _sum: { totalAmount: true, paidAmount: true, debtAmount: true },
      }),
      prisma.transfer.count({ where: transferWhere }),
      prisma.inventoryMovement.count({ where: adjustmentWhere }),
      prisma.inventoryMovement.count({ where: damageWhere }),
      prisma.saleItem.findMany({
        where: { sale: saleWhere },
        select: {
          quantity: true,
          buyingPrice: true,
          totalAmount: true,
          item: { select: { name: true, code: true, locationId: true } },
        },
      }),
      prisma.purchaseItem.findMany({
        where: { purchase: purchaseWhere },
        select: { quantity: true, item: { select: { name: true, code: true, locationId: true } } },
      }),
      prisma.transferItem.findMany({
        where: { transfer: transferWhere },
        select: { quantity: true, item: { select: { name: true, code: true, locationId: true } } },
      }),
      prisma.inventoryMovement.findMany({
        where: adjustmentWhere,
        select: { quantity: true, item: { select: { name: true, code: true, locationId: true } } },
      }),
      prisma.inventoryMovement.findMany({
        where: damageWhere,
        select: { quantity: true, item: { select: { name: true, code: true, locationId: true } } },
      }),
      prisma.expense.findMany({
        where: expenseWhere,
        select: { amount: true, paymentMethod: true, name: true },
      }),
      prisma.customerPayment.findMany({
        where: customerPaymentWhere,
        select: {
          amount: true,
          paymentMethod: true,
          bankAccountId: true,
          customer: { select: { id: true, name: true } },
          sale: { select: { voucherCode: true } },
        },
        orderBy: { paymentDate: "asc" },
      }),
      prisma.supplierPayment.findMany({
        where: supplierPaymentWhere,
        select: { amount: true, paymentMethod: true },
      }),
      prisma.bankTransaction.findMany({
        where: bankTxWhere,
        select: {
          amount: true,
          type: true,
          bankAccount: { select: { displayName: true, accountType: true } },
        },
      }),
      prisma.bankAccount.findMany({
        where: { locationId: business.id, isActive: true },
        select: { id: true, displayName: true, bankName: true },
      }),
    ]);

    const salesTotal = Number(salesAgg._sum.totalAmount || 0);
    const salesCash = Number(salesAgg._sum.cashAmount || 0);
    const salesBank = Number(salesAgg._sum.bankAmount || 0);
    const salesCredit = Number(salesAgg._sum.creditAmount || 0);
    const purchaseTotal = Number(purchaseAgg._sum.totalAmount || 0);
    const purchasePaid = Number(purchaseAgg._sum.paidAmount || 0);
    const purchaseDebt = Number(purchaseAgg._sum.debtAmount || 0);

    const cogs = saleItems.reduce(
      (sum, row) => sum + Number(row.buyingPrice || 0) * Number(row.quantity || 0),
      0,
    );
    const grossProfit = salesTotal - cogs;

    const expenseCash = expenses
      .filter((row) => String(row.paymentMethod || "").toUpperCase() === "CASH")
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const expenseBank = expenses
      .filter((row) => String(row.paymentMethod || "").toUpperCase() === "BANK")
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const expenseTotal = expenseCash + expenseBank;

    const custCash = customerPayments
      .filter((row) => String(row.paymentMethod || "").toUpperCase() === "CASH")
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const custBank = customerPayments
      .filter((row) => String(row.paymentMethod || "").toUpperCase() === "BANK")
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const custTotal = custCash + custBank;

    // Outstanding credit still owed (ledger: credit sales − allocations/payments).
    const [creditSales, allCreditPayments] = await Promise.all([
      prisma.sale.findMany({
        where: { locationId: business.id, creditAmount: { gt: 0 } },
        select: {
          id: true,
          customerId: true,
          creditAmount: true,
          saleDate: true,
          createdAt: true,
          customer: { select: { name: true } },
        },
      }),
      prisma.customerPayment.findMany({
        where: { locationId: business.id },
        select: {
          id: true,
          customerId: true,
          saleId: true,
          amount: true,
          allocations: { select: { paymentId: true, saleId: true, amount: true } },
        },
      }),
    ]);
    const creditAllocations = allCreditPayments.flatMap((payment) =>
      (payment.allocations || []).map((allocation) => ({
        paymentId: allocation.paymentId || payment.id,
        saleId: allocation.saleId,
        amount: Number(allocation.amount || 0),
      })),
    );
    const unpaidCredit = listCreditSales(
      creditSales.map((sale) => ({
        id: sale.id,
        customerId: sale.customerId,
        creditAmount: Number(sale.creditAmount || 0),
        saleDate: sale.saleDate,
        createdAt: sale.createdAt,
      })),
      allCreditPayments.map((payment) => ({
        id: payment.id,
        customerId: payment.customerId,
        saleId: payment.saleId,
        amount: Number(payment.amount || 0),
      })),
      creditAllocations,
    ).filter((sale) => sale.outstandingAmount > 0);

    let outstandingCreditTotal = 0;
    const outstandingByCustomer = new Map<string, { name: string; amount: number }>();
    const customerNameById = new Map(
      creditSales.map((sale) => [
        sale.customerId || "",
        String(sale.customer?.name || "Customer").trim() || "Customer",
      ]),
    );
    for (const sale of unpaidCredit) {
      outstandingCreditTotal += sale.outstandingAmount;
      const current = outstandingByCustomer.get(sale.customerId) || {
        name: customerNameById.get(sale.customerId) || "Customer",
        amount: 0,
      };
      current.amount += sale.outstandingAmount;
      outstandingByCustomer.set(sale.customerId, current);
    }

    const bankAccountById = new Map(
      bankAccounts.map((account) => [account.id, account] as const),
    );
    const creditPaymentLines = customerPayments.slice(0, 20).map((row) => {
      const name = String(row.customer?.name || "Customer").trim() || "Customer";
      const method = String(row.paymentMethod || "").toUpperCase() || "—";
      const bankLabel = formatBankAccountLabel(
        row.bankAccountId ? bankAccountById.get(row.bankAccountId) : null,
      );
      const methodLabel = formatMethodWithBank(method, bankLabel);
      const voucher = row.sale?.voucherCode ? ` · ${escapeHtml(row.sale.voucherCode)}` : "";
      const customerId = row.customer?.id || "";
      const left = customerId ? outstandingByCustomer.get(customerId)?.amount ?? 0 : 0;
      return `• ${escapeHtml(name)}: paid ${money(Number(row.amount || 0))} (${escapeHtml(methodLabel)})${voucher} · left ${money(left)}`;
    });
    if (customerPayments.length > 20) {
      creditPaymentLines.push(`• +${customerPayments.length - 20} more payments`);
    }

    const suppCash = supplierPayments
      .filter((row) => String(row.paymentMethod || "").toUpperCase() === "CASH")
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const suppBank = supplierPayments
      .filter((row) => String(row.paymentMethod || "").toUpperCase() === "BANK")
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);

    // Purchase-time bank payments are stored as BankTransaction (SUPPLIER_PAYMENT).
    const purchaseBankTx = bankTxs
      .filter((row) => String(row.type || "").toUpperCase() === "SUPPLIER_PAYMENT")
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    // Cash paid at purchase time ≈ paidAmount minus bank txs (supplier settlements counted separately).
    const purchaseCashAtBuy = Math.max(0, purchasePaid - purchaseBankTx);
    const purchaseBankAtBuy = Math.max(0, purchaseBankTx - suppBank);

    const cashIn = salesCash + custCash;
    const bankIn = salesBank + custBank;
    const cashOut = expenseCash + suppCash + purchaseCashAtBuy;
    const bankOut = expenseBank + suppBank + purchaseBankAtBuy;
    const netProfit = grossProfit - expenseTotal;

    const bankByAccount = new Map<string, { in: number; out: number }>();
    for (const tx of bankTxs) {
      if (String(tx.bankAccount.accountType || "").toUpperCase() === "CASH") continue;
      const name = String(tx.bankAccount.displayName || "Bank").trim() || "Bank";
      const current = bankByAccount.get(name) || { in: 0, out: 0 };
      const amount = Number(tx.amount || 0);
      const type = String(tx.type || "").toUpperCase();
      if (type === "SALE_PAYMENT" || type === "DEPOSIT" || type === "CASH_TO_BANK") {
        current.in += amount;
      } else {
        current.out += amount;
      }
      bankByAccount.set(name, current);
    }
    const bankAccountLines = [...bankByAccount.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, flow]) => {
        const net = flow.in - flow.out;
        const netLabel = net >= 0 ? `+${money(net)}` : money(net);
        return `• ${escapeHtml(name)}: in ${money(flow.in)} · out ${money(flow.out)} · net ${netLabel}`;
      });

    const saleLines = saleItems.map((row) => ({
      name: formatTelegramItemLabel(row.item, business.id),
      qty: row.quantity,
    }));
    const purchaseLines = purchaseItems.map((row) => ({
      name: formatTelegramItemLabel(row.item, business.id),
      qty: row.quantity,
    }));
    const transferLines = transferItems.map((row) => ({
      name: formatTelegramItemLabel(row.item, business.id),
      qty: row.quantity,
    }));
    const adjustmentLines = adjustmentItems.map((row) => ({
      name: formatTelegramItemLabel(row.item, business.id),
      qty: row.quantity,
    }));
    const damageLines = damageItems.map((row) => ({
      name: formatTelegramItemLabel(row.item, business.id),
      qty: Math.abs(Number(row.quantity || 0)),
    }));

    const financeLines = [
      tgTitle("💰", "FINANCE"),
      `In: cash ${money(cashIn)} · bank ${money(bankIn)}`,
      `Out: cash ${money(cashOut)} · bank ${money(bankOut)}`,
      `Sales: cash ${money(salesCash)} · bank ${money(salesBank)} · credit ${money(salesCredit)}`,
      `Credit collections: ${customerPayments.length} · ${money(custTotal)} (cash ${money(custCash)} · bank ${money(custBank)})`,
      `Credit still owed: ${money(outstandingCreditTotal)}`,
      `Purchases paid ${money(purchasePaid)} · debt ${money(purchaseDebt)}`,
      `Supplier paid: cash ${money(suppCash)} · bank ${money(suppBank)}`,
      `COGS ${money(cogs)} · Gross profit ${money(grossProfit)}`,
      `Expenses ${money(expenseTotal)} (cash ${money(expenseCash)} · bank ${money(expenseBank)})`,
      `Net profit ${money(netProfit)}`,
    ];
    if (creditPaymentLines.length) {
      financeLines.push(tgTitle("💳", "CREDIT PAYMENTS"), ...creditPaymentLines);
    }
    if (bankAccountLines.length) {
      financeLines.push(tgTitle("🏦", "BANKS"), ...bankAccountLines);
    }

    const claimed = await claimDailyOverview(business.id, label);
    if (!claimed) {
      results.push({ businessId: business.id, name: business.name, sent: false, skipped: "Already sent for this day." });
      continue;
    }

    let result: Awaited<ReturnType<typeof notifyBusiness>>;
    try {
      result = await notifyBusiness(business.id, [
        tgTitle("📊", `DAILY · ${label}`),
        ...sectionWithItems("🟢", `SALES · ${salesAgg._count._all} · ${money(salesTotal)}`, saleLines),
        ...sectionWithItems("🔵", `PURCHASES · ${purchaseAgg._count._all} · ${money(purchaseTotal)}`, purchaseLines),
        ...sectionWithItems("🔄", `TRANSFERS · ${transferCount}`, transferLines),
        ...sectionWithItems("🛠", `ADJUSTMENTS · ${adjustmentCount}`, adjustmentLines),
        ...sectionWithItems("🗑", `DAMAGE · ${damageCount}`, damageLines),
        ...financeLines,
      ]);
    } catch (error) {
      await releaseDailyOverview(business.id, label);
      throw error;
    }
    if (!result.ok) await releaseDailyOverview(business.id, label);
    results.push({
      businessId: business.id,
      name: business.name,
      sent: result.ok,
      error: result.error,
      skipped: result.skipped,
    });
  }

  return results;
}

let dailySchedulerStarted = false;
let lastDailyOverviewLabel = "";

/** Local/dev fallback: Vercel cron does not run on localhost. */
export function startDailyOverviewScheduler() {
  // Production uses the Vercel cron. Starting this timer there sends the 10pm report a second time.
  if (process.env.VERCEL) return;
  if (dailySchedulerStarted) return;
  if (typeof setInterval !== "function") return;
  dailySchedulerStarted = true;

  const tick = async () => {
    try {
      const now = new Date();
      const { label, eatHour, eatMinute } = eatDayBounds(now);
      // Fire in the first 2 minutes of 10:00 PM EAT.
      if (eatHour !== 22 || eatMinute > 1) return;
      if (lastDailyOverviewLabel === label) return;
      lastDailyOverviewLabel = label;
      console.log(`[telegram] Sending daily overview for ${label} (local scheduler)`);
      await sendDailyOverviews(now);
    } catch (error) {
      console.error("[telegram] Daily overview scheduler failed:", error);
    }
  };

  void tick();
  setInterval(() => {
    void tick();
  }, 30_000);
}
