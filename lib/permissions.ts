import { prisma } from "@/lib/prisma";
import { PERMISSION_CATALOG } from "@/lib/permission-catalog";

const SUPER_ADMIN_ROLE = "Super Admin";
const LEGACY_ADMIN_ROLES = ["Administrator", "ADMIN"];
const SALES_ROLE = "Sales";
const MANAGER_ROLE = "Manager";
const SALES_PERMISSION_KEYS = [
  "dashboard.view",
  "inventory.items.view",
  "inventory.stock.view",
  "inventory.movements.view",
  "sales.view",
  "sales.create",
  "sales.pos",
  "customers.view",
  "customers.create",
  "customers.update",
  "customers.payments.create",
];

async function normalizeLegacyAdminRoles() {
  const superAdmin = await prisma.role.findUnique({ where: { name: SUPER_ADMIN_ROLE } });

  for (const roleName of LEGACY_ADMIN_ROLES) {
    const legacyAdminRole = await prisma.role.findUnique({
      where: { name: roleName },
      include: { _count: { select: { users: true } } },
    });

    if (!legacyAdminRole) continue;

    if (superAdmin) {
      await prisma.user.updateMany({
        where: { roleId: legacyAdminRole.id },
        data: { roleId: superAdmin.id, role: "ADMIN" },
      });

      await prisma.rolePermission.deleteMany({ where: { roleId: legacyAdminRole.id } });

      if (legacyAdminRole._count.users === 0) {
        await prisma.role.delete({ where: { id: legacyAdminRole.id } });
      } else {
        await prisma.role.update({
          where: { id: legacyAdminRole.id },
          data: { isActive: false, isSystem: false, description: "Legacy admin role replaced by Super Admin." },
        });
      }
      continue;
    }

    await prisma.role.update({
      where: { id: legacyAdminRole.id },
      data: {
        name: SUPER_ADMIN_ROLE,
        description: "System role with full access to every permission.",
        isSystem: true,
        isActive: true,
      },
    });
    break;
  }
}

let isSynced = false;

export async function ensureDefaultPermissionsAndRoles(force = false) {
  if (isSynced && !force) return;

  // Always sync: create any permissions from catalog that don't exist yet
  await prisma.permission.createMany({
    data: PERMISSION_CATALOG.map((permission) => ({ ...permission })),
    skipDuplicates: true,
  });
  for (const permission of PERMISSION_CATALOG) {
    await prisma.permission.updateMany({
      where: { key: permission.key },
      data: { label: permission.label, module: permission.module },
    });
  }

  const catalogKeys = PERMISSION_CATALOG.map((permission) => permission.key);
  const obsoletePermissions = await prisma.permission.findMany({
    where: { key: { notIn: catalogKeys } },
    select: { id: true },
  });
  const obsoletePermissionIds = obsoletePermissions.map((permission) => permission.id);
  if (obsoletePermissionIds.length > 0) {
    await prisma.rolePermission.deleteMany({ where: { permissionId: { in: obsoletePermissionIds } } });
    await prisma.userPermission.deleteMany({ where: { permissionId: { in: obsoletePermissionIds } } });
    await prisma.permission.deleteMany({ where: { id: { in: obsoletePermissionIds } } });
  }

  const permissions = await prisma.permission.findMany();
  const allPermissionIds = permissions.map((permission) => permission.id);
  const allByKey = new Map(permissions.map((permission) => [permission.key, permission.id]));

  await normalizeLegacyAdminRoles();

  const existingRoleCount = await prisma.role.count();
  if (existingRoleCount === 0) {
    const adminRole = await prisma.role.create({
      data: { name: SUPER_ADMIN_ROLE, description: "Full system access", isSystem: true, isActive: true },
    });

    await prisma.rolePermission.createMany({
      data: allPermissionIds.map((permissionId) => ({ roleId: adminRole.id, permissionId })),
      skipDuplicates: true,
    });

    const salesRole = await prisma.role.create({
      data: { name: SALES_ROLE, description: "Sales desk access for customers, sales, and stock viewing.", isSystem: true, isActive: true },
    });
    await prisma.rolePermission.createMany({
      data: SALES_PERMISSION_KEYS
        .map((key) => allByKey.get(key))
        .filter(Boolean)
        .map((permissionId) => ({ roleId: salesRole.id, permissionId: permissionId as string })),
      skipDuplicates: true,
    });

    const managerKeys = PERMISSION_CATALOG.filter(
      (permission) => !permission.key.startsWith("admin.") && !permission.key.startsWith("reports."),
    ).map((permission) => permission.key);
    const managerRole = await prisma.role.create({
      data: { name: MANAGER_ROLE, description: "Operational management without admin settings", isSystem: false, isActive: true },
    });
    await prisma.rolePermission.createMany({
      data: managerKeys
        .map((key) => allByKey.get(key))
        .filter(Boolean)
        .map((permissionId) => ({ roleId: managerRole.id, permissionId: permissionId as string })),
      skipDuplicates: true,
    });
  }

  // Ensure that only Super Admin and Sales are system roles in the database
  await prisma.role.updateMany({
    where: {
      name: { notIn: [SUPER_ADMIN_ROLE, SALES_ROLE] },
      isSystem: true,
    },
    data: {
      isSystem: false,
    },
  });

  await prisma.role.updateMany({
    where: {
      name: { in: [SUPER_ADMIN_ROLE, SALES_ROLE] },
      isSystem: false,
    },
    data: {
      isSystem: true,
      isActive: true,
    },
  });

  const adminRole = await prisma.role.findFirst({ where: { name: SUPER_ADMIN_ROLE, isActive: true } });
  const salesRole = await prisma.role.findFirst({ where: { name: SALES_ROLE, isActive: true } });

  // Ensure Super Admin always has ALL permissions assigned
  if (adminRole) {
    await prisma.rolePermission.createMany({
      data: allPermissionIds.map((permissionId) => ({ roleId: adminRole.id, permissionId })),
      skipDuplicates: true,
    });
    await prisma.user.updateMany({
      where: { role: "ADMIN", roleId: null },
      data: { roleId: adminRole.id },
    });
  }

  if (salesRole) {
    const salesPermissionCount = await prisma.rolePermission.count({ where: { roleId: salesRole.id } });
    if (salesPermissionCount === 0) {
      await prisma.rolePermission.createMany({
        data: SALES_PERMISSION_KEYS
          .map((key) => allByKey.get(key))
          .filter(Boolean)
          .map((permissionId) => ({ roleId: salesRole.id, permissionId: permissionId as string })),
        skipDuplicates: true,
      });
    }
    await prisma.user.updateMany({
      where: { role: { not: "ADMIN" }, roleId: null },
      data: { roleId: salesRole.id },
    });
  }

  const storePermissionId = allByKey.get("inventory.store.view");
  const stockPermissionId = allByKey.get("inventory.stock.view");
  if (storePermissionId && stockPermissionId) {
    const stockRoles = await prisma.rolePermission.findMany({
      where: { permissionId: stockPermissionId },
      select: { roleId: true },
    });
    await prisma.rolePermission.createMany({
      data: stockRoles
        .filter((entry) => entry.roleId !== salesRole?.id)
        .map((entry) => ({ roleId: entry.roleId, permissionId: storePermissionId })),
      skipDuplicates: true,
    });
  }

  const managerRole = await prisma.role.findFirst({ where: { name: MANAGER_ROLE, isActive: true } });
  if (managerRole) {
    const reportPermissionIds = permissions
      .filter((permission) => permission.key.startsWith("reports."))
      .map((permission) => permission.id);
    if (reportPermissionIds.length > 0) {
      await prisma.rolePermission.deleteMany({
        where: { roleId: managerRole.id, permissionId: { in: reportPermissionIds } },
      });
    }
  }
  isSynced = true;
}
