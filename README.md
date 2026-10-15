# Éclat by Harsha

Mobile-first booking app for Éclat by Harsha, a bridal makeup studio in
Calicut: bookings, a calendar of booked/done dates, earnings, invoices and
reference photos. **Supabase** is the database (Postgres + auth + storage);
the app is React + TypeScript (Vite), installable on Android and iPhone.

## Setup

See [`supabase/README.md`](./supabase/README.md): run `supabase/schema.sql`,
switch on email codes, optionally import the old Google Sheet, then:

```bash
npm install
npm run dev
```

`.env` needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Access

Everyone signs in with email + a 6-digit code. Roles: **Owner** (everything +
team management), **Admin** (everything), **Team** (schedule, notes, photos;
no contacts or money). Enforced by database row-level security.

## Views

- **Bookings**: quick chips (All, Today, Tomorrow, This week, Upcoming, Past,
  and Payment due for admin) pin the chosen group to the top in a wine panel,
  ordered by start time; the rest of the list follows by date. Opens on Today.
- **Calendar**: Monday-first month grid in booked/done/both colours; tap a date
  for its bookings. Admin can add, edit and mark bookings as done there.
- **Earnings** (admin): totals, received vs due, by month or by client,
  one-tap "Mark as paid".

## Sync and speed

- **Online saves:** each save goes straight to Supabase and the form waits for
  confirmation (≈0.1–0.3 s). If it fails, the form stays open with everything
  filled in. A booking and its private details save in one transaction.
- **Live updates:** Supabase Realtime tells every open device about changes
  within about a second; no polling.
- **Instant launch:** the last bookings list is cached per role in
  `localStorage` and painted on the first frame, then refreshed.
- **Edit conflicts:** an edit saved from an out-of-date screen is refused
  ("changed on another device") instead of overwriting.
- **Reference photos:** compressed on the phone, stored privately, deleted
  automatically 2 months after the work date.
