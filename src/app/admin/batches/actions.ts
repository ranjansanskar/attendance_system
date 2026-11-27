"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import type { ActionState } from "@/components/ui";

const time = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM");

const BatchSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(80),
    subject: z.string().trim().max(80).optional(),
    days: z.array(z.coerce.number().int().min(0).max(6)).min(1, "Pick at least one day"),
    start_time: time,
    end_time: time,
    late_after_min: z.coerce.number().int().min(0).max(120),
    absent_after_min: z.coerce.number().int().min(1).max(180),
  })
  .refine((b) => b.end_time > b.start_time, { message: "End time must be after start time" })
  .refine((b) => b.absent_after_min >= b.late_after_min, {
    message: "Absent cutoff must be the same as or later than the late cutoff",
  });

function parseBatch(formData: FormData) {
  return BatchSchema.safeParse({
    name: formData.get("name"),
    subject: formData.get("subject") || undefined,
    days: formData.getAll("days"),
    start_time: formData.get("start_time"),
    end_time: formData.get("end_time"),
    late_after_min: formData.get("late_after_min"),
    absent_after_min: formData.get("absent_after_min"),
  });
}

function dbError(message: string): ActionState {
  if (message.includes("duplicate key")) return { error: "A batch with that name already exists." };
  return { error: message };
}

export async function createBatch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const parsed = parseBatch(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data, error } = await supabase.from("batches").insert(parsed.data).select("id").single();
  if (error) return dbError(error.message);
  revalidatePath("/admin/batches");
  redirect(`/admin/batches/${data.id}`);
}

export async function updateBatch(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const parsed = parseBatch(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabase.from("batches").update(parsed.data).eq("id", id);
  if (error) return dbError(error.message);
  revalidatePath("/admin/batches");
  revalidatePath(`/admin/batches/${id}`);
  return { ok: "Saved." };
}

export async function setBatchActive(id: string, active: boolean) {
  const { supabase } = await requireAdmin();
  await supabase.from("batches").update({ active }).eq("id", id);
  revalidatePath("/admin/batches");
  revalidatePath(`/admin/batches/${id}`);
}

const SessionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  status: z.enum(["cancelled", "holiday", "scheduled"]),
  note: z.string().trim().max(200).optional(),
});

/**
 * Cancel a class, mark a holiday, or restore it. batchId = "all" applies to every active batch.
 * A cancelled/holiday session never produces absent marks or WhatsApp alerts.
 */
export async function setSessionStatus(batchId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const parsed = SessionSchema.safeParse({
    date: formData.get("date"),
    status: formData.get("status"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { date, status, note } = parsed.data;

  let batchIds = [batchId];
  if (batchId === "all") {
    const { data } = await supabase.from("batches").select("id").eq("active", true);
    batchIds = (data ?? []).map((b) => b.id);
    if (batchIds.length === 0) return { error: "No active batches." };
  }

  const rows = batchIds.map((id) => ({ batch_id: id, session_date: date, status, note: note ?? null }));
  const { error } = await supabase.from("batch_sessions").upsert(rows, { onConflict: "batch_id,session_date" });
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/admin/batches");
  if (batchId !== "all") revalidatePath(`/admin/batches/${batchId}`);
  const label = status === "scheduled" ? "restored" : status === "holiday" ? "marked as holiday" : "cancelled";
  return { ok: `${date} ${label}${batchId === "all" ? " for all batches" : ""}.` };
}
