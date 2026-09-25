"use client";

import React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowUpRight, Calendar, Edit3, Landmark, MapPin, ReceiptText, Trash2, X } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { buildLedgerTransactions, movementSummary } from "@/lib/finance-ledger";
import { AppModal } from "@/components/app-modal";
import { NumericInput } from "@/components/numeric-input";
import { formatCurrency } from "@/lib/utils";
import { useAppData } from "@/lib/client/useAppData";

export default function BankAccountDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const state = useAppData();
  const account = state.bankAccounts.find((entry) => entry.id === params.id);
  const ledger = buildLedgerTransactions(state);
  const transactions = account ? ledger.filter((tx) => tx.accountId === account.id) : [];
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(15);
  const [editing, setEditing] = React.useState(false);
  const [formData, setFormData] = React.useState({
    displayName: account?.displayName || "",
    bankName: account?.bankName || "",
    accountNumber: account?.accountNumber || "",
    openingBalance: String(account?.currentBalance || 0),
  });

  React.useEffect(() => {
    if (!account) return;
    setFormData({
      displayName: account.displayName,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      openingBalance: String(account.currentBalance),
    });
  }, [account]);

  if (!account) {
    return (
      <div className="mx-auto flex max-w-3xl items-start justify-between gap-3">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Account not found</h1>
        <BackButton href="/finance/banks" />
      </div>
    );
  }

  const canDelete = account.accountType !== "CASH" && transactions.length === 0;
  const summary = movementSummary(transactions, account.currentBalance);
  const openingBalance = summary.openingBalance;
  const inflow = summary.totalInflow;
  const outflow = summary.totalOutflow;
  const netMovement = summary.netMovement;
  const balance = summary.availableBalance;
  const totalPages = Math.max(1, Math.ceil(transactions.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedTransactions = transactions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const saveAccount = () => {
    const displayName = formData.displayName.trim();
    const bankName = formData.bankName.trim();
    const accountNumber = formData.accountNumber.trim();
    const currentBalance = Number(formData.openingBalance.replace(/,/g, "")) || 0;
    if (!displayName || !bankName || !accountNumber) return;

    state.updateBankAccount({
      ...account,
      displayName,
      bankName,
      accountNumber,
      currentBalance,
    });
    setEditing(false);
  };

  const deleteAccount = () => {
    if (!canDelete) return;
    state.deleteBankAccount(account.id);
    router.push("/finance/banks");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="page-heading">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-600">Account Details</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 dark:text-white">{account.displayName}</h1>
            <p className="text-sm font-black uppercase tracking-widest text-slate-500">{account.bankName}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <BackButton href="/finance/banks" />
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-900/20"
          >
            <Edit3 className="h-4 w-4" />
            Edit
          </button>
          <button
            type="button"
            disabled={!canDelete}
            onClick={deleteAccount}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 px-5 text-xs font-black uppercase tracking-widest text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent dark:border-rose-900/50 dark:hover:bg-rose-950/30"
            title={canDelete ? "Delete unused account" : "Only unused bank accounts can be deleted"}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <SummaryCard label="Available Balance" value={formatCurrency(balance)} />
        <SummaryCard label="Transactions" value={String(transactions.length)} />
        <SummaryCard label="Account Type" value={account.accountType === "CASH" ? "Cash" : "Bank"} />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-950/40">
            <Landmark className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-950 dark:text-white">Account Profile</h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Global account record</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InfoRow label="Display Name" value={account.displayName} />
          <InfoRow label="Bank Name" value={account.bankName} />
          <InfoRow label="Account Number" value={account.accountNumber} />
          <InfoRow label="Delete Status" value={canDelete ? "Unused, can delete" : "Protected or used"} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-black text-slate-950 dark:text-white">Movement Summary</h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Current account totals</p>
          <div className="mt-5 space-y-3">
            <InfoRow label="Opening Balance" value={formatCurrency(openingBalance)} />
            <InfoRow label="Total Inflow" value={formatCurrency(inflow)} />
            <InfoRow label="Total Outflow" value={formatCurrency(outflow)} />
            <InfoRow label="Net Movement" value={formatCurrency(netMovement)} />
            <InfoRow label="Available Balance" value={formatCurrency(balance)} />
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-slate-100 p-6 dark:border-zinc-800">
            <h2 className="text-lg font-black text-slate-950 dark:text-white">Recent Activity</h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sales, purchases, deposits, and withdrawals</p>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-zinc-800">
            {transactions.length === 0 ? (
              <p className="p-8 text-center text-xs font-black uppercase tracking-widest text-slate-500">No activity yet</p>
            ) : pagedTransactions.map((tx) => (
              <div key={tx.id} className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:bg-zinc-800">
                      {tx.type}
                    </span>
                    <p className="truncate text-sm font-black uppercase text-slate-950 dark:text-white">{tx.category}</p>
                  </div>
                  <p className="text-xs font-bold text-slate-500">{tx.description}</p>
                  <div className="flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(tx.date).toLocaleDateString()}</span>
                    <span className="inline-flex items-center gap-1"><Landmark className="h-3 w-3" />{tx.method}</span>
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{tx.locationId}</span>
                    <span className="inline-flex items-center gap-1"><ReceiptText className="h-3 w-3" />{tx.sourceId}</span>
                  </div>
                  <ActivityLink tx={tx} />
                </div>
                <div className="flex items-center justify-between gap-4 md:flex-col md:items-end">
                  <p className={amountClass(tx.type)}>{tx.type === "EXPENSE" ? "-" : tx.type === "INCOME" ? "+" : ""}{formatCurrency(tx.amount)}</p>
                </div>
              </div>
            ))}
          </div>
          {transactions.length > 0 ? (
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-zinc-800">
              <span>Page {currentPage} of {totalPages}</span>
              <div className="flex items-center gap-2">
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-[10px] font-black uppercase tracking-widest outline-none dark:border-zinc-800 dark:bg-zinc-950"
                >
                  {[10, 15, 25, 50].map((size) => (
                    <option key={size} value={size}>{size} / page</option>
                  ))}
                </select>
                <button type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40 dark:border-zinc-800">Prev</button>
                <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40 dark:border-zinc-800">Next</button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {editing ? (
        <AppModal open onClose={() => setEditing(false)} labelledBy="edit-account-title">
          <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-zinc-800">
            <h2 id="edit-account-title" className="text-lg font-black text-slate-950 dark:text-white">Edit Account</h2>
            <button type="button" onClick={() => setEditing(false)} className="rounded-full p-2 text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-800">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-4 p-5">
            <AccountInput autoFocus label="Display Name" value={formData.displayName} onChange={(value) => setFormData({ ...formData, displayName: value })} />
            <AccountInput label="Bank Name" value={formData.bankName} onChange={(value) => setFormData({ ...formData, bankName: value })} />
            <AccountInput label="Account Number" value={formData.accountNumber} onChange={(value) => setFormData({ ...formData, accountNumber: value })} />
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">Opening Balance</label>
              <NumericInput
                value={formData.openingBalance}
                onValueChange={(value) => setFormData({ ...formData, openingBalance: String(value) })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-900"
              />
            </div>
          </div>
          <div className="flex gap-3 bg-slate-50 p-5 dark:bg-zinc-900/60">
            <button type="button" onClick={() => setEditing(false)} className="btn-cancel h-11 flex-1">Cancel</button>
            <button type="button" onClick={saveAccount} className="h-11 flex-1 rounded-xl bg-indigo-600 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-900/20">Save</button>
          </div>
        </AppModal>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 dark:bg-zinc-950">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function AccountInput({
  label,
  value,
  onChange,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</label>
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-900"
      />
    </div>
  );
}

function ActivityLink({ tx }: { tx: ReturnType<typeof buildLedgerTransactions>[number] }) {
  const href = tx.category === "Sale"
    ? `/sales/${tx.sourceId}`
    : tx.category === "Purchase"
      ? `/purchases/${tx.sourceId}`
      : tx.category === "Cash Deposit"
        ? "/finance/cash-to-bank"
        : tx.category === "Expense"
          ? "/finance/expenses"
          : "";

  if (!href) return null;

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-600 transition hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50"
    >
      See Details
      <ArrowUpRight className="h-3 w-3" />
    </Link>
  );
}

function amountClass(type: "INCOME" | "EXPENSE" | "TRANSFER") {
  if (type === "INCOME") return "shrink-0 text-lg font-black text-emerald-600";
  if (type === "EXPENSE") return "shrink-0 text-lg font-black text-rose-600";
  return "shrink-0 text-lg font-black text-blue-600";
}
