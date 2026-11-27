import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type StaffRole = "admin" | "teacher";

/** Ensures the visitor is a logged-in staff member; redirects to /login otherwise. */
export async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: staff } = await supabase
    .from("staff")
    .select("id, name, role")
    .eq("id", user.id)
    .maybeSingle<{ id: string; name: string; role: StaffRole }>();
  if (!staff) redirect("/login?error=not-staff");

  return { supabase, user, staff };
}

/** Same as requireStaff, but only admins pass. Use at the top of every admin-only server action. */
export async function requireAdmin() {
  const ctx = await requireStaff();
  if (ctx.staff.role !== "admin") redirect("/admin?error=admin-only");
  return ctx;
}
