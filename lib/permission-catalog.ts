export const PERMISSION_CATALOG = [
  { module: "Dashboard", key: "dashboard.view", label: "View dashboard" },

  { module: "Inventory", key: "inventory.items.view", label: "View item list" },
  { module: "Inventory", key: "inventory.items.create", label: "Create items" },
  { module: "Inventory", key: "inventory.items.update", label: "Update items" },
  { module: "Inventory", key: "inventory.items.delete", label: "Delete unused items" },
  { module: "Inventory", key: "inventory.categories.view", label: "View categories" },
  { module: "Inventory", key: "inventory.categories.manage", label: "Manage categories" },
  { module: "Inventory", key: "inventory.stock.view", label: "View stock" },
  { module: "Inventory", key: "inventory.stock.adjust", label: "Adjust stock" },
  { module: "Inventory", key: "inventory.transfers.view", label: "View stock transfers" },
  { module: "Inventory", key: "inventory.transfers.create", label: "Create stock transfers" },
  { module: "Inventory", key: "inventory.movements.view", label: "View stock movements" },

  { module: "Purchases", key: "purchases.view", label: "View purchases" },
  { module: "Purchases", key: "purchases.create", label: "Create purchases" },
  { module: "Purchases", key: "purchases.update", label: "Update purchases" },
  { module: "Purchases", key: "purchases.delete", label: "Delete purchases (restore stock & payments)" },

  { module: "Sales", key: "sales.view", label: "View sales" },
  { module: "Sales", key: "sales.create", label: "Create sales" },
  { module: "Sales", key: "sales.pos", label: "Use POS" },
  { module: "Sales", key: "sales.update", label: "Update sales" },
  { module: "Sales", key: "sales.delete", label: "Delete sales (restore stock & payments)" },
  { module: "Sales", key: "sales.sell_below_cost", label: "Approve selling below batch cost" },

  { module: "Inventory", key: "inventory.expiry.view", label: "View expiry monitoring" },

  { module: "Customers", key: "customers.view", label: "View customers" },
  { module: "Customers", key: "customers.create", label: "Create customers" },
  { module: "Customers", key: "customers.update", label: "Update customers" },
  { module: "Customers", key: "customers.delete", label: "Delete customers" },
  { module: "Customers", key: "customers.payments.create", label: "Record customer payments" },

  { module: "Suppliers", key: "suppliers.view", label: "View suppliers" },
  { module: "Suppliers", key: "suppliers.create", label: "Create suppliers" },
  { module: "Suppliers", key: "suppliers.update", label: "Update suppliers" },
  { module: "Suppliers", key: "suppliers.delete", label: "Delete suppliers" },
  { module: "Suppliers", key: "suppliers.payments.create", label: "Record supplier payments" },

  { module: "Finance", key: "finance.overview.view", label: "View finance overview" },
  { module: "Finance", key: "finance.ledger.view", label: "View account ledger" },
  { module: "Finance", key: "finance.transactions.view", label: "View finance transactions" },
  { module: "Finance", key: "finance.expenses.view", label: "View expenses" },
  { module: "Finance", key: "finance.expenses.create", label: "Record expenses" },
  { module: "Finance", key: "finance.expenses.update", label: "Update expenses" },
  { module: "Finance", key: "finance.expenses.delete", label: "Delete expenses" },
  { module: "Finance", key: "finance.cash_to_bank.view", label: "View cash to bank transfers" },
  { module: "Finance", key: "finance.cash_to_bank.create", label: "Create cash to bank transfers" },
  { module: "Finance", key: "finance.banks.view", label: "View bank accounts" },
  { module: "Finance", key: "finance.banks.create", label: "Create bank accounts" },
  { module: "Finance", key: "finance.banks.update", label: "Update bank accounts" },
  { module: "Finance", key: "finance.banks.delete", label: "Delete bank accounts" },
  { module: "Finance", key: "finance.tax.view", label: "View tax report" },

  { module: "Reports", key: "reports.view", label: "View reports" },
  { module: "Reports", key: "reports.sales.view", label: "View sales reports" },
  { module: "Reports", key: "reports.inventory.view", label: "View inventory reports" },
  { module: "Reports", key: "reports.finance.view", label: "View finance reports" },
  { module: "Reports", key: "reports.audit.view", label: "View audit reports" },

  { module: "Admin", key: "admin.users.view", label: "View users" },
  { module: "Admin", key: "admin.users.create", label: "Create users" },
  { module: "Admin", key: "admin.users.update", label: "Update users" },
  { module: "Admin", key: "admin.users.delete", label: "Delete users" },
  { module: "Admin", key: "admin.roles.view", label: "View roles" },
  { module: "Admin", key: "admin.roles.manage", label: "Manage roles" },
  { module: "Admin", key: "admin.permissions.view", label: "View permissions" },
  { module: "Admin", key: "admin.settings.view", label: "View settings" },
  { module: "Admin", key: "admin.settings.update", label: "Update settings" },
  { module: "Admin", key: "admin.locations.view", label: "View locations" },
  { module: "Admin", key: "admin.locations.create", label: "Create locations" },
  { module: "Admin", key: "admin.locations.update", label: "Update locations" },
  { module: "Admin", key: "admin.locations.delete", label: "Delete locations" },
  { module: "Admin", key: "admin.transactions.view", label: "View central transactions" },
  { module: "Admin", key: "admin.backup.manage", label: "Manage backup and restore" },
] as const;

export type PermissionCatalogItem = (typeof PERMISSION_CATALOG)[number];

function titleCase(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function formatPermissionLabel(permission?: { key?: string; label?: string | null; name?: string | null } | null) {
  if (!permission) return "Permission";
  if (permission.name) return permission.name;
  if (permission.label) return titleCase(permission.label);

  const parts = String(permission.key || "").split(".").filter(Boolean);
  const action = parts.at(-1) || permission.key || "Permission";
  const resource = parts.at(-2) || "";
  return `${titleCase(action)} ${titleCase(resource)}`.trim();
}

export function groupPermissions<T extends { module: string }>(permissions: T[]) {
  return permissions.reduce<Record<string, T[]>>((groups, permission) => {
    groups[permission.module] = groups[permission.module] || [];
    groups[permission.module].push(permission);
    return groups;
  }, {});
}
