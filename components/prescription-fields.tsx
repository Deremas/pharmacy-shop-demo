export function PrescriptionFields({
  prescriptionNumber,
  patientName,
  prescriberName,
  onPrescriptionNumber,
  onPatientName,
  onPrescriberName,
}: {
  prescriptionNumber: string;
  patientName: string;
  prescriberName: string;
  onPrescriptionNumber: (value: string) => void;
  onPatientName: (value: string) => void;
  onPrescriberName: (value: string) => void;
}) {
  const fieldClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none dark:border-zinc-700 dark:bg-zinc-950";
  return (
    <div className="grid gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20 sm:grid-cols-3">
      <label className="space-y-1">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-300">Prescription number</span>
        <input value={prescriptionNumber} onChange={(event) => onPrescriptionNumber(event.target.value)} placeholder="From the paper" className={fieldClass} />
      </label>
      <label className="space-y-1">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-300">Patient name</span>
        <input value={patientName} onChange={(event) => onPatientName(event.target.value)} placeholder="Optional" className={fieldClass} />
      </label>
      <label className="space-y-1">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-300">Prescriber</span>
        <input value={prescriberName} onChange={(event) => onPrescriberName(event.target.value)} placeholder="Optional" className={fieldClass} />
      </label>
      <p className="text-xs font-medium text-slate-500 sm:col-span-3">Enter the prescription number. Patient and prescriber are optional.</p>
    </div>
  );
}
