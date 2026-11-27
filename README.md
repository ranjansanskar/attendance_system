# Ranjan Tutorials — Attendance System

Web app (installable PWA) for automatic attendance: rotating QR + face check on students' phones,
a kiosk for students without smartphones, and WhatsApp alerts to parents when a student is absent.

Stack: Next.js 15 + TypeScript + Tailwind · Supabase (Postgres, Auth, Storage, pgvector) · Vercel.

## Status

| Phase | What | Status |
|---|---|---|
| 0 | Accounts, domain, WhatsApp setup | **Your steps below** |
| 1 | Schema, staff login, batches, students, CSV import, holidays, settings, PWA shell | **Done** |
| 2 | Rotating QR kiosk, student login, device lock, GPS check | Next |
| 3 | Face enrollment + selfie/blink verification | |
| 4 | Kiosk B (no smartphone) + teacher override | |
| 5 | WhatsApp absent alerts | |
| 6 | Reports + exports | |

---

## Phase 0 — setup steps (one-time, ~1 hour)

### 1. Supabase (database + login) — free
1. Go to https://supabase.com → sign up with Google → **New project**.
   - Name: `ranjan-attendance` · Region: **Mumbai (ap-south-1)** · set a strong database password and save it.
2. When it's ready: **SQL Editor → New query**, paste the whole of
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), click **Run**. It should say "Success".
3. **Project Settings → API**: copy the **Project URL** and the **anon public** key.
4. In this folder, copy `.env.example` to `.env.local` and paste those two values.

### 2. Create your admin login
1. Supabase → **Authentication → Users → Add user → Create new user**: your email + a password,
   tick **Auto Confirm User**.
2. **SQL Editor**, run (change the email and name):
   ```sql
   insert into staff (id, name, role)
   select id, 'Sanskar Ranjan', 'admin' from auth.users where email = 'YOUR-EMAIL@example.com';
   ```
   To add a **teacher** later: same two steps, with `'teacher'` instead of `'admin'`.
3. Recommended: **Authentication → Sign In / Providers → Email** → turn **off** "Allow new users to sign up",
   so only accounts you create can log in.

### 3. Run it on your laptop
```bash
cd web
npm install
npm run dev
```
Open http://localhost:3000 → **Staff login**.

### 4. GitHub + Vercel (hosting) — free
1. Create a **private** repository on https://github.com and push this `web` folder to it.
2. https://vercel.com → sign up with GitHub → **Add New → Project** → import the repository.
3. Under **Environment Variables** add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` → **Deploy**.

### 5. Your domain: attendance.ranjantutorials.com
1. Vercel → your project → **Settings → Domains** → add `attendance.ranjantutorials.com`.
2. Vercel shows a **CNAME** record (usually `cname.vercel-dns.com`). At your domain registrar
   (where you bought ranjantutorials.com), open DNS settings and add:
   `Type: CNAME · Name: attendance · Value: cname.vercel-dns.com`
3. Wait 5–30 minutes. HTTPS is set up automatically. Your existing website is not affected.
4. Supabase → **Authentication → URL Configuration** → Site URL: `https://attendance.ranjantutorials.com`.

### 6. WhatsApp Business (start now — approval takes 1–3 days; used in Phase 5)
1. Get a **new SIM** that has never been used on WhatsApp (not even WhatsApp Business app).
2. https://business.facebook.com → create a Business account for "Ranjan Tutorials",
   website `https://ranjantutorials.com`.
3. https://developers.facebook.com → **Create App** → type **Business** → add the **WhatsApp** product.
4. In WhatsApp → **API Setup**, add your new number and verify it by SMS/call.
5. **WhatsApp Manager → Message templates → Create**: category **Utility**, name `student_absent`,
   language English, body:
   ```
   {{1}}: {{2}} was absent from the {{3}} batch today ({{4}}). For queries, please call {{5}}.
   ```
   Example values: Ranjan Tutorials / Riya Sharma / 4:00 PM Physics / 27 Nov / 98XXXXXXXX. Submit for review.
6. Optional but recommended: **Business Settings → Security Center → Start verification** (needs a business
   document such as GST or shop registration). Unverified accounts still work, with a lower daily limit.

### 7. Collect before Phase 3
- Signed **consent forms** from parents (face data + WhatsApp messages) — required under the DPDP Act.
- A student list for the CSV import (Students page → Bulk import).

---

## Phase 1 — what's in the app now

- **Staff login** (`/login`) — admins and teachers; everything under `/admin` requires login.
- **Dashboard** — active students, batches, today's batches and whether any are cancelled.
- **Batches** — days, timings, late cutoff, absent cutoff; deactivate; per-batch student list.
- **Holidays / cancellations** — for one batch or all batches on a date; no attendance or alerts that day.
- **Students** — add/edit, parent WhatsApp number (any Indian format, stored as +91…), batches,
  check-in method (phone or kiosk), consent recorded, deactivate when a student leaves.
- **CSV import** — bulk add/update from Excel. Columns: `roll_no,name,parent_phone,parent_name,student_phone,batches,checkin_method`
  (batches separated by `;`, names must match exactly).
- **Settings** — institute name, GPS location + allowed radius (used from Phase 2), staff list.
- **PWA** — manifest, icons, service worker; installs to the home screen once deployed on HTTPS.

Security: every table has Row Level Security. Only staff can read; only admins can change setup data;
teachers can mark attendance.

## Project layout
```
supabase/migrations/   SQL schema (run in Supabase SQL editor)
src/app/login/         staff login
src/app/admin/         dashboard, batches, students, settings
src/lib/               Supabase clients, auth guards, time (IST), phone + CSV helpers
public/sw.js           service worker
```
