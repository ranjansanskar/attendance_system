"use client";

import { useActionState } from "react";
import { ui } from "@/components/ui";
import { studentSignIn } from "../actions";

export function StudentLoginForm() {
  const [state, action, pending] = useActionState(studentSignIn, undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <p className={ui.error}>{state.error}</p>}
      <div>
        <label className={ui.label} htmlFor="roll_no">Roll number</label>
        <input className={`${ui.input} text-base`} id="roll_no" name="roll_no" autoComplete="username" required />
      </div>
      <div>
        <label className={ui.label} htmlFor="pin">PIN (from the office)</label>
        <input
          className={`${ui.input} text-base tracking-widest`}
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="\d{4,8}"
          autoComplete="current-password"
          required
        />
      </div>
      <button className={`${ui.button} w-full py-3 text-base`} disabled={pending}>
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
