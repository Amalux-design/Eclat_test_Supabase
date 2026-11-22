# Project map

Last updated 2026-11-22 (data, save and backup paths re-checked; the rest verified 2026-11-18).

## Shape
- `index.html` — inline splash (logo reveal; `.instant` mode when launched as an installed app), iOS launch images, fonts (Playfair Display, Jost, Pinyon Script).
- `src/main.tsx` → `src/App.tsx`: providers (ErrorBoundary → Auth → Confirm → Notice → Logs) → HashRouter.
- Not signed in → `SignIn`; signed in but not a member → `NoAccess`; else the shell: `AppHeader` + `<main>` routes + `BottomNav` + `SwipeTabs` + `InstallHint`.
- Routes: `/` Calendar · `/logs` Bookings · `/payments` Earnings (admin/owner only).

## Key files
| Area | Files |
|---|---|
| Supabase client | `src/lib/supabase.ts` (cleans pasted env values, accepts publishable or legacy anon keys, refuses secret keys and signed-out data requests) |
| Auth & roles | `src/context/AuthContext.tsx` (status loading/signed-out/no-access/ready; signIn, createAccount, changePassword, signOut, recheck; isAdmin/isOwner; numbered checks, last confirmed role as fallback) |
| Data | `src/context/LogsContext.tsx` (fetch, realtime, add/edit/remove/recordPayment, conflict handling via `utils/editMerge.ts`, numbered refreshes, `saving` count → logo shimmer), `src/api/client.ts` (every Supabase call; `ApiError` codes AUTH/CONFLICT/NOT_FOUND/VALIDATION/NETWORK/ERROR) |
| Cache | `src/utils/localCache.ts` — last booking list per role in localStorage for instant first paint; cleared on sign-out |
| Pages | `src/pages/CalendarPage.tsx`, `LogsPage.tsx` (sticky title + chips block, search, sticky date headings), `PaymentsPage.tsx` (year filter, totals card, Month/Client ledger, payment sheet) |
| Booking UI | `LogForm.tsx` (asks before discarding unsaved changes), `LogCard.tsx` (compact card: time, Call, name, price, first service +N, place, badges, on Calendar each is a standard white group with Mark as done as its last row, photo hint; tap → sheet), `BookingSheet.tsx` (details sheet on every tab: name, when + where slip, services, paid bar + Record payment, notes, photos, Call/Edit/⋯), `ServiceTiles.tsx` (tiles + qty stepper), `Photos.tsx` (picker, strip, viewer with prev/next), `Pickers.tsx` (date/time/select sheets) |
| Earnings dashboard | `EarningsDashboard.tsx` (hero, money to collect, month chart, rankings; 1 column under 700px, 2 from 700px, set in `index.css` "dashboard on every screen") |
| Documents | `src/utils/invoice.ts` (one PDF engine: invoice and quotation from the sheet's ⋯ menu `MoreMenu.tsx`; wrapping, page breaks, policy page, non-Latin text drawn as images, time-stamped file names). Price lines come from `utils/lineItems.ts`, shared with the booking sheet. |
| Business data | `src/data/services.ts` (price menu, `servicePrice`; only the default, a booking keeps its own prices), `src/data/business.ts` (address, phone, email, UPI/bank, quote policy, default note) |
| Shell & motion | `AppHeader.tsx`, `BottomNav.tsx` (exports `TABS`), `utils/useSwipeTabs.ts` (finger-follow swipe between tabs, `data-swipe` entrance), `utils/splash.ts` (logo glides into header), `utils/useSheet.ts` (slide-away close, drag-down-to-close on phones/tablets, `requestClose` with `confirmDismiss`), `utils/backgroundLock.ts` (page behind any open overlay never scrolls), `Sheet.tsx`, `ConfirmDialog.tsx`, `Notice.tsx` |
| Styles | `src/index.css` (tokens on `:root`, then layered sections; laptop block `@media (min-width:1024px)`; laptop zoom ≥1360px) |
| Backend | `supabase/schema.sql`, `supabase/hardening.sql`, `supabase/archive-members.sql`, `supabase/backup.sql`, `supabase/README.md` |
| Serverless | `api/keep-alive.js` + `vercel.json` cron (daily DB ping) |
| Scripts | `scripts/sheet-to-sql.mjs` (old Sheet CSV → SQL import), `scripts/backup-apps-script.gs` (daily Google Sheets backup) |

## Data model (Postgres, RLS on all tables)
- `members(email PK, name, role owner|admin|team, active, archived)` — who may use the app; "Delete" = `archive_member()` (hide + remove login), never a row delete.
- `bookings` — fields everyone on the team may see (date, client name, services text (names and quantities, no prices), event, venue, bridesmaids, status, times, team notes).
- `booking_private` — phones, qty/price/amount, `rates` (price per service as booked), paid amount, payment status, referral, "Notes for me". Admin/owner only.
- `booking_photos` — storage paths + `work_date` (kept in sync with the booking date by trigger).
- Storage bucket `reference-photos` (private, signed URLs, 5 MB, images only).
- Helper functions: `app_role`, `is_member`, `is_admin`, `is_owner`, `is_invited`; trigger `protect_owner`; RPC `save_booking(b, p, base)`; `backup_export(secret)`.

## Workflows
- **Sign-in:** email + password; "Confirm email" OFF; app sends no email. First time: `is_invited` check → sign-up. DB trigger (`hardening.sql`) also refuses uninvited sign-ups and API email changes.
- **Save:** online only. `save_booking` (security invoker) writes `bookings` + `booking_private` atomically; with `base` it checks `updated_at` → `CONFLICT` if another device changed it. Form stays open on failure. Edits send changed fields, merged after a warning; a new booking keeps its id across retries. Confirmed saves show at once; `recordPayment` returns the booking instead of saving when its money changed, and the sheet asks.
- **Load:** pages of 1,000 by id, then sorted by date; older replies are ignored.
- **Delete:** row first; files only once the row is confirmed gone (best effort).
- **Live updates:** realtime on bookings, booking_photos, booking_private (admins), members (instant revoke/role change); refetch on app foreground; 1-minute heartbeat.
- **Photos:** compressed on device (1600 px ≈300 KB + 360 px thumb); admin devices delete photos 2 months after work date, once a day (`eclat:photo-sweep` key).
- **Documents:** jsPDF loaded on demand; iPhone uses the share sheet, others download.
- **Backup:** Apps Script calls `backup_export` daily in pages of 1,000 → "Latest" + 14 dated tabs.
- **Keep-alive:** Vercel cron hits `/api/keep-alive` daily (03:00 UTC).

## Offline / PWA
- Manifest + icons + iOS launch images; no service worker → no offline mode, no queued writes (decided: online-only).
- Cached list paints instantly; an offline mark shows in the header; writes fail with a message and keep the form.

## Env
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in `.env` (git-ignored) and Vercel. The anon key is public by design.
