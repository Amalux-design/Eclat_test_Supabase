# Glow Diary

A mobile-first work tracker for a freelance makeup artist: log bookings, manage a
calendar of worked/reserved dates, and track payments. Google Sheets is the
database; Google Apps Script is the API layer.

## Project structure

```
glow-diary/
  src/            React + TypeScript frontend (Vite)
  apps-script/    Google Apps Script backend (Code.gs) + setup README
```

## Frontend setup

```bash
cd glow-diary
npm install
npm run dev
```

The app runs immediately with an in-memory mock dataset — no backend required
to try it out. A "Demo mode" banner shows at the top when this fallback is active.

### Connecting the real backend

1. Follow [`apps-script/README.md`](./apps-script/README.md) to create the
   Sheet, paste in `Code.gs`, and deploy it as a Web App.
2. Copy `.env.example` to `.env` in the `glow-diary` root:

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

- Vite + React 18 + TypeScript (strict)
- React Context + hooks for shared state (no Redux)
- `react-router-dom` (hash routing) for view switching
- `lucide-react` icons
- Plain CSS with CSS variables for design tokens (see `src/index.css`)
- Google Sheets + Apps Script as the backend

## Views

- **Logs** — chronological list of bookings grouped by date, add/edit via a
  bottom-sheet form, swipe-to-delete style trailing delete action.
- **Calendar** — month grid with Worked/Reserved/Mixed day states, tap a date
  to see its bookings, reserve empty future dates, convert a reservation to a
  completed job.
- **Payments** — earnings summary cards, monthly or per-client breakdown,
  one-tap "Mark as Paid" on pending items.

## Performance: caching & indexing

Apps Script + Sheets is the slowest link in this stack (cold starts, full-sheet
scans), so both ends are optimized around it:

- **Instant reload (frontend):** `LogsProvider` ([src/context/LogsContext.tsx](./src/context/LogsContext.tsx))
  persists the last-known log list to `localStorage`. On the next app open it
  paints that cached data immediately (no spinner) and revalidates against the
  API in the background — stale-while-revalidate, so the UI never blocks on
  the network for a repeat visit.
- **Fast indexing (frontend):** the same provider builds `logsByDate` and
  `logsByMonth` lookup maps once per data change (`O(n)`), which every page
  reuses instead of each one re-scanning the full log array with its own
  `filter`/`find` pass. Calendar's month view and Logs' date grouping are both
  `O(1)` map lookups now.
- **Optimistic writes:** delete and "Mark as Paid" update local state
  immediately and roll back only if the API call fails, so those actions feel
  instant instead of waiting on a round trip.
- **Server-side caching:** `getLogs()` in `Code.gs` is cached with
  `CacheService` for up to 6 hours and invalidated on every write made through
  the app, so the full-sheet read + sort only happens once per cache window
  instead of on every request. See the caching note in
  [`apps-script/README.md`](./apps-script/README.md) for the one caveat
  (manual edits made directly in the Sheet UI).
