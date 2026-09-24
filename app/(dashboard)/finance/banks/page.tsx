"use client";

import React from "react";
import { ArrowUpRight, CreditCard, Edit3, Landmark, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { buildLedgerTransactions, movementSummary } from "@/lib/finance-ledger";
import { AppModal } from "@/components/app-modal";
import { NumericInput } from "@/components/numeric-input";
import { isTenantBusiness, locationsForCurrentBusiness } from "@/lib/businesses";
import { formatCurrency } from "@/lib/utils";
import { calculateLocationCashBalance, useAppData } from "@/lib/client/useAppData";
import { useCan } from "@/lib/client/useCan";

export default function BankAccountsPage() {
  const state = useAppData();
  const can = useCan();
  const ledger = buildLedgerTransactions(state);
  const [selectedAccountId, setSelectedAccountId] = React.useState<string | null>(null);
  const [editingAccountId, setEditingAccountId] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState({
    displayName: "",
    bankName: "",
    accountNumber: "",
    openingBalance: "0",
    accountType: "BANK",
  });

  const transactionsFor = (accountId: string) => ledger.filter((tx) => tx.accountId === accountId);
  const balanceFor = (accountId: string, fallbackBalance: number) =>
    movementSummary(transactionsFor(accountId), fallbackBalance).availableBalance;
  const selectedAccount = selectedAccountId
    ? state.bankAccounts.find((account) => account.id === selectedAccountId) || null
    : null;
  const selectedTransactions = selectedAccount ? transactionsFor(selectedAccount.id) : [];
  const cashLocations = locationsForCurrentBusiness(state.currentLocation, state.locations).filter(isTenantBusiness);
  const cashLocationBalances = cashLocations.map((location) => ({
    ...location,
    balance: calculateLocationCashBalance(state, location.id),
  }));
  const cashLocationTotal = cashLocationBalances.reduce((sum, location) => sum + location.balance, 0);
  const cashAccounts = state.bankAccounts.filter((account) => account.accountType === "CASH");
  const bankOnlyAccounts = state.bankAccounts.filter((account) => account.accountType !== "CASH");
  const displayedBalanceFor = (account: typeof state.bankAccounts[number]) =>
    account.accountType === "CASH" ? cashLocationTotal : balanceFor(account.id, account.currentBalance);

  const openEditor = (account?: typeof state.bankAccounts[number]) => {
    setEditingAccountId(account?.id || "new");
    setFormData({
      displayName: account?.displayName || "",
      bankName: account?.bankName || "",
      accountNumber: account?.accountNumber || "",
      openingBalance: String(account?.currentBalance || 0),
      accountType: account?.accountType === "MOBILE" ? "MOBILE" : "BANK",
    });
  };

  const closeEditor = () => setEditingAccountId(null);

  const saveAccount = async () => {
    const displayName = formData.displayName.trim();
    const bankName = formData.bankName.trim();
    const accountNumber = formData.accountNumber.trim();
    const currentBalance = Number(formData.openingBalance.replace(/,/g, "")) || 0;

    if (!displayName || !bankName || !accountNumber) return;

    if (editingAccountId === "new") {
      await state.addBankAccount({
        displayName,
        bankName,
        accountNumber,
        currentBalance,
        accountType: formData.accountType === "MOBILE" ? "MOBILE" : "BANK",
      });
    } else {
      const account = state.bankAccounts.find((entry) => entry.id === editingAccountId);
      if (!account) return;
      await state.updateBankAccount({
        ...account,
        displayName,
        bankName,
        accountNumber,
        currentBalance,
      });
    }
    closeEditor();
  };

  const deleteAccount = (accountId: string) => {
    const account = state.bankAccounts.find((entry) => entry.id === accountId);
    if (!account || account.accountType === "CASH" || transactionsFor(accountId).length > 0) return;
    state.deleteBankAccount(accountId);
    if (selectedAccountId === accountId) setSelectedAccountId(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="page-heading">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl lg:text-3xl">
            <CreditCard className="h-5 w-5 shrink-0 text-indigo-600 sm:h-7 sm:w-7" />
            Bank & Cash Accounts
          </h1>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">Manage your business bank accounts and internal cash drawers.</p>
        </div>
        {can("finance.banks.create") ? (
          <button
            type="button"
            onClick={() => openEditor()}
            className="page-action gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-900/20 transition-all hover:bg-indigo-500 active:scale-95 sm:text-sm"
          >
            <Plus className="h-4 w-4" /> Add Account
          </button>
        ) : null}
      </div>

      <section className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm dark:border-indigo-950/50 dark:bg-zinc-900">
        <div className="flex flex-col items-end gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 w-full sm:w-auto">
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Cash Balance Center</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 dark:text-white">{formatCurrency(cashLocationTotal)}</h2>
            <p className="mt-1 text-xs font-bold text-slate-500">
              {state.currentLocation?.name || "Current business"} cash drawer only.
            </p>
          </div>
          {can("finance.cash_to_bank.create") ? (
            <Link
              href="/finance/cash-to-bank"
              className="page-action h-11 gap-2 self-end rounded-xl bg-indigo-600 px-5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-900/20 transition hover:bg-indigo-500"
            >
              Deposit Cash to Bank
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {cashLocationBalances.map((location) => {
            const cashAccount = cashAccounts.find((account) => account.locationId === location.id) || cashAccounts[0];
            return (
            <div key={location.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-sm font-black text-slate-950 dark:text-white">{location.name}</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Cash drawer</p>
              <p className="mt-3 text-xl font-black text-slate-950 dark:text-white">{formatCurrency(location.balance)}</p>
              {cashAccount ? (
                <Link
                  href={`/finance/banks/${cashAccount.id}`}
                  className="mt-3 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-indigo-600"
                >
                  Details <ArrowUpRight className="h-3 w-3" />
                </Link>
              ) : null}
            </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {bankOnlyAccounts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs font-black uppercase tracking-widest text-slate-500 dark:border-zinc-800 dark:bg-zinc-900">
            No bank accounts for this business yet
          </div>
        ) : null}
        {bankOnlyAccounts.map((account) => {
          const currentBalance = displayedBalanceFor(account);
          const transactionCount = transactionsFor(account.id).length;
          const canDelete = can("finance.banks.delete") && account.accountType !== "CASH" && transactionCount === 0;

          return (
            <div key={account.id} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
              <div className="absolute right-0 top-0 p-4 opacity-5 transition-opacity group-hover:opacity-10">
                <Landmark className="h-20 w-20" />
              </div>

              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-900/20">
                  <Landmark className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{account.displayName}</h4>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300">
                    {account.accountType === "MOBILE" ? "Mobile money" : "Bank"} · {account.bankName}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300">Available Balance</p>
                <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{formatCurrency(currentBalance)}</h2>
              </div>

              <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-zinc-800">
                <span className="text-[10px] font-mono text-slate-400">{account.accountNumber}</span>
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/finance/banks/${account.id}`}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold text-indigo-600 transition hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                  >
                    Details <ArrowUpRight className="h-3 w-3" />
                  </Link>
                  {can("finance.banks.update") ? (
                    <button
                      type="button"
                      onClick={() => openEditor(account)}
                      className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                      aria-label={`Edit ${account.displayName}`}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={!canDelete}
                    onClick={() => deleteAccount(account.id)}
                    className="rounded-lg p-1.5 text-rose-500 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent dark:hover:bg-rose-950/30"
                    title={canDelete ? "Delete unused account" : "Only unused bank accounts can be deleted"}
                    aria-label={`Delete ${account.displayName}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedAccount ? (
        <div className="fixed inset-0 z-[100] flex justify-end bg-slate-950/35 backdrop-blur-sm pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
          <div className="h-full max-h-dvh w-full max-w-lg overflow-y-auto overscroll-contain bg-white p-6 shadow-2xl dark:bg-zinc-950">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Account Details</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{selectedAccount.displayName}</h2>
                <p className="text-sm font-bold uppercase tracking-widest text-slate-500">{selectedAccount.bankName}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAccountId(null)}
                className="rounded-full p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-zinc-800 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <DetailStat label="Balance" value={formatCurrency(displayedBalanceFor(selectedAccount))} />
              <DetailStat label="Transactions" value={String(selectedTransactions.length)} />
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 p-4 dark:border-zinc-800">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Account Number</p>
              <p className="mt-1 text-sm font-black text-slate-900 dark:text-white">{selectedAccount.accountNumber}</p>
            </div>

            <div className="mt-6 flex gap-3">
              {can("finance.banks.update") ? (
                <button
                  type="button"
                  onClick={() => openEditor(selectedAccount)}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-900/20"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit
                </button>
              ) : null}
              {can("finance.banks.delete") ? (
              <button
                type="button"
                disabled={selectedAccount.accountType === "CASH" || selectedTransactions.length > 0}
                onClick={() => deleteAccount(selectedAccount.id)}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-rose-200 text-xs font-black uppercase tracking-widest text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent dark:border-rose-900/50 dark:hover:bg-rose-950/30"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
              ) : null}
            </div>

            <div className="mt-8">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Recent Activity</h3>
              <div className="mt-3 space-y-2">
                {selectedTransactions.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 p-4 text-xs font-bold text-slate-400 dark:bg-zinc-900">No activity yet. This account can be deleted.</p>
                ) : selectedTransactions.slice(0, 8).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-3 dark:bg-zinc-900">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black uppercase text-slate-900 dark:text-white">{tx.category}</p>
                      <p className="text-[10px] font-bold text-slate-400">{new Date(tx.date).toLocaleDateString()} - {tx.method}</p>
                    </div>
                    <p className={cnAmount(tx.type)}>{tx.type === "EXPENSE" ? "-" : tx.type === "INCOME" ? "+" : ""}{formatCurrency(tx.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editingAccountId ? (
        <AppModal open onClose={closeEditor} labelledBy="account-editor-title">
          <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-zinc-800">
            <h2 id="account-editor-title" className="text-lg font-black text-slate-950 dark:text-white">
              {editingAccountId === "new" ? "Add Account" : "Edit Account"}
            </h2>
            <button type="button" onClick={closeEditor} className="rounded-full p-2 text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-800">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-4 p-5">
            {editingAccountId === "new" ? (
              <label className="block space-y-1.5 text-[11px] font-black uppercase tracking-widest text-slate-500">
                Account type
                <select
                  value={formData.accountType}
                  onChange={(event) => setFormData({ ...formData, accountType: event.target.value })}
                  className="mt-1 block h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold normal-case text-slate-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                >
                  <option value="BANK">Bank</option>
                  <option value="MOBILE">Mobile money</option>
                </select>
              </label>
            ) : null}
            <AccountInput autoFocus label="Account Name" placeholder={formData.accountType === "MOBILE" ? "Telebirr shop" : "Main bank"} value={formData.displayName} onChange={(value) => setFormData({ ...formData, displayName: value })} />
            <AccountInput label={formData.accountType === "MOBILE" ? "Provider" : "Bank Name"} placeholder={formData.accountType === "MOBILE" ? "Telebirr" : "BOA"} value={formData.bankName} onChange={(value) => setFormData({ ...formData, bankName: value })} />
            <AccountInput label={formData.accountType === "MOBILE" ? "Phone / account" : "Account Number"} placeholder={formData.accountType === "MOBILE" ? "0911..." : "32456"} value={formData.accountNumber} onChange={(value) => setFormData({ ...formData, accountNumber: value })} />
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
            <button type="button" onClick={closeEditor} className="btn-cancel h-11 flex-1">Cancel</button>
            <button type="button" onClick={saveAccount} className="h-11 flex-1 rounded-xl bg-indigo-600 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-900/20">Save</button>
          </div>
        </AppModal>
      ) : null}
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 dark:bg-zinc-900">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function AccountInput({
  label,
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</label>
      <input
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none placeholder:font-medium placeholder:text-slate-400 focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-900"
      />
    </div>
  );
}

function cnAmount(type: "INCOME" | "EXPENSE" | "TRANSFER") {
  if (type === "INCOME") return "shrink-0 text-sm font-black text-emerald-600";
  if (type === "EXPENSE") return "shrink-0 text-sm font-black text-rose-600";
  return "shrink-0 text-sm font-black text-blue-600";
}
