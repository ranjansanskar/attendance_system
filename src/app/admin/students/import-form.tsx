"use client";

import { useActionState } from "react";
import { ui } from "@/components/ui";
import { importStudents } from "./actions";

const SAMPLE = `roll_no,name,parent_phone,parent_name,batches,checkin_method
101,Riya Sharma,9876543210,Sunita Sharma,Class 10 Physics – 4 PM,phone
102,Aman Verma,+91 98765 11111,,Class 10 Physics – 4 PM;Class 10 Maths – 5 PM,kiosk`;

export function ImportForm() {
  const [state, action, pending] = useActionState(importStudents, undefined);
  return (
    <form action={action} className="space-y-3">
      {state?.ok && <p className={ui.success}>{state.ok}</p>}
      {state?.error && <p className={`${ui.error} whitespace-pre-line`}>{state.error}</p>}
      <p className={ui.muted}>
        Upload a CSV (from Excel: File → Save As → CSV) or paste it below. Required columns: roll_no, name, parent_phone.
        Optional: parent_name, student_phone, batches (separate several with ;), checkin_method (phone or kiosk). Existing
        roll numbers are updated.
      </p>
      <input type="file" name="file" accept=".csv,text/csv" className="text-sm" />
      <textarea className={`${ui.input} h-32 font-mono text-xs`} name="csv" placeholder={SAMPLE} />
      <button className={ui.button} disabled={pending}>{pending ? "Importing…" : "Import students"}</button>
    </form>
  );
}
