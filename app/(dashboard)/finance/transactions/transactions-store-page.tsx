"use client";

import { buildLedgerTransactions } from "@/lib/finance-ledger";
import { isTenantBusiness } from "@/lib/businesses";
import { useAppData } from "@/lib/client/useAppData";
import { TransactionsClient } from "./transactions-client";

export function TransactionsStorePage({ scope }: { scope: "LOCATION" | "ADMIN" }) {
  const state = useAppData();
  const source = scope === "ADMIN" ? (state.reportData || state) : state;
  const locationOptions = scope === "ADMIN"
    ? (state.availableLocations?.length ? state.availableLocations : (source.locations || []).filter(isTenantBusiness))
    : (state.locations || []).filter(isTenantBusiness);
  const currentLocationId = state.currentLocation?.id || locationOptions[0]?.id;
  const transactions = buildLedgerTransactions(source).map((transaction) => {
    const location = (state.availableLocations || source.locations || []).find((entry: any) => entry.id === transaction.locationId);
    return {
      ...transaction,
      date: transaction.date.toISOString(),
      locationName: location?.name || state.currentLocation?.name || "Current business",
    };
  });

  return (
    <TransactionsClient
      accounts={source.bankAccounts.map((account: any) => ({
        id: account.id,
        displayName: account.displayName,
      }))}
      locations={locationOptions.map((location: any) => ({
        id: location.id,
        name: location.name,
      }))}
      transactions={transactions}
      initialLocationIds={scope === "LOCATION" && currentLocationId ? [currentLocationId] : []}
    />
  );
}
