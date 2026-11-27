import { redirect } from "next/navigation";
import { getStudent } from "@/lib/student-session";
import { ui } from "@/components/ui";
import { StudentLoginForm } from "./login-form";

export const metadata = { title: "Student login" };

export default async function StudentLoginPage() {
  if (await getStudent()) redirect("/s");
  return (
    <main className="flex min-h-[80dvh] flex-col justify-center">
      <div className={ui.card}>
        <h1 className={ui.h1}>Ranjan Tutorials</h1>
        <p className={`${ui.muted} mb-6`}>Student attendance</p>
        <StudentLoginForm />
      </div>
      <InstallHint />
    </main>
  );
}

function InstallHint() {
  return (
    <div className={`${ui.muted} mt-6 space-y-2 px-1`}>
      <p className="font-medium text-zinc-700 dark:text-zinc-300">Install the app first, then log in:</p>
      <p>
        <b>Android (Chrome):</b> menu ⋮ → <i>Add to Home screen</i> / <i>Install app</i>.
      </p>
      <p>
        <b>iPhone (Safari):</b> Share button → <i>Add to Home Screen</i>. Then open it from the home screen and log
        in there.
      </p>
      <p>Your account works on one phone only. Log in on your own phone.</p>
    </div>
  );
}
