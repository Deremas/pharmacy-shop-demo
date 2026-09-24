"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function AddPurchaseRedirect() {
  const router = useRouter();

  React.useEffect(() => {
    router.replace("/purchases/create");
  }, [router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm font-bold text-slate-400">
      Opening purchase form...
    </div>
  );
}
