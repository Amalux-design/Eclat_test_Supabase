# Éclat by Harsha — Supabase setup

One-time setup, about 10 minutes. Do the steps in order.

## 1. Create the database

1. Supabase dashboard → **SQL Editor** → **New query** → paste the whole of
   `supabase/schema.sql`.
2. There (not in the repo file), replace `OWNER-EMAIL-HERE` near the end with
   the owner's own email, read it back letter by letter, then **Run**. The
   script refuses to run until you do. Have the owner create their password
   straight away: until then, anyone who knows that email could claim it.
3. You should see "Success. No rows returned".

This creates:

| Table | Holds | Who can read |
| --- | --- | --- |
| `members` | who may sign in, and their role | each person sees their own row; owner sees all |
| `bookings` | date, client name, services, event, venue, times, bridesmaids, team notes | owner, admin, team |
| `booking_private` | phone numbers, amounts, payments, referrer, "Notes for me" | owner, admin |
| `booking_photos` | reference photo records | owner, admin, team |

Plus a private storage bucket `reference-photos`, live updates, and the
`save_booking` function (saves a booking and its private details together,
with a check that stops one device silently overwriting another's edit).

## 2. Turn off email confirmation (password sign-in)

People sign in with **email + password**; no emails are sent, so Supabase's
free-plan email limits don't matter.

Supabase → **Authentication** → **Sign In / Providers** → **Email**:

1. **Enable Email provider**: on.
2. **Confirm email**: **off**. (Otherwise Supabase tries to send a
   confirmation email when someone creates their password.)
3. Save.

Only emails Harsha has added (Account → Team access) can create a password.
Anyone else gets "This email isn't on the Éclat team yet".

### Forgot password

Supabase → **Authentication → Users** → find the person → **⋯** → **Send
password recovery** won't work without email setup, so instead:
**⋯ → Edit user** (or "Update user") → set a new password → Save. Tell them
the new password; they can change it in the app (Account → Change password).

## 2b. Harden logins (required)

Supabase → **SQL Editor** → paste `supabase/hardening.sql` → **Run**. The
database then refuses sign-ups for emails not on the team and blocks login
email changes through the API. Then also run `supabase/archive-members.sql`
(the "Delete" button for removed people). Full checklist: `docs/SECURITY.md`.

## 2c. Daily backup

1. Paste `supabase/backup.sql` into the SQL Editor. There (never in the repo
   file), replace `CHANGE-ME-LONG-RANDOM` with a new secret of at least 24
   characters, then **Run**. Re-running later keeps the saved secret (to change
   it, see `docs/SECURITY.md`).
2. Paste `scripts/backup-apps-script.gs` into the backup Sheet's Apps Script.
   There (never in the repo file), fill in this project's URL, anon key and
   that secret, then run `backupNow` once.

## 3. Move the existing bookings (optional)

Skip for production: it starts empty (decided 2026-11-18).

1. In the old Google Sheet, open the `WORK_LOGS` tab → **File → Download →
   Comma-separated values (.csv)**.
2. In this project folder run:

   ```bash
   node scripts/sheet-to-sql.mjs path/to/WORK_LOGS.csv > supabase/import.sql
   ```

3. Supabase → **SQL Editor** → paste `supabase/import.sql` → **Run**.
   Safe to run twice: rows that already exist are skipped.

Phone numbers are cleaned to plain 10-digit mobiles on the way in.

## 4. Run the app

`.env` (not committed) holds:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=…
```

```bash
npm install
npm run dev
```

On Vercel, add the same two variables under **Settings → Environment
Variables**, then redeploy.

On newer projects use the **Publishable** key (`sb_publishable_...`) wherever
this guide says anon key. Never use a Secret key (`sb_secret_...`).

The anon key is meant to be public: the database's row-level security
decides what each signed-in person can do. **Never** put the `service_role`
key in the app, `.env`, Vercel or chat.

## How access works

- Everyone signs in with their email and a password; the phone then stays
  signed in. First time: "First time? Create password" (only for emails
  Harsha has added).
- **Owner**: everything, plus **Account → Team access** to add people (name,
  email, Team or Admin), switch roles, and remove or restore access.
- **Admin**: everything except managing the team.
- **Team**: schedule, services, event, venue, times, bridesmaids, team notes,
  reference photos. No phone numbers, money or private notes, and no editing.
  The database itself refuses those, not just the app.
- Removing someone takes effect on their next request (straight away when
  they open the app, at most a few minutes if it's already open). Their
  phone's saved bookings are cleared and they see "No access".

## Saving

Online-only. Each save goes to the database and the form stays open until
it's confirmed. If it fails (no signal), the form keeps everything filled in
and says so: tap Save again when back online. Other devices see changes
within about a second (live updates).

If two people edit the same booking at once, the second save stops with a
warning and keeps the form open. Saving again writes only the fields that
person changed, on top of the latest version; if both changed the same field,
the warning shows the other value first.

## Reference photos

- Up to 6 per booking, added in the booking form (admins/owner).
- Shrunk on the phone before upload (≈300 KB full view, ≈25 KB preview), so
  the 1 GB free storage lasts years.
- Private: only signed-in team members can view them, through short-lived links.
- **Deleted automatically 2 months after the work date.** The clean-up runs
  from admin/owner devices, at most once a day, when the app is opened.
  Changing a booking's date moves its photos' deletion date too.

## Free tier notes

- 500 MB database, 1 GB file storage, 5 GB downloads a month.
- A free project **pauses after 7 days with no activity**; with daily use this
  won't happen. If it does, open the dashboard and click Restore.
