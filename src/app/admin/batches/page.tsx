import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { formatDays, formatTime, todayIST } from "@/lib/time";
import { ui } from "@/components/ui";
import { BatchForm } from "./batch-form";
import { SessionForm } from "./session-form";
import { createBatch, setSessionStatus } from "./actions";

type Row = {
  id: string;
  name: string;
  subject: string | null;
  days: number[];
  start_time: string;
  end_time: string;
  active: boolean;
  student_batches: { count: number }[];
};

export default async function BatchesPage() {
  const { supabase, staff } = await requireStaff();
  const today = todayIST();
  const [{ data }, { data: upcoming }] = await Promise.all([
    supabase
      .from("batches")
      .select("id, name, subject, days, start_time, end_time, active, student_batches(count)")
      .order("active", { ascending: false })
      .order("start_time"),
    supabase
      .from("batch_sessions")
      .select("session_date, status, note, batches(name)")
      .neq("status", "scheduled")
      .gte("session_date", today)
      .order("session_date")
      .limit(30),
  ]);
  const batches = (data ?? []) as unknown as Row[];
  const isAdmin = staff.role === "admin";

  return (
    <div className="space-y-6">
      <h1 className={ui.h1}>Batches</h1>

      <section className={ui.card}>
        {batches.length === 0 ? (
          <p className={ui.muted}>No batches yet. Create the first one below.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={ui.table}>
              <thead>
                <tr>
                  <th className={ui.th}>Name</th>
                  <th className={ui.th}>Days</th>
                  <th className={ui.th}>Time</th>
                  <th className={ui.th}>Students</th>
                  <th className={ui.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className={b.active ? "" : "opacity-50"}>
                    <td className={ui.td}>
                      <Link className="font-medium underline" href={`/admin/batches/${b.id}`}>{b.name}</Link>
                      {b.subject && <span className={`${ui.muted} ml-2`}>{b.subject}</span>}
                    </td>
                    <td className={ui.td}>{formatDays(b.days)}</td>
                    <td className={ui.td}>{formatTime(b.start_time)} – {formatTime(b.end_time)}</td>
                    <td className={ui.td}>{b.student_batches[0]?.count ?? 0}</td>
                    <td className={ui.td}>{b.active ? "Active" : "Inactive"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isAdmin && (
        <>
          <section className={ui.card}>
            <h2 className={`${ui.h2} mb-4`}>Holiday or cancellation for all batches</h2>
            <SessionForm action={setSessionStatus.bind(null, "all")} defaultDate={today} allBatches />
            {upcoming && upcoming.length > 0 && (
              <div className="mt-4">
                <p className={`${ui.label}`}>Upcoming holidays and cancellations</p>
                <ul className="space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                  {(upcoming as unknown as { session_date: string; status: string; note: string | null; batches: { name: string } }[]).map(
                    (s, i) => (
                      <li key={i}>
                        {s.session_date} · {s.batches.name} · {s.status}
                        {s.note ? ` – ${s.note}` : ""}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            )}
          </section>

          <section className={ui.card}>
            <h2 className={`${ui.h2} mb-4`}>New batch</h2>
            <BatchForm action={createBatch} submitLabel="Create batch" />
          </section>
        </>
      )}
    </div>
  );
}
