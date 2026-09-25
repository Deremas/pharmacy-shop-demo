"use client";

import React from "react";
import { ScanLine } from "lucide-react";
import { AppModal } from "@/components/app-modal";
import { cn } from "@/lib/utils";

export function ItemCodeBox({
  onCode,
  placeholder = "Scan or type the pack code",
}: {
  onCode: (code: string) => void;
  placeholder?: string;
}) {
  const [value, setValue] = React.useState("");
  const submit = (code: string) => {
    const next = code.trim();
    if (!next) return;
    onCode(next);
    setValue("");
  };
  return (
    <div className="flex gap-2">
      <input
        aria-label={placeholder}
        value={value}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit(value);
          }
        }}
        className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-950"
      />
      <CodeScanButton label="Scan" showLabel onScan={submit} />
    </div>
  );
}

export function CodeScanButton({
  onScan,
  label = "Scan",
  showLabel = false,
  className,
}: {
  onScan: (code: string) => void;
  label?: string;
  showLabel?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={() => setOpen(true)}
        className={cn(
          showLabel
            ? "inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-900/20 hover:bg-indigo-500"
            : "inline-flex h-10 shrink-0 items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-2.5 text-[10px] font-black uppercase tracking-wide text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200",
          className,
        )}
      >
        <ScanLine className={showLabel ? "h-4 w-4" : "h-3.5 w-3.5"} />
        {showLabel ? label : "Scan"}
      </button>
      <CodeScanModal
        open={open}
        onClose={() => setOpen(false)}
        onScan={(code) => {
          setOpen(false);
          onScan(code);
        }}
      />
    </>
  );
}

function cameraMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  const text = error instanceof Error ? error.message : String(error || "");
  if (name === "NotAllowedError" || /not allowed|permission/i.test(text)) {
    return "Allow the camera for this site in the browser, then press Scan again. You can also type the code.";
  }
  if (name === "NotFoundError" || /not found|no camera/i.test(text)) {
    return "No camera was found. Type the code, or use a scanner that types into the box.";
  }
  return "The camera did not start. Allow the camera, or type the code.";
}

function CodeScanModal({
  open,
  onClose,
  onScan,
}: {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}) {
  const regionRef = React.useRef<HTMLDivElement>(null);
  const [error, setError] = React.useState("");
  const [starting, setStarting] = React.useState(false);
  const onScanRef = React.useRef(onScan);
  onScanRef.current = onScan;

  React.useEffect(() => {
    if (!open) return;
    const region = regionRef.current;
    if (!region) return;
    setError("");
    setStarting(true);
    let stopped = false;
    let running = false;
    let scanner: { stop: () => Promise<void>; clear: () => void } | null = null;

    const finish = (code: string) => {
      if (stopped) return;
      stopped = true;
      const value = code.trim();
      const done = () => {
        if (value) onScanRef.current(value);
      };
      if (!running || !scanner) {
        done();
        return;
      }
      running = false;
      scanner.stop().catch(() => undefined).finally(done);
    };

    const start = async () => {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      if (stopped) return;
      const cameras = await Html5Qrcode.getCameras().catch(() => []);
      if (stopped) return;
      const preferred = cameras.find((camera) => /back|rear|environment/i.test(camera.label)) || cameras[0];
      const camera = preferred?.id || { facingMode: "user" as const };
      const instance = new Html5Qrcode(region.id, {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ],
      });
      scanner = instance;
      await instance.start(
        camera,
        {
          fps: 8,
          qrbox: (width, height) => {
            const edge = Math.max(120, Math.floor(Math.min(width, height) * 0.72));
            return { width: edge, height: edge };
          },
        },
        (text) => finish(text),
        () => undefined,
      );
      if (stopped) {
        await instance.stop().catch(() => undefined);
        return;
      }
      running = true;
      setStarting(false);
    };

    const timer = window.setTimeout(() => {
      start().catch((error) => {
        if (stopped) return;
        setStarting(false);
        setError(cameraMessage(error));
      });
    }, 200);

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      if (running && scanner) {
        running = false;
        scanner.stop().catch(() => undefined);
      }
    };
  }, [open]);

  return (
    <AppModal open={open} onClose={onClose} labelledBy="code-scan-title">
      <div className="space-y-4 p-5">
        <div>
          <h2 id="code-scan-title" className="text-lg font-black text-slate-950 dark:text-white">Scan code</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">Point the camera at the code on the pack.</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-slate-950">
          <div ref={regionRef} id="pack-code-reader" className="pack-code-reader min-h-64 w-full" />
          {starting ? <p className="absolute inset-x-0 top-3 text-center text-xs font-bold text-white">Starting camera…</p> : null}
        </div>
        {error ? <p className="text-sm font-medium leading-5 text-rose-600">{error}</p> : null}
        <button type="button" onClick={onClose} className="btn-cancel h-11 w-full">Close</button>
      </div>
    </AppModal>
  );
}
