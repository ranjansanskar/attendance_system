"use client";

import { useActionState } from "react";
import { ui, type ActionState } from "@/components/ui";

/** Cancel a class / mark a holiday / restore it, for one batch or all batches. */
export function SessionForm({
  action,
  defaultDate,
  allBatches,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  defaultDate: string;
  allBatches?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-3">
      {state?.error && <p className={ui.error}>{state.error}</p>}
      {state?.ok && <p className={ui.success}>{state.ok}</p>}
      <div className="grid gap-3 sm:grid-cols-[auto_auto_1fr_auto] sm:items-end">
        <div>
          <label className={ui.label}>Date</label>
          <input className={ui.input} type="date" name="date" defaultValue={defaultDate} required />
        </div>
        <div>
          <label className={ui.label}>Mark as</label>
          <select className={ui.input} name="status" defaultValue={allBatches ? "holiday" : "cancelled"}>
            <option value="holiday">Holiday</option>
            <option value="cancelled">Class cancelled</option>
            <option value="scheduled">Restore (normal class)</option>
          </select>
        </div>
        <div>
          <label className={ui.label}>Note (optional)</label>
          <input className={ui.input} name="note" placeholder="Diwali / teacher on leave" />
        </div>
        <button className={ui.button} disabled={pending}>{pending ? "Saving…" : "Apply"}</button>
      </div>
      <p className={ui.muted}>No attendance is taken and no absent alerts are sent on cancelled or holiday dates.</p>
    </form>
  );
}
