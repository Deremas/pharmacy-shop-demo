"use client";

import { useSession } from "next-auth/react";

export function useCan() {
  const { data } = useSession();
  const user = data?.user as { role?: string; permissions?: string[] } | undefined;
  const keys = new Set(user?.permissions || []);
  return (permission?: string) =>
    !permission || user?.role === "Super Admin" || keys.has(permission);
}
