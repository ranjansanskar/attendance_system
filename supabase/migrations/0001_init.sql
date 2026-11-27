-- Ranjan Tutorials attendance system — Phase 1 schema
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

create extension if not exists vector;

-- ---------- Types ----------
create type staff_role        as enum ('admin', 'teacher');
create type checkin_method    as enum ('phone', 'kiosk');
create type attendance_status as enum ('present', 'late', 'absent');
create type attendance_source as enum ('phone', 'kiosk', 'teacher', 'system');
create type session_status    as enum ('scheduled', 'cancelled', 'holiday');
create type device_kind       as enum ('student', 'kiosk');
create type alert_status      as enum ('queued', 'sent', 'delivered', 'read', 'failed', 'skipped');

-- ---------- Settings (single row) ----------
create table app_settings (
  id              smallint primary key default 1 check (id = 1),
  institute_name  text not null default 'Ranjan Tutorials',
  latitude        double precision,
  longitude       double precision,
  radius_m        integer not null default 100 check (radius_m between 20 and 2000),
  timezone        text not null default 'Asia/Kolkata',
  updated_at      timestamptz not null default now()
);
insert into app_settings (id) values (1);

-- ---------- Staff (admins + teachers), linked to Supabase Auth users ----------
create table staff (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null,
  phone       text,
  role        staff_role not null default 'teacher',
  created_at  timestamptz not null default now()
);

-- ---------- Batches ----------
create table batches (
  id                uuid primary key default gen_random_uuid(),
  name              text not null unique,
  subject           text,
  days              smallint[] not null check (days <@ array[0,1,2,3,4,5,6]::smallint[] and cardinality(days) > 0), -- 0 = Sunday
  start_time        time not null,
  end_time          time not null,
  late_after_min    integer not null default 10 check (late_after_min between 0 and 120),
  absent_after_min  integer not null default 20 check (absent_after_min between 1 and 180),
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  check (end_time > start_time),
  check (absent_after_min >= late_after_min)
);

-- One row per batch per class day. Created on demand (first check-in, absent job,
-- or when an admin cancels a class / marks a holiday).
create table batch_sessions (
  id            uuid primary key default gen_random_uuid(),
  batch_id      uuid not null references batches (id) on delete cascade,
  session_date  date not null,
  status        session_status not null default 'scheduled',
  note          text,
  alerts_sent_at timestamptz,          -- set by the absent-alert job so it runs once
  created_at    timestamptz not null default now(),
  unique (batch_id, session_date)
);

-- ---------- Students ----------
create table students (
  id              uuid primary key default gen_random_uuid(),
  roll_no         text not null unique,
  name            text not null,
  parent_name     text,
  parent_phone    text not null check (parent_phone ~ '^\+[1-9][0-9]{7,14}$'), -- E.164, e.g. +919876543210
  student_phone   text check (student_phone is null or student_phone ~ '^\+[1-9][0-9]{7,14}$'),
  checkin_method  checkin_method not null default 'phone',
  auth_user_id    uuid unique references auth.users (id) on delete set null, -- set in Phase 2
  consent_at      timestamptz,   -- date the signed consent form was received
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create table student_batches (
  student_id  uuid not null references students (id) on delete cascade,
  batch_id    uuid not null references batches (id) on delete cascade,
  primary key (student_id, batch_id)
);
create index on student_batches (batch_id);

-- ---------- Face embeddings (Human.js produces 1024-dim vectors) ----------
create table face_embeddings (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students (id) on delete cascade,
  embedding   vector(1024) not null,
  source      text not null default 'enrollment' check (source in ('enrollment', 'learned')),
  photo_path  text,
  created_at  timestamptz not null default now()
);
create index on face_embeddings (student_id);

-- ---------- Devices (student phones + institute kiosks) ----------
create table devices (
  id               uuid primary key default gen_random_uuid(),
  kind             device_kind not null,
  student_id       uuid references students (id) on delete cascade,
  name             text,
  device_key_hash  text not null unique,
  registered_at    timestamptz not null default now(),
  revoked_at       timestamptz,
  check ((kind = 'student') = (student_id is not null))
);
-- At most one active phone per student.
create unique index devices_one_active_phone on devices (student_id) where kind = 'student' and revoked_at is null;

-- ---------- Attendance ----------
create table attendance (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references batch_sessions (id) on delete cascade,
  student_id      uuid not null references students (id) on delete cascade,
  status          attendance_status not null,
  method          attendance_source not null,
  checked_in_at   timestamptz,
  selfie_path     text,
  face_score      real,
  gps_distance_m  real,
  marked_by       uuid references staff (id) on delete set null,
  note            text,
  created_at      timestamptz not null default now(),
  unique (session_id, student_id)
);
create index on attendance (student_id);

-- ---------- WhatsApp alerts (absent only) ----------
create table alerts (
  id             uuid primary key default gen_random_uuid(),
  attendance_id  uuid not null unique references attendance (id) on delete cascade,
  student_id     uuid not null references students (id) on delete cascade,
  to_phone       text not null,
  status         alert_status not null default 'queued',
  wa_message_id  text,
  error          text,
  attempts       integer not null default 0,
  created_at     timestamptz not null default now(),
  sent_at        timestamptz
);

-- ---------- Role helpers ----------
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where id = auth.uid());
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where id = auth.uid() and role = 'admin');
$$;

-- ---------- Row Level Security ----------
-- Phase 1: only staff can see anything. Student policies arrive in Phase 2.
alter table app_settings    enable row level security;
alter table staff           enable row level security;
alter table batches         enable row level security;
alter table batch_sessions  enable row level security;
alter table students        enable row level security;
alter table student_batches enable row level security;
alter table face_embeddings enable row level security;
alter table devices         enable row level security;
alter table attendance      enable row level security;
alter table alerts          enable row level security;

-- Staff can read everything.
create policy staff_read on app_settings    for select using (is_staff());
create policy staff_read on staff           for select using (is_staff());
create policy staff_read on batches         for select using (is_staff());
create policy staff_read on batch_sessions  for select using (is_staff());
create policy staff_read on students        for select using (is_staff());
create policy staff_read on student_batches for select using (is_staff());
create policy staff_read on face_embeddings for select using (is_staff());
create policy staff_read on devices         for select using (is_staff());
create policy staff_read on attendance      for select using (is_staff());
create policy staff_read on alerts          for select using (is_staff());

-- Admins manage setup data.
create policy admin_write on app_settings    for all using (is_admin()) with check (is_admin());
create policy admin_write on staff           for all using (is_admin()) with check (is_admin());
create policy admin_write on batches         for all using (is_admin()) with check (is_admin());
create policy admin_write on batch_sessions  for all using (is_admin()) with check (is_admin());
create policy admin_write on students        for all using (is_admin()) with check (is_admin());
create policy admin_write on student_batches for all using (is_admin()) with check (is_admin());
create policy admin_write on face_embeddings for all using (is_admin()) with check (is_admin());
create policy admin_write on devices         for all using (is_admin()) with check (is_admin());

-- Teachers and admins can mark attendance (manual override).
create policy staff_write on attendance for all using (is_staff()) with check (is_staff());

-- ---------- Role grants (newer Supabase projects don't grant public tables by default) ----------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.is_staff(), public.is_admin() to authenticated;
