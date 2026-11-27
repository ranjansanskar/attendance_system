-- Phase 2: student login (roll number + PIN), phone lock and check-in support.
-- Run once in Supabase: SQL Editor → New query → paste → Run.

alter table students
  add column pin_hash          text,          -- scrypt hash; set by an admin, never stored in plain text
  add column pin_set_at        timestamptz,
  add column pin_failed_count  integer not null default 0,
  add column pin_locked_until  timestamptz;   -- 5 wrong PINs → locked for 15 minutes

-- Fast lookup of today's attendance for the kiosk and admin pages.
create index if not exists attendance_checked_in_at_idx on attendance (checked_in_at desc);
create index if not exists batch_sessions_date_idx on batch_sessions (session_date);

-- Student sign-in and check-in run on the server with the service-role key,
-- which bypasses Row Level Security; students never query the database directly.
