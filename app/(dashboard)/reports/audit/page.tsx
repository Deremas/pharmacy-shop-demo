import { redirect } from "next/navigation";

export default function AuditLogsPage() {
  redirect("/reports?report=audit-security");
}
