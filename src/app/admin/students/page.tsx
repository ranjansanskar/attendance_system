import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { ui } from "@/components/ui";
import { ImportForm } from "./import-form";
import { BulkPinPanel } from "./pin-panels";

type Row = {
  id: string;
  roll_no: string;
  name: string;
  parent_phone: string;
  checkin_method: "phone" | "kiosk";
  consent_at: string | null;
  active: boolean;
  student_batches: { batches: { name: string } }[];
};

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; batch?: string; inactive?: string }>;
}) {
  const { q = "", batch = "", inactive } = await searchParams;
  const { supabase, staff } = await requireStaff();

  const { data: batches } = await supabase.from("batches").select("id, name").order("name");

  let query = supabase
    .from("students")
    .select("id, roll_no, name, parent_phone, checkin_method, consent_at, active, student_batches(batches(name))")
    .order("roll_no");
  if (!inactive) query = query.eq("active", true);
  const term = q.replace(/[,()%*]/g, " ").trim();
  if (term) query = query.or(`name.ilike.%${term}%,roll_no.ilike.%${term}%`);
  if (batch) {
    const { data: ids } = await supabase.from("student_batches").select("student_id").eq("batch_id", batch);
    query = query.in("id", (ids ?? []).map((r) => r.student_id));
  }
  const { data, error } = await query;
  const students = ((data ?? []) as unknown as Row[]).sort((a, b) =>
    a.roll_no.localeCompare(b.roll_no, undefined, { numeric: true }),
  );
  const isAdmin = staff.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className={ui.h1}>Students</h1>
        {isAdmin && (
          <Link href="/admin/students/new" className={`${ui.button} ml-auto`}>+ Add student</Link>
        )}
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label className={ui.label}>Search</label>
          <input className={ui.input} name="q" defaultValue={q} placeholder="Name or roll number" />
        </div>
        <div>
          <label className={ui.label}>Batch</label>
          <select className={ui.input} name="batch" defaultValue={batch}>
            <option value="">All batches</option>
            {(batches ?? []).map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-1.5 pb-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" name="inactive" value="1" defaultChecked={!!inactive} /> Show inactive
        </label>
        <button className={ui.buttonSecondary}>Filter</button>
      </form>

      <section className={ui.card}>
        {error && <p className={ui.error}>{error.message}</p>}
        <p className={`${ui.muted} mb-2`}>{students.length} student{students.length === 1 ? "" : "s"}</p>
        <div className="overflow-x-auto">
          <table className={ui.table}>
            <thead>
              <tr>
                <th className={ui.th}>Roll no</th>
                <th className={ui.th}>Name</th>
                <th className={ui.th}>Batches</th>
                <th className={ui.th}>Parent WhatsApp</th>
                <th className={ui.th}>Check-in</th>
                <th className={ui.th}>Consent</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className={s.active ? "" : "opacity-50"}>
                  <td className={ui.td}>{s.roll_no}</td>
                  <td className={ui.td}>
                    <Link className="font-medium underline" href={`/admin/students/${s.id}`}>{s.name}</Link>
                  </td>
                  <td className={ui.td}>{s.student_batches.map((sb) => sb.batches.name).join(", ") || "—"}</td>
                  <td className={ui.td}>{s.parent_phone}</td>
                  <td className={ui.td}>{s.checkin_method === "kiosk" ? "Kiosk" : "Phone"}</td>
                  <td className={ui.td}>{s.consent_at ? "Yes" : <span className="text-amber-600">Missing</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {isAdmin && (
        <section className={ui.card}>
          <h2 className={`${ui.h2} mb-3`}>App PINs</h2>
          <BulkPinPanel />
        </section>
      )}

      {isAdmin && (
        <section className={ui.card}>
          <h2 className={`${ui.h2} mb-3`}>Bulk import from CSV / Excel</h2>
          <ImportForm />
        </section>
      )}
    </div>
  );
}
