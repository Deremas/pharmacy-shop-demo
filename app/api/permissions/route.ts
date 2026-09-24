import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureDefaultPermissionsAndRoles } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatPermissionLabel } from "@/lib/permission-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (currentUser.role !== "Super Admin" && !currentUser.permissions?.includes("admin.permissions.view")) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  await ensureDefaultPermissionsAndRoles();

  const permissions = await prisma.permission.findMany({
    include: { roles: { include: { role: true } }, _count: { select: { roles: true, users: true } } },
    orderBy: [{ module: "asc" }, { label: "asc" }],
  });

  return NextResponse.json({
    permissions: permissions.map((permission) => ({
      id: permission.id,
      key: permission.key,
      name: formatPermissionLabel(permission),
      label: permission.label,
      module: permission.module,
      description: null,
      usedByRoles: permission.roles.map((entry) => entry.role.name).sort(),
      usageCount: permission._count.roles + permission._count.users,
    })),
  });
}
