import { redirect } from "next/navigation";

export default function SalesReportsPage() {
  redirect("/reports?module=Sales");
}
