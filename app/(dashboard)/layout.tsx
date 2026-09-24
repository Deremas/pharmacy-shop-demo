import DashboardLayoutClient from "./DashboardLayoutClient";
import { AppDataProvider } from "@/lib/client/useAppData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppDataProvider>
      <DashboardLayoutClient>{children}</DashboardLayoutClient>
    </AppDataProvider>
  );
}
