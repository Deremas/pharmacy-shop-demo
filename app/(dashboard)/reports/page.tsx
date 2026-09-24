"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Boxes,
  CreditCard,
  Database,
  FileClock,
  FileText,
  Filter,
  Landmark,
  Layers,
  Package,
  ReceiptText,
  Search,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  Truck,
  UserRound,
  Wallet,
} from "lucide-react";

import { cn, formatCurrency, subtractMoney, sumMoney } from "@/lib/utils";
import { useAppData, useReportData } from "@/lib/client/useAppData";
import { paginateRows, saleProfit } from "@/lib/sales-utils";
import { ReportScopeBar, useReportScope } from "@/components/report-scope-bar";
import { formatItemChoiceLabel } from "@/lib/item-display";

const categories = ["All", "Sales", "Inventory", "Procurement", "Finance", "Credit", "Administrative"] as const;

type Category = typeof categories[number];

type ReportDefinition = {
  id: string;
  title: string;
  category: Exclude<Category, "All">;
  description: string;
  icon: React.ElementType;
  filters: string[];
  output: string;
  route?: string;
  hidden?: boolean;
};

const reports: ReportDefinition[] = [
  { id: "sales-by-number", title: "Sales by Sale Number", category: "Sales", description: "Complete recorded contents and payment split of each sale number (voucher code).", icon: ShoppingCart, filters: ["Locations", "Date Range", "Customers", "Payment Method"], output: "Sale details", route: "/sales" },
  { id: "sales-list", title: "Sales Summary", category: "Sales", description: "One exact summary row for every recorded sale.", icon: ShoppingCart, filters: ["Locations", "Date Range", "Customers", "Payment Method", "Status"], output: "Sales summary", route: "/sales" },
  { id: "sold-items", title: "Sales by Item", category: "Sales", description: "Recorded item-level sales, costs, discounts, and profit.", icon: ReceiptText, filters: ["Locations", "Date Range", "Items", "Categories", "Customers"], output: "Item sales" },
  { id: "total-sales-by-item", title: "Total Sales by Item", category: "Sales", description: "One summarized row per item from recorded sales.", icon: BarChart3, filters: ["Locations", "Date Range", "Items", "Categories"], output: "Item totals" },
  { id: "sales-by-date", title: "Sales by Date", category: "Sales", description: "Exact daily sales, payment, cost, and profit totals.", icon: FileClock, filters: ["Locations", "Date Range"], output: "Daily sales" },
  { id: "sales-by-customer", title: "Sales by Customer", category: "Sales", description: "Recorded customer purchases, payments, and outstanding credit.", icon: UserRound, filters: ["Locations", "Date Range", "Customers"], output: "Customer sales" },
  { id: "sales-by-employee", title: "Sales by Employee", category: "Sales", description: "Recorded sales performance by cashier or salesperson.", icon: UserRound, filters: ["Locations", "Date Range"], output: "Employee sales" },
  { id: "product-ranking", title: "Best-Selling Items", category: "Sales", description: "Items ranked by recorded net sales with quantity and gross profit.", icon: BarChart3, filters: ["Locations", "Date Range", "Items", "Categories"], output: "Best-selling items" },
  { id: "discounted-items", title: "Discounted Items", category: "Sales", description: "Recorded sold items where a discount was applied.", icon: ReceiptText, filters: ["Locations", "Date Range", "Items"], output: "Discounted items" },

  { id: "inventory-quantity", title: "Current Stock", category: "Inventory", description: "Current recorded quantity, movement totals, prices, and status by location.", icon: Boxes, filters: ["Locations", "Items", "Categories", "Stock Status"], output: "Current stock" },
  { id: "inventory-as-of", title: "Inventory as of Date", category: "Inventory", description: "Recorded stock quantity at the end of a selected date.", icon: FileClock, filters: ["Locations", "As-of Date", "Items", "Categories"], output: "Historical stock quantity" },
  { id: "stock-movement-log", title: "Item Stock Movement", category: "Inventory", description: "Complete recorded stock entries and exits with balances and references.", icon: Database, filters: ["Locations", "Date Range", "Items", "Movement Type"], output: "Stock movement ledger", route: "/store/movements" },
  { id: "stock-replenishment", title: "Low Stock", category: "Inventory", description: "Items at or below their recorded minimum stock level.", icon: Package, filters: ["Locations", "Items", "Categories", "Stock Status"], output: "Low-stock items", route: "/items/low-stock" },
  { id: "zero-stock", title: "Zero Stock", category: "Inventory", description: "Active items with exactly zero recorded stock by location.", icon: Package, filters: ["Locations", "Items", "Categories"], output: "Zero-stock items" },
  { id: "stock-valuation", title: "Stock Valuation", category: "Inventory", description: "Recorded remaining inventory quantity and buying-cost value.", icon: Layers, filters: ["Locations", "Items", "Categories"], output: "Stock valuation" },
  { id: "branch-stock-comparison", title: "Branch Stock Comparison", category: "Inventory", description: "Exact current item quantities across accessible branches.", icon: Boxes, filters: ["Items", "Categories"], output: "Branch comparison", hidden: true },
  { id: "slow-moving-items", title: "Slow-Moving Items", category: "Inventory", description: "Current stock with actual period sales and days since the last recorded sale.", icon: FileClock, filters: ["Locations", "Items", "Categories", "Date Range"], output: "Slow-moving stock" },
  { id: "location-transfers", title: "Location Transfers", category: "Inventory", description: "Recorded stock transfers between shop and store for the selected business.", icon: Truck, filters: ["Locations", "Date Range", "Items"], output: "Transfer list", route: "/store/transfers" },
  { id: "stock-damage", title: "Damaged / Written-off Stock", category: "Inventory", description: "Items written off as damaged or out of use, with quantity and estimated buying cost.", icon: Package, filters: ["Locations", "Date Range", "Items", "Categories"], output: "Damage write-offs", route: "/store/damage" },
  { id: "batch-profit", title: "Batch Profit", category: "Inventory", description: "Profit kept on each batch after sales and returns, using the cost stored on that batch.", icon: TrendingUp, filters: ["Locations", "Items"], output: "Batch profit", route: "/reports/stock" },
  { id: "expiry-loss", title: "Expiry Loss", category: "Inventory", description: "Buying-cost value of stock that is still on hand after its expiry date.", icon: ShieldCheck, filters: ["Locations", "Items"], output: "Expiry loss", route: "/reports/stock" },
  { id: "stock-aging", title: "Stock Aging", category: "Inventory", description: "How long remaining batches have been in stock, with their buying-cost value.", icon: FileClock, filters: ["Locations", "Items"], output: "Aging", route: "/reports/stock" },

  { id: "purchase-list", title: "Purchase List", category: "Procurement", description: "Recorded supplier purchases and payment details.", icon: Truck, filters: ["Locations", "Date Range", "Suppliers", "Payment Method", "Status"], output: "Purchases", route: "/purchases" },
  { id: "purchased-items", title: "Purchased Items", category: "Procurement", description: "Recorded item-level purchases with supplier and cost detail.", icon: ReceiptText, filters: ["Locations", "Date Range", "Suppliers", "Items", "Categories"], output: "Purchased items" },
  { id: "purchases-by-item", title: "Purchases by Item", category: "Procurement", description: "Complete recorded purchase history for selected items.", icon: ReceiptText, filters: ["Locations", "Date Range", "Suppliers", "Items"], output: "Item purchase history" },
  { id: "purchases-by-supplier", title: "Purchases by Supplier", category: "Procurement", description: "Exact purchase, payment, and payable totals by supplier.", icon: Truck, filters: ["Locations", "Date Range", "Suppliers"], output: "Supplier purchase totals" },
  { id: "purchase-summary", title: "Purchase Summary", category: "Procurement", description: "Recorded purchase quantities, values, payments, and payables.", icon: FileText, filters: ["Locations", "Date Range", "Suppliers"], output: "Purchase totals" },
  { id: "supplier-payables", title: "Supplier Payables", category: "Procurement", description: "Recorded global supplier debt without assumed due dates or aging.", icon: UserRound, filters: ["Suppliers"], output: "Supplier payables", route: "/suppliers/debts" },

  { id: "expense-analysis", title: "Expense Report", category: "Finance", description: "Recorded expenses by category, location, account, and creator.", icon: Wallet, filters: ["Locations", "Date Range", "Expense Category", "Accounts"], output: "Expenses", route: "/finance/expenses" },
  { id: "bank-transactions", title: "Bank Transactions", category: "Finance", description: "Recorded bank inflows, outflows, references, and balances after each transaction.", icon: Database, filters: ["Locations", "Date Range", "Accounts"], output: "Bank transaction ledger", route: "/finance/transactions" },
  { id: "cash-to-bank", title: "Cash-to-Bank", category: "Finance", description: "Recorded transfers from cash to bank accounts.", icon: Landmark, filters: ["Locations", "Date Range", "Accounts"], output: "Cash-to-bank transfers", route: "/finance/cash-to-bank" },
  { id: "payment-breakdown", title: "Payment Method Summary", category: "Finance", description: "Actual recorded cash, bank, and credit amounts and shares.", icon: CreditCard, filters: ["Locations", "Date Range"], output: "Payment totals" },
  { id: "sales-profitability", title: "Detailed Sales and Profit", category: "Finance", description: "Recorded line-level sales, cost, discount, and gross profit.", icon: TrendingUp, filters: ["Locations", "Date Range", "Items", "Categories"], output: "Sales and profit" },
  { id: "profit-summary", title: "Profit Summary", category: "Finance", description: "Exact recorded net sales, cost, expenses, and profit for the period.", icon: TrendingUp, filters: ["Locations", "Date Range"], output: "Profit summary" },

  { id: "customer-credit-aging", title: "Customer Credit", category: "Credit", description: "Actual global outstanding customer balances without assumed aging.", icon: UserRound, filters: ["Customers"], output: "Customer credit", route: "/customers/credits" },
  { id: "customer-payment-history", title: "Customer Payment History", category: "Credit", description: "Every recorded customer payment and its resulting balance.", icon: CreditCard, filters: ["Locations", "Date Range", "Customers", "Payment Method"], output: "Customer payments", route: "/customers/credits" },

  { id: "audit-security", title: "Audit & Security Logs", category: "Administrative", description: "System activity, data changes, and security-relevant events.", icon: ShieldCheck, filters: ["Date Range", "Users", "Module", "Action"], output: "Audit trail", route: "/reports/audit" },
  { id: "user-activity", title: "User Activity", category: "Administrative", description: "Operational actions by user across sales, purchases, and finance.", icon: FileText, filters: ["Date Range", "Users", "Locations", "Module"], output: "User log" },
];

const visibleReports = reports.filter((report) => !report.hidden);

export default function ReportsPage() {
  const state = useReportData();
  const { locations } = state;
  const router = useRouter();
  const searchParams = useSearchParams();
  const scope = useReportScope(locations, state.currentLocation);
  const [activeCategory, setActiveCategory] = React.useState<Category>("All");
  const [search, setSearch] = React.useState("");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [openedReportId, setOpenedReportId] = React.useState<string | null>(null);
  const selectedLocationId = scope.scopeId;

  React.useEffect(() => {
    const reportId = searchParams.get("report");
    setOpenedReportId(reportId && visibleReports.some((report) => report.id === reportId) ? reportId : null);
  }, [searchParams]);

  const filteredReports = visibleReports.filter((report) => {
    const searchHaystack = `${report.title} ${report.description} ${report.category} ${report.filters.join(" ")}`.toLowerCase();
    return (activeCategory === "All" || report.category === activeCategory) && searchHaystack.includes(search.toLowerCase());
  });
  const openedReport = openedReportId ? visibleReports.find((report) => report.id === openedReportId) || null : null;

  const resetFilters = () => {
    setDateFrom("");
    setDateTo("");
    setSearch("");
  };

  if (openedReport) {
    return (
      <ReportDetailView
        report={openedReport}
        state={state}
        dateFrom={dateFrom}
        dateTo={dateTo}
        selectedLocationId={selectedLocationId}
        onBack={() => {
          setOpenedReportId(null);
          router.push("/reports");
        }}
      />
    );
  }

  return (
    <div className="space-y-6 pb-20 font-sans animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">Reports</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Figures follow the business selected in the top bar. Admin and roles with report access see that company only.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Available Reports</p>
          <p className="mt-1 text-xl font-black text-slate-950 dark:text-white">{visibleReports.length}</p>
        </div>
      </div>

      <ReportScopeBar label={scope.label} />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_minmax(140px,170px)_minmax(140px,170px)_120px] xl:items-end">
          <div className="relative min-w-0">
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Search</label>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search reports, filters, or modules..."
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-bold outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>
          <DateField label="Date From" value={dateFrom} onChange={setDateFrom} />
          <DateField label="Date To" value={dateTo} onChange={setDateTo} />
          <button
            type="button"
            onClick={resetFilters}
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[10px] font-black uppercase tracking-widest text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-zinc-800 dark:bg-zinc-950"
          >
            Reset
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={cn(
                "rounded-xl px-4 py-2 text-xs font-black transition",
                activeCategory === category
                  ? "bg-slate-950 text-white shadow-lg shadow-slate-950/15 dark:bg-white dark:text-slate-950"
                  : "border border-slate-200 bg-slate-50 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 dark:border-zinc-800 dark:bg-zinc-950",
              )}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {filteredReports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onOpen={() => {
                setOpenedReportId(report.id);
                router.push(`/reports?report=${report.id}`);
              }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-widest text-slate-600 outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
      />
    </label>
  );
}

function ReportCard({ report, onOpen }: { report: ReportDefinition; onOpen: () => void }) {
  const Icon = report.icon;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900",
      )}
    >
      <div className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100">
        <ArrowUpRight className="h-4 w-4 text-indigo-600" />
      </div>
      <div className="flex gap-4">
        <div className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
          report.category === "Sales" && "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40",
          report.category === "Inventory" && "bg-blue-50 text-blue-600 dark:bg-blue-950/40",
          report.category === "Procurement" && "bg-amber-50 text-amber-600 dark:bg-amber-950/40",
          report.category === "Finance" && "bg-rose-50 text-rose-600 dark:bg-rose-950/40",
          report.category === "Credit" && "bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40",
          report.category === "Administrative" && "bg-violet-50 text-violet-600 dark:bg-violet-950/40",
        )}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{report.category}</p>
          <h3 className="mt-1 text-sm font-black text-slate-950 transition group-hover:text-indigo-600 dark:text-white">{report.title}</h3>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{report.description}</p>
        </div>
      </div>
      <div className="mt-5 border-t border-slate-100 pt-3 dark:border-zinc-800">
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
          <Filter className="h-3 w-3" />
          {report.filters.length} filters
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {report.filters.slice(0, 3).map((filter) => (
            <span key={filter} className="rounded-md bg-slate-50 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:bg-zinc-950">
              {filter}
            </span>
          ))}
          {report.filters.length > 3 ? (
            <span className="rounded-md bg-indigo-600 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white">
              +{report.filters.length - 3}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function ReportDetailView({
  report,
  state,
  dateFrom,
  dateTo,
  selectedLocationId,
  onBack,
}: {
  report: ReportDefinition;
  state: ReturnType<typeof useAppData>;
  dateFrom: string;
  dateTo: string;
  selectedLocationId: string;
  onBack: () => void;
}) {
  const Icon = report.icon;
  const [filters, setFilters] = React.useState<ReportFilters>({
    search: "",
    locationId: selectedLocationId,
    dateFrom,
    dateTo,
    customerId: "",
    supplierId: "",
    itemId: "",
    category: "",
    paymentMethod: "",
    accountId: "",
    status: "",
  });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const rows = buildReportRows(report.id, state, filters);
  const columns = rows.length > 0 ? Object.keys(rows[0]).filter((key) => !key.startsWith("_")) : defaultColumns(report.id);
  const totals = summarizeRows(rows);
  const pagedRows = paginateRows(rows, page, pageSize);
  const activeFilterCount = Object.entries(filters).filter(([, value]) => Boolean(value)).length;
  const setFilter = (key: keyof ReportFilters, value: string) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };
  const resetReportFilters = () => {
    setPage(1);
    setFilters({
    search: "",
    locationId: selectedLocationId,
    dateFrom: "",
    dateTo: "",
    customerId: "",
    supplierId: "",
    itemId: "",
    category: "",
    paymentMethod: "",
    accountId: "",
    status: "",
  });
  };
  React.useEffect(() => {
    setPage(1);
  }, [report.id]);
  React.useEffect(() => {
    setFilters((current) => ({ ...current, locationId: selectedLocationId }));
  }, [selectedLocationId]);
  const reportItems = [...(state.products || []), ...(state.items || [])]
    .filter((item, index, entries) => entries.findIndex((entry) => entry.id === item.id) === index);
  const categoryOptions = Array.from(new Set<string>(reportItems.map((item) => String(item.category || "")).filter(Boolean))).sort();
  const expenseCategoryOptions = Array.from(new Set<string>((state.expenses || []).map((expense) => String(expense.category || "")).filter(Boolean))).sort();
  const showCustomerFilter = ["sales-by-number", "sales-list", "sold-items", "sales-by-customer", "customer-credit-aging", "customer-payment-history", "discounted-items"].includes(report.id);
  const showSupplierFilter = ["purchase-list", "purchased-items", "purchases-by-item", "purchases-by-supplier", "purchase-summary", "supplier-payables"].includes(report.id);
  const showItemFilter = ["sold-items", "total-sales-by-item", "sales-profitability", "product-ranking", "discounted-items", "stock-valuation", "inventory-quantity", "inventory-as-of", "stock-movement-log", "location-transfers", "stock-damage", "stock-replenishment", "zero-stock", "branch-stock-comparison", "slow-moving-items", "purchased-items", "purchases-by-item"].includes(report.id);
  const showCategoryFilter = ["sold-items", "total-sales-by-item", "sales-profitability", "product-ranking", "stock-valuation", "inventory-quantity", "inventory-as-of", "stock-replenishment", "zero-stock", "branch-stock-comparison", "slow-moving-items", "purchased-items", "stock-damage", "expense-analysis"].includes(report.id);
  const showPaymentFilter = ["sales-by-number", "sales-list", "purchase-list", "expense-analysis", "customer-payment-history"].includes(report.id);
  const showAccountFilter = ["expense-analysis", "bank-transactions", "cash-to-bank"].includes(report.id);
  const showStatusFilter = ["inventory-quantity", "stock-replenishment", "purchase-list"].includes(report.id);
  const showMovementFilter = report.id === "stock-movement-log";
  const showDateFilters = !["inventory-quantity", "stock-replenishment", "zero-stock", "stock-valuation", "branch-stock-comparison", "customer-credit-aging", "supplier-payables"].includes(report.id);

  return (
    <div className="space-y-6 pb-20 font-sans animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="page-heading">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900"
            aria-label="Back to reports"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40">
              <Icon className="h-7 w-7" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-600">{report.category}</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 dark:text-white">{report.title}</h1>
              <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-slate-500">{report.description}</p>
            </div>
          </div>
        </div>
        <a
          href={report.route || "#"}
          className={cn(
            "page-action h-11 gap-2 rounded-xl px-5 text-xs font-black uppercase tracking-widest transition",
            report.route
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20 hover:bg-indigo-500"
              : "bg-slate-100 text-slate-400 dark:bg-zinc-800",
          )}
        >
          Open Related View
          <ArrowUpRight className="h-4 w-4" />
        </a>
      </div>

      <div className={cn("grid gap-4", report.id === "bank-transactions" ? "md:grid-cols-4" : "md:grid-cols-3")}>
        {report.id === "bank-transactions" ? (
          <>
            <ReportInfo label="Transactions" value={String(rows.length)} />
            <ReportInfo label="Total Inflow" value={formatCurrency(totals.inflow)} />
            <ReportInfo label="Total Outflow" value={formatCurrency(totals.outflow)} />
            <ReportInfo label="Net Movement" value={formatCurrency(subtractMoney(totals.inflow, totals.outflow))} />
          </>
        ) : (
          <>
            <ReportInfo label="Rows" value={String(rows.length)} />
            <ReportInfo label="Quantity" value={formatNumber(totals.quantity)} />
            <ReportInfo label="Amount" value={formatCurrency(totals.amount)} />
          </>
        )}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative md:col-span-2">
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Search Report</label>
            <Search className="absolute left-3 top-[calc(50%+10px)] h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={filters.search}
              onChange={(event) => setFilter("search", event.target.value)}
              placeholder="Search rows..."
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-bold outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>
          <SelectFilter label="Pharmacy" value={filters.locationId} onChange={(value) => setFilter("locationId", value)} hidden options={(state.locations || []).map((location) => ({ value: String(location.id), label: String(location.name) }))} />
          <SelectFilter label="Payment" value={filters.paymentMethod} onChange={(value) => setFilter("paymentMethod", value)} hidden={!showPaymentFilter} options={["CASH", "BANK", "CREDIT", "MIXED"].map((method) => ({ value: method, label: method }))} />
          {showDateFilters && report.id !== "inventory-as-of" ? <DateFilter label="From" value={filters.dateFrom} onChange={(value) => setFilter("dateFrom", value)} /> : null}
          {showDateFilters ? <DateFilter label={report.id === "inventory-as-of" ? "As of Date" : "To"} value={filters.dateTo} onChange={(value) => setFilter("dateTo", value)} /> : null}
          <SelectFilter label="Customer" value={filters.customerId} onChange={(value) => setFilter("customerId", value)} hidden={!showCustomerFilter} options={(state.customers || []).map((customer) => ({ value: String(customer.id), label: String(customer.name) }))} />
          <SelectFilter label="Supplier" value={filters.supplierId} onChange={(value) => setFilter("supplierId", value)} hidden={!showSupplierFilter} options={(state.suppliers || []).map((supplier) => ({ value: String(supplier.id), label: String(supplier.name) }))} />
          <SelectFilter label="Item" value={filters.itemId} onChange={(value) => setFilter("itemId", value)} hidden={!showItemFilter} options={reportItems.map((item) => ({ value: String(item.id), label: formatItemChoiceLabel(item, selectedLocationId) }))} />
          <SelectFilter label="Category" value={filters.category} onChange={(value) => setFilter("category", value)} hidden={!showCategoryFilter} options={(report.id === "expense-analysis" ? expenseCategoryOptions : categoryOptions).map((category) => ({ value: category, label: category }))} />
          <SelectFilter label="Account" value={filters.accountId} onChange={(value) => setFilter("accountId", value)} hidden={!showAccountFilter} options={(state.bankAccounts || []).map((account) => ({ value: String(account.id), label: String(account.displayName) }))} />
          <SelectFilter label="Status" value={filters.status} onChange={(value) => setFilter("status", value)} hidden={!showStatusFilter} options={["OK", "Low Stock", "Out of Stock", "PAID", "PARTIAL", "UNPAID"].map((status) => ({ value: status, label: status.replace(/_/g, " ") }))} />
          <SelectFilter label="Movement Type" value={filters.status} onChange={(value) => setFilter("status", value)} hidden={!showMovementFilter} options={Array.from(new Set<string>((state.inventoryMovements || []).map((movement: any) => String(movement.type || "")).filter(Boolean))).sort().map((status) => ({ value: status, label: status.replace(/_/g, " ") }))} />
          <div className="flex items-end gap-3">
            <div className="flex h-12 flex-1 items-center rounded-xl bg-indigo-50 px-4 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:bg-indigo-950/40">
              {activeFilterCount} filters active
            </div>
            <button
              type="button"
              onClick={resetReportFilters}
              className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-[10px] font-black uppercase tracking-widest text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-zinc-800 dark:bg-zinc-950"
            >
              Reset
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-black text-slate-950 dark:text-white">{report.output}</h2>
            <p className="text-xs font-semibold text-slate-500">Report table generated from current database-backed app data.</p>
          </div>
          <button
            type="button"
            disabled={rows.length === 0}
            onClick={() => exportReportCsv(report.title, rows, columns)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-950"
          >
            Export CSV
          </button>
        </div>
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-zinc-800 dark:bg-zinc-950/50">
                {columns.map((column) => (
                  <th key={column} className="px-4 py-3">{column}</th>
                ))}
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-12 text-center text-xs font-black uppercase tracking-widest text-slate-500">
                    No records found
                  </td>
                </tr>
              ) : pagedRows.rows.map((row, index) => (
                <tr key={index} className="hover:bg-slate-50 dark:hover:bg-zinc-800/30">
                  {columns.map((column) => (
                    <td key={column} className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-600 dark:text-zinc-300">
                      {String(row[column] ?? "-")}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    {row._href ? (
                      <a href={String(row._href)} className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:underline">
                        Details
                      </a>
                    ) : (
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">View</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500 dark:border-zinc-800">
          <span>Page {pagedRows.page} of {pagedRows.totalPages} - {rows.length} rows</span>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] font-black uppercase tracking-widest outline-none dark:border-zinc-800 dark:bg-zinc-950"
            >
              {[10, 15, 25, 50].map((size) => (
                <option key={size} value={size}>{size} / page</option>
              ))}
            </select>
            <button type="button" disabled={pagedRows.page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40 dark:border-zinc-800">Prev</button>
            <button type="button" disabled={pagedRows.page >= pagedRows.totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40 dark:border-zinc-800">Next</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ReportInfo({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900", compact ? "p-3" : "p-5")}>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className={cn("font-black text-slate-950 dark:text-white", compact ? "mt-1 text-sm" : "mt-2 text-lg")}>{value}</p>
    </div>
  );
}

function SelectFilter({
  label,
  value,
  onChange,
  options,
  hidden = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  hidden?: boolean;
}) {
  if (hidden) return null;

  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-700 outline-none transition focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
      >
        <option value="">All {label}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DateFilter({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-700 outline-none transition focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
      />
    </label>
  );
}

type ReportRow = Record<string, string | number | undefined>;

type ReportFilters = {
  search: string;
  dateFrom: string;
  dateTo: string;
  locationId: string;
  customerId: string;
  supplierId: string;
  itemId: string;
  category: string;
  paymentMethod: string;
  accountId: string;
  status: string;
};

function buildReportRows(
  reportId: string,
  state: ReturnType<typeof useAppData>,
  filters: ReportFilters,
): ReportRow[] {
  const number = (value: unknown) => Number(value || 0);
  const timeOf = (value?: Date | string) => value ? new Date(value).getTime() : 0;
  const newestFirst = <T,>(rows: T[], dateOf: (row: T) => Date | string) => [...rows].sort(
    (left, right) => timeOf(dateOf(right)) - timeOf(dateOf(left))
      || timeOf((right as any).createdAt) - timeOf((left as any).createdAt),
  );
  const locations = (state.locations || []).filter((location: any) => !filters.locationId || location.id === filters.locationId);
  const products = state.products || [];
  const sales = newestFirst(state.sales || [], (sale: any) => sale.saleDate);
  const purchases = newestFirst(state.purchases || [], (purchase: any) => purchase.purchaseDate);
  const movements = state.inventoryMovements || [];
  const batches = state.inventoryBatches || [];
  const locationName = (id?: string) => locations.find((location: any) => location.id === id)?.name || "-";
  const customerById = (id?: string | null) => state.customers.find((customer: any) => customer.id === id);
  const customerName = (id?: string | null) => customerById(id)?.name || "Walk-in Customer";
  const supplierName = (id?: string) => state.suppliers.find((supplier: any) => supplier.id === id)?.name || "No Supplier";
  const itemById = (id?: string) => products.find((item: any) => item.id === id) || state.items.find((item: any) => item.id === id);
  const currentItem = (itemId: string, locationId: string) => state.items.find((item: any) => item.id === itemId && item.locationId === locationId);
  const bankName = (id?: string) => state.bankAccounts.find((account: any) => account.id === id)?.displayName || "-";
  const inRange = (date: Date | string) => {
    const time = new Date(date).getTime();
    if (filters.dateFrom && time < new Date(filters.dateFrom).getTime()) return false;
    if (filters.dateTo && time > new Date(filters.dateTo).getTime() + 86400000 - 1) return false;
    return true;
  };
  const matchesLocation = (locationId?: string) => !filters.locationId || locationId === filters.locationId;
  const matchesCustomer = (customerId?: string | null) => !filters.customerId || customerId === filters.customerId;
  const matchesSupplier = (supplierId?: string | null) => !filters.supplierId || supplierId === filters.supplierId;
  const matchesPayment = (method?: string) => !filters.paymentMethod || method === filters.paymentMethod;
  const matchesAccount = (accountId?: string) => !filters.accountId || accountId === filters.accountId;
  const matchesItem = (itemId?: string) => !filters.itemId || itemId === filters.itemId;
  const matchesCategory = (itemId?: string, category?: string) => {
    if (!filters.category) return true;
    return (category || itemById(itemId)?.category) === filters.category;
  };
  const matchesStatus = (status?: string) => !filters.status || status === filters.status;
  const finalize = (rows: ReportRow[]) => {
    const q = filters.search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => Object.values(row).join(" ").toLowerCase().includes(q));
  };
  const scopedSales = () => sales.filter((sale: any) => inRange(sale.saleDate) && matchesLocation(sale.locationId) && matchesCustomer(sale.customerId) && matchesPayment(sale.paymentMethod));
  const scopedPurchases = () => purchases.filter((purchase: any) => inRange(purchase.purchaseDate) && matchesLocation(purchase.locationId) && matchesSupplier(purchase.supplierId) && matchesPayment(purchase.paymentMethod) && matchesStatus(purchase.paymentStatus));
  const stockStatus = (stock: number, minimum: number) => stock <= 0 ? "Out of Stock" : stock <= minimum ? "Low Stock" : "OK";
  const stockRows = () => products.flatMap((product: any) => locations.map((location: any) => {
    const item = currentItem(product.id, location.id);
    const stock = number(item?.stock);
    const minimum = number(item?.lowStockAlert ?? product.lowStockAlert ?? state.settings.lowStockThreshold);
    return { product, location, item, stock, minimum, status: stockStatus(stock, minimum) };
  })).filter(({ product, location, status }: any) => matchesLocation(location.id) && matchesItem(product.id) && matchesCategory(product.id, product.category) && matchesStatus(status));
  const itemLocationMovements = (itemId: string, locationId: string) => movements.filter((movement: any) => movement.itemId === itemId && movement.locationId === locationId);
  const weightedStockCost = (itemId: string, locationId: string) => {
    const open = batches.filter((batch: any) => batch.itemId === itemId && batch.locationId === locationId && number(batch.remainingQuantity) > 0);
    const quantity = open.reduce((sum: number, batch: any) => sum + number(batch.remainingQuantity), 0);
    const value = open.reduce((sum: number, batch: any) => sum + number(batch.remainingQuantity) * number(batch.buyingPrice), 0);
    return { quantity, value, average: quantity > 0 ? value / quantity : 0 };
  };
  const lastSaleFor = (itemId: string, locationId?: string) => sales
    .filter((sale: any) => (!locationId || sale.locationId === locationId) && sale.items.some((line: any) => line.itemId === itemId))
    .sort((a: any, b: any) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime())[0];
  const lastPurchaseFor = (itemId: string, locationId?: string) => purchases
    .filter((purchase: any) => (!locationId || purchase.locationId === locationId) && purchase.items.some((line: any) => line.itemId === itemId))
    .sort((a: any, b: any) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime())[0];
  const movementDate = (movement: any) => {
    if (movement.referenceType === "SALE") return sales.find((sale: any) => sale.id === movement.referenceId)?.saleDate || movement.createdAt;
    if (movement.referenceType === "PURCHASE") return purchases.find((purchase: any) => purchase.id === movement.referenceId)?.purchaseDate || movement.createdAt;
    if (movement.referenceType === "TRANSFER") return (state.transfers || []).find((transfer: any) => transfer.id === movement.referenceId)?.date || movement.createdAt;
    return movement.createdAt;
  };
  const movementBalance = new Map<string, number>();
  const movementGroups = new Map<string, any[]>();
  movements.forEach((movement: any) => {
    const key = `${movement.itemId}:${movement.locationId}`;
    movementGroups.set(key, [...(movementGroups.get(key) || []), movement]);
  });
  movementGroups.forEach((entries, key) => {
    const [itemId, locationId] = key.split(":");
    let balance = number(currentItem(itemId, locationId)?.stock) - entries.reduce((sum, movement) => sum + number(movement.quantity), 0);
    entries.sort((a, b) => new Date(movementDate(a)).getTime() - new Date(movementDate(b)).getTime() || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).forEach((movement) => {
      balance += number(movement.quantity);
      movementBalance.set(movement.id, balance);
    });
  });

  switch (reportId) {
    case "sales-by-number":
      return finalize(scopedSales().flatMap((sale: any) => sale.items
        .filter((line: any) => matchesItem(line.itemId) && matchesCategory(line.itemId))
        .map((line: any, index: number) => ({
          "Sale Number": sale.voucherCode || sale.id,
          Date: new Date(sale.saleDate).toLocaleString(),
          Customer: customerName(sale.customerId),
          Phone: customerById(sale.customerId)?.phone || "-",
          Cashier: sale.createdByName || "System",
          Branch: locationName(sale.locationId),
          Item: line.itemName || itemById(line.itemId)?.name || line.itemId,
          Qty: number(line.qty),
          "Unit Price": formatCurrency(number(line.price)),
          Discount: formatCurrency(number(line.discount)),
          "Line Total": formatCurrency(number(line.total)),
          Cost: formatCurrency(number(line.buyingPrice) * number(line.qty)),
          Profit: formatCurrency(number(line.total) - number(line.buyingPrice) * number(line.qty)),
          Cash: index === 0 ? formatCurrency(number(sale.cashAmount)) : "-",
          Bank: index === 0 ? formatCurrency(number(sale.bankAmount)) : "-",
          Credit: index === 0 ? formatCurrency(number(sale.creditAmount)) : "-",
          Payment: index === 0 ? sale.paymentMethod : "-",
          _amount: number(line.total),
          _quantity: number(line.qty),
          _href: `/sales/${sale.id}`,
        }))));
    case "sales-list":
      return finalize(scopedSales().filter((sale: any) => matchesStatus(sale.paymentStatus)).map((sale: any) => ({
        Date: formatDate(sale.saleDate),
        "Sale Number": sale.voucherCode || sale.id,
        Customer: customerName(sale.customerId),
        Items: sale.items.length,
        Quantity: sale.items.reduce((sum: number, line: any) => sum + number(line.qty), 0),
        "Gross Sales": formatCurrency(number(sale.subTotal)),
        Discount: formatCurrency(number(sale.discount)),
        "Net Sales": formatCurrency(number(sale.totalAmount)),
        Cash: formatCurrency(number(sale.cashAmount)),
        Bank: formatCurrency(number(sale.bankAmount)),
        Credit: formatCurrency(number(sale.creditAmount)),
        Payment: sale.paymentMethod,
        Status: sale.paymentStatus,
        Cashier: sale.createdByName || "System",
        Branch: locationName(sale.locationId),
        _amount: number(sale.totalAmount),
        _quantity: sale.items.reduce((sum: number, line: any) => sum + number(line.qty), 0),
        _href: `/sales/${sale.id}`,
      })));
    case "sold-items":
    case "discounted-items":
      return finalize(sales.filter((sale: any) =>
        inRange(sale.saleDate) &&
        matchesLocation(sale.locationId) &&
        matchesCustomer(sale.customerId)
      ).flatMap((sale: any) =>
        sale.items
          .filter((line: any) =>
            (reportId !== "discounted-items" || line.discount > 0) &&
            matchesItem(line.itemId) &&
            matchesCategory(line.itemId)
          )
          .map((line: any) => {
            const item = itemById(line.itemId);
            const cost = number(line.buyingPrice) * number(line.qty);
            return {
              Date: formatDate(sale.saleDate),
              "Sale Number": sale.voucherCode || sale.id,
              Item: item?.name || line.itemId,
              Customer: customerName(sale.customerId),
              Qty: number(line.qty),
              "Buying Price": formatCurrency(number(line.buyingPrice)),
              "Unit Price": formatCurrency(number(line.price)),
              "Gross Sales": formatCurrency(number(line.price) * number(line.qty)),
              Discount: formatCurrency(number(line.discount)),
              "Net Sales": formatCurrency(number(line.total)),
              COGS: formatCurrency(cost),
              Profit: formatCurrency(number(line.total) - cost),
              Branch: locationName(sale.locationId),
              Cashier: sale.createdByName || "System",
              _amount: number(line.total),
              _quantity: number(line.qty),
              _href: `/sales/${sale.id}`,
            };
          })
      ));
    case "sales-profitability":
      return finalize(sales.filter((sale: any) =>
        inRange(sale.saleDate) &&
        matchesLocation(sale.locationId) &&
        matchesCustomer(sale.customerId)
      ).flatMap((sale: any) =>
        sale.items.filter((line: any) => matchesItem(line.itemId) && matchesCategory(line.itemId)).map((line: any) => {
          const item = itemById(line.itemId);
          const cost = number(line.buyingPrice) * number(line.qty);
          const profit = number(line.total) - cost;
          return {
            Date: formatDate(sale.saleDate),
            "Sale Number": sale.voucherCode || sale.id,
            Item: line.itemName || item?.name || line.itemId,
            Qty: number(line.qty),
            "Buying Price": formatCurrency(number(line.buyingPrice)),
            "Unit Price": formatCurrency(number(line.price)),
            "Total Cost": formatCurrency(cost),
            "Gross Sales": formatCurrency(number(line.price) * number(line.qty)),
            Discount: formatCurrency(number(line.discount)),
            "Net Sales": formatCurrency(number(line.total)),
            "Gross Profit": formatCurrency(profit),
            Branch: locationName(sale.locationId),
            _amount: profit,
            _quantity: number(line.qty),
            _href: `/sales/${sale.id}`,
          };
        })
      ));
    case "customer-credit-aging":
      return finalize(state.customers.filter((customer: any) => number(customer.balance) > 0 && matchesCustomer(customer.id)).map((customer: any) => {
        const customerSales = sales.filter((sale: any) => sale.customerId === customer.id);
        const lastPayment = (state.customerPayments || []).filter((payment: any) => payment.customerId === customer.id).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        return {
        Customer: customer.name,
        Phone: customer.phone,
        "Credit Sales": customerSales.filter((sale: any) => number(sale.creditAmount) > 0).length,
        "Original Credit": formatCurrency(customerSales.reduce((sum: number, sale: any) => sum + number(sale.creditAmount), 0)),
        "Amount Paid": formatCurrency((state.customerPayments || []).filter((payment: any) => payment.customerId === customer.id).reduce((sum: number, payment: any) => sum + number(payment.amount), 0)),
        Outstanding: formatCurrency(number(customer.balance)),
        "Last Payment": lastPayment ? formatDate(lastPayment.date) : "Not recorded",
        _amount: number(customer.balance),
        _href: `/customers/${customer.id}`,
      };}));
    case "customer-payment-history":
      return finalize(newestFirst(state.customerPayments || [], (payment: any) => payment.date).filter((payment: any) => inRange(payment.date) && matchesLocation(payment.locationId) && matchesCustomer(payment.customerId) && matchesPayment(payment.method)).map((payment: any) => {
        const bank = payment.bankAccount || state.bankAccounts.find((account: any) => account.id === payment.bankAccountId);
        const bankLabel = bank
          ? `${bank.displayName}${bank.bankName ? ` (${bank.bankName})` : ""}`
          : "-";
        return {
        Date: formatDate(payment.date),
        Customer: customerName(payment.customerId),
        Reference: payment.referenceNo || payment.id,
        "Sale Number": payment.saleId ? (sales.find((sale: any) => sale.id === payment.saleId)?.voucherCode || payment.saleId) : "Not allocated",
        Amount: formatCurrency(number(payment.amount)),
        Method: payment.method,
        Bank: payment.method === "BANK" ? bankLabel : "-",
        "Remaining Balance": formatCurrency(number(payment.remainingBalance)),
        "Received By": payment.createdBy || "System",
        Branch: locationName(payment.locationId),
        _amount: number(payment.amount),
      };}));
    case "product-ranking": {
      const grouped = new Map<string, { item: string; qty: number; amount: number; profit: number }>();
      sales.filter((sale: any) => inRange(sale.saleDate) && matchesLocation(sale.locationId)).forEach((sale: any) => {
        sale.items.filter((line: any) => matchesItem(line.itemId) && matchesCategory(line.itemId)).forEach((line: any) => {
          const item = itemById(line.itemId);
          const cost = number(line.buyingPrice) * number(line.qty);
          const entry = grouped.get(line.itemId) || { item: line.itemName || item?.name || line.itemId, qty: 0, amount: 0, profit: 0 };
          entry.qty += number(line.qty);
          entry.amount += number(line.total);
          entry.profit += number(line.total) - cost;
          grouped.set(line.itemId, entry);
        });
      });
      const total = [...grouped.values()].reduce((sum, entry) => sum + entry.amount, 0);
      return finalize([...grouped.values()].sort((a, b) => b.amount - a.amount).map((entry, index) => ({
        Rank: index + 1,
        Item: entry.item,
        "Quantity Sold": entry.qty,
        "Net Sales": formatCurrency(entry.amount),
        "Gross Profit": formatCurrency(entry.profit),
        Contribution: total > 0 ? `${((entry.amount / total) * 100).toFixed(2)}%` : "0%",
        _amount: entry.amount,
        _quantity: entry.qty,
      })));
    }
    case "total-sales-by-item": {
      const grouped = new Map<string, { item: any; sales: Set<string>; qty: number; gross: number; discount: number; net: number; cost: number }>();
      sales.filter((sale: any) => inRange(sale.saleDate) && matchesLocation(sale.locationId)).forEach((sale: any) => sale.items.filter((line: any) => matchesItem(line.itemId) && matchesCategory(line.itemId)).forEach((line: any) => {
        const item = itemById(line.itemId);
        const entry = grouped.get(line.itemId) || { item, sales: new Set<string>(), qty: 0, gross: 0, discount: 0, net: 0, cost: 0 };
        entry.sales.add(sale.id); entry.qty += number(line.qty); entry.gross += number(line.price) * number(line.qty); entry.discount += number(line.discount); entry.net += number(line.total); entry.cost += number(line.buyingPrice) * number(line.qty);
        grouped.set(line.itemId, entry);
      }));
      return finalize([...grouped.values()].map((entry) => ({
        Code: entry.item?.code || "-", Item: entry.item?.name || "-", Category: entry.item?.category || "-", Sales: entry.sales.size, "Quantity Sold": entry.qty,
        "Average Price": formatCurrency(entry.qty > 0 ? entry.net / entry.qty : 0), "Gross Sales": formatCurrency(entry.gross), Discount: formatCurrency(entry.discount), "Net Sales": formatCurrency(entry.net), COGS: formatCurrency(entry.cost), "Gross Profit": formatCurrency(entry.net - entry.cost), Margin: entry.net > 0 ? `${(((entry.net - entry.cost) / entry.net) * 100).toFixed(2)}%` : "0%", _amount: entry.net, _quantity: entry.qty,
      })));
    }
    case "sales-by-date": {
      const grouped = new Map<string, any>();
      sales.filter((sale: any) => inRange(sale.saleDate) && matchesLocation(sale.locationId)).forEach((sale: any) => {
        const date = formatDate(sale.saleDate);
        const entry = grouped.get(date) || { count: 0, qty: 0, gross: 0, discount: 0, net: 0, cash: 0, bank: 0, credit: 0, cost: 0 };
        entry.count += 1; entry.qty += sale.items.reduce((sum: number, line: any) => sum + number(line.qty), 0); entry.gross += number(sale.subTotal); entry.discount += number(sale.discount); entry.net += number(sale.totalAmount); entry.cash += number(sale.cashAmount); entry.bank += number(sale.bankAmount); entry.credit += number(sale.creditAmount); entry.cost += sale.items.reduce((sum: number, line: any) => sum + number(line.buyingPrice) * number(line.qty), 0); grouped.set(date, entry);
      });
      return finalize([...grouped.entries()].map(([date, entry]) => ({ Date: date, Sales: entry.count, Quantity: entry.qty, "Gross Sales": formatCurrency(entry.gross), Discount: formatCurrency(entry.discount), "Net Sales": formatCurrency(entry.net), Cash: formatCurrency(entry.cash), Bank: formatCurrency(entry.bank), Credit: formatCurrency(entry.credit), COGS: formatCurrency(entry.cost), "Gross Profit": formatCurrency(entry.net - entry.cost), _amount: entry.net, _quantity: entry.qty })));
    }
    case "sales-by-customer":
      return finalize(state.customers.filter((customer: any) => matchesCustomer(customer.id)).map((customer: any) => {
        const rows = sales.filter((sale: any) => sale.customerId === customer.id && inRange(sale.saleDate) && matchesLocation(sale.locationId));
        const paid = rows.reduce((sum: number, sale: any) => sum + number(sale.cashAmount) + number(sale.bankAmount), 0);
        const latest = [...rows].sort((a: any, b: any) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime())[0];
        return { Customer: customer.name, Phone: customer.phone, Purchases: rows.length, Quantity: rows.reduce((sum: number, sale: any) => sum + sale.items.reduce((lineSum: number, line: any) => lineSum + number(line.qty), 0), 0), "Gross Sales": formatCurrency(rows.reduce((sum: number, sale: any) => sum + number(sale.subTotal), 0)), Discount: formatCurrency(rows.reduce((sum: number, sale: any) => sum + number(sale.discount), 0)), "Net Sales": formatCurrency(rows.reduce((sum: number, sale: any) => sum + number(sale.totalAmount), 0)), "Paid at Sale": formatCurrency(paid), "Global Outstanding": formatCurrency(number(customer.balance)), "Last Purchase": latest ? formatDate(latest.saleDate) : "Not recorded", _amount: rows.reduce((sum: number, sale: any) => sum + number(sale.totalAmount), 0), _href: `/customers/${customer.id}` };
      }).filter((row: any) => row.Purchases > 0));
    case "sales-by-employee": {
      const grouped = new Map<string, any>();
      sales.filter((sale: any) => inRange(sale.saleDate) && matchesLocation(sale.locationId)).forEach((sale: any) => {
        const key = sale.createdById || sale.createdByName || "System";
        const entry = grouped.get(key) || { name: sale.createdByName || "System", count: 0, qty: 0, gross: 0, discount: 0, net: 0, cash: 0, bank: 0, credit: 0, cost: 0 };
        entry.count += 1; entry.qty += sale.items.reduce((sum: number, line: any) => sum + number(line.qty), 0); entry.gross += number(sale.subTotal); entry.discount += number(sale.discount); entry.net += number(sale.totalAmount); entry.cash += number(sale.cashAmount); entry.bank += number(sale.bankAmount); entry.credit += number(sale.creditAmount); entry.cost += sale.items.reduce((sum: number, line: any) => sum + number(line.buyingPrice) * number(line.qty), 0); grouped.set(key, entry);
      });
      return finalize([...grouped.values()].map((entry) => ({ Employee: entry.name, Sales: entry.count, Quantity: entry.qty, "Gross Sales": formatCurrency(entry.gross), Discount: formatCurrency(entry.discount), "Net Sales": formatCurrency(entry.net), Cash: formatCurrency(entry.cash), Bank: formatCurrency(entry.bank), Credit: formatCurrency(entry.credit), COGS: formatCurrency(entry.cost), "Gross Profit": formatCurrency(entry.net - entry.cost), _amount: entry.net, _quantity: entry.qty })));
    }
    case "payment-breakdown": {
      const filtered = sales.filter((sale: any) => inRange(sale.saleDate) && matchesLocation(sale.locationId));
      const entries = [
        { method: "Cash", key: "cashAmount" }, { method: "Bank", key: "bankAmount" }, { method: "Credit", key: "creditAmount" },
      ].map(({ method, key }) => ({ method, count: filtered.filter((sale: any) => number(sale[key]) > 0).length, amount: filtered.reduce((sum: number, sale: any) => sum + number(sale[key]), 0) }));
      const total = entries.reduce((sum, entry) => sum + entry.amount, 0);
      return finalize(entries.map((entry) => ({ Method: entry.method, Transactions: entry.count, Amount: formatCurrency(entry.amount), Percentage: total > 0 ? `${((entry.amount / total) * 100).toFixed(2)}%` : "0%", _amount: entry.amount })));
    }
    case "inventory-quantity":
      return finalize(stockRows().map(({ product, location, item, stock, minimum, status }: any) => {
        const itemMovements = itemLocationMovements(product.id, location.id);
        const cost = weightedStockCost(product.id, location.id);
        return { Code: product.code || "-", Item: product.name, Category: product.category, Unit: product.unit, Branch: location.name, Opening: itemMovements.filter((movement: any) => movement.type === "OPENING_STOCK").reduce((sum: number, movement: any) => sum + number(movement.quantity), 0), Received: itemMovements.filter((movement: any) => movement.type === "PURCHASE").reduce((sum: number, movement: any) => sum + number(movement.quantity), 0), Sold: Math.abs(itemMovements.filter((movement: any) => movement.type === "SALE").reduce((sum: number, movement: any) => sum + number(movement.quantity), 0)), "Transfer In": itemMovements.filter((movement: any) => movement.type === "TRANSFER_IN").reduce((sum: number, movement: any) => sum + number(movement.quantity), 0), "Transfer Out": Math.abs(itemMovements.filter((movement: any) => movement.type === "TRANSFER_OUT").reduce((sum: number, movement: any) => sum + number(movement.quantity), 0)), Adjustments: itemMovements.filter((movement: any) => movement.type === "ADJUSTMENT").reduce((sum: number, movement: any) => sum + number(movement.quantity), 0), Damaged: Math.abs(itemMovements.filter((movement: any) => movement.type === "DAMAGE").reduce((sum: number, movement: any) => sum + number(movement.quantity), 0)), "Current Quantity": stock, "Average Cost": formatCurrency(cost.average), "Selling Price": formatCurrency(number(item?.sellingPrice ?? product.price)), "Stock Cost": formatCurrency(cost.value), Minimum: minimum, Status: status, _amount: cost.value, _quantity: stock, _href: "/items" };
      }));
    case "inventory-as-of": {
      const cutoff = filters.dateTo ? new Date(filters.dateTo).getTime() + 86400000 - 1 : Date.now();
      return finalize(stockRows().map(({ product, location, stock }: any) => {
        const itemMovements = itemLocationMovements(product.id, location.id);
        const laterMovement = itemMovements.filter((movement: any) => new Date(movementDate(movement)).getTime() > cutoff).reduce((sum: number, movement: any) => sum + number(movement.quantity), 0);
        const throughDate = itemMovements.filter((movement: any) => new Date(movementDate(movement)).getTime() <= cutoff);
        const closing = stock - laterMovement;
        return { "As of": new Date(cutoff).toLocaleDateString(), Code: product.code || "-", Item: product.name, Branch: location.name, Opening: throughDate.filter((movement: any) => movement.type === "OPENING_STOCK").reduce((sum: number, movement: any) => sum + number(movement.quantity), 0), Received: throughDate.filter((movement: any) => movement.type === "PURCHASE").reduce((sum: number, movement: any) => sum + number(movement.quantity), 0), "Transfer In": throughDate.filter((movement: any) => movement.type === "TRANSFER_IN").reduce((sum: number, movement: any) => sum + number(movement.quantity), 0), Sold: Math.abs(throughDate.filter((movement: any) => movement.type === "SALE").reduce((sum: number, movement: any) => sum + number(movement.quantity), 0)), "Transfer Out": Math.abs(throughDate.filter((movement: any) => movement.type === "TRANSFER_OUT").reduce((sum: number, movement: any) => sum + number(movement.quantity), 0)), Adjustments: throughDate.filter((movement: any) => movement.type === "ADJUSTMENT").reduce((sum: number, movement: any) => sum + number(movement.quantity), 0), Damaged: Math.abs(throughDate.filter((movement: any) => movement.type === "DAMAGE").reduce((sum: number, movement: any) => sum + number(movement.quantity), 0)), "Closing Quantity": closing, _quantity: closing };
      }));
    }
    case "stock-valuation":
      return finalize(stockRows().map(({ product, location, item, stock }: any) => {
        const cost = weightedStockCost(product.id, location.id);
        return { Code: product.code || "-", Item: product.name, Branch: location.name, "Remaining Quantity": stock, "Average Buying Cost": formatCurrency(cost.average), "Inventory Cost": formatCurrency(cost.value), _amount: cost.value, _quantity: stock };
      }));
    case "stock-replenishment":
      return finalize(stockRows().filter(({ status }: any) => status !== "OK").map(({ product, location, stock, minimum, status }: any) => ({ Code: product.code || "-", Item: product.name, Category: product.category, Branch: location.name, "Current Quantity": stock, "Minimum Stock": minimum, Shortage: Math.max(0, minimum - stock), "Last Purchase": lastPurchaseFor(product.id, location.id) ? formatDate(lastPurchaseFor(product.id, location.id).purchaseDate) : "Not recorded", "Last Sale": lastSaleFor(product.id, location.id) ? formatDate(lastSaleFor(product.id, location.id).saleDate) : "Not recorded", Status: status, _quantity: stock, _href: "/items/low-stock" })));
    case "zero-stock":
      return finalize(stockRows().filter(({ stock }: any) => stock === 0).map(({ product, location }: any) => ({ Code: product.code || "-", Item: product.name, Category: product.category, Unit: product.unit, Branch: location.name, "Last Purchase": lastPurchaseFor(product.id, location.id) ? formatDate(lastPurchaseFor(product.id, location.id).purchaseDate) : "Not recorded", "Last Sale": lastSaleFor(product.id, location.id) ? formatDate(lastSaleFor(product.id, location.id).saleDate) : "Not recorded", _quantity: 0 })));
    case "branch-stock-comparison":
      return finalize(products.filter((product: any) => matchesItem(product.id) && matchesCategory(product.id, product.category)).map((product: any) => {
        const quantities = Object.fromEntries(locations.map((location: any) => [location.name, number(currentItem(product.id, location.id)?.stock)]));
        const total = Object.values(quantities).reduce<number>((sum, value) => sum + number(value), 0);
        return { Code: product.code || "-", Item: product.name, Category: product.category, Unit: product.unit, ...quantities, Total: total, _quantity: total };
      }));
    case "slow-moving-items":
      return finalize(stockRows().filter(({ stock }: any) => stock > 0).map(({ product, location, stock }: any) => {
        const periodQty = sales.filter((sale: any) => sale.locationId === location.id && inRange(sale.saleDate)).flatMap((sale: any) => sale.items).filter((line: any) => line.itemId === product.id).reduce((sum: number, line: any) => sum + number(line.qty), 0);
        const lastSale = lastSaleFor(product.id, location.id); const cost = weightedStockCost(product.id, location.id);
        return { Item: product.name, Category: product.category, Unit: product.unit, Branch: location.name, "Current Quantity": stock, "Current Stock Cost": formatCurrency(cost.value), "Period Quantity Sold": periodQty, "Last Sale": lastSale ? formatDate(lastSale.saleDate) : "Never", "Days Since Last Sale": lastSale ? Math.max(0, Math.floor((Date.now() - new Date(lastSale.saleDate).getTime()) / 86400000)) : "Not applicable", _amount: cost.value, _quantity: stock };
      }).sort((a: any, b: any) => number(a["Period Quantity Sold"]) - number(b["Period Quantity Sold"])));
    case "stock-movement-log":
      return finalize(movements.filter((movement: any) => inRange(movementDate(movement)) && matchesLocation(movement.locationId) && matchesItem(movement.itemId) && matchesCategory(movement.itemId, movement.category) && (!filters.status || movement.type === filters.status)).sort((a: any, b: any) => new Date(movementDate(b)).getTime() - new Date(movementDate(a)).getTime()).map((movement: any) => {
        const transfer = movement.referenceType === "TRANSFER" ? (state.transfers || []).find((entry: any) => entry.id === movement.referenceId && entry.itemId === movement.itemId) : null;
        const batch = batches.find((entry: any) => entry.id === movement.inventoryBatchId);
        return { "Date & Time": new Date(movementDate(movement)).toLocaleString(), Code: movement.itemCode || "-", Item: movement.itemName, Branch: movement.locationName, Type: String(movement.type).replace(/_/g, " "), Reference: movement.referenceId || "-", Description: movement.note || "-", "Quantity In": number(movement.quantity) > 0 ? number(movement.quantity) : 0, "Quantity Out": number(movement.quantity) < 0 ? Math.abs(number(movement.quantity)) : 0, "Balance After": number(movementBalance.get(movement.id)), "Buying Price": batch ? formatCurrency(number(batch.buyingPrice)) : "Not recorded", "Source Branch": transfer ? locationName(transfer.fromLocationId) : "-", "Destination Branch": transfer ? locationName(transfer.toLocationId) : "-", "Created By": movement.createdByName || "System", _quantity: Math.abs(number(movement.quantity)) };
      }));
    case "stock-damage":
      return finalize(
        movements
          .filter(
            (movement: any) =>
              movement.type === "DAMAGE" &&
              inRange(movementDate(movement)) &&
              matchesLocation(movement.locationId) &&
              matchesItem(movement.itemId) &&
              matchesCategory(movement.itemId, movement.category),
          )
          .sort(
            (a: any, b: any) =>
              new Date(movementDate(b)).getTime() - new Date(movementDate(a)).getTime(),
          )
          .map((movement: any) => {
            const product = itemById(movement.itemId);
            const qty = Math.abs(number(movement.quantity));
            const unitCost = number(product?.buyingPrice);
            const cost = qty * unitCost;
            return {
              Date: new Date(movementDate(movement)).toLocaleString(),
              Code: movement.itemCode || product?.code || "-",
              Item: movement.itemName || product?.name || movement.itemId,
              Category: movement.category || product?.category || "-",
              "Dispensary / Store": movement.locationName || locationName(movement.locationId),
              Qty: qty,
              "Est. Unit Cost": formatCurrency(unitCost),
              "Est. Cost": formatCurrency(cost),
              Reason: movement.note || "-",
              "Created By": movement.createdByName || "System",
              _amount: cost,
              _quantity: qty,
              _href: "/store/damage",
            };
          }),
      );
    case "location-transfers":
      return finalize(newestFirst(state.transfers || [], (transfer: any) => transfer.date).filter((transfer) => inRange(transfer.date) && matchesItem(transfer.itemId) && matchesCategory(transfer.itemId) && (!filters.locationId || transfer.fromLocationId === filters.locationId || transfer.toLocationId === filters.locationId)).map((transfer) => ({
        Date: formatDate(transfer.date),
        From: locationName(transfer.fromLocationId),
        To: locationName(transfer.toLocationId),
        Item: itemById(transfer.itemId)?.name || transfer.itemId,
        Qty: transfer.quantity,
        Status: transfer.status,
        _quantity: transfer.quantity,
        _href: "/store/transfers",
      })));
    case "purchase-list":
      return finalize(scopedPurchases().map((purchase: any) => ({
        Date: formatDate(purchase.purchaseDate),
        "Purchase Number": purchase.invoiceNo || purchase.id,
        Supplier: supplierName(purchase.supplierId),
        Quantity: purchase.items.reduce((sum: number, line: any) => sum + number(line.qty), 0),
        Payment: purchase.paymentMethod,
        Total: formatCurrency(purchase.totalAmount),
        Cash: formatCurrency(number(purchase.cashAmount)),
        Bank: formatCurrency(number(purchase.bankAmount)),
        Paid: formatCurrency(purchase.paidAmount),
        Payable: formatCurrency(purchase.debtAmount),
        Status: purchase.paymentStatus,
        Branch: locationName(purchase.locationId),
        "Created By": purchase.createdByName || "System",
        _amount: number(purchase.totalAmount),
        _quantity: purchase.items.reduce((sum: number, line: any) => sum + number(line.qty), 0),
        _href: `/purchases/${purchase.id}`,
      })));
    case "purchased-items":
    case "purchases-by-item":
      return finalize(purchases.filter((purchase: any) =>
        inRange(purchase.purchaseDate) &&
        matchesLocation(purchase.locationId) &&
        matchesSupplier(purchase.supplierId)
      ).flatMap((purchase: any) =>
        purchase.items.filter((line: any) => matchesItem(line.itemId) && matchesCategory(line.itemId)).map((line: any) => ({ Date: formatDate(purchase.purchaseDate), "Purchase Number": purchase.invoiceNo || purchase.id, Supplier: supplierName(purchase.supplierId), Code: itemById(line.itemId)?.code || "-", Item: itemById(line.itemId)?.name || line.itemId, Quantity: number(line.qty), Unit: itemById(line.itemId)?.unit || "-", "Buying Price": formatCurrency(number(line.unitCost)), "Total Purchase Cost": formatCurrency(number(line.total)), Branch: locationName(purchase.locationId), _amount: number(line.total), _quantity: number(line.qty), _href: `/purchases/${purchase.id}` }))
      ));
    case "purchases-by-supplier":
      return finalize(state.suppliers.filter((supplier: any) => matchesSupplier(supplier.id)).map((supplier: any) => {
        const rows = purchases.filter((purchase: any) => purchase.supplierId === supplier.id && inRange(purchase.purchaseDate) && matchesLocation(purchase.locationId)); const latest = [...rows].sort((a: any, b: any) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime())[0];
        return { Supplier: supplier.name, Purchases: rows.length, "Quantity Purchased": rows.reduce((sum: number, purchase: any) => sum + purchase.items.reduce((lineSum: number, line: any) => lineSum + number(line.qty), 0), 0), "Purchase Value": formatCurrency(rows.reduce((sum: number, purchase: any) => sum + number(purchase.totalAmount), 0)), "Paid at Purchase": formatCurrency(rows.reduce((sum: number, purchase: any) => sum + number(purchase.paidAmount), 0)), "Recorded Purchase Debt": formatCurrency(rows.reduce((sum: number, purchase: any) => sum + number(purchase.debtAmount), 0)), "Current Outstanding": formatCurrency(number(supplier.debt)), "Last Purchase": latest ? formatDate(latest.purchaseDate) : "Not recorded", _amount: rows.reduce((sum: number, purchase: any) => sum + number(purchase.totalAmount), 0), _href: `/suppliers/${supplier.id}` };
      }).filter((row: any) => row.Purchases > 0));
    case "purchase-summary": {
      const rows = purchases.filter((purchase: any) => inRange(purchase.purchaseDate) && matchesLocation(purchase.locationId) && matchesSupplier(purchase.supplierId));
      const quantity = rows.reduce((sum: number, purchase: any) => sum + purchase.items.reduce((lineSum: number, line: any) => lineSum + number(line.qty), 0), 0); const total = rows.reduce((sum: number, purchase: any) => sum + number(purchase.totalAmount), 0);
      return finalize([{ Purchases: rows.length, "Quantity Purchased": quantity, "Purchase Value": formatCurrency(total), Paid: formatCurrency(rows.reduce((sum: number, purchase: any) => sum + number(purchase.paidAmount), 0)), "Recorded Payable": formatCurrency(rows.reduce((sum: number, purchase: any) => sum + number(purchase.debtAmount), 0)), Cash: formatCurrency(rows.reduce((sum: number, purchase: any) => sum + number(purchase.cashAmount), 0)), Bank: formatCurrency(rows.reduce((sum: number, purchase: any) => sum + number(purchase.bankAmount), 0)), _amount: total, _quantity: quantity }]);
    }
    case "supplier-payables":
      return finalize(state.suppliers.filter((supplier: any) => number(supplier.debt) > 0 && matchesSupplier(supplier.id)).map((supplier: any) => {
        const latest = purchases.filter((purchase: any) => purchase.supplierId === supplier.id).sort((a: any, b: any) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime())[0];
        return {
        Supplier: supplier.name,
        Phone: supplier.phone,
        "Current Outstanding": formatCurrency(number(supplier.debt)),
        "Last Purchase": latest ? formatDate(latest.purchaseDate) : "Not recorded",
        Status: "Outstanding",
        _amount: number(supplier.debt),
        _href: `/suppliers/${supplier.id}`,
      };}));
    case "expense-analysis":
      return finalize(newestFirst(state.expenses || [], (expense: any) => expense.date).filter((expense) =>
        inRange(expense.date) &&
        matchesLocation(expense.locationId) &&
        matchesPayment(expense.paymentMethod) &&
        matchesAccount(expense.bankAccountId) &&
        (!filters.category || expense.category === filters.category)
      ).map((expense) => ({
        Date: formatDate(expense.date),
        Category: expense.category,
        "Expense Name": expense.name || expense.description,
        Description: expense.description || "-",
        Location: locationName(expense.locationId),
        Method: expense.paymentMethod,
        Amount: formatCurrency(expense.amount),
        "Created By": expense.createdByName || "System",
        _amount: expense.amount,
        _href: "/finance/expenses",
      })));
    case "bank-transactions": {
      const signed = (tx: any) => ["WITHDRAW", "SUPPLIER_PAYMENT"].includes(tx.type) ? -number(tx.amount) : number(tx.amount);
      const balances = new Map<string, number>(); const running = new Map<string, number>();
      state.bankAccounts.forEach((account: any) => { const accountRows = (state.bankTransactions || []).filter((tx: any) => tx.bankAccountId === account.id); balances.set(account.id, number(account.currentBalance) - accountRows.reduce((sum: number, tx: any) => sum + signed(tx), 0)); });
      [...(state.bankTransactions || [])].sort((a: any, b: any) => timeOf(a.transactionDate) - timeOf(b.transactionDate) || timeOf(a.createdAt) - timeOf(b.createdAt)).forEach((tx: any) => { const next = number(balances.get(tx.bankAccountId)) + signed(tx); balances.set(tx.bankAccountId, next); running.set(tx.id, next); });
      return finalize(newestFirst(state.bankTransactions || [], (tx: any) => tx.transactionDate).filter((tx: any) => inRange(tx.transactionDate) && matchesLocation(tx.locationId) && matchesAccount(tx.bankAccountId)).map((tx: any) => ({ "Date & Time": new Date(tx.transactionDate).toLocaleString(), Bank: tx.bankAccountName, Account: tx.accountNumber || "-", Type: String(tx.type).replace(/_/g, " "), Reference: tx.referenceNo || "-", Description: tx.description || "-", Inflow: signed(tx) > 0 ? formatCurrency(number(tx.amount)) : "-", Outflow: signed(tx) < 0 ? formatCurrency(number(tx.amount)) : "-", "Balance After": formatCurrency(number(running.get(tx.id))), "Created By": tx.createdByName || "System", Branch: locationName(tx.locationId), _amount: number(tx.amount), _inflow: signed(tx) > 0 ? number(tx.amount) : 0, _outflow: signed(tx) < 0 ? number(tx.amount) : 0 })));
    }
    case "cash-to-bank":
      return finalize(newestFirst(state.cashTransfers || [], (transfer: any) => transfer.date).filter((transfer: any) => inRange(transfer.date) && matchesLocation(transfer.locationId) && matchesAccount(transfer.bankAccountId)).map((transfer: any) => ({ Date: formatDate(transfer.date), Reference: transfer.referenceNo || transfer.id, "Destination Bank": bankName(transfer.bankAccountId), "Account Number": state.bankAccounts.find((account: any) => account.id === transfer.bankAccountId)?.accountNumber || "-", Amount: formatCurrency(number(transfer.amount)), Description: transfer.note || "-", "Deposited By": transfer.createdByName || "System", Branch: locationName(transfer.locationId), _amount: number(transfer.amount) })));
    case "profit-summary": {
      const selectedSales = sales.filter((sale: any) => inRange(sale.saleDate) && matchesLocation(sale.locationId)); const selectedExpenses = (state.expenses || []).filter((expense: any) => inRange(expense.date) && matchesLocation(expense.locationId));
      const gross = selectedSales.reduce((sum: number, sale: any) => sum + number(sale.subTotal), 0); const discount = selectedSales.reduce((sum: number, sale: any) => sum + number(sale.discount), 0); const net = selectedSales.reduce((sum: number, sale: any) => sum + number(sale.totalAmount), 0); const cost = selectedSales.reduce((sum: number, sale: any) => sum + sale.items.reduce((lineSum: number, line: any) => lineSum + number(line.buyingPrice) * number(line.qty), 0), 0); const expenses = selectedExpenses.reduce((sum: number, expense: any) => sum + number(expense.amount), 0); const grossProfit = net - cost; const netProfit = grossProfit - expenses;
      return finalize([{ "Gross Sales": formatCurrency(gross), Discounts: formatCurrency(discount), "Net Sales": formatCurrency(net), COGS: formatCurrency(cost), "Gross Profit": formatCurrency(grossProfit), Expenses: formatCurrency(expenses), "Net Profit": formatCurrency(netProfit), "Gross Margin": net > 0 ? `${((grossProfit / net) * 100).toFixed(2)}%` : "0%", "Net Margin": net > 0 ? `${((netProfit / net) * 100).toFixed(2)}%` : "0%", _amount: netProfit }]);
    }
    case "audit-security":
    case "user-activity":
      return finalize(newestFirst(state.auditLogs || [], (log: any) => log.createdAt).filter((log: any) =>
        inRange(log.createdAt) &&
        matchesLocation(log.locationId)
      ).map((log: any) => ({
        Date: formatDate(log.createdAt),
        User: log.userName,
        Module: log.module,
        Action: log.action,
        Record: [log.tableName, log.recordId].filter(Boolean).join(" / ") || "-",
        Location: log.locationId ? locationName(log.locationId) : "Global",
      })));
    default:
      return [];
  }
}

function summarizeRows(rows: ReportRow[]): { amount: number; quantity: number; inflow: number; outflow: number } {
  return {
    amount: sumMoney(rows.map((row) => Number(row._amount || 0))),
    quantity: rows.reduce((total, row) => total + Number(row._quantity || row.Qty || row.Stock || 0), 0),
    inflow: sumMoney(rows.map((row) => Number(row._inflow || 0))),
    outflow: sumMoney(rows.map((row) => Number(row._outflow || 0))),
  };
}

function defaultColumns(reportId: string) {
  if (reportId.includes("inventory") || reportId.includes("stock")) return ["Location", "Item", "Category", "Stock", "Status"];
  if (reportId.includes("purchase") || reportId.includes("supplier")) return ["Date", "Supplier", "Total", "Status"];
  if (reportId.includes("expense") || reportId.includes("ledger") || reportId.includes("account")) return ["Date", "Category", "Account", "Amount"];
  return ["Date", "Reference", "Location", "Amount"];
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString();
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function exportReportCsv(title: string, rows: ReportRow[], columns: string[]) {
  const safeCell = (value: unknown) => {
    let text = String(value ?? "");
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const csv = [columns.map(safeCell).join(","), ...rows.map((row) => columns.map((column) => safeCell(row[column])).join(","))].join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
