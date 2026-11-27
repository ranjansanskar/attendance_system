"use client";

import { useActionState } from "react";
import { ui } from "@/components/ui";
import { generateMissingPins, resetStudentPin, type BulkPinResult, type PinResult } from "./actions";

export function PinPanel({ studentId, hasPin }: { studentId: string; hasPin: boolean }) {
  const [state, action, pending] = useActionState<PinResult>(resetStudentPin.bind(null, studentId), undefined);
  return (
    <form action={action} className="space-y-2">
      {state?.error && <p className={ui.error}>{state.error}</p>}
      {state?.pin && (
        <div className={ui.success}>
          New PIN: <span className="font-mono text-xl font-semibold tracking-widest">{state.pin}</span>
          <br />
          Give this to the student now. It won&apos;t be shown again.
        </div>
      )}
      <button
        className={ui.buttonSecondary}
        disabled={pending}
        onClick={(e) => {
          if (hasPin && !confirm("Create a new PIN? The old PIN will stop working.")) e.preventDefault();
        }}
      >
        {pending ? "Generating…" : hasPin ? "Reset PIN" : "Generate PIN"}
      </button>
    </form>
  );
}

export function BulkPinPanel() {
  const [state, action, pending] = useActionState<BulkPinResult>(generateMissingPins, undefined);
  return (
    <div className="space-y-3">
      <form action={action} className="flex flex-wrap items-center gap-3">
        <button className={ui.buttonSecondary} disabled={pending}>
          {pending ? "Generating…" : "Generate PINs for students without one"}
        </button>
        <span className={ui.muted}>Then print the slips and hand them out. PINs are shown only once.</span>
      </form>
      {state?.error && <p className={ui.error}>{state.error}</p>}
      {state?.pins && (
        <div id="pin-slips">
          <div className="mb-3 flex items-center gap-3 print:hidden">
            <p className={ui.success}>{state.pins.length} PINs created.</p>
            <button onClick={() => window.print()} className={ui.button}>Print slips</button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {state.pins.map((p) => (
              <div key={p.roll_no} className="break-inside-avoid rounded-lg border border-dashed border-zinc-400 p-3 text-sm text-zinc-900 dark:text-zinc-100">
                <p className="font-semibold">Ranjan Tutorials · Attendance</p>
                <p>{p.name}</p>
                <p>Roll no: <b>{p.roll_no}</b></p>
                <p>PIN: <b className="font-mono tracking-widest">{p.pin}</b></p>
                <p className="mt-1 text-xs text-zinc-500">Install the app, log in on your own phone. Keep this PIN private.</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
