# Review workflow

Run this on every change, without being asked. A change is not "done" until
steps 1–4 pass; report what was checked and what could not be.

## 1. Before editing
- Read the relevant doc (`PROJECT_MAP`, `DECISIONS`, `KNOWN_ISSUES`) and the
  whole component being changed, plus anything that shares its logic
  (grep the helper names: two copies of a rule drift apart).
- Note every place the change shows up: phone upright, phone landscape,
  tablet, laptop (≥1024 dialog mode, ≥1360 zoom), admin vs assistant.

## 2. While editing
- Shared logic lives once: dates/numbers → `utils/format.ts`, price lines →
  `utils/lineItems.ts`, sheets → `useSheet`, overlays → `useBackgroundLock`.
- CSS: append overrides at the end of `index.css`; check older, more specific
  rules first. Fixed UI stays portalled to `<body>`.
- Keep the file's existing line endings (some files are CRLF).
- Anything that closes a form or deletes data must not lose work silently.

## 3. Check the change (every time)
1. `npx tsc -b` and `npm run lint` — no new warnings in touched files.
2. `npm run build`.
3. Self-review the diff (`git diff`) with these questions:
   - Wrong/inverted condition, falsy zero, empty string, missing `await`?
   - Edge data: no name, no services, ₹0, overpaid, part paid, long names,
     Malayalam text, 14+ services, no phone, assistant (non-admin) view.
   - Did any removed line enforce something? Is it enforced again?
   - Who else calls the changed function? Still correct for them?
   - Touch: scroll vs drag vs tap, keyboard open, short vs long content.
   - Zoom: JS coordinates from `getBoundingClientRect` divided by `--z`.
4. Exercise it in the preview at 375×812 and desktop width. Behind sign-in:
   mount the component or its markup directly and measure (positions,
   computed styles, events) — say plainly that the real screen wasn't seen.
5. PDFs: generate invoice + proposal for the edge data above and parse the
   text positions (nothing past x=540pt, nothing in the footer band).

## 4. Before pushing
- Update docs touched by the change (`PROJECT_MAP`, `DECISIONS`,
  `KNOWN_ISSUES`).
- Only `git push live-supabase main`. Never `origin`.
- Push only when the user says so.

## 5. Periodic full audit (every ~5 pushes, or after a big feature)
Run `/code-review` over the commits since the last audit, fix what is real,
and walk the main flows once: sign-in, new booking, edit, mark paid / partial,
delete, invoice + proposal, calendar, earnings dashboard, account sheet,
swipe between tabs, drag sheets closed.
