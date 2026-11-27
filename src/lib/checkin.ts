import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatTime, nowIST, toMinutes } from "@/lib/time";

/** Check-in opens this many minutes before a batch starts and stays open until it ends. */
export const OPENS_BEFORE_MIN = 15;

type Batch = {
  id: string;
  name: string;
  days: number[];
  start_time: string;
  end_time: string;
  late_after_min: number;
};

export type CheckinOutcome =
  | { ok: true; status: "present" | "late"; batchName: string; checkedInAt: string; alreadyMarked: boolean }
  | { ok: false; error: string };

/**
 * The batch this student can check in to right now (window: start − 15 min … end), or an explanation.
 * If two batches overlap, the one starting soonest wins.
 */
export async function findCurrentBatch(
  db: SupabaseClient,
  studentId: string,
  now = new Date(),
): Promise<{ batch: Batch; date: string; minutes: number } | { error: string }> {
  const { date, weekday, minutes } = nowIST(now);
  const { data } = await db
    .from("student_batches")
    .select("batches!inner(id, name, days, start_time, end_time, late_after_min, active)")
    .eq("student_id", studentId)
    .eq("batches.active", true);

  const todays = ((data ?? []) as unknown as { batches: Batch }[])
    .map((r) => r.batches)
    .filter((b) => b.days.includes(weekday))
    .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));

  if (todays.length === 0) return { error: "You have no batch today." };

  const open = todays.filter(
    (b) => minutes >= toMinutes(b.start_time) - OPENS_BEFORE_MIN && minutes <= toMinutes(b.end_time),
  );
  if (open.length > 0) {
    open.sort((a, b) => Math.abs(toMinutes(a.start_time) - minutes) - Math.abs(toMinutes(b.start_time) - minutes));
    return { batch: open[0], date, minutes };
  }

  const next = todays.find((b) => toMinutes(b.start_time) - OPENS_BEFORE_MIN > minutes);
  if (next) {
    const opensAt = toMinutes(next.start_time) - OPENS_BEFORE_MIN;
    const hh = String(Math.floor(opensAt / 60)).padStart(2, "0");
    const mm = String(opensAt % 60).padStart(2, "0");
    return {
      error: `Check-in for ${next.name} (${formatTime(next.start_time)}) opens at ${formatTime(`${hh}:${mm}`)}.`,
    };
  }
  return { error: "Today's batches are over." };
}

/** Finds or creates today's session row for a batch without overwriting a cancellation. */
async function getSession(db: SupabaseClient, batchId: string, date: string) {
  await db
    .from("batch_sessions")
    .upsert({ batch_id: batchId, session_date: date }, { onConflict: "batch_id,session_date", ignoreDuplicates: true });
  const { data, error } = await db
    .from("batch_sessions")
    .select("id, status, note")
    .eq("batch_id", batchId)
    .eq("session_date", date)
    .single();
  if (error) throw new Error(error.message);
  return data as { id: string; status: "scheduled" | "cancelled" | "holiday"; note: string | null };
}

/**
 * Records a check-in for the student's current batch. Shared by phone check-in (Phase 2),
 * kiosk check-in (Phase 4). The caller must already have verified identity, QR and location.
 */
export async function recordCheckin(
  db: SupabaseClient,
  input: {
    studentId: string;
    method: "phone" | "kiosk" | "teacher";
    gpsDistanceM?: number | null;
    faceScore?: number | null;
    selfiePath?: string | null;
    markedBy?: string | null;
  },
  now = new Date(),
): Promise<CheckinOutcome> {
  const current = await findCurrentBatch(db, input.studentId, now);
  if ("error" in current) return { ok: false, error: current.error };
  const { batch, date, minutes } = current;

  const session = await getSession(db, batch.id, date);
  if (session.status !== "scheduled") {
    const what = session.status === "holiday" ? "a holiday" : "cancelled";
    return { ok: false, error: `${batch.name} is ${what} today${session.note ? ` (${session.note})` : ""}.` };
  }

  const status: "present" | "late" =
    minutes > toMinutes(batch.start_time) + batch.late_after_min ? "late" : "present";
  const checkedInAt = now.toISOString();
  const row = {
    status,
    method: input.method,
    checked_in_at: checkedInAt,
    gps_distance_m: input.gpsDistanceM ?? null,
    face_score: input.faceScore ?? null,
    selfie_path: input.selfiePath ?? null,
    marked_by: input.markedBy ?? null,
  };

  const { data: existing } = await db
    .from("attendance")
    .select("id, status, method, checked_in_at")
    .eq("session_id", session.id)
    .eq("student_id", input.studentId)
    .maybeSingle();

  if (existing) {
    // Marked absent automatically, then arrived: upgrade to late. (The absent alert may already have gone.)
    if (existing.status === "absent" && existing.method === "system") {
      const { error } = await db.from("attendance").update({ ...row, status: "late" }).eq("id", existing.id);
      if (error) return { ok: false, error: "Could not save attendance. Try again." };
      return { ok: true, status: "late", batchName: batch.name, checkedInAt, alreadyMarked: false };
    }
    return {
      ok: true,
      status: existing.status === "late" ? "late" : "present",
      batchName: batch.name,
      checkedInAt: existing.checked_in_at ?? checkedInAt,
      alreadyMarked: true,
    };
  }

  const { error } = await db.from("attendance").insert({ ...row, session_id: session.id, student_id: input.studentId });
  if (error) {
    // Two scans at the same moment: the unique constraint keeps one; report it as already marked.
    if (error.code === "23505") {
      return { ok: true, status, batchName: batch.name, checkedInAt, alreadyMarked: true };
    }
    return { ok: false, error: "Could not save attendance. Try again." };
  }
  return { ok: true, status, batchName: batch.name, checkedInAt, alreadyMarked: false };
}
