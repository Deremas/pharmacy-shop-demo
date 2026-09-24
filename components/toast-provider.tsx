"use client";

import React, { createContext, useContext, useMemo, useState } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info";

type Toast = {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
};

type ToastInput = {
  title: string;
  description?: string;
};

type ToastContextValue = {
  success: (input: string | ToastInput) => void;
  error: (input: string | ToastInput) => void;
  info: (input: string | ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function normalizeToast(input: string | ToastInput) {
  return typeof input === "string" ? { title: input } : input;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = (id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const showToast = (type: ToastType, input: string | ToastInput) => {
    const id = Math.random().toString(36).slice(2);
    const toast = { id, type, ...normalizeToast(input) };

    setToasts((current) => [toast, ...current].slice(0, 4));
    window.setTimeout(() => removeToast(id), 3600);
  };

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (input) => showToast("success", input),
      error: (input) => showToast("error", input),
      info: (input) => showToast("info", input),
    }),
    [],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-20 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3 sm:right-6">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }

  return context;
}

function ToastCard({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const Icon =
    toast.type === "success" ? CheckCircle2 : toast.type === "error" ? XCircle : Info;

  return (
    <div
      className={cn(
        "pointer-events-auto overflow-hidden rounded-2xl border bg-white p-4 shadow-2xl shadow-slate-950/10 ring-1 ring-black/5 animate-in slide-in-from-right-4 fade-in duration-200 dark:bg-zinc-900 dark:shadow-black/30",
        toast.type === "success" && "border-emerald-200 dark:border-emerald-900/40",
        toast.type === "error" && "border-rose-200 dark:border-rose-900/40",
        toast.type === "info" && "border-indigo-200 dark:border-indigo-900/40",
      )}
      role="status"
    >
      <div className="flex gap-3">
        <div
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
            toast.type === "success" && "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300",
            toast.type === "error" && "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300",
            toast.type === "info" && "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-950 dark:text-white">{toast.title}</p>
          {toast.description ? (
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-zinc-400">
              {toast.description}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
