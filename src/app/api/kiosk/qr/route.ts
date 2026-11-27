import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { currentQrToken } from "@/lib/qr";
import { nowIST, toMinutes } from "@/lib/time";
import { OPENS_BEFORE_MIN } from "@/lib/checkin";

export const dynamic = "force-dynamic";

/**
 * Current QR code for the entrance kiosk + live check-in feed. Staff login required,
 * so only an institute device can display a valid code.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const { data: staff } = await supabase.from("staff").select("id").eq("id", user.id).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Not staff" }, { status: 403 });

  const { token, expiresAt } = currentQrToken();
  const { date, weekday, minutes } = nowIST();

  const [{ data: batches }, { data: recent }] = await Promise.all([
    supabase.from("batches").select("id, name, days, start_time, end_time").eq("active", true).order("start_time"),
    supabase
      .from("attendance")
      .select("id, status, checked_in_at, students(name, roll_no), batch_sessions!inner(session_date, batches(name))")
      .eq("batch_sessions.session_date", date)
      .not("checked_in_at", "is", null)
      .order("checked_in_at", { ascending: false })
      .limit(8),
  ]);

  const openNow = (batches ?? [])
    .filter(
      (b) =>
        (b.days as number[]).includes(weekday) &&
        minutes >= toMinutes(b.start_time) - OPENS_BEFORE_MIN &&
        minutes <= toMinutes(b.end_time),
    )
    .map((b) => ({ name: b.name, start_time: b.start_time, end_time: b.end_time }));

  const feed = ((recent ?? []) as unknown as {
    id: string;
    status: string;
    checked_in_at: string;
    students: { name: string; roll_no: string };
    batch_sessions: { batches: { name: string } };
  }[]).map((r) => ({
    id: r.id,
    name: r.students.name,
    roll_no: r.students.roll_no,
    status: r.status,
    checked_in_at: r.checked_in_at,
    batch: r.batch_sessions.batches.name,
  }));

  return NextResponse.json(
    {
      url: `${request.nextUrl.origin}/s/scan?t=${encodeURIComponent(token)}`,
      expiresAt,
      serverNow: Date.now(),
      openNow,
      recent: feed,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
