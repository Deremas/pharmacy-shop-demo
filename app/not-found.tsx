"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home, SearchX } from "lucide-react";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#eef3f8] px-4 py-8 text-slate-950 dark:bg-zinc-950 dark:text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
        <div className="w-full overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.14)] dark:border-zinc-800 dark:bg-zinc-900">
          <div className="grid gap-0 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="flex min-h-72 flex-col justify-between bg-slate-950 p-8 text-white sm:p-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500 shadow-xl shadow-indigo-950/30">
                <SearchX className="h-7 w-7" />
              </div>

              <div>
                <p className="text-sm font-black uppercase tracking-[0.35em] text-indigo-200">
                  Page Missing
                </p>
                <h1 className="mt-4 text-7xl font-black leading-none tracking-normal sm:text-8xl">
                  404
                </h1>
              </div>
            </div>

            <div className="flex flex-col justify-center p-8 sm:p-12">
              <p className="text-sm font-black uppercase tracking-[0.28em] text-slate-400">
                Pharmacy
              </p>
              <h2 className="mt-4 text-3xl font-black tracking-normal text-slate-950 sm:text-4xl dark:text-white">
                This page is not available
              </h2>
              <p className="mt-4 max-w-xl text-base font-semibold leading-7 text-slate-500 dark:text-zinc-400">
                The page may have moved, the link may be incomplete, or the
                screen has not been added yet.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => router.back()}
                  className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 text-sm font-black uppercase tracking-[0.16em] text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  Back
                </button>

                <Link
                  href="/dashboard"
                  className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 text-sm font-black uppercase tracking-[0.16em] text-white shadow-xl shadow-indigo-900/20 transition hover:bg-indigo-500 active:scale-[0.98]"
                >
                  <Home className="h-5 w-5" />
                  Back To Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
