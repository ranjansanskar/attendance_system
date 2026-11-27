import Link from "next/link";
import { ui } from "@/components/ui";

export default function Home() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className={`${ui.card} w-full max-w-sm space-y-4 text-center`}>
        <h1 className={ui.h1}>Ranjan Tutorials</h1>
        <p className={ui.muted}>Attendance</p>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">Student check-in opens here soon.</p>
        <Link href="/admin" className={`${ui.buttonSecondary} w-full`}>Staff login</Link>
      </div>
    </main>
  );
}
