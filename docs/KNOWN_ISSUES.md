# Known issues & risks

Status as of 2026-10-20. "Verified" = checked in code/state; "Open" = needs a decision or owner action.

## Owner actions pending (Open)
1. **GitHub repo is public** (Amalux-design/Eclat_test_Supabase). No keys or client data in it, but studio UPI/bank details (`src/data/business.ts`) are in history. Make it private — see `docs/SECURITY.md`. (Those details are also printed on invoices and are inside the public JS bundle, so exposure is low.)
2. **Run `supabase/hardening.sql`** in Supabase (blocks uninvited sign-ups and API email changes).
3. **Members realtime:** `alter publication supabase_realtime add table public.members;` must have been run for instant revoke.
4. **Typo owner row** `heyamalux@gmail.com.com` should be deleted if still present.

## Product gaps (Open)
- Quote/invoice numbers from the Quote builder are random, not sequential.
- Username login (`name` → `name@eclat.invalid`) discussed, not built.
- No automated tests; sign-in-only screens are build-verified unless the owner checks them.

## Technical debt (Verified)
- `src/index.css` (~4,300 lines) is layered overrides; specificity collisions have caused bugs twice. Consider consolidating sections.
- Lint warnings: `LogsContext.tsx` setState in effect; `AuthContext.tsx` exports a hook alongside the provider (fast-refresh). Harmless.
- `useSwipeTabs` relies on DOM queries (`.page`, `.bottom-nav`) and a `data-swipe` attribute; renaming those classes breaks the swipe.
- Laptop zoom math (`--z`) must be respected by any new vh/vw sizing or coordinate math.

## Resolved recently (for regression checks)
- Sign-out did nothing on long-open laptop tabs → now local sign-out + clears stored login and all cached bookings.
- Splash logo overshot on zoomed laptops → divides by zoom.
- Calendar width jumped when the page grew a scrollbar → `scrollbar-gutter: stable`.
- Page re-fade/blink after swipe → `data-swipe` set once per navigation, no fades.
