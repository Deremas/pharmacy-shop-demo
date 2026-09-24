"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CreditCustomersPageRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/customers/credits");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-pulse text-xs font-black uppercase tracking-widest text-slate-500">
        Redirecting to Credits...
      </div>
    </div>
  );
}
