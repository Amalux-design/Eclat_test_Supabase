# Known issues & risks

Status as of 2026-11-22. "Verified" = checked in code/state; "Open" = needs a decision or owner action.

## Owner actions pending (Open)
1. **GitHub repo is public** (Amalux-design/Eclat_test_Supabase) — intentional while this is the test version; **make the production repo private**. No keys or client data in it, but studio UPI/bank details (`src/data/business.ts`) are in history. Make it private — see `docs/SECURITY.md`. (Those details are also printed on invoices and are inside the public JS bundle, so exposure is low.)
2. ~~Run `supabase/hardening.sql`~~ — installed 2026-10-20 (fixed `session_user` version confirmed). Owner-tested: outsider refused, members sign in, instant removal works.
3. ~~Members realtime publication~~ — run 2026-10-20.
4. ~~Typo owner row~~ — deleted 2026-10-20; confirmed absent 2026-11-22.
5. **After the 2026-11-22 fixes are deployed:** reopen the app on every device; re-run `supabase/backup.sql` (keeps the secret); paste the new `scripts/backup-apps-script.gs` with the same key and secret and run `backupNow`; delete TEST / RETEST bookings.

## Before handover (Open)
- The fixed setup SQL has run on throwaway Postgres only (Supabase parts imitated). Run it on the real empty project: unedited first (must stop), then with the owner's email.
- A believable owner-email typo still passes the check: read it letter by letter and create that password straight away.
- The paged Sheets backup is untested against real Google + Supabase; a restore has never been tested.
- Full audit, real-phone walk-through and a handover guide are still to do.
- Vercel plan to decide (Hobby is for non-commercial use).

## Risks (Open)
- Backup Sheet: text starting with `=` or `+` is treated as a formula.
- `npm audit` reported 3 low advisories on 2026-11-22.

## Product gaps (Open)
- Quote/invoice numbers from the Quote builder are random, not sequential.
- Username login (`name` → `name@eclat.invalid`) discussed, not built.
- No automated tests; sign-in-only screens are build-verified unless the owner checks them.

## Technical debt (Verified)
- `src/index.css` (~5,300 lines) is layered overrides; specificity collisions have caused bugs twice. Consider consolidating sections.
- Lint baseline is 7 warnings, 0 errors: `useSwipeTabs` refs during render; `LogsContext` setState in effect; five fast-refresh export warnings (`LogsContext`, `AuthContext`, `Notice`, `ConfirmDialog`, `Loader`).
- `useSwipeTabs` relies on DOM queries (`.page`, `.bottom-nav`) and a `data-swipe` attribute; renaming those classes breaks the swipe.
- Laptop zoom math (`--z`) must be respected by any new vh/vw sizing or coordinate math.

## Resolved recently (for regression checks)
Fixed 2026-11-22 (1 tested on throwaway Postgres; 2-9 retested by the developer in the app):
1. Setup file had a built-in owner → no default; stops until the email is filled in.
2. Raising a paid total counted as received → shows the balance due.
3. Lowering a total clipped the advance → keeps it and shows the refund.
4. A save conflict lost the edit → form stays open; second save merges.
5. Retrying a new booking duplicated it → same id on retry.
6. A stale form overwrote a newer payment → warns, saves changed fields only.
7. Only 1,000 bookings loaded or backed up → paged (app half retested; Sheet half pending, see owner action 5).
8. A slow refresh restored old data → only the newest refresh wins.
9. A failed delete destroyed photos → row first, files after.

Earlier:
- Sign-out did nothing on long-open laptop tabs → now local sign-out + clears stored login and all cached bookings.
- Splash logo overshot on zoomed laptops → divides by zoom.
- Calendar width jumped when the page grew a scrollbar → `scrollbar-gutter: stable`.
- Page re-fade/blink after swipe → `data-swipe` set once per navigation, no fades.
