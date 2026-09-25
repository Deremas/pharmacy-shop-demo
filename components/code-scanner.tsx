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
        className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-950"
      />
      <CodeScanButton label="Scan pack code" onScan={submit} />
    </div>
  );
}

export function CodeScanButton({
  onScan,
  label = "Scan",
  className,
}: {
  onScan: (code: string) => void;
  label?: string;
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
          "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 dark:border-zinc-700 dark:text-zinc-300",
          className,
        )}
      >
        <ScanLine className="h-4 w-4" />
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

function CodeScanModal({
  open,
  onClose,
  onScan,
}: {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}) {
  const regionId = React.useId().replace(/:/g, "");
  const [error, setError] = React.useState("");
  const onScanRef = React.useRef(onScan);
  onScanRef.current = onScan;

  React.useEffect(() => {
    if (!open) return;
    setError("");
    let stopped = false;
    let scanner: { stop: () => Promise<void> } | null = null;

    const finish = (code: string) => {
      if (stopped) return;
      stopped = true;
      const value = code.trim();
      const done = () => {
        if (value) onScanRef.current(value);
      };
      if (!scanner) {
        done();
        return;
      }
      scanner.stop().catch(() => undefined).finally(done);
    };

    const start = async () => {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      if (stopped) return;
      const instance = new Html5Qrcode(regionId, {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
        ],
      });
      scanner = instance;
      await instance.start(
        { facingMode: "environment" },
        { fps: 8, qrbox: { width: 240, height: 150 } },
        (text) => finish(text),
        () => undefined,
      );
    };

    start().catch(() => {
      if (!stopped) setError("The camera did not start. Allow the camera, or type the code. A counter scanner can type into the box.");
    });

    return () => {
      stopped = true;
      scanner?.stop().catch(() => undefined);
    };
  }, [open, regionId]);

  return (
    <AppModal open={open} onClose={onClose} labelledBy="code-scan-title">
      <div className="space-y-4 p-5">
        <div>
          <h2 id="code-scan-title" className="text-lg font-black text-slate-950 dark:text-white">Scan code</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">Point the camera at the code on the pack.</p>
        </div>
        <div id={regionId} className="min-h-56 overflow-hidden rounded-2xl bg-slate-950" />
        {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
        <button type="button" onClick={onClose} className="btn-cancel h-11 w-full">Close</button>
      </div>
    </AppModal>
  );
}
