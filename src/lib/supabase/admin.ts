import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env, serverEnv } from "@/lib/env";

/**
 * Service-role client: bypasses Row Level Security. Server-only.
 * Used for student sign-in and check-in, where the student is verified by our own signed session.
 */
export function createAdminClient() {
  return createClient(env.supabaseUrl, serverEnv.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
