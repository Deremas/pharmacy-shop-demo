"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SupplierDebtRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/suppliers/debts");
  }, [router]);
  return null;
}
