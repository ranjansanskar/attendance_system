"use client";

import { useActionState } from "react";
import { signIn } from "./actions";
import { ui } from "@/components/ui";

export function LoginForm({ next, notStaff }: { next: string; notStaff: boolean }) {
  const [state, action, pending] = useActionState(signIn, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {notStaff && <p className={ui.error}>This account is not registered as staff. Ask the admin to add you.</p>}
      {state?.error && <p className={ui.error}>{state.error}</p>}
      <div>
        <label className={ui.label} htmlFor="email">Email</label>
        <input className={ui.input} id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <label className={ui.label} htmlFor="password">Password</label>
        <input className={ui.input} id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <button className={`${ui.button} w-full`} disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
