# Handover setup — Éclat in Harsha's own accounts

A fresh, empty copy of the app that Harsha owns: her GitHub, her Vercel, her
Supabase. The developer's test copy (eclatsupabasetest.vercel.app) stays as it
is and is never pointed at her data. About 1½ hours, done together on a laptop
with Harsha present for her logins and passwords.

**Rules for the whole session**
- Harsha types her own passwords. Nobody posts a password, key or secret in chat,
  email, WhatsApp or a doc. Keep them in a password manager (or her phone's
  saved passwords).
- Never copy the Supabase **service_role** / **Secret** key anywhere.
- Do the parts in order. Each part ends with a check; don't move on until it passes.

---

## Part 0 — Accounts (Harsha)

1. One Google account for the business (e.g. `eclatbyharsha@gmail.com`) with
   **2-Step Verification on** (myaccount.google.com → Security).
2. Using that Google account, create or sign in to:
   - **GitHub** (github.com) → turn on 2-factor (Settings → Password and authentication).
   - **Supabase** (supabase.com, "Continue with GitHub" or Google).
   - **Vercel** (vercel.com, "Continue with GitHub").
3. **Vercel plan:** the free Hobby plan is for non-commercial use only. Éclat is
   a business, so choose **Pro** (or agree on another host) before going live.

✅ Check: Harsha can sign in to all three, and 2-step is on for Google and GitHub.

---

## Part 1 — Private copy of the code (developer)

The copy has no git history (old test details stay out of it).

1. On Harsha's GitHub: **+** → **New repository** → name `eclat` → **Private** →
   don't add a README → **Create repository**.
2. Make the clean copy in PowerShell from the developer's project folder:

   ```powershell
   cd C:\Eclat
   git archive --format=zip -o C:\eclat-handover.zip HEAD
   Expand-Archive C:\eclat-handover.zip -DestinationPath C:\eclat-handover
   cd C:\eclat-handover
   git init -b main
   git add -A
   git commit -m "Éclat by Harsha"
   git remote add origin https://github.com/<harsha-account>/eclat.git
   git push -u origin main
   ```

   `git archive` takes only the committed files: no `.env`, no `demo/`, no
   `proposal/`, no audit notes, no history.

✅ Check: the repo on GitHub is marked **Private** and has a `src` folder and `supabase` folder.

---

## Part 2 — Supabase project (Harsha clicks, developer guides)

1. supabase.com → **New project**.
   - Name: `eclat`. Region: **Mumbai (ap-south-1)**.
   - Database password: generate a strong one → save it in the password manager.
2. Wait until the project says it's ready (about 2 minutes).

### 2a. Database (SQL Editor → New query, one file at a time)

1. Paste the whole of `supabase/schema.sql` **without changing anything** → **Run**.
   It must **stop** with *"Set the owner email on the owner_email line…"*.
   That proves the safety check works. Left menu → **Table Editor** must show
   **no tables** (the whole run was cancelled). If tables do appear, stop and
   tell the developer: this has so far only been tried on a test database.
2. In the editor (never in the repo file), find `OWNER-EMAIL-HERE` near the
   end and replace it with Harsha's sign-in email. **Read it back letter by
   letter.** → **Run** → "Success. No rows returned".
3. New query → paste `supabase/hardening.sql` → **Run** → Success.
4. New query → paste `supabase/archive-members.sql` → **Run** → Success.
5. New query → paste `supabase/backup.sql`. In the editor, replace
   `CHANGE-ME-LONG-RANDOM` with a **new** long random secret (40 letters and
   digits; generate it in the password manager and save it there as
   "Éclat backup secret") → **Run** → Success.

✅ Check (New query → Run):

```sql
select email, role, active from public.members;                       -- exactly 1 row: Harsha, owner
select indexname from pg_indexes where indexname = 'members_one_owner'; -- 1 row
select tgname from pg_trigger where tgname like 'guard_auth_users%';   -- 2 rows
```

Then run the one-time check in `docs/PASSWORD_RESET.md` ("One-time check").

### 2b. Sign-in settings

**Authentication → Sign In / Providers → Email:**
- Enable Email provider: **on**
- Confirm email: **off** (no emails are sent; with it on, nobody can finish creating a password)
- **Save**

Also make sure **Allow new users to sign up** is **on** (same area, "User
Signups"). It has to be on for "First time? Create password". The database
still refuses anyone who isn't on the team.

### 2c. Keys for the app

**Project Settings → API** (or **API Keys**). Note down, for Part 3:
- **Project URL** (`https://xxxx.supabase.co`)
- **Publishable key** (`sb_publishable_…`) — on older-style projects, the **anon public** key.

Never the Secret / service_role key.

---

## Part 3 — Vercel (Harsha clicks, developer guides)

1. vercel.com → **Add New… → Project** → import the private `eclat` repo
   (allow Vercel's GitHub app to see it if asked).
2. Framework preset: **Vite** (it reads `vercel.json`, nothing to change).
3. **Environment Variables**, add both:
   - `VITE_SUPABASE_URL` = the Project URL
   - `VITE_SUPABASE_ANON_KEY` = the Publishable key
4. **Deploy**. Wait for "Congratulations".
5. Note the site address (e.g. `eclat-xxxx.vercel.app`, or add a custom domain
   under Settings → Domains).
6. Back in Supabase: **Authentication → URL Configuration → Site URL** = that
   address → Save.

✅ Check:
- Open `https://<site>/api/keep-alive` → shows `"ok":true` (keeps the free Supabase project from pausing).
- Vercel → project → **Settings → Cron Jobs** lists `/api/keep-alive`.
- The site opens on the Éclat sign-in screen with no red error.

---

## Part 4 — Harsha's login (straight away)

Until Harsha creates her password, anyone who knows her email could, so do this now.

1. Open the site → **First time? Create password** → Harsha's email → her own
   password (8+ characters) → **Create password**. She lands in the empty calendar.
2. **Account** (top right) shows her as **Owner**.

✅ Check the door is shut: sign out → **First time? Create password** with an
email that isn't on the team (e.g. `nobody@eclat.invalid`) → must say
*"This email isn't on the Éclat team yet"*. Then sign Harsha back in.

---

## Part 5 — The team

For each person, one at a time:
1. Harsha: **Account → Team access** → add name + email → **Team** (schedule
   only, no money or phone numbers) or **Admin** (everything except the team list).
2. That person creates their password **the same day** (on their phone: open
   the site → First time? Create password). Until they do, their email is open.
3. On each phone: open the site in the browser → **Add to Home Screen** (iPhone:
   Share → Add to Home Screen; Android: ⋮ → Add to Home screen / Install app).

✅ Check: a Team phone opens a booking and sees **no** amounts, phone numbers or
private notes, and no Earnings tab.

Use real emails people own, or a made-up one on `@eclat.invalid`, never a
domain nobody owns (e.g. `@eclat.com`).

---

## Part 6 — Daily backup to Google Sheets (Harsha's Drive)

1. Harsha's Google Drive → **New → Google Sheets** → name it `Éclat backup`.
2. **Extensions → Apps Script**. Delete what's there, paste the whole of
   `scripts/backup-apps-script.gs`.
3. At the top, in the editor only (never in the repo file), fill in:
   - `SUPABASE_URL` = the new Project URL (replace the test one already there)
   - `ANON_KEY` = the Publishable key
   - `BACKUP_SECRET` = the secret from Part 2a step 5
4. **Save** (disk icon). In the function list choose **backupNow** → **Run** →
   **Review permissions** → Harsha's account → Advanced → Go to project → **Allow**.
5. Back in the Sheet: tabs **Latest** and **Backup yyyy-mm-dd** exist, and
   Latest shows *"Last backup: … · N bookings"*.
6. In Apps Script choose **installDaily** → **Run**. (Without this, the backup
   runs only once. It's the step that was missing from the old guide.)
7. Left bar → **Triggers** (clock icon): one trigger, `backupNow`, day timer,
   2am–3am. Click its pencil → **Failure notification settings → Notify me
   immediately** → Save.

✅ Check the next morning: Latest shows today's date.

**What the backup is (and isn't):** a readable copy of every booking with
phones, amounts and payments, 14 days of dated copies. Photos, the team list
and a one-click restore are **not** included. If data were ever lost, bookings
would be re-entered from this Sheet.

---

## Part 7 — Trial run, then go live

1. Harsha adds one test booking (name `TEST`), records a part payment, opens the
   invoice PDF, marks it done, then deletes it.
2. Check **Earnings** shows ₹0 after the delete.
3. Rehearse a password reset on a test team account (`docs/PASSWORD_RESET.md`),
   then remove that account.

✅ Done: Harsha uses this site from now on; nothing is added to the developer's test copy.

---

## Afterwards

- **Developer access:** decide whether the developer keeps an Admin login. If
  not, remove it (Team access → Remove). The developer can also be removed from
  the GitHub repo / Vercel project when no more changes are planned.
- **Old test copy:** remove its test logins and test bookings; it is not a backup.
- **Someone leaves:** Account → Team access → Remove, the same day.
- **Forgot password:** `docs/PASSWORD_RESET.md`.
- **Supabase free plan:** 500 MB database, 1 GB photos. Photos auto-delete
  2 months after the work date. The daily keep-alive stops the project pausing.

## Write down (password manager, not here)

| Item | Where it's used |
| --- | --- |
| Supabase database password | only for Supabase support / emergencies |
| Backup secret | `backup.sql` (already run) and the Apps Script |
| Project URL + Publishable key | Vercel and the Apps Script (not secret, but keep together) |
| Harsha's app password | the app |
