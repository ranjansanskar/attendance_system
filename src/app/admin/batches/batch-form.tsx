"use client";

import { useActionState } from "react";
import { ui, type ActionState } from "@/components/ui";
import { WEEKDAYS } from "@/lib/time";

export type BatchValues = {
  name: string;
  subject: string | null;
  days: number[];
  start_time: string;
  end_time: string;
  late_after_min: number;
  absent_after_min: number;
};

const EMPTY: BatchValues = {
  name: "",
  subject: "",
  days: [1, 2, 3, 4, 5, 6],
  start_time: "16:00",
  end_time: "17:00",
  late_after_min: 10,
  absent_after_min: 20,
};

export function BatchForm({
  action,
  initial = EMPTY,
  submitLabel,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: BatchValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <p className={ui.error}>{state.error}</p>}
      {state?.ok && <p className={ui.success}>{state.ok}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={ui.label}>Batch name</label>
          <input className={ui.input} name="name" defaultValue={initial.name} placeholder="Class 10 Physics – 4 PM" required />
        </div>
        <div>
          <label className={ui.label}>Subject (optional)</label>
          <input className={ui.input} name="subject" defaultValue={initial.subject ?? ""} />
        </div>
      </div>
      <fieldset>
        <legend className={ui.label}>Days</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d) => (
            <label key={d.value} className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700">
              <input type="checkbox" name="days" value={d.value} defaultChecked={initial.days.includes(d.value)} />
              {d.short}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <label className={ui.label}>Start time</label>
          <input className={ui.input} type="time" name="start_time" defaultValue={initial.start_time.slice(0, 5)} required />
        </div>
        <div>
          <label className={ui.label}>End time</label>
          <input className={ui.input} type="time" name="end_time" defaultValue={initial.end_time.slice(0, 5)} required />
        </div>
        <div>
          <label className={ui.label}>Late after (min)</label>
          <input className={ui.input} type="number" min={0} max={120} name="late_after_min" defaultValue={initial.late_after_min} required />
        </div>
        <div>
          <label className={ui.label}>Absent after (min)</label>
          <input className={ui.input} type="number" min={1} max={180} name="absent_after_min" defaultValue={initial.absent_after_min} required />
        </div>
      </div>
      <p className={ui.muted}>
        Students checking in after the late cutoff are marked Late. When the absent cutoff passes, everyone not checked in is
        marked Absent and their parent gets a WhatsApp alert.
      </p>
      <button className={ui.button} disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
    </form>
  );
}
