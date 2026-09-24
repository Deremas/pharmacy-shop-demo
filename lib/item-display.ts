export type ItemLike = {
  name?: string;
  code?: string;
  category?: string;
  locationId?: string;
  size?: string;
  stock?: number;
  unit?: string;
  unitName?: string;
  unitShortName?: string;
  shortName?: string;
};

export type ItemKind = "item";

export type ItemVariant = {
  kind: ItemKind;
  style: string;
  size: string;
  sizeLabel: string;
  badge: string;
  code: string;
};

const STRENGTH_PATTERN = /(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|iu|%)/i;

export function itemKind(_item?: ItemLike, _businessId?: string): ItemKind {
  return "item";
}

function splitStrength(name: string) {
  const match = String(name || "").match(STRENGTH_PATTERN);
  if (!match) return { style: String(name || "").trim(), strength: "" };
  const unit = match[2].toLowerCase() === "iu" ? "IU" : match[2].toLowerCase();
  const strength = `${match[1]}${unit}`;
  const style = String(name || "")
    .replace(match[0], " ")
    .replace(/\s+/g, " ")
    .trim();
  return { style: style || String(name || "").trim(), strength };
}

export function itemVariant(item: ItemLike, _businessId?: string): ItemVariant {
  const name = String(item.name || "").trim() || "Item";
  const code = String(item.code || "").trim();
  const explicit = String(item.size || "").trim();
  const parsed = splitStrength(name);
  const strength = explicit || parsed.strength;
  const style = strength ? parsed.style || name : name;
  return {
    kind: "item",
    style,
    size: strength,
    sizeLabel: strength,
    badge: strength || code,
    code,
  };
}

export function formatItemChoiceLabel(item: ItemLike, businessId?: string) {
  const variant = itemVariant(item, businessId);
  if (!variant.badge || variant.badge.toLowerCase() === variant.style.toLowerCase()) return variant.style;
  return `${variant.style} · ${variant.badge}`;
}

/** Telegram line label: "Paracetamol 500mg · PCM-500". */
export function formatTelegramItemLabel(item: ItemLike, businessId?: string) {
  const variant = itemVariant(item, businessId);
  const name = variant.sizeLabel ? `${variant.style} ${variant.sizeLabel}` : variant.style;
  const code = String(variant.code || item.code || "").trim();
  if (code && name && code.toLowerCase() !== name.toLowerCase()) {
    return `${name} · ${code}`;
  }
  return code || name || "Item";
}

export function itemSearchText(item: ItemLike, businessId?: string) {
  const variant = itemVariant(item, businessId);
  return [item.name, item.code, item.category, variant.style, variant.sizeLabel, variant.badge, variant.code]
    .filter(Boolean)
    .join(" ");
}

export function formatUnitLabel(
  unit?:
    | string
    | {
        name?: string;
        unit?: string;
        unitName?: string;
        unitShortName?: string;
        shortName?: string;
      }
    | null,
) {
  if (unit == null || unit === "") return "";
  if (typeof unit === "string") return canonicalizeUnit("", unit) || unit;

  const unitName = String(unit.unitName || "").trim();
  const recordName = unit.shortName != null ? String(unit.name || "").trim() : "";
  const short = String(unit.unitShortName || unit.shortName || unit.unit || "").trim();
  return canonicalizeUnit(unitName || recordName, short) || unitName || recordName || short;
}

function canonicalizeUnit(name: string, short: string) {
  const blob = `${name} ${short}`.toLowerCase();
  if (/\btablets?\b/.test(blob) || /^tab$/i.test(short) || /^tab$/i.test(name)) return "Tab";
  if (/\bcapsules?\b/.test(blob) || /^cap$/i.test(short)) return "Cap";
  if (/\bbottles?\b/.test(blob) || /^btl$/i.test(short)) return "Btl";
  if (/\bbox(?:es)?\b/.test(blob) || /^box$/i.test(short)) return "Box";
  if (/\bstrips?\b/.test(blob) || /^str$/i.test(short)) return "Str";
  if (/\btubes?\b/.test(blob) || /^tube$/i.test(short)) return "Tube";
  if (/\bsachets?\b/.test(blob) || /^sch$/i.test(short)) return "Sch";
  if (/\bpieces?\b/.test(blob) || /^pcs$/i.test(short) || /^pcs$/i.test(name)) return "Pcs";
  if (/\bpairs?\b/.test(blob) || /^pr$/i.test(short)) return "Pair";
  if (/\bbundles?\b/.test(blob) || /^bdl$/i.test(short)) return "Bundles";
  return "";
}

export function itemSelectOption(
  item: ItemLike & { id: string },
  meta?: string,
  businessId?: string,
) {
  const variant = itemVariant(item, businessId);
  return {
    value: item.id,
    label: variant.style || String(item.name || "Item"),
    size: variant.badge,
    meta: itemSelectMeta(item, variant, meta),
    searchText: itemSearchText(item, businessId),
  };
}

function itemSelectMeta(item: ItemLike, variant: ItemVariant, extra?: string) {
  const parts: string[] = [];
  if (variant.code && variant.code !== variant.badge && variant.code.toLowerCase() !== variant.style.toLowerCase()) {
    parts.push(variant.code);
  }
  const extraText = String(extra || "").trim();
  if (extraText) {
    parts.push(extraText);
  } else {
    const unit = formatUnitLabel(item);
    if (item.stock != null && unit) parts.push(`${item.stock} ${unit}`);
    else if (unit) parts.push(unit);
  }
  return parts.filter(Boolean).join(" · ");
}
