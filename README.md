# Ranjan Tutorials — Attendance System

Web app (installable PWA) for automatic attendance: rotating QR + face check on students' phones,
a kiosk for students without smartphones, and WhatsApp alerts to parents when a student is absent.

Stack: Next.js 15 + TypeScript + Tailwind · Supabase (Postgres, Auth, Storage, pgvector) · Vercel.

## Status

| Phase | What | Status |
|---|---|---|
| 0 | Accounts, domain, WhatsApp setup | **Your steps below** |
| 1 | Schema, staff login, batches, students, CSV import, holidays, settings, PWA shell | **Done** |
| 2 | Rotating QR kiosk, student login, device lock, GPS check | **Done**: see setup below |
| 3 | Face enrollment + selfie/blink verification | Next |
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

## Phase 2: setup (about 10 minutes)

1. **Database:** Supabase → SQL Editor → New query → paste
   [`supabase/migrations/0002_student_login.sql`](supabase/migrations/0002_student_login.sql) → Run.
2. **Local secrets:** Supabase → Project Settings → API → copy the **service_role** key (click Reveal) and paste it
   after `SUPABASE_SERVICE_ROLE_KEY=` in `.env.local`. `APP_SECRET` is already filled in locally.
   Never share the service_role key or put it in a `NEXT_PUBLIC_` variable.
3. **Vercel:** Project → Settings → Environment Variables → add
   - `SUPABASE_SERVICE_ROLE_KEY` = the same service_role key
   - `APP_SECRET` = a new random value (run `openssl rand -base64 48` in Terminal and paste the output)

   Then Deployments → ⋯ on the latest → **Redeploy** (or push the new code to GitHub).
4. **Institute location:** Admin → Settings → enter latitude/longitude (Google Maps → long-press the entrance).
   Until it is set, the GPS check is skipped.

## Phase 2: how it works

- **Kiosk (`/kiosk`):** log in as staff on the entrance laptop, open *Open kiosk ↗*, press *Full screen*.
  The QR changes every 15 s; a scanned code works for at most 30 s. A side panel shows who just checked in.
- **Student app (`/s`):** a student logs in with **roll number + 6-digit PIN**. The first phone they log in on becomes
  their phone; the account will not work on any other phone, and one phone cannot be used by two students.
  If a student changes phones: Admin → student → *Reset phone*.
- **PINs:** Admin → Students → *Generate PINs for students without one* → *Print slips*. Or one at a time on a
  student's page (*Generate PIN / Reset PIN*). 5 wrong PINs lock the account for 15 minutes.
- **Check-in:** *Scan QR to check in* → camera scans the kiosk QR → phone sends its GPS location → the server checks
  the QR is fresh, the phone is registered, the student is within the radius, and a batch is open. A batch is open from
  **15 min before start until it ends**. After the late cutoff the student is marked **Late**. Scanning the kiosk QR with the
  phone's normal camera app also works (it opens the check-in link).
- **Cancelled/holiday** batches refuse check-in.
- Admin → a batch's page shows today's status per student; a student's page shows their recent attendance and
  distance from the institute at each check-in.

**iPhone note:** an app added to the iPhone home screen keeps its own login, separate from Safari. Students should add
the app to the home screen **first** and log in there. If they logged in in Safari first, use *Reset phone*.

### Test it yourself
1. Create a batch whose time includes *now* (for example, start 15 minutes from now).
2. Add a student in that batch → generate a PIN.
3. On the laptop: open `/kiosk`. On your phone: open your Vercel URL (`https://<project>.vercel.app/s/login`),
   log in with the roll number + PIN, tap *Scan QR to check in*, scan the laptop screen.
4. The kiosk panel shows the check-in; the batch page shows the student as present.

Camera and GPS need HTTPS, so test phones against the Vercel URL, not `http://<laptop-ip>:3000`.

## Project layout
```
supabase/migrations/   SQL schema (run in Supabase SQL editor)
src/app/login/         staff login
src/app/admin/         dashboard, batches, students, settings
src/app/kiosk/         rotating QR screen for the entrance
src/app/s/             student app: login, home, QR scanner
src/app/api/           check-in and kiosk endpoints
src/lib/               Supabase clients, auth guards, time (IST), phone + CSV helpers
public/sw.js           service worker
```
