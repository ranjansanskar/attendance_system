import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Only staff areas use Supabase Auth; student pages use their own signed cookie and skip this.
  matcher: ["/admin/:path*", "/kiosk/:path*", "/login", "/api/kiosk/:path*"],
};
