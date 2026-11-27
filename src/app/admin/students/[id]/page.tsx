import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { formatClockIST } from "@/lib/time";
import { ui } from "@/components/ui";
import { StudentForm, type StudentValues } from "../student-form";
import { resetStudentPhone, setStudentActive, updateStudent } from "../actions";
import { PinPanel } from "../pin-panels";

type Rec = {
  id: string;
  status: "present" | "late" | "absent";
  method: string;
  checked_in_at: string | null;
  gps_distance_m: number | null;
  batch_sessions: { session_date: string; batches: { name: string } };
};

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, staff } = await requireStaff();

  const [{ data: student }, { data: batches }, { data: device }, { data: records }] = await Promise.all([
    supabase
      .from("students")
      .select(
        "id, roll_no, name, parent_name, parent_phone, student_phone, checkin_method, consent_at, active, pin_set_at, pin_locked_until, student_batches(batch_id)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("batches").select("id, name, active").order("name"),
    supabase
      .from("devices")
      .select("registered_at")
      .eq("student_id", id)
      .eq("kind", "student")
      .is("revoked_at", null)
      .maybeSingle(),
    supabase
      .from("attendance")
      .select("id, status, method, checked_in_at, gps_distance_m, batch_sessions(session_date, batches(name))")
      .eq("student_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  if (!student) notFound();

  const batchIds: string[] = student.student_batches.map((sb: { batch_id: string }) => sb.batch_id);
  const initial: StudentValues = { ...student, batch_ids: batchIds };
  // Show active batches plus any inactive ones the student is still in.
  const batchOptions = (batches ?? []).filter((b) => b.active || batchIds.includes(b.id));
  const isAdmin = staff.role === "admin";
  const locked = student.pin_locked_until && new Date(student.pin_locked_until) > new Date();
  const recs = (records ?? []) as unknown as Rec[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/students" className={ui.muted}>← Students</Link>
        <h1 className={ui.h1}>
          {student.name} <span className={ui.muted}>#{student.roll_no}</span>
        </h1>
        {!student.active && <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs dark:bg-zinc-800">Inactive</span>}
      </div>

      {isAdmin ? (
        <section className={ui.card}>
          <StudentForm action={updateStudent.bind(null, id)} batches={batchOptions} initial={initial} submitLabel="Save changes" />
          <form action={setStudentActive.bind(null, id, !student.active)} className="mt-4">
            <button className={student.active ? ui.buttonDanger : ui.buttonSecondary}>
              {student.active ? "Mark as left (deactivate)" : "Reactivate student"}
            </button>
          </form>
        </section>
      ) : (
        <section className={`${ui.card} space-y-1 text-sm`}>
          <p>Parent WhatsApp: {student.parent_phone}</p>
          <p>Check-in: {student.checkin_method === "kiosk" ? "Kiosk" : "Phone"}</p>
        </section>
      )}

      {isAdmin && (
        <section className={`${ui.card} grid gap-6 sm:grid-cols-2`}>
          <div className="space-y-2">
            <h2 className={ui.h2}>App PIN</h2>
            <p className={ui.muted}>
              {student.pin_set_at ? `PIN set on ${student.pin_set_at.slice(0, 10)}.` : "No PIN yet. The student can't log in."}
              {locked && " Locked after 5 wrong attempts. Resetting the PIN unlocks it."}
            </p>
            <PinPanel studentId={id} hasPin={!!student.pin_set_at} />
          </div>
          <div className="space-y-2">
            <h2 className={ui.h2}>Phone</h2>
            <p className={ui.muted}>
              {device
                ? `Registered on ${device.registered_at.slice(0, 10)}. Only this phone can check in.`
                : "No phone registered. The first phone the student logs in on becomes theirs."}
            </p>
            {device && (
              <form action={resetStudentPhone.bind(null, id)}>
                <button className={ui.buttonDanger}>Reset phone (student changed phones)</button>
              </form>
            )}
          </div>
        </section>
      )}

      <section className={ui.card}>
        <h2 className={`${ui.h2} mb-3`}>Recent attendance</h2>
        {recs.length === 0 ? (
          <p className={ui.muted}>No attendance yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={ui.table}>
              <thead>
                <tr>
                  <th className={ui.th}>Date</th>
                  <th className={ui.th}>Batch</th>
                  <th className={ui.th}>Status</th>
                  <th className={ui.th}>Time</th>
                  <th className={ui.th}>Method</th>
                  <th className={ui.th}>Distance</th>
                </tr>
              </thead>
              <tbody>
                {recs.map((r) => (
                  <tr key={r.id}>
                    <td className={ui.td}>{r.batch_sessions.session_date}</td>
                    <td className={ui.td}>{r.batch_sessions.batches.name}</td>
                    <td className={ui.td}>{r.status}</td>
                    <td className={ui.td}>{r.checked_in_at ? formatClockIST(r.checked_in_at) : "—"}</td>
                    <td className={ui.td}>{r.method}</td>
                    <td className={ui.td}>{r.gps_distance_m != null ? `${Math.round(r.gps_distance_m)} m` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
