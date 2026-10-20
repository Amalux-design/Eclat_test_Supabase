# Éclat by Harsha — booking app

Private booking/schedule app for a bridal makeup studio (Calicut). React 19 + TypeScript + Vite 8, Supabase backend, deployed on Vercel. Installable (manifest + icons), online-only (no service worker).

## Commands
- `npm run dev` · `npm run build` (tsc -b + vite build; run before every push) · `npm run lint` (oxlint)
- No automated tests. Screens behind sign-in can't be viewed in the local preview without credentials; say so when a change is only build-verified.
- Local preview servers: `.claude/launch.json` → `eclat-supabase` (port 5174).

## Deploy
- `git push live-supabase main` → GitHub Amalux-design/Eclat_test_Supabase → Vercel auto-deploys (eclatsupabasetest.vercel.app).
- **Never push to `origin`** (old Google-Sheets repo, eclat-test-server).
- Commit messages end with the Co-Authored-By line given in session instructions.

## Rules for safe changes
- `src/index.css` is one long file of layered overrides; later rules win. Append overrides at the end or raise specificity — check for older, more specific rules first (e.g. `.ledger.pinned …`).
- Fixed-position UI (sheets, dialogs, FAB, viewer) is portalled to `<body>`; keep it that way (transforms/backdrop-filter on ancestors break `position: fixed`). React events still bubble through portals — stop propagation where needed.
- Laptop scale: `body { zoom: var(--z) }` ≥1360px; vh/vw inside must be divided by `--z`; JS transforms from `getBoundingClientRect` must divide by zoom (see `utils/splash.ts`).
- Titles use `--font-title` (Playfair Display); money/figures on Earnings use the sans `--font-fin`.
- Services are stored as text: `"2× Classic Bridal, Saree Draping (Bridal)"` — use `splitQty` / `withQty` in `utils/format.ts`.
- Security lives in Postgres RLS (`supabase/schema.sql`) and `supabase/hardening.sql`, not in the UI. Never put the service_role key, backup secret, passwords or client data in code, docs or memory.

## Docs
- `docs/PROJECT_MAP.md` — architecture, files, data flow
- `docs/DECISIONS.md` — why things are the way they are
- `docs/KNOWN_ISSUES.md` — open issues, risks, lint warnings
- `docs/SECURITY.md` — backend setup checklist and owner actions
- `supabase/README.md` — first-time Supabase setup
