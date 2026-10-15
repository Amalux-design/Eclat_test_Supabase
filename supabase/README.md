# Éclat by Harsha — Supabase setup

One-time setup, about 10 minutes. Do the steps in order.

## 1. Create the database

1. Open `supabase/schema.sql` and change the email on the **last line**
   (`owner@example.com`) to Harsha's email. This makes her the owner.
2. Supabase dashboard → **SQL Editor** → **New query** → paste the whole file → **Run**.
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

## 2. Email sign-in with a 6-digit code

Supabase → **Authentication**:

1. **Sign In / Providers → Email**: make sure Email is **enabled**. Leave
   "Confirm email" on.
2. **Emails → Templates → Magic Link**: replace the body with:

   ```html
   <h2>Your Éclat sign-in code</h2>
   <p>Enter this code in the app:</p>
   <p style="font-size:28px;letter-spacing:6px"><strong>{{ .Token }}</strong></p>
   <p>It expires in 1 hour. If you didn't ask for it, ignore this email.</p>
   ```

   Do the same for the **Confirm signup** template (first-time sign-ins use it).
3. **URL Configuration → Site URL**: set it to the app's address once it's on
   Vercel (e.g. `https://eclat-xxxx.vercel.app`).

**Email limits:** Supabase's built-in email sender only allows a few emails
per hour, which is fine for a small team that signs in once per phone. If
codes stop arriving, set up free custom SMTP (e.g. Resend) under
**Authentication → Emails → SMTP Settings**.

## 3. Move the existing bookings (optional)

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
VITE_SUPABASE_URL=https://kppfwtaagqasbvofztuv.supabase.co
VITE_SUPABASE_ANON_KEY=…
```

```bash
npm install
npm run dev
```

On Vercel, add the same two variables under **Settings → Environment
Variables**, then redeploy.

The anon key is meant to be public: the database's row-level security
decides what each signed-in person can do. **Never** put the `service_role`
key in the app, `.env`, Vercel or chat.

## How access works

- Everyone signs in with their email and a 6-digit code; the phone then stays
  signed in.
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

If two people edit the same booking at once, the second save is refused with
"This booking was changed on another device", and their screen refreshes to
the latest version, instead of silently overwriting.

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
