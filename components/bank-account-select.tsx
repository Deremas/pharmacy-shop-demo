"use client";

import { SearchableSelect } from "@/components/searchable-select";
import { formatCurrency } from "@/lib/utils";

export type BankAccountOption = {
  id: string;
  displayName?: string;
  bankName?: string;
  accountNumber?: string;
  currentBalance?: number;
  accountType?: string;
};

export function bankAccountsOnly(accounts: BankAccountOption[] = []) {
  return accounts.filter((account) => String(account.accountType || "BANK").toUpperCase() !== "CASH");
}

export function needsBankAccount(method?: string, bankAmount = 0) {
  const paymentMethod = String(method || "").toUpperCase();
  return paymentMethod === "BANK" || (paymentMethod === "MIXED" && Number(bankAmount) > 0);
}

export function BankAccountSelect({
  value,
  onChange,
  accounts,
  placeholder = "Select bank or mobile money",
  emptyHint = "Add a bank or mobile money account in Finance first.",
}: {
  value: string;
  onChange: (value: string) => void;
  accounts: BankAccountOption[];
  placeholder?: string;
  emptyHint?: string;
}) {
  const options = bankAccountsOnly(accounts).map((account) => ({
    value: account.id,
    label: account.displayName || "Account",
    meta: `${account.accountType === "MOBILE" ? "Mobile money" : account.bankName || "Bank"}${account.accountNumber ? ` · ${account.accountNumber}` : ""} · ${formatCurrency(Number(account.currentBalance || 0))}`,
    searchText: `${account.displayName || ""} ${account.bankName || ""} ${account.accountNumber || ""}`,
  }));

  return (
    <div className="relative z-30 space-y-1.5 overflow-visible">
      <SearchableSelect
        value={value}
        onChange={onChange}
        placeholder={options.length ? placeholder : "No bank accounts"}
        options={options}
      />
      {options.length === 0 ? (
        <p className="text-[10px] font-semibold text-rose-600">{emptyHint}</p>
      ) : null}
    </div>
  );
}
