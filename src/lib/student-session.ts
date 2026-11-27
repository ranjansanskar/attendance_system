import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { safeEqual, sign } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const SESSION_COOKIE = "rt_student";
/** Long-lived random key that identifies this phone. Survives logout; only its hash is stored. */
const DEVICE_COOKIE = "rt_device";

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

type SessionPayload = { sid: string; did: string; iat: number };

export type StudentContext = {
  student: { id: string; roll_no: string; name: string; checkin_method: "phone" | "kiosk" };
  deviceId: string;
};

function encode(p: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(p)).toString("base64url");
  return `${body}.${sign("session", body)}`;
}

function decode(value: string | undefined): SessionPayload | null {
  if (!value) return null;
  const [body, sig] = value.split(".");
  if (!body || !sig || !safeEqual(sig, sign("session", body))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    return typeof p.sid === "string" && typeof p.did === "string" ? p : null;
  } catch {
    return null;
  }
}

export async function setStudentSession(studentId: string, deviceId: string) {
  (await cookies()).set(SESSION_COOKIE, encode({ sid: studentId, did: deviceId, iat: Date.now() }), {
    ...cookieBase,
    maxAge: 60 * 60 * 24 * 180,
  });
}

export async function clearStudentSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getDeviceKey(): Promise<string | undefined> {
  return (await cookies()).get(DEVICE_COOKIE)?.value;
}

export async function setDeviceKey(key: string) {
  (await cookies()).set(DEVICE_COOKIE, key, { ...cookieBase, maxAge: 60 * 60 * 24 * 400 });
}

/** Has a (signature-valid) session cookie; cheap check without a database call. */
export async function hasStudentCookie(): Promise<boolean> {
  return decode((await cookies()).get(SESSION_COOKIE)?.value) !== null;
}

/**
 * The signed-in student, or null. Also verifies that the student is still active and that the
 * phone has not been reset by the office (a reset revokes the device and logs the student out).
 */
export async function getStudent(): Promise<StudentContext | null> {
  const payload = decode((await cookies()).get(SESSION_COOKIE)?.value);
  if (!payload) return null;

  const db = createAdminClient();
  const [{ data: student }, { data: device }] = await Promise.all([
    db.from("students").select("id, roll_no, name, checkin_method, active").eq("id", payload.sid).maybeSingle(),
    db.from("devices").select("id, student_id, revoked_at").eq("id", payload.did).maybeSingle(),
  ]);
  if (!student?.active || !device || device.revoked_at || device.student_id !== student.id) return null;

  return {
    student: { id: student.id, roll_no: student.roll_no, name: student.name, checkin_method: student.checkin_method },
    deviceId: device.id,
  };
}

export async function requireStudent(): Promise<StudentContext> {
  const ctx = await getStudent();
  if (!ctx) redirect("/s/login");
  return ctx;
}
