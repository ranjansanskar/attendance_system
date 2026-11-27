import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { ui } from "@/components/ui";
import { StudentForm, type StudentValues } from "../student-form";
import { setStudentActive, updateStudent } from "../actions";

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, staff } = await requireStaff();

  const [{ data: student }, { data: batches }] = await Promise.all([
    supabase.from("students").select("*, student_batches(batch_id)").eq("id", id).maybeSingle(),
    supabase.from("batches").select("id, name, active").order("name"),
  ]);
  if (!student) notFound();

  const batchIds: string[] = student.student_batches.map((sb: { batch_id: string }) => sb.batch_id);
  const initial: StudentValues = { ...student, batch_ids: batchIds };
  // Show active batches plus any inactive ones the student is still in.
  const batchOptions = (batches ?? []).filter((b) => b.active || batchIds.includes(b.id));
  const isAdmin = staff.role === "admin";

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

      <section className={ui.card}>
        <h2 className={ui.h2}>Face enrollment & attendance</h2>
        <p className={ui.muted}>Arrives in Phases 2–3.</p>
      </section>
    </div>
  );
}
