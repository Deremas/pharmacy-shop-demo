export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startDailyOverviewScheduler } = await import("@/lib/telegram");
  startDailyOverviewScheduler();
}
