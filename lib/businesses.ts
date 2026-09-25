export const ACTIVE_BUSINESS_STORAGE_KEY = "activeBusinessId";

export const BUSINESSES = [
  {
    id: "loc-pharmacy-bole",
    name: "Bole Pharmacy",
    type: "BUSINESS",
    location: "Bole, Addis Ababa",
  },
  {
    id: "loc-pharmacy-piazza",
    name: "Piazza Pharmacy",
    type: "BUSINESS",
    location: "Piazza, Addis Ababa",
  },
  {
    id: "loc-pharmacy-merkato",
    name: "Merkato Pharmacy",
    type: "BUSINESS",
    location: "Merkato, Addis Ababa",
  },
] as const;

export const LEGACY_LOCATION_ID = "loc-shop-main";

/** Fashion retail locations retired when this app became a pharmacy demo. */
export const RETIRED_BUSINESS_IDS = [
  "loc-all-american-shoes",
  "loc-lanchi-hair",
  "loc-alpha-male",
  LEGACY_LOCATION_ID,
] as const;

type BusinessLike = {
  id?: string;
  name?: string;
  type?: string;
  location?: string | null;
} | null | undefined;

const BUSINESS_ACCENTS: Record<string, { mark: string; chip: string; bar: string; sub: string; selected: string }> = {
  "loc-pharmacy-bole": {
    mark: "bg-teal-600",
    chip: "border-teal-200 bg-teal-50 dark:border-teal-800 dark:bg-teal-950/40",
    bar: "bg-teal-600",
    sub: "text-slate-900 dark:text-white",
    selected: "border-teal-400 bg-teal-100 ring-2 ring-teal-500 dark:border-teal-400 dark:bg-teal-950/80 dark:ring-teal-400",
  },
  "loc-pharmacy-piazza": {
    mark: "bg-emerald-600",
    chip: "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40",
    bar: "bg-emerald-600",
    sub: "text-slate-900 dark:text-white",
    selected: "border-emerald-400 bg-emerald-100 ring-2 ring-emerald-500 dark:border-emerald-400 dark:bg-emerald-950/80 dark:ring-emerald-400",
  },
  "loc-pharmacy-merkato": {
    mark: "bg-sky-600",
    chip: "border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40",
    bar: "bg-sky-600",
    sub: "text-slate-900 dark:text-white",
    selected: "border-sky-400 bg-sky-100 ring-2 ring-sky-500 dark:border-sky-400 dark:bg-sky-950/80 dark:ring-sky-400",
  },
};

const DEFAULT_ACCENT = {
  mark: "bg-indigo-600",
  chip: "border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-950",
  bar: "bg-indigo-600",
  sub: "text-slate-900 dark:text-white",
  selected: "border-indigo-400 bg-indigo-100 ring-2 ring-indigo-500 dark:border-indigo-400 dark:bg-indigo-950/80 dark:ring-indigo-400",
};

export function businessTypeLabel(type?: string | null) {
  if (!type || type === "BUSINESS") return "Pharmacy";
  return type.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function businessInitials(name?: string | null) {
  const words = String(name || "Pharmacy").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "PH";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

export function getBusinessBrand(business?: BusinessLike) {
  const accent = (business?.id && BUSINESS_ACCENTS[business.id]) || DEFAULT_ACCENT;
  return {
    id: business?.id || "",
    name: business?.name || "Select Pharmacy",
    typeLabel: businessTypeLabel(business?.type),
    place: business?.location || "",
    initials: businessInitials(business?.name),
    ...accent,
  };
}

function asIdList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(",").map((entry) => entry.trim()).filter(Boolean);
  }
  return [];
}

export function isRetiredBusinessId(locationId?: string | null) {
  const id = String(locationId || "");
  if (!id) return false;
  const tenant = id.endsWith("-store") ? id.slice(0, -"-store".length) : id;
  return (RETIRED_BUSINESS_IDS as readonly string[]).includes(tenant);
}

export function retiredLocationIds() {
  return RETIRED_BUSINESS_IDS.flatMap((id) => [id, `${id}-store`]);
}

export function remapLocationId(locationId?: string | null) {
  if (!locationId) return "";
  if (!isRetiredBusinessId(locationId)) return locationId;
  const mapped = BUSINESSES[0].id;
  return String(locationId).endsWith("-store") ? storeLocationIdFor(mapped) : mapped;
}

export function normalizeAssignedLocationIds(user?: {
  role?: string;
  assignedLocations?: unknown;
  assignedBusinesses?: Array<{ id?: string }>;
  locationId?: string | null;
} | null) {
  const ids = [
    ...asIdList(user?.assignedLocations),
    ...(user?.assignedBusinesses || []).map((business) => String(business?.id || "").trim()),
    user?.locationId || "",
  ]
    .map((id) => remapLocationId(id))
    .filter(Boolean);
  return [...new Set(ids)];
}

export function catalogBusiness(id?: string | null) {
  const mappedId = remapLocationId(id);
  return BUSINESSES.find((business) => business.id === mappedId) || null;
}

export function toBusinessSummary(business?: BusinessLike) {
  if (!business?.id && !business?.name) return null;
  const mappedId = remapLocationId(business?.id) || business?.id || "";
  const catalog = catalogBusiness(mappedId);
  if (!mappedId && !catalog) return null;
  return {
    id: mappedId || catalog?.id || "",
    name: catalog?.name || business?.name || "",
    type: business?.type || catalog?.type || "BUSINESS",
    location: business?.location || catalog?.location || "",
  };
}

export function resolveAvailableLocations<T extends { id: string; name?: string; type?: string; location?: string | null }>(
  user: {
    role?: string;
    assignedLocations?: unknown;
    assignedBusinesses?: Array<{ id?: string; name?: string; type?: string; location?: string | null }>;
    locationId?: string | null;
  } | null | undefined,
  locations: T[] = [],
) {
  if (user?.role === "Super Admin") {
    const businesses = locations.filter(isTenantBusiness);
    return businesses.length ? businesses : [...BUSINESSES];
  }

  const assignedIds = [...new Set(normalizeAssignedLocationIds(user).map((id) => tenantBusinessId(id)))];
  const fromApi = assignedIds.length
    ? locations.filter((location) => assignedIds.includes(tenantBusinessId(location.id)) && isTenantBusiness(location))
    : locations.filter(isTenantBusiness);
  if (fromApi.length) return fromApi;

  const fromSession = (user?.assignedBusinesses || [])
    .map((business) => toBusinessSummary(business))
    .filter(Boolean) as Array<{ id: string; name: string; type: string; location: string }>;
  if (fromSession.length) return fromSession;

  const fromCatalog = assignedIds
    .map((id) => catalogBusiness(id))
    .filter(Boolean) as Array<(typeof BUSINESSES)[number]>;
  if (fromCatalog.length) return fromCatalog;

  return locations;
}

export function defaultBusinessForUser<T extends { id: string }>(
  user: {
    role?: string;
    assignedLocations?: unknown;
    assignedBusinesses?: Array<{ id?: string; name?: string; type?: string; location?: string | null }>;
    locationId?: string | null;
  } | null | undefined,
  locations: T[] = [],
  preferredId?: string | null,
) {
  const available = resolveAvailableLocations(user, locations);
  const mappedPreferred = remapLocationId(preferredId);
  return (
    available.find((business) => business.id === mappedPreferred) ||
    available.find((business) => business.id === remapLocationId(user?.locationId)) ||
    available[0] ||
    null
  );
}

export function isStoreLocation(type?: string | null) {
  return type === "STORE";
}

export function isShopLocation(type?: string | null) {
  return !isStoreLocation(type);
}

export function isTenantBusiness(location?: { id?: string; type?: string | null } | null) {
  const id = String(location?.id || "");
  const type = String(location?.type || "");
  if (id.endsWith("-store") || type === "STORE") return false;
  if (type === "BUSINESS") return true;
  return BUSINESSES.some((business) => business.id === id);
}

export function storeLocationIdFor(businessId: string) {
  const tenant = tenantBusinessId(businessId);
  return `${tenant}-store`;
}

export function shopLocationIdFor(businessId: string) {
  return tenantBusinessId(businessId);
}

export function tenantBusinessId(locationId?: string | null) {
  const raw = String(locationId || "");
  if (!raw) return "";
  const tenant = raw.endsWith("-store") ? raw.slice(0, -"-store".length) : raw;
  if (tenant === LEGACY_LOCATION_ID) return BUSINESSES[0].id;
  return tenant;
}

export function stockLocationIdsFor(businessId?: string | null) {
  const tenant = tenantBusinessId(businessId);
  if (!tenant) return [];
  return [shopLocationIdFor(tenant), storeLocationIdFor(tenant)];
}

export function isStoreLocationId(locationId?: string | null) {
  return String(locationId || "").endsWith("-store");
}

export function stockLocationLabel(locationId?: string | null, type?: string | null) {
  if (isStoreLocation(type) || isStoreLocationId(locationId)) return "Store";
  return "Counter";
}

export function belongsToBusiness(locationId: string | null | undefined, businessId: string | null | undefined) {
  const tenant = tenantBusinessId(businessId);
  if (!tenant || !locationId) return false;
  return tenantBusinessId(locationId) === tenant;
}

export function stockScopeIdsFor(businessIds: Array<string | null | undefined>) {
  return [...new Set(businessIds.flatMap((id) => stockLocationIdsFor(id)))];
}

export function resolveStockLocationId(businessId: string, requested?: string | null) {
  const tenant = tenantBusinessId(businessId);
  const requestedId = String(requested || "").trim();
  if (requestedId && stockLocationIdsFor(tenant).includes(requestedId)) return requestedId;
  return shopLocationIdFor(tenant);
}

export function matchesStockView(type: string | null | undefined, view: "SHOP" | "STORE") {
  return view === "STORE" ? isStoreLocation(type) : isShopLocation(type);
}

export function stockViewForLocation(type?: string | null): "SHOP" | "STORE" {
  return isStoreLocation(type) ? "STORE" : "SHOP";
}

export function locationsForCurrentBusiness<T extends { id?: string; type?: string }>(
  currentLocation?: T | null,
  locations: T[] = [],
): T[] {
  const tenant = tenantBusinessId(currentLocation?.id);
  if (!tenant) return locations;
  const allowed = new Set(stockLocationIdsFor(tenant));
  const matches = locations.filter((location) => allowed.has(String(location.id || "")));
  return matches.length ? matches : currentLocation ? [currentLocation] : [];
}

export function cashAccountIdFor(locationId: string) {
  return `cash-${locationId}`;
}

export function defaultBankAccountIdFor(locationId: string) {
  return `bank-${locationId}`;
}

/** Record URLs that belong to one business. On switch, send the user to the matching list. */
export function homePathWhenLeavingBusiness(pathname: string, search = "") {
  const path = pathname.replace(/\/$/, "") || "/";
  const query = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(query);

  if (path === "/items/create" && params.get("id")) return "/items";

  const rules: Array<[RegExp, string]> = [
    [/^\/sales\/(?!create$|pos$|sold-items$|list$|returns$)[^/]+$/, "/sales"],
    [/^\/purchases\/(?!create$|items$|add$|returns$)[^/]+$/, "/purchases"],
    [/^\/customers\/(?!credits$|credit$)[^/]+$/, "/customers"],
    [/^\/suppliers\/(?!debts$|debt$)[^/]+$/, "/suppliers"],
    [/^\/finance\/banks\/[^/]+$/, "/finance/banks"],
  ];

  for (const [pattern, home] of rules) {
    if (pattern.test(path)) return home;
  }
  return null;
}

export function uncategorizedCategoryIdFor(locationId: string) {
  return `cat-uncategorized-${locationId}`;
}

export function piecesUnitIdFor(locationId: string) {
  return pharmacyUnitId(locationId, "pcs");
}

export const PHARMACY_UNITS = [
  { key: "tab", name: "Tablet", shortName: "Tab" },
  { key: "cap", name: "Capsule", shortName: "Cap" },
  { key: "str", name: "Strip", shortName: "Str" },
  { key: "box", name: "Box", shortName: "Box" },
  { key: "btl", name: "Bottle", shortName: "Btl" },
  { key: "pcs", name: "Piece", shortName: "Pcs" },
  { key: "pack", name: "Pack", shortName: "Pack" },
  { key: "sch", name: "Sachet", shortName: "Sch" },
  { key: "tube", name: "Tube", shortName: "Tube" },
  { key: "vial", name: "Vial", shortName: "Vial" },
  { key: "amp", name: "Ampoule", shortName: "Amp" },
  { key: "jar", name: "Jar", shortName: "Jar" },
  { key: "bag", name: "Bag", shortName: "Bag" },
  { key: "can", name: "Can", shortName: "Can" },
  { key: "roll", name: "Roll", shortName: "Roll" },
  { key: "pair", name: "Pair", shortName: "Pair" },
  { key: "set", name: "Set", shortName: "Set" },
  { key: "oth", name: "Other", shortName: "Other" },
] as const;

export type PharmacyUnitName = (typeof PHARMACY_UNITS)[number]["name"];

export function pharmacyUnitId(locationId: string, key: string) {
  return `unit-${key}-${locationId}`;
}

export const DEFAULT_EXPENSE_CATEGORY_NAMES = [
  "Rent",
  "Salaries",
  "Utilities",
  "Transport",
  "Marketing",
  "Supplies",
  "Maintenance",
  "Tax",
  "Other",
] as const;

export function defaultUnitsForBusiness(locationId: string) {
  return PHARMACY_UNITS.map((unit) => ({
    id: pharmacyUnitId(locationId, unit.key),
    name: unit.name,
    shortName: unit.shortName,
  }));
}

export function defaultBusinessSettings(companyName: string) {
  return [
    { key: "companyName", value: companyName },
    { key: "companyEmail", value: "" },
    { key: "companyPhone", value: "" },
    { key: "companyAddress", value: "" },
    { key: "currency", value: "ETB" },
    { key: "taxRate", value: "0" },
    { key: "lowStockThreshold", value: "10" },
    { key: "enableNotifications", value: "true" },
    { key: "enableEmailAlerts", value: "false" },
    { key: "passwordStrength", value: "Medium" },
    { key: "require2FA", value: "false" },
  ];
}

export function parseSettingRecord(settingValue: Record<string, string>) {
  return {
    companyName: settingValue.companyName || "",
    companyEmail: settingValue.companyEmail || "",
    companyPhone: settingValue.companyPhone || "",
    companyAddress: settingValue.companyAddress || "",
    currency: settingValue.currency || "ETB",
    taxRate: Number(settingValue.taxRate || 0),
    lowStockThreshold: Number(settingValue.lowStockThreshold || 10),
    enableNotifications: settingValue.enableNotifications !== "false",
    enableEmailAlerts: settingValue.enableEmailAlerts === "true",
    passwordStrength: settingValue.passwordStrength || "Medium",
    require2FA: settingValue.require2FA === "true",
  };
}
