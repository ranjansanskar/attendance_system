import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { ui } from "@/components/ui";
import { StudentForm } from "../student-form";
import { createStudent } from "../actions";

export default async function NewStudentPage() {
  const { supabase } = await requireAdmin();
  const { data: batches } = await supabase.from("batches").select("id, name").eq("active", true).order("name");
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/students" className={ui.muted}>← Students</Link>
        <h1 className={ui.h1}>Add student</h1>
      </div>
      <section className={ui.card}>
        <StudentForm action={createStudent} batches={batches ?? []} submitLabel="Add student" />
      </section>
    </div>
  );
}
