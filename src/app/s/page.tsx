import Link from "next/link";
import { requireStudent } from "@/lib/student-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatClockIST, formatTime, nowIST } from "@/lib/time";
import { ui } from "@/components/ui";
import { studentSignOut } from "./actions";

export const dynamic = "force-dynamic";

type Rec = {
  status: "present" | "late" | "absent";
  checked_in_at: string | null;
  batch_sessions: { session_date: string; batches: { name: string } };
};

const LABEL = { present: "Present", late: "Late", absent: "Absent" } as const;
const COLOR = {
  present: "text-green-700 dark:text-green-400",
  late: "text-amber-600 dark:text-amber-400",
  absent: "text-red-600 dark:text-red-400",
} as const;

export default async function StudentHome() {
  const { student } = await requireStudent();
  const db = createAdminClient();
  const { date, weekday } = nowIST();
  const monthStart = `${date.slice(0, 7)}-01`;

  const [{ data: batchRows }, { data: records }] = await Promise.all([
    db
      .from("student_batches")
      .select("batches!inner(id, name, days, start_time, end_time, active)")
      .eq("student_id", student.id)
      .eq("batches.active", true),
    db
      .from("attendance")
      .select("status, checked_in_at, batch_sessions!inner(session_date, batches(name))")
      .eq("student_id", student.id)
      .gte("batch_sessions.session_date", monthStart)
      .order("created_at", { ascending: false }),
  ]);

  const todays = ((batchRows ?? []) as unknown as { batches: { name: string; days: number[]; start_time: string; end_time: string } }[])
    .map((r) => r.batches)
    .filter((b) => b.days.includes(weekday))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const recs = (records ?? []) as unknown as Rec[];
  const attended = recs.filter((r) => r.status !== "absent").length;
  const pct = recs.length ? Math.round((attended / recs.length) * 100) : null;
  const todayRecs = new Map(
    recs.filter((r) => r.batch_sessions.session_date === date).map((r) => [r.batch_sessions.batches.name, r]),
  );

  return (
    <main className="space-y-5">
      <header className="flex items-start justify-between">
        <div>
          <h1 className={ui.h1}>Hi, {student.name.split(" ")[0]}</h1>
          <p className={ui.muted}>Roll no {student.roll_no}</p>
        </div>
        <form action={studentSignOut}>
          <button className="text-sm text-zinc-500 underline">Log out</button>
        </form>
      </header>

      <Link href="/s/scan" className={`${ui.button} w-full py-5 text-lg`}>
        Scan QR to check in
      </Link>

      <section className={ui.card}>
        <h2 className={`${ui.h2} mb-2`}>Today</h2>
        {todays.length === 0 ? (
          <p className={ui.muted}>No batch today.</p>
        ) : (
          <ul className="space-y-2">
            {todays.map((b) => {
              const r = todayRecs.get(b.name);
              return (
                <li key={b.name} className="flex items-center justify-between text-sm">
                  <span>
                    <span className="font-medium">{b.name}</span>
                    <span className={`${ui.muted} ml-2`}>{formatTime(b.start_time)}</span>
                  </span>
                  {r ? (
                    <span className={COLOR[r.status]}>
                      {LABEL[r.status]}
                      {r.checked_in_at ? ` · ${formatClockIST(r.checked_in_at)}` : ""}
                    </span>
                  ) : (
                    <span className={ui.muted}>Not checked in</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={ui.card}>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className={ui.h2}>This month</h2>
          {pct !== null && (
            <span className={`text-2xl font-semibold ${pct < 75 ? "text-red-600" : "text-green-700"}`}>{pct}%</span>
          )}
        </div>
        {recs.length === 0 ? (
          <p className={ui.muted}>No attendance recorded yet this month.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
            {recs.slice(0, 20).map((r, i) => (
              <li key={i} className="flex justify-between py-2">
                <span>
                  {r.batch_sessions.session_date.slice(8)}/{r.batch_sessions.session_date.slice(5, 7)} ·{" "}
                  {r.batch_sessions.batches.name}
                </span>
                <span className={COLOR[r.status]}>{LABEL[r.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
