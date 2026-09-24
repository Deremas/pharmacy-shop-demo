"use client";

import React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Viewport-safe dialog. Portals to document.body, locks scroll, Esc to close.
 * Uses m-auto inside a scrollable shell so tall content is never clipped
 * (items-center alone cuts off tops/bottoms on short screens).
 */
export function AppModal({
  open,
  onClose,
  children,
  contentClassName,
  overlayClassName,
  labelledBy,
}: {
  open: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  contentClassName?: string;
  overlayClassName?: string;
  labelledBy?: string;
}) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className={cn("fixed inset-0 z-[100] overflow-y-auto overscroll-contain", overlayClassName)}
      role="presentation"
    >
      <button
        type="button"
        className="fixed inset-0 z-0 bg-slate-950/45 backdrop-blur-[2px]"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex min-h-full justify-center p-4 pointer-events-none sm:p-6"
        style={{
          paddingTop: "max(1rem, env(safe-area-inset-top))",
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          className={cn(
            "pointer-events-auto m-auto flex w-full max-w-md flex-col overflow-y-auto overscroll-contain rounded-3xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200 dark:border-zinc-800 dark:bg-zinc-950",
            "max-h-[min(92dvh,calc(100dvh-2rem))]",
            contentClassName,
          )}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
