"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import type { ActionState } from "@/components/ui";

const optionalNumber = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().min(min).max(max).nullable());

const SettingsSchema = z.object({
  institute_name: z.string().trim().min(1).max(100),
  latitude: optionalNumber(-90, 90),
  longitude: optionalNumber(-180, 180),
  radius_m: z.coerce.number().int().min(20, "Radius must be at least 20 m").max(2000),
});

export async function saveSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const parsed = SettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if ((parsed.data.latitude === null) !== (parsed.data.longitude === null)) {
    return { error: "Enter both latitude and longitude, or neither." };
  }
  const { error } = await supabase
    .from("app_settings")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return { error: error.message };
  revalidatePath("/admin/settings");
  return { ok: "Settings saved." };
}
