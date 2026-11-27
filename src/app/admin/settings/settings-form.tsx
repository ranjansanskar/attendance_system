"use client";

import { useActionState } from "react";
import { ui } from "@/components/ui";
import { saveSettings } from "./actions";

type Settings = { institute_name: string; latitude: number | null; longitude: number | null; radius_m: number };

export function SettingsForm({ initial }: { initial: Settings }) {
  const [state, action, pending] = useActionState(saveSettings, undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <p className={ui.error}>{state.error}</p>}
      {state?.ok && <p className={ui.success}>{state.ok}</p>}
      <div>
        <label className={ui.label}>Institute name (used in WhatsApp messages)</label>
        <input className={ui.input} name="institute_name" defaultValue={initial.institute_name} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={ui.label}>Latitude</label>
          <input className={ui.input} name="latitude" inputMode="decimal" defaultValue={initial.latitude ?? ""} placeholder="25.5941" />
        </div>
        <div>
          <label className={ui.label}>Longitude</label>
          <input className={ui.input} name="longitude" inputMode="decimal" defaultValue={initial.longitude ?? ""} placeholder="85.1376" />
        </div>
        <div>
          <label className={ui.label}>Allowed radius (metres)</label>
          <input className={ui.input} name="radius_m" type="number" min={20} max={2000} defaultValue={initial.radius_m} required />
        </div>
      </div>
      <p className={ui.muted}>
        To get the coordinates: open Google Maps, long-press the institute&apos;s entrance, and copy the two numbers shown.
        Phone check-ins farther than the radius are rejected (from Phase 2).
      </p>
      <button className={ui.button} disabled={pending}>{pending ? "Saving…" : "Save settings"}</button>
    </form>
  );
}
