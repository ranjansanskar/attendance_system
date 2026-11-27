import { requireAdmin } from "@/lib/auth";
import { ui } from "@/components/ui";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: settings }, { data: staff }] = await Promise.all([
    supabase.from("app_settings").select("institute_name, latitude, longitude, radius_m").eq("id", 1).single(),
    supabase.from("staff").select("id, name, role, phone").order("role").order("name"),
  ]);

  return (
    <div className="space-y-6">
      <h1 className={ui.h1}>Settings</h1>
      <section className={ui.card}>
        <h2 className={`${ui.h2} mb-4`}>Institute</h2>
        {settings && <SettingsForm initial={settings} />}
      </section>
      <section className={ui.card}>
        <h2 className={`${ui.h2} mb-3`}>Staff</h2>
        <table className={ui.table}>
          <thead>
            <tr>
              <th className={ui.th}>Name</th>
              <th className={ui.th}>Role</th>
              <th className={ui.th}>Phone</th>
            </tr>
          </thead>
          <tbody>
            {(staff ?? []).map((s) => (
              <tr key={s.id}>
                <td className={ui.td}>{s.name}</td>
                <td className={ui.td}>{s.role}</td>
                <td className={ui.td}>{s.phone ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={`${ui.muted} mt-3`}>
          To add a teacher: create their login in Supabase (Authentication → Users → Add user), then run the
          &quot;add staff&quot; SQL from the README with their email.
        </p>
      </section>
    </div>
  );
}
