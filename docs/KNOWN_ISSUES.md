# Known issues & risks

Status as of 2026-11-22. "Verified" = checked in code/state; "Open" = needs a decision or owner action.

## Owner actions pending (Open)
1. **GitHub repo is public** (Amalux-design/Eclat_test_Supabase) — intentional while this is the test version; **make the production repo private**. No keys or client data in it, but studio UPI/bank details (`src/data/business.ts`) are in history. Make it private — see `docs/SECURITY.md`. (Those details are also printed on invoices and are inside the public JS bundle, so exposure is low.)
2. ~~Run `supabase/hardening.sql`~~ — installed 2026-10-20 (fixed `session_user` version confirmed). Owner-tested: outsider refused, members sign in, instant removal works.
3. ~~Members realtime publication~~ — run 2026-10-20.
4. ~~Typo owner row~~ — deleted 2026-10-20; confirmed absent 2026-11-22.
5. **Post-deploy (2026-11-22):** devices reopened, backup SQL re-run, Sheets backup set up for the first time (19 of 19 rows, daily trigger on). TEST / RETEST bookings stay for now (testing phase, developer decision 2026-11-22).

## Before handover (Open)
- **Not production-ready yet.** The 2026-11-22 audit's remaining fixes are being done in small steps; the list is kept privately until they land.
- The "Forgot password" dashboard steps in `supabase/README.md` don't work (there is no set-password there); a tested procedure is to be written.
- The fixed setup SQL has run on throwaway Postgres only (Supabase parts imitated). Run it on the real empty project: unedited first (must stop), then with the owner's email.
- A believable owner-email typo still passes the check: read it letter by letter and create that password straight away.
- Sheets backup works on real Google + Supabase (19 rows, 2026-11-22). Still untested there: over 1,000 rows, the first nightly run, and a restore.
- Full audit, real-phone walk-through and a handover guide are still to do.
- Vercel plan to decide (Hobby is non-commercial, and its private repos only deploy the account owner's commits).

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
Pre-handover test 2026-11-24 (owner + team phone, on test bookings, all deleted after):
- Money boxes read "Rs 5000.00" as 500000 and "5k" as 5; now ₹/Rs/INR, /-, decimals, k and lakh all read correctly.
- Dashboard "Overdue / Coming up" labels now say what the split is (date passed / today or later).
- Passed: part and full payments, overpay blocked, stale payment dialog, two-device edits (merge and clash), lowered total → refund, discount guard, Done prompt, delete elsewhere, live updates, Payments/dashboard/invoice totals vs database, team sees no money or contacts.

Audit fixes 2026-11-22, steps 1-7 (each tested by the developer):
- Team-management guard and owner protection tightened.
- New-style Supabase keys and explicit table grants for new projects.
- An old Team screen can't undo a change made elsewhere.
- A failed access check or unrenewable login no longer changes what the app shows or deletes.

Audit fixes 2026-11-23, steps 8-10 (each tested by the developer):
- Editing again no longer undoes the previous save.
- A typed custom service can't be dropped by Save.
- A retried, repeated or stale payment asks instead of adding or vanishing.

Audit fix 2026-11-23, step 11 (app part; existing rows still to be migrated):
- Each booking saves its service prices in the private row and keeps them when the menu changes.

UI fixes 2026-11-23 (checked with invented data at phone, tablet and laptop widths):
- Earnings dashboard was wider than every phone screen when a name was long; now responsive.
- "Paid" was unreadable on the dark Today panel.

Audit fixes 2026-11-23, steps 11c-12: old prices moved to the private row and locked (verified on the test database); a typed total survives adding services; removing a discounted service no longer saves Rs. 0.

Audit fix 2026-11-23, step 13: invoices with no total no longer say "Paid in full"; no Rs. 0 proposals; a failed PDF says so.

Audit fix 2026-11-24, step 14: pasted and decimal amounts read correctly; the Paid / Payment due switch always matches what is saved.

Audit fix 2026-11-24, step 15: undo after a lost reply works; an out-of-date role can no longer blank a booking.

Audit fix 2026-11-24, step 16: Earnings "% collected" and refunds correct; "All years" no longer merges months.

Audit fix 2026-11-24, step 17: cached client data is cleared on removal, demotion and sign-out, and never shown to another login.

Audit fix 2026-11-24, step 18: the photo clean-up uses the server's date and the booking's current date (needs `expired_photos()` from schema.sql; until then it is skipped).

Fixed 2026-11-22 (1 tested on throwaway Postgres; 2-9 retested by the developer in the app):
1. Setup file had a built-in owner → no default; stops until the email is filled in.
2. Raising a paid total counted as received → shows the balance due.
3. Lowering a total clipped the advance → keeps it and shows the refund.
4. A save conflict lost the edit → form stays open; second save merges.
5. Retrying a new booking duplicated it → same id on retry.
6. A stale form overwrote a newer payment → warns, saves changed fields only.
7. Only 1,000 bookings loaded or backed up → paged (app half retested; Sheet works, not yet tried over 1,000 rows).
8. A slow refresh restored old data → only the newest refresh wins.
9. A failed delete destroyed photos → row first, files after.

Earlier:
- Sign-out did nothing on long-open laptop tabs → now local sign-out + clears stored login and all cached bookings.
- Splash logo overshot on zoomed laptops → divides by zoom.
- Calendar width jumped when the page grew a scrollbar → `scrollbar-gutter: stable`.
- Page re-fade/blink after swipe → `data-swipe` set once per navigation, no fades.
