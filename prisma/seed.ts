import "dotenv/config";
import { Prisma, PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { PERMISSION_CATALOG } from "../lib/permission-catalog";
import { BUSINESSES, PHARMACY_UNITS, retiredLocationIds, RETIRED_BUSINESS_IDS } from "../lib/businesses";
import { bootstrapBusinessDefaults } from "../lib/actions/business-defaults";
import { seedBusinessCatalogs } from "./catalog-seed";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  keepAlive: true,
  connectionTimeoutMillis: 30000,
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

const SUPER_ADMIN_ROLE = "Super Admin";
const LEGACY_ADMIN_ROLES = ["Administrator", "ADMIN"] as const;
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

type DefaultRoleTemplate = {
  name: string;
  description: string;
  isSystem: boolean;
  keys: string[];
};

type SeedUser = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  phone: string;
  roleName: typeof SUPER_ADMIN_ROLE | typeof SALES_ROLE;
  locationId?: string;
  assignedLocationIds?: string;
};

async function normalizeLegacyAdminRoles() {
  const superAdmin = await prisma.role.findUnique({
    where: { name: SUPER_ADMIN_ROLE },
  });

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
      await prisma.rolePermission.deleteMany({
        where: { roleId: legacyAdminRole.id },
      });

      if (legacyAdminRole._count.users === 0) {
        await prisma.role.delete({ where: { id: legacyAdminRole.id } });
      } else {
        await prisma.role.update({
          where: { id: legacyAdminRole.id },
          data: {
            isActive: false,
            isSystem: false,
            description: "Legacy admin role replaced by Super Admin.",
          },
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

async function syncPermissionsAndRoles() {
  await prisma.permission.createMany({
    data: PERMISSION_CATALOG.map((permission) => ({
      key: permission.key,
      label: permission.label,
      module: permission.module,
    })),
    skipDuplicates: true,
  });
  await prisma.$executeRaw`
    UPDATE "Permission" AS permission
    SET "label" = incoming.label, "module" = incoming.module
    FROM (VALUES ${Prisma.join(
      PERMISSION_CATALOG.map(
        (permission) => Prisma.sql`(${permission.key}, ${permission.label}, ${permission.module})`,
      ),
    )}) AS incoming(key, label, module)
    WHERE permission."key" = incoming.key
  `;

  const catalogKeys = PERMISSION_CATALOG.map((permission) => permission.key);
  const obsoletePermissions = await prisma.permission.findMany({
    where: { key: { notIn: catalogKeys } },
    select: { id: true },
  });
  const obsoletePermissionIds = obsoletePermissions.map(
    (permission) => permission.id,
  );
  if (obsoletePermissionIds.length > 0) {
    await prisma.rolePermission.deleteMany({
      where: { permissionId: { in: obsoletePermissionIds } },
    });
    await prisma.userPermission.deleteMany({
      where: { permissionId: { in: obsoletePermissionIds } },
    });
    await prisma.permission.deleteMany({
      where: { id: { in: obsoletePermissionIds } },
    });
  }

  const allPermissions = await prisma.permission.findMany();

  await normalizeLegacyAdminRoles();

  const superAdmin = await prisma.role.upsert({
    where: { name: SUPER_ADMIN_ROLE },
    update: {
      description: "System role with full access to every permission.",
      isSystem: true,
      isActive: true,
    },
    create: {
      name: SUPER_ADMIN_ROLE,
      description: "System role with full access to every permission.",
      isSystem: true,
      isActive: true,
    },
  });

  await prisma.rolePermission.createMany({
    data: allPermissions.map((permission) => ({
      roleId: superAdmin.id,
      permissionId: permission.id,
    })),
    skipDuplicates: true,
  });

  const defaultRoles: DefaultRoleTemplate[] = [
    {
      name: SALES_ROLE,
      description: "Sales desk access for customers, sales, and stock viewing.",
      isSystem: true,
      keys: SALES_PERMISSION_KEYS,
    },
    {
      name: MANAGER_ROLE,
      description:
        "Operational manager access across store, purchases, sales, and finance. Reports stay with admin.",
      isSystem: false,
      keys: PERMISSION_CATALOG.filter(
        (permission) =>
          !permission.key.startsWith("admin.") &&
          !permission.key.startsWith("reports."),
      ).map((permission) => permission.key),
    },
  ];

  for (const roleTemplate of defaultRoles) {
    const role = await prisma.role.upsert({
      where: { name: roleTemplate.name },
      update: {
        description: roleTemplate.description,
        isSystem: roleTemplate.isSystem,
        isActive: true,
      },
      create: {
        name: roleTemplate.name,
        description: roleTemplate.description,
        isSystem: roleTemplate.isSystem,
        isActive: true,
      },
    });

    const existingAssignments = await prisma.rolePermission.count({
      where: { roleId: role.id },
    });

    if (existingAssignments > 0) continue;

    const permissions = allPermissions.filter((permission) =>
      roleTemplate.keys.includes(permission.key),
    );

    await prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
  }

  const managerRole = await prisma.role.findUnique({ where: { name: MANAGER_ROLE } });
  if (managerRole) {
    const reportPermissionIds = allPermissions
      .filter((permission) => permission.key.startsWith("reports."))
      .map((permission) => permission.id);
    if (reportPermissionIds.length > 0) {
      await prisma.rolePermission.deleteMany({
        where: { roleId: managerRole.id, permissionId: { in: reportPermissionIds } },
      });
    }
  }

  await prisma.user.updateMany({
    where: { role: "ADMIN", roleId: null },
    data: { roleId: superAdmin.id },
  });

  const salesRole = await prisma.role.findUnique({
    where: { name: SALES_ROLE },
  });
  if (salesRole) {
    await prisma.user.updateMany({
      where: { role: { not: "ADMIN" }, roleId: null },
      data: { roleId: salesRole.id },
    });
  }
}

async function seedSampleData() {
  const businesses = [];
  for (const business of BUSINESSES) {
    const location = await prisma.location.upsert({
      where: { id: business.id },
      update: {
        name: business.name,
        type: business.type,
        location: business.location,
        isActive: true,
      },
      create: {
        id: business.id,
        name: business.name,
        type: business.type,
        location: business.location,
      },
    });
    const unitCount = await prisma.unit.count({ where: { locationId: location.id } });
    if (unitCount < PHARMACY_UNITS.length) {
      await bootstrapBusinessDefaults(prisma, location);
    }
    businesses.push(location);
  }

  await seedBusinessCatalogs(prisma);
  await retireFashionBusinesses(businesses[0].id);

  const allBusinessIds = businesses.map((business) => business.id).join(",");

  const [superAdminRole, salesRole] = await Promise.all([
    prisma.role.findUniqueOrThrow({ where: { name: SUPER_ADMIN_ROLE } }),
    prisma.role.findUniqueOrThrow({ where: { name: SALES_ROLE } }),
  ]);

  const seedUsers: SeedUser[] = [
    {
      id: "seed-user-admin",
      firstName: "Admin",
      lastName: "User",
      username: "admin",
      password: "1234",
      phone: "",
      roleName: SUPER_ADMIN_ROLE,
      locationId: businesses[0].id,
      assignedLocationIds: allBusinessIds,
    },
    {
      id: "seed-user-sales",
      firstName: "Sales",
      lastName: "Desk",
      username: "sales",
      password: "1234",
      phone: "",
      roleName: SALES_ROLE,
      locationId: businesses[0].id,
      assignedLocationIds: businesses[0].id,
    },
    ...businesses.map((business, index) => ({
      id: `seed-user-sales-${index + 1}`,
      firstName: "Sales",
      lastName: business.name,
      username: `sales${index + 1}`,
      password: "1234",
      phone: "",
      roleName: SALES_ROLE as typeof SALES_ROLE,
      locationId: business.id,
      assignedLocationIds: business.id,
    })),
  ];

  for (const seedUser of seedUsers) {
    const role =
      seedUser.roleName === SUPER_ADMIN_ROLE ? superAdminRole : salesRole;
    const passwordHash = await bcrypt.hash(seedUser.password, 10);
    const locationId = seedUser.locationId || businesses[0].id;
    const assignedLocationIds =
      seedUser.assignedLocationIds ||
      (role.name === SUPER_ADMIN_ROLE ? allBusinessIds : locationId);

    await prisma.user.upsert({
      where: { username: seedUser.username },
      update: {
        firstName: seedUser.firstName,
        lastName: seedUser.lastName,
        phone: seedUser.phone,
        passwordHash,
        role: role.name === SUPER_ADMIN_ROLE ? "ADMIN" : role.name,
        roleId: role.id,
        locationId,
        assignedLocationIds,
        isActive: true,
      },
      create: {
        id: seedUser.id,
        firstName: seedUser.firstName,
        lastName: seedUser.lastName,
        username: seedUser.username,
        phone: seedUser.phone,
        passwordHash,
        role: role.name === SUPER_ADMIN_ROLE ? "ADMIN" : role.name,
        roleId: role.id,
        locationId,
        assignedLocationIds,
        isActive: true,
      },
    });
  }

}

async function main() {
  await syncPermissionsAndRoles();
  await seedSampleData();
  console.log("Seed completed.");
  console.log("Logins:");
  console.log("  admin / 1234  (all pharmacies)");
  console.log("  sales / 1234  (Bole Pharmacy)");
  for (const [index, business] of BUSINESSES.entries()) {
    console.log(`  sales${index + 1} / 1234 (${business.name})`);
  }
}

async function retireFashionBusinesses(replacementId: string) {
  const retiredTenants = new Set<string>(RETIRED_BUSINESS_IDS);
  await prisma.location.updateMany({
    where: { id: { in: [...retiredLocationIds()] } },
    data: { isActive: false },
  });
  await prisma.item.updateMany({
    where: { locationId: { in: [...RETIRED_BUSINESS_IDS] } },
    data: { isActive: false },
  });
  await prisma.category.updateMany({
    where: { locationId: { in: [...RETIRED_BUSINESS_IDS] } },
    data: { isActive: false },
  });

  const users = await prisma.user.findMany({
    select: { id: true, locationId: true, assignedLocationIds: true },
  });
  for (const user of users) {
    const assigned = String(user.assignedLocationIds || "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id && !retiredTenants.has(id.replace(/-store$/, "")));
    const locationTenant = String(user.locationId || "").replace(/-store$/, "");
    const locationRetired = retiredTenants.has(locationTenant);
    const assignmentChanged = assigned.length !== String(user.assignedLocationIds || "").split(",").filter((id) => id.trim()).length;
    if (!locationRetired && !assignmentChanged) continue;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        locationId: locationRetired ? replacementId : user.locationId,
        assignedLocationIds: assigned.length ? assigned.join(",") : replacementId,
      },
    });
  }
}

async function run() {
  const attempts = 4;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await main();
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retryable = /terminated|ECONNRESET|ECONNREFUSED|timeout|closed/i.test(message);
      if (!retryable || attempt === attempts) throw error;
      console.log(`Database connection dropped. Retrying seed (${attempt + 1}/${attempts})...`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
