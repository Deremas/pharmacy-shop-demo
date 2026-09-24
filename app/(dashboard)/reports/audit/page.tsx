import { redirect } from "next/navigation";

export default function AuditLogsPage() {
  redirect("/reports?module=Administrative&report=audit-security");
}
