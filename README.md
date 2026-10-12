# Éclat by Harsha

Mobile-first booking diary for Éclat by Harsha, a bridal makeup studio in
Calicut: bookings, a calendar of booked/done dates, and earnings. Google Sheets
is the database; Google Apps Script is the API layer.

## Modes

- **View-only** (default, for assistants): Calendar and Bookings. Shows client
  name, services, event, date, times, location, bridesmaids and notes. No
  edits, no phone numbers, prices or payment status. The server strips those
  fields; they never reach the device.
- **Admin**: tap the key icon in the header and enter the 6-digit PIN. Adds
  Earnings, editing, the "New booking" button and the sync badge. Stays
  unlocked on that device until the lock icon is tapped or the PIN is changed.
  In demo mode the PIN is `123456`.

See [`apps-script/README.md`](./apps-script/README.md) for setting/changing the
PIN and the lockout rules.

## Project structure

```
eclat/
  src/            React + TypeScript frontend (Vite)
  apps-script/    Google Apps Script backend (Code.gs) + setup README
```

## Frontend setup

```bash
cd eclat
npm install
npm run dev
```

The app runs immediately with an in-memory mock dataset — no backend required
to try it out. A "Demo mode" banner shows at the top when this fallback is active.

### Connecting the real backend

1. Follow [`apps-script/README.md`](./apps-script/README.md) to create the
   Sheet, paste in `Code.gs`, and deploy it as a Web App.
2. Copy `.env.example` to `.env` in the project root:

   ```
   VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/XXXXXXX/exec
   ```

3. Restart `npm run dev`. The mock banner disappears once the URL is set and
   the app is live-reading/writing your Sheet.

## Environment variables

| Variable                | Description                                             |
| ------------------------ | -------------------------------------------------------- |
| `VITE_APPS_SCRIPT_URL`   | Deployed Apps Script Web App URL. Omit to use mock data. |

`.env` is git-ignored — it holds your real Apps Script URL and is never pushed.
`.env.example` is the committed template; copy it to `.env` locally and fill in the real value.

## Deploying

### Push to GitHub

```bash
git add .
git commit -m "Deploy setup"
git push -u origin master
```

(`.env` won't be included — it's in `.gitignore`.)

### Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import the GitHub repo.
2. Vercel auto-detects Vite (`vercel.json` in this repo pins the build command
   `npm run build` and output directory `dist` as a fallback).
3. Before the first deploy (or after, under **Project → Settings → Environment
   Variables**), add:

   | Key | Value |
   | --- | --- |
   | `VITE_APPS_SCRIPT_URL` | your deployed Apps Script Web App URL |

   Without this, the deployed app runs in mock/demo mode — same as local dev
   without a `.env`.
4. Deploy. Any push to the connected branch redeploys automatically; changing
   the env var requires a redeploy (**Deployments → ⋯ → Redeploy**) to take effect.

## Tech stack

- Vite + React 19 + TypeScript (strict)
- React Context + hooks for shared state (no Redux)
- `react-router-dom` (hash routing) for view switching
- `lucide-react` icons
- Plain CSS with CSS variables for design tokens (see `src/index.css`)
- Google Sheets + Apps Script as the backend

## Views

- **Bookings**: quick chips (All, Today, Tomorrow, This week, Upcoming, Past,
  and Payment due for admin) pin the chosen group to the top in a wine panel,
  ordered by start time; the rest of the list follows by date. Opens on Today.
- **Calendar**: Monday-first month grid in booked/done/both colours; tap a date
  for its bookings. Admin can add, edit and mark bookings as done there.
- **Earnings** (admin): totals, received vs due, by month or by client,
  one-tap "Mark as paid".

## Sync and speed

- **Instant saves:** admin edits apply on screen immediately and go into a
  background save queue stored in IndexedDB ([src/sync/saveQueue.ts](./src/sync/saveQueue.ts)).
  It sends changes in order, retries with back-off (2 s → 1 min), resumes when
  the device comes back online, and survives closing the app. The header badge
  shows Saved / Saving / Offline.
- **Instant launch:** the last bookings list is cached per mode in
  `localStorage` and painted on the first frame, then refreshed.
- **Auto-refresh:** every open device checks a tiny version number every
  2 minutes (`POLL_INTERVAL_MS` in [src/context/LogsContext.tsx](./src/context/LogsContext.tsx))
  and downloads the list only when it changed; paused while the app is hidden,
  backs off to 8 minutes on errors.
- **Server:** cached reads (`CacheService`), `TextFinder` row lookup, writes
  serialised with `LockService`, idempotent create/delete so retries are safe.
