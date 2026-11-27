import Link from "next/link";
import { redirect } from "next/navigation";
import { hasStudentCookie } from "@/lib/student-session";
import { ui } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (await hasStudentCookie()) redirect("/s");
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className={`${ui.card} w-full max-w-sm space-y-4 text-center`}>
        <h1 className={ui.h1}>Ranjan Tutorials</h1>
        <p className={ui.muted}>Attendance</p>
        <Link href="/s/login" className={`${ui.button} w-full py-3`}>Student login</Link>
        <Link href="/login" className={`${ui.buttonSecondary} w-full`}>Staff login</Link>
      </div>
    </main>
  );
}
