# Project map

Verified against the code on 2026-10-20.

## Shape
- `index.html` — inline splash (logo reveal; `.instant` mode when launched as an installed app), iOS launch images, fonts (Playfair Display, Jost, Pinyon Script).
- `src/main.tsx` → `src/App.tsx`: providers (ErrorBoundary → Auth → Confirm → Notice → Logs) → HashRouter.
- Not signed in → `SignIn`; signed in but not a member → `NoAccess`; else the shell: `AppHeader` + `<main>` routes + `BottomNav` + `SwipeTabs` + `InstallHint`.
- Routes: `/` Calendar · `/logs` Bookings · `/payments` Earnings (admin/owner only).

## Key files
| Area | Files |
|---|---|
| Supabase client | `src/lib/supabase.ts` (cleans pasted env values, validates the anon key) |
| Auth & roles | `src/context/AuthContext.tsx` (status loading/signed-out/no-access/ready; signIn, createAccount, changePassword, signOut, recheck; isAdmin/isOwner) |
| Data | `src/context/LogsContext.tsx` (fetch, realtime, add/edit/remove/markPaid/recordPayment, conflict handling, `saving` count → logo shimmer), `src/api/client.ts` (every Supabase call; `ApiError` codes AUTH/CONFLICT/NOT_FOUND/VALIDATION/NETWORK/ERROR) |
| Cache | `src/utils/localCache.ts` — last booking list per role in localStorage for instant first paint; cleared on sign-out |
| Pages | `src/pages/CalendarPage.tsx`, `LogsPage.tsx` (chips, search, sticky date headings, Quote pill), `PaymentsPage.tsx` (year filter, totals card, Month/Client ledger, payment sheet) |
| Booking UI | `LogForm.tsx`, `LogCard.tsx` (Edit pill, call, invoice, delete), `ServiceTiles.tsx` (tiles + qty stepper), `Photos.tsx` (picker, strip, viewer with prev/next), `Pickers.tsx` (date/time/select sheets) |
| Documents | `src/utils/invoice.ts` (one PDF engine: invoice from a booking, quotation/invoice from `QuoteSheet.tsx`; policy page / advance-confirmation page) |
| Business data | `src/data/services.ts` (price menu, `servicePrice`), `src/data/business.ts` (address, phone, email, UPI/bank, quote policy, default note) |
| Shell & motion | `AppHeader.tsx`, `BottomNav.tsx` (exports `TABS`), `utils/useSwipeTabs.ts` (finger-follow swipe between tabs, `data-swipe` entrance), `utils/splash.ts` (logo glides into header), `utils/useSheet.ts`, `Sheet.tsx`, `ConfirmDialog.tsx`, `Notice.tsx` |
| Styles | `src/index.css` (tokens on `:root`, then layered sections; laptop block `@media (min-width:1024px)`; laptop zoom ≥1360px) |
| Backend | `supabase/schema.sql`, `supabase/hardening.sql`, `supabase/backup.sql`, `supabase/README.md` |
| Serverless | `api/keep-alive.js` + `vercel.json` cron (daily DB ping) |
| Scripts | `scripts/sheet-to-sql.mjs` (old Sheet CSV → SQL import), `scripts/backup-apps-script.gs` (daily Google Sheets backup) |

## Data model (Postgres, RLS on all tables)
- `members(email PK, name, role owner|admin|team, active)` — who may use the app.
- `bookings` — fields everyone on the team may see (date, client name, services text, event, venue, bridesmaids, status, times, team notes).
- `booking_private` — phones, qty/price/amount, paid amount, payment status, referral, "Notes for me". Admin/owner only.
- `booking_photos` — storage paths + `work_date` (kept in sync with the booking date by trigger).
- Storage bucket `reference-photos` (private, signed URLs, 5 MB, images only).
- Helper functions: `app_role`, `is_member`, `is_admin`, `is_owner`, `is_invited`; RPC `save_booking(b, p, base)`; `backup_export(secret)`.

## Workflows
- **Sign-in:** email + password; "Confirm email" OFF; app sends no email. First time: `is_invited` check → sign-up. DB trigger (`hardening.sql`) also refuses uninvited sign-ups and API email changes.
- **Save:** online only. `save_booking` (security invoker) writes `bookings` + `booking_private` atomically; with `base` it checks `updated_at` → `CONFLICT` if another device changed it. Form stays open on failure.
- **Live updates:** realtime on bookings, booking_photos, booking_private (admins), members (instant revoke/role change); refetch on app foreground; 1-minute heartbeat.
- **Photos:** compressed on device (1600 px ≈300 KB + 360 px thumb); admin devices delete photos 2 months after work date, once a day (`eclat:photo-sweep` key).
- **Documents:** jsPDF loaded on demand; iPhone uses the share sheet, others download.
- **Backup:** Apps Script calls `backup_export` daily → "Latest" + 14 dated tabs.
- **Keep-alive:** Vercel cron hits `/api/keep-alive` daily (03:00 UTC).

## Offline / PWA
- Manifest + icons + iOS launch images; no service worker → no offline mode, no queued writes (decided: online-only).
- Cached list paints instantly; an offline mark shows in the header; writes fail with a message and keep the form.

## Env
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in `.env` (git-ignored) and Vercel. The anon key is public by design.
