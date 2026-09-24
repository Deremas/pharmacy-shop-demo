import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { BUSINESSES, isTenantBusiness, normalizeAssignedLocationIds, remapLocationId, toBusinessSummary } from "@/lib/businesses";

const ONE_DAY_SECONDS = 24 * 60 * 60;

function normalizeCredential(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value: unknown) {
  return String(value || "").replace(/\s+/g, "");
}

async function withDbRetry<T>(fn: () => Promise<T>, retries = 4, delay = 1000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isConnectionError =
        error.message?.includes("Can't reach database server") ||
        error.message?.includes("PrismaClientInitializationError") ||
        error.message?.includes("P1001") ||
        error.message?.includes("P1003") ||
        error.message?.includes("timeout") ||
        String(error).includes("Can't reach database server") ||
        String(error).includes("InitializationError");
      
      if (!isConnectionError) {
        throw error;
      }
      
      console.warn(`[DB Retry] Connection attempt ${i + 1} failed. Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

async function buildSessionUser(userId: string) {
  let user;
  let locations;
  try {
    [user, locations] = await withDbRetry(() =>
      Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          include: {
            location: true,
            roleRecord: { include: { permissions: { include: { permission: true } } } },
            permissions: { include: { permission: true } },
          },
        }),
        prisma.location.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      ])
    );
  } catch (error) {
    console.error("Unable to refresh session user from database after retries:", error);
    return null;
  }


  if (!user || !user.isActive) return null;

  const isAdmin = user.role === "ADMIN";
  const roleName = isAdmin ? "Super Admin" : user.roleRecord?.name || user.role || "Sales";

  const tenantLocations = locations.filter((location) => isTenantBusiness(location));
  const assignedLocations = isAdmin
    ? tenantLocations.map((location) => location.id)
    : normalizeAssignedLocationIds({
        assignedLocations: (user as any).assignedLocationIds,
        locationId: user.locationId,
      }).map((id) => remapLocationId(id)).filter(Boolean);

  const assignedBusinesses = (isAdmin ? tenantLocations : tenantLocations.filter((location) => assignedLocations.includes(location.id)))
    .filter((location) => location.isActive || assignedLocations.includes(location.id))
    .map((location) => toBusinessSummary(location))
    .filter(Boolean);

  const locationId = remapLocationId(user.locationId) || assignedLocations[0] || BUSINESSES[0].id;
  const assignedFromRelation = user.location
    ? toBusinessSummary({
        ...user.location,
        id: remapLocationId(user.location.id) || user.location.id,
      })
    : null;
  const businesses =
    assignedBusinesses.length
      ? assignedBusinesses
      : assignedFromRelation
        ? [assignedFromRelation]
        : assignedLocations.map((id) => toBusinessSummary({ id, ...BUSINESSES.find((business) => business.id === id) })).filter(Boolean);

  const allPermissions = isAdmin ? await prisma.permission.findMany({ select: { key: true } }).catch(() => []) : [];
  const rolePermissions = user.roleRecord?.permissions.map((entry) => entry.permission.key) || [];
  const userPermissions = user.permissions.map((entry) => entry.permission.key);

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    phone: user.phone || "",
    role: roleName,
    roleId: user.roleId || "",
    permissions: isAdmin ? allPermissions.map((permission) => permission.key) : Array.from(new Set([...rolePermissions, ...userPermissions])),
    assignedLocations: isAdmin ? locations.map((location) => location.id) : assignedLocations,
    assignedBusinesses: businesses,
    locationId,
  };
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: ONE_DAY_SECONDS },
  jwt: { maxAge: ONE_DAY_SECONDS },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Username or Phone", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const identifier = normalizeCredential(credentials?.identifier);
        const phoneIdentifier = normalizePhone(credentials?.identifier);
        const password = String(credentials?.password || "");

        if (!identifier || !password) return null;

        const users = await withDbRetry(() =>
          prisma.user.findMany({
            where: { isActive: true },
            orderBy: { createdAt: "asc" },
          })
        );
        const user = users.find(
          (entry) => normalizeCredential(entry.username) === identifier || normalizePhone(entry.phone) === phoneIdentifier,
        );

        if (!user || !(await bcrypt.compare(password, user.passwordHash))) return null;

        const sessionUser = await buildSessionUser(user.id);
        if (!sessionUser) return null;

        return {
          id: sessionUser.id,
          name: `${sessionUser.firstName} ${sessionUser.lastName}`,
          email: sessionUser.username,
          ...sessionUser,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user?.id) {
        const freshUser = await buildSessionUser(String(user.id));
        token.user = freshUser ? { ...user, ...freshUser } : user;
        (token as any).lastRefreshed = Date.now();
      } else if (token.user?.id) {
        const now = Date.now();
        const lastRefreshed = (token as any).lastRefreshed || 0;
        const needsRefresh = now - lastRefreshed > 30000;

        if (needsRefresh || trigger === "update") {
          const freshUser = await buildSessionUser(String(token.user.id));
          if (freshUser) {
            token.user = { ...token.user, ...freshUser };
            (token as any).lastRefreshed = now;
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user = token.user as any;
      return session;
    },
  },
};

export async function getCurrentUser() {
  const { getServerSession } = await import("next-auth");
  const session = await getServerSession(authOptions);
  return (session?.user as any) || null;
}
