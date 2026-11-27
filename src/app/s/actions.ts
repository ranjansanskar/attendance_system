"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomKey, sha256, verifyPin } from "@/lib/crypto";
import { clearStudentSession, getDeviceKey, setDeviceKey, setStudentSession } from "@/lib/student-session";
import type { ActionState } from "@/components/ui";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

/**
 * Roll number + PIN sign-in. The first successful sign-in registers this phone; after that the
 * account works only on this phone until the office resets it. A phone can belong to one student only.
 */
export async function studentSignIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const rollNo = String(formData.get("roll_no") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();
  if (!rollNo || !/^\d{4,8}$/.test(pin)) return { error: "Enter your roll number and PIN." };

  const db = createAdminClient();
  const { data: student } = await db
    .from("students")
    .select("id, active, pin_hash, pin_failed_count, pin_locked_until")
    .eq("roll_no", rollNo)
    .maybeSingle();

  // Same message for unknown roll number and wrong PIN.
  const wrong: ActionState = { error: "Wrong roll number or PIN." };
  if (!student || !student.active) return wrong;
  if (!student.pin_hash) return { error: "No PIN set for you yet. Ask the office for your PIN." };

  if (student.pin_locked_until && new Date(student.pin_locked_until) > new Date()) {
    const mins = Math.ceil((new Date(student.pin_locked_until).getTime() - Date.now()) / 60000);
    return { error: `Too many wrong attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` };
  }

  if (!(await verifyPin(pin, student.pin_hash))) {
    const failed = student.pin_failed_count + 1;
    const lock = failed >= MAX_ATTEMPTS;
    await db
      .from("students")
      .update({
        pin_failed_count: lock ? 0 : failed,
        pin_locked_until: lock ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() : null,
      })
      .eq("id", student.id);
    return lock ? { error: `Too many wrong attempts. Try again in ${LOCK_MINUTES} minutes.` } : wrong;
  }
  await db.from("students").update({ pin_failed_count: 0, pin_locked_until: null }).eq("id", student.id);

  // ---- Phone lock ----
  const existingKey = await getDeviceKey();
  const existingHash = existingKey ? sha256(existingKey) : null;

  const { data: active } = await db
    .from("devices")
    .select("id, device_key_hash")
    .eq("kind", "student")
    .eq("student_id", student.id)
    .is("revoked_at", null)
    .maybeSingle();

  if (active) {
    if (active.device_key_hash !== existingHash) {
      return {
        error: "Your account is registered on a different phone. If you changed phones, ask the office to reset it.",
      };
    }
    await setStudentSession(student.id, active.id);
    redirect("/s");
  }

  // No phone registered yet. Refuse if this phone already belongs to another student.
  if (existingHash) {
    const { data: other } = await db
      .from("devices")
      .select("student_id")
      .eq("device_key_hash", existingHash)
      .is("revoked_at", null)
      .maybeSingle();
    if (other && other.student_id !== student.id) {
      return { error: "This phone is already registered to another student. Each student must use their own phone." };
    }
  }

  // Fresh key for every new registration (old revoked rows keep their hashes).
  const key = randomKey();
  const { data: device, error } = await db
    .from("devices")
    .insert({ kind: "student", student_id: student.id, device_key_hash: sha256(key) })
    .select("id")
    .single();
  if (error || !device) return { error: "Could not register this phone. Try again." };

  await setDeviceKey(key);
  await setStudentSession(student.id, device.id);
  redirect("/s");
}

export async function studentSignOut() {
  await clearStudentSession();
  redirect("/s/login");
}
