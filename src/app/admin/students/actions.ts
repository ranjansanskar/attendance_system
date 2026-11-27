"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { parseCsv } from "@/lib/csv";
import type { ActionState } from "@/components/ui";

const phone = z.string().transform((v, ctx) => {
  const n = normalizePhone(v);
  if (!n) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `"${v}" is not a valid phone number` });
    return z.NEVER;
  }
  return n;
});

const StudentSchema = z.object({
  roll_no: z.string().trim().min(1, "Roll number is required").max(30),
  name: z.string().trim().min(1, "Name is required").max(100),
  parent_name: z.string().trim().max(100).optional(),
  parent_phone: phone,
  student_phone: phone.optional(),
  checkin_method: z.enum(["phone", "kiosk"]),
  consent: z.boolean(),
  batch_ids: z.array(z.string().uuid()),
});

function parseStudent(formData: FormData) {
  return StudentSchema.safeParse({
    roll_no: formData.get("roll_no"),
    name: formData.get("name"),
    parent_name: formData.get("parent_name") || undefined,
    parent_phone: formData.get("parent_phone"),
    student_phone: formData.get("student_phone") || undefined,
    checkin_method: formData.get("checkin_method"),
    consent: formData.get("consent") === "on",
    batch_ids: formData.getAll("batch_ids"),
  });
}

function dbError(message: string): ActionState {
  if (message.includes("students_roll_no_key")) return { error: "Another student already has that roll number." };
  return { error: message };
}

type Supabase = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

async function setBatches(supabase: Supabase, studentId: string, batchIds: string[]) {
  const del = await supabase.from("student_batches").delete().eq("student_id", studentId);
  if (del.error) return del.error.message;
  if (batchIds.length === 0) return null;
  const ins = await supabase
    .from("student_batches")
    .insert(batchIds.map((batch_id) => ({ student_id: studentId, batch_id })));
  return ins.error?.message ?? null;
}

export async function createStudent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const parsed = parseStudent(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { batch_ids, consent, ...fields } = parsed.data;

  const { data, error } = await supabase
    .from("students")
    .insert({ ...fields, consent_at: consent ? new Date().toISOString() : null })
    .select("id")
    .single();
  if (error) return dbError(error.message);

  const batchError = await setBatches(supabase, data.id, batch_ids);
  if (batchError) return { error: `Student saved, but batches failed: ${batchError}` };

  revalidatePath("/admin/students");
  redirect(`/admin/students/${data.id}`);
}

export async function updateStudent(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const parsed = parseStudent(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { batch_ids, consent, ...fields } = parsed.data;

  // Keep the original consent date if it was already recorded.
  const { data: existing } = await supabase.from("students").select("consent_at").eq("id", id).single();
  const consent_at = consent ? (existing?.consent_at ?? new Date().toISOString()) : null;

  const { error } = await supabase
    .from("students")
    .update({ ...fields, parent_name: fields.parent_name ?? null, student_phone: fields.student_phone ?? null, consent_at })
    .eq("id", id);
  if (error) return dbError(error.message);

  const batchError = await setBatches(supabase, id, batch_ids);
  if (batchError) return { error: `Saved, but batches failed: ${batchError}` };

  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${id}`);
  return { ok: "Saved." };
}

export async function setStudentActive(id: string, active: boolean) {
  const { supabase } = await requireAdmin();
  await supabase.from("students").update({ active }).eq("id", id);
  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${id}`);
}

/**
 * Bulk import / update from CSV. Header row required. Columns (any order):
 * roll_no, name, parent_phone, parent_name, student_phone, batches (names separated by ";"), checkin_method (phone|kiosk)
 * Existing students (same roll_no) are updated.
 */
export async function importStudents(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const file = formData.get("file");
  let text = String(formData.get("csv") ?? "");
  if (file instanceof File && file.size > 0) {
    if (file.size > 1_000_000) return { error: "File is larger than 1 MB." };
    text = await file.text();
  }
  const rows = parseCsv(text.replace(/^﻿/, ""));
  if (rows.length < 2) return { error: "Paste a header row and at least one student." };

  const header = rows[0].map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const col = (name: string) => header.indexOf(name);
  for (const required of ["roll_no", "name", "parent_phone"]) {
    if (col(required) === -1) return { error: `Missing column "${required}". Header must include roll_no, name, parent_phone.` };
  }

  const { data: batchRows } = await supabase.from("batches").select("id, name");
  const batchByName = new Map((batchRows ?? []).map((b) => [b.name.toLowerCase(), b.id]));

  const errors: string[] = [];
  const valid: { record: Record<string, string | null>; batchIds: string[] | null }[] = [];
  const seen = new Set<string>();

  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const get = (name: string) => (col(name) === -1 ? "" : (r[col(name)] ?? ""));
    const roll_no = get("roll_no");
    const name = get("name");
    if (!roll_no || !name) return errors.push(`Line ${line}: roll_no and name are required.`);
    if (seen.has(roll_no)) return errors.push(`Line ${line}: roll_no ${roll_no} appears twice.`);
    seen.add(roll_no);

    const parent_phone = normalizePhone(get("parent_phone"));
    if (!parent_phone) return errors.push(`Line ${line}: invalid parent_phone "${get("parent_phone")}".`);
    const studentPhoneRaw = get("student_phone");
    const student_phone = studentPhoneRaw ? normalizePhone(studentPhoneRaw) : null;
    if (studentPhoneRaw && !student_phone) return errors.push(`Line ${line}: invalid student_phone "${studentPhoneRaw}".`);

    const method = (get("checkin_method") || "phone").toLowerCase();
    if (method !== "phone" && method !== "kiosk") return errors.push(`Line ${line}: checkin_method must be phone or kiosk.`);

    let batchIds: string[] | null = null; // null = column absent, leave batches unchanged
    if (col("batches") !== -1) {
      const names = get("batches").split(/[;|]/).map((s) => s.trim()).filter(Boolean);
      const unknown = names.filter((n) => !batchByName.has(n.toLowerCase()));
      if (unknown.length) return errors.push(`Line ${line}: unknown batch ${unknown.map((u) => `"${u}"`).join(", ")}.`);
      batchIds = names.map((n) => batchByName.get(n.toLowerCase())!);
    }

    valid.push({
      record: {
        roll_no,
        name,
        parent_phone,
        parent_name: get("parent_name") || null,
        student_phone,
        checkin_method: method,
      },
      batchIds,
    });
  });

  if (valid.length === 0) return { error: `Nothing imported.\n${errors.join("\n")}` };

  const { data: saved, error } = await supabase
    .from("students")
    .upsert(valid.map((v) => v.record), { onConflict: "roll_no" })
    .select("id, roll_no");
  if (error) return { error: error.message };

  const idByRoll = new Map((saved ?? []).map((s) => [s.roll_no, s.id]));
  for (const v of valid) {
    if (v.batchIds === null) continue;
    const id = idByRoll.get(v.record.roll_no!);
    if (!id) continue;
    const err = await setBatches(supabase, id, v.batchIds);
    if (err) errors.push(`Roll ${v.record.roll_no}: batches not saved (${err}).`);
  }

  revalidatePath("/admin/students");
  revalidatePath("/admin/batches");
  const summary = `Imported or updated ${valid.length} student${valid.length === 1 ? "" : "s"}.`;
  return errors.length ? { ok: summary, error: `Skipped:\n${errors.join("\n")}` } : { ok: summary };
}
