"use client";

import { useActionState } from "react";
import { ui, type ActionState } from "@/components/ui";

export type StudentValues = {
  roll_no: string;
  name: string;
  parent_name: string | null;
  parent_phone: string;
  student_phone: string | null;
  checkin_method: "phone" | "kiosk";
  consent_at: string | null;
  batch_ids: string[];
};

const EMPTY: StudentValues = {
  roll_no: "",
  name: "",
  parent_name: "",
  parent_phone: "",
  student_phone: "",
  checkin_method: "phone",
  consent_at: null,
  batch_ids: [],
};

export function StudentForm({
  action,
  batches,
  initial = EMPTY,
  submitLabel,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  batches: { id: string; name: string }[];
  initial?: StudentValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <p className={ui.error}>{state.error}</p>}
      {state?.ok && <p className={ui.success}>{state.ok}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={ui.label}>Roll number</label>
          <input className={ui.input} name="roll_no" defaultValue={initial.roll_no} required />
        </div>
        <div>
          <label className={ui.label}>Student name</label>
          <input className={ui.input} name="name" defaultValue={initial.name} required />
        </div>
        <div>
          <label className={ui.label}>Parent name (optional)</label>
          <input className={ui.input} name="parent_name" defaultValue={initial.parent_name ?? ""} />
        </div>
        <div>
          <label className={ui.label}>Parent WhatsApp number</label>
          <input className={ui.input} name="parent_phone" type="tel" defaultValue={initial.parent_phone} placeholder="98765 43210" required />
        </div>
        <div>
          <label className={ui.label}>Student phone (optional)</label>
          <input className={ui.input} name="student_phone" type="tel" defaultValue={initial.student_phone ?? ""} />
        </div>
        <div>
          <label className={ui.label}>Check-in method</label>
          <select className={ui.input} name="checkin_method" defaultValue={initial.checkin_method}>
            <option value="phone">Own smartphone</option>
            <option value="kiosk">Kiosk (no smartphone)</option>
          </select>
        </div>
      </div>
      <fieldset>
        <legend className={ui.label}>Batches</legend>
        {batches.length === 0 ? (
          <p className={ui.muted}>Create batches first.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {batches.map((b) => (
              <label key={b.id} className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700">
                <input type="checkbox" name="batch_ids" value={b.id} defaultChecked={initial.batch_ids.includes(b.id)} />
                {b.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <label className="flex items-start gap-2 text-sm text-zinc-800 dark:text-zinc-200">
        <input type="checkbox" name="consent" defaultChecked={!!initial.consent_at} className="mt-0.5" />
        <span>
          Signed consent form received (face data + WhatsApp messages)
          {initial.consent_at && <span className={ui.muted}> · recorded {initial.consent_at.slice(0, 10)}</span>}
        </span>
      </label>
      <button className={ui.button} disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
    </form>
  );
}
