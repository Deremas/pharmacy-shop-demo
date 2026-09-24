import { redirect } from "next/navigation";

export default function TaxReportsPage() {
  redirect("/reports?module=Finance");
}
