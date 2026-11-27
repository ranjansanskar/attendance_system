import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { formatTime, todayIST, weekdayOf } from "@/lib/time";
import { ui } from "@/components/ui";

type Batch = { id: string; name: string; start_time: string; end_time: string; days: number[] };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { supabase } = await requireStaff();
  const today = todayIST();
  const weekday = weekdayOf(today);

  const [students, batches, sessions] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("batches").select("id, name, start_time, end_time, days").eq("active", true).order("start_time"),
    supabase.from("batch_sessions").select("batch_id, status, note").eq("session_date", today),
  ]);

  const todays = ((batches.data ?? []) as Batch[]).filter((b) => b.days.includes(weekday));
  const statusByBatch = new Map((sessions.data ?? []).map((s) => [s.batch_id, s]));

  return (
    <div className="space-y-6">
      {error === "admin-only" && <p className={ui.error}>Only admins can do that.</p>}
      <h1 className={ui.h1}>Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Active students" value={students.count ?? 0} />
        <Stat label="Active batches" value={batches.data?.length ?? 0} />
        <Stat label="Batches today" value={todays.length} />
      </div>
      <section className={ui.card}>
        <h2 className={`${ui.h2} mb-3`}>Today · {today}</h2>
        {todays.length === 0 ? (
          <p className={ui.muted}>No batches scheduled today.</p>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th className={ui.th}>Batch</th>
                <th className={ui.th}>Time</th>
                <th className={ui.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {todays.map((b) => {
                const s = statusByBatch.get(b.id);
                const status = s?.status ?? "scheduled";
                return (
                  <tr key={b.id}>
                    <td className={ui.td}>
                      <Link className="underline" href={`/admin/batches/${b.id}`}>{b.name}</Link>
                    </td>
                    <td className={ui.td}>{formatTime(b.start_time)} – {formatTime(b.end_time)}</td>
                    <td className={ui.td}>
                      {status === "scheduled" ? "Scheduled" : `${status === "holiday" ? "Holiday" : "Cancelled"}${s?.note ? ` – ${s.note}` : ""}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className={ui.card}>
      <p className={ui.muted}>{label}</p>
      <p className="mt-1 text-3xl font-semibold text-zinc-900 dark:text-zinc-100">{value}</p>
    </div>
  );
}
