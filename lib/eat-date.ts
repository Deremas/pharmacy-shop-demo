/** Africa/Addis_Ababa is UTC+3 year-round (no DST). */

const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

export function eatParts(now = new Date()) {
  const eat = new Date(now.getTime() + EAT_OFFSET_MS);
  return {
    year: eat.getUTCFullYear(),
    month: eat.getUTCMonth(),
    day: eat.getUTCDate(),
    hour: eat.getUTCHours(),
    minute: eat.getUTCMinutes(),
  };
}

/** Today's calendar date in EAT as YYYY-MM-DD (for date inputs). */
export function eatTodayYmd(now = new Date()) {
  const { year, month, day } = eatParts(now);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Parse a YYYY-MM-DD business date as UTC midnight (stable calendar day). */
export function parseBusinessDateInput(ymd: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || "").trim());
  if (!match) return new Date(NaN);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
}

/** Inclusive start / exclusive end for an EAT calendar day (midnight → midnight). */
export function eatDayBounds(now = new Date()) {
  const { year, month, day, hour, minute } = eatParts(now);
  const start = new Date(Date.UTC(year, month, day, 0, 0, 0) - EAT_OFFSET_MS);
  const end = new Date(Date.UTC(year, month, day + 1, 0, 0, 0) - EAT_OFFSET_MS);
  const label = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { start, end, label, eatHour: hour, eatMinute: minute };
}

/**
 * Daily Telegram report window: 00:00 EAT → 22:00 EAT (10pm).
 * Includes everything done that business day up to the cron time.
 */
export function eatReportBounds(now = new Date()) {
  const { year, month, day, hour, minute } = eatParts(now);
  const start = new Date(Date.UTC(year, month, day, 0, 0, 0) - EAT_OFFSET_MS);
  const end = new Date(Date.UTC(year, month, day, 22, 0, 0) - EAT_OFFSET_MS);
  const label = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { start, end, label, eatHour: hour, eatMinute: minute };
}
