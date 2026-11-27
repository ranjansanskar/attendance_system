import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { todayIST } from "@/lib/time";
import { ui } from "@/components/ui";
import { BatchForm, type BatchValues } from "../batch-form";
import { SessionForm } from "../session-form";
import { setBatchActive, setSessionStatus, updateBatch } from "../actions";

export default async function BatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, staff } = await requireStaff();
  const today = todayIST();

  const [{ data: batch }, { data: members }, { data: sessions }] = await Promise.all([
    supabase.from("batches").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("student_batches")
      .select("students(id, roll_no, name, checkin_method, active)")
      .eq("batch_id", id),
    supabase
      .from("batch_sessions")
      .select("session_date, status, note")
      .eq("batch_id", id)
      .neq("status", "scheduled")
      .gte("session_date", today)
      .order("session_date"),
  ]);
  if (!batch) notFound();

  const students = ((members ?? []) as unknown as { students: { id: string; roll_no: string; name: string; checkin_method: string; active: boolean } }[])
    .map((m) => m.students)
    .sort((a, b) => a.roll_no.localeCompare(b.roll_no, undefined, { numeric: true }));
  const isAdmin = staff.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/batches" className={ui.muted}>← Batches</Link>
        <h1 className={ui.h1}>{batch.name}</h1>
        {!batch.active && <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs dark:bg-zinc-800">Inactive</span>}
      </div>

      {isAdmin && (
        <section className={ui.card}>
          <h2 className={`${ui.h2} mb-4`}>Details</h2>
          <BatchForm action={updateBatch.bind(null, id)} initial={batch as BatchValues} submitLabel="Save changes" />
          <form action={setBatchActive.bind(null, id, !batch.active)} className="mt-4">
            <button className={batch.active ? ui.buttonDanger : ui.buttonSecondary}>
              {batch.active ? "Deactivate batch" : "Reactivate batch"}
            </button>
          </form>
        </section>
      )}

      {isAdmin && (
        <section className={ui.card}>
          <h2 className={`${ui.h2} mb-4`}>Cancel a class or mark a holiday</h2>
          <SessionForm action={setSessionStatus.bind(null, id)} defaultDate={today} />
          {sessions && sessions.length > 0 && (
            <ul className="mt-4 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
              {sessions.map((s) => (
                <li key={s.session_date}>
                  {s.session_date} · {s.status}
                  {s.note ? ` – ${s.note}` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className={ui.card}>
        <h2 className={`${ui.h2} mb-3`}>Students ({students.length})</h2>
        {students.length === 0 ? (
          <p className={ui.muted}>No students in this batch. Assign batches from a student&apos;s page or the CSV import.</p>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th className={ui.th}>Roll no</th>
                <th className={ui.th}>Name</th>
                <th className={ui.th}>Check-in</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className={s.active ? "" : "opacity-50"}>
                  <td className={ui.td}>{s.roll_no}</td>
                  <td className={ui.td}>
                    <Link className="underline" href={`/admin/students/${s.id}`}>{s.name}</Link>
                  </td>
                  <td className={ui.td}>{s.checkin_method === "kiosk" ? "Kiosk" : "Phone"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
