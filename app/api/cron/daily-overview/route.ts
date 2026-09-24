import { NextRequest, NextResponse } from "next/server";
import { sendDailyOverviews } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorizeCron(request: NextRequest) {
  const secret = String(process.env.CRON_SECRET || "").trim();
  const header = request.headers.get("authorization") || "";
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";

  // Vercel Cron sends Authorization: Bearer $CRON_SECRET when the env var is set.
  if (secret && header === `Bearer ${secret}`) return true;
  // Also trust Vercel's own cron header (covers missing/mismatched CRON_SECRET).
  if (isVercelCron) return true;
  return false;
}

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const results = await sendDailyOverviews();
  const sent = results.filter((entry) => entry.sent).length;

  return NextResponse.json({
    ok: true,
    sent,
    total: results.length,
    window: "00:00-22:00 Africa/Addis_Ababa",
    results,
  });
}
