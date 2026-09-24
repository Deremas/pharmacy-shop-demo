import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      firstName: string;
      lastName: string;
      username: string;
      phone: string;
      role: string;
      roleId: string;
      permissions: string[];
      assignedLocations: string[];
      locationId: string;
    };
  }

  interface User {
    firstName?: string;
    lastName?: string;
    username?: string;
    phone?: string;
    role?: string;
    roleId?: string;
    permissions?: string[];
    assignedLocations?: string[];
    locationId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    user?: any;
  }
}
