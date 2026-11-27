import { NextResponse } from "next/server";
import { z } from "zod";
import { getStudent } from "@/lib/student-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyQrToken } from "@/lib/qr";
import { distanceMetres } from "@/lib/geo";
import { recordCheckin } from "@/lib/checkin";

const Body = z.object({
  token: z.string().min(1).max(100),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  accuracy: z.number().min(0).nullable().optional(),
});

/** GPS error allowance: up to 50 m of the phone's reported accuracy is forgiven. */
const MAX_ACCURACY_ALLOWANCE_M = 50;

function fail(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  const ctx = await getStudent();
  if (!ctx) return fail("Please log in again.", 401);

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Invalid request.");
  const { token, lat, lng, accuracy } = parsed.data;

  if (!verifyQrToken(token)) {
    return fail("This QR code has expired. Scan the code on the screen again.");
  }

  const db = createAdminClient();
  const { data: settings } = await db.from("app_settings").select("latitude, longitude, radius_m").eq("id", 1).single();

  let gpsDistanceM: number | null = null;
  if (settings?.latitude != null && settings?.longitude != null) {
    if (lat == null || lng == null) {
      return fail("Location is needed to check in. Allow location access for this site and try again.");
    }
    gpsDistanceM = Math.round(distanceMetres(lat, lng, settings.latitude, settings.longitude));
    const allowance = Math.min(accuracy ?? 0, MAX_ACCURACY_ALLOWANCE_M);
    if (gpsDistanceM - allowance > settings.radius_m) {
      return fail(
        `You appear to be ${gpsDistanceM} m from the institute. Check in from inside the institute. If you are inside, turn on precise location and try again.`,
      );
    }
  }

  const outcome = await recordCheckin(db, { studentId: ctx.student.id, method: "phone", gpsDistanceM });
  return NextResponse.json(outcome, { status: outcome.ok ? 200 : 400 });
}
