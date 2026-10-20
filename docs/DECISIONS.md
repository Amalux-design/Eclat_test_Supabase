# Decisions

| Decision | Why |
|---|---|
| Supabase instead of Google Sheets/Apps Script | Real roles and per-row security, live updates, photos, fewer sync/data-integrity problems. |
| Online-only saves (no offline queue) | Owner preferred "never corrupted or lost" over offline editing; a save is done only when the server confirms. |
| Email + password, "Confirm email" off | Free Supabase plan can't customise emails (no OTP template); passwords need no email at all. Owner resets forgotten passwords in the dashboard. |
| Roles owner / admin / team in `members` | Owner can grant/revoke instantly; only the owner manages the team. |
| Private details in a separate admin-only table | Team devices never receive phones or money, enforced by RLS, not just hidden in the UI. |
| `save_booking` with `updated_at` check | Stops two devices silently overwriting each other. |
| Real login emails (or a reserved domain), never fake real-looking domains | Supabase's public auth API can email reset/magic links to any address; a domain someone else owns could take over the account. |
| DB triggers on `auth.users` (`hardening.sql`) | The invite check and email lock must hold even when the API is called directly. |
| Reference photos auto-deleted 2 months after work date | Keeps storage inside the free tier and doesn't keep client photos longer than needed. |
| Daily Vercel cron ping | Free Supabase pauses after 7 idle days; app code only runs when someone opens it. |
| Google Sheets backup via secret-locked `backup_export` | Daily readable copy without putting the service_role key anywhere. |
| Quantities stored as "2× Name" in the services text | No schema change; old bookings read as ×1. |
| One PDF engine for invoice and quotation | Same approved design; quote adds the policy page, invoice can add advance confirmation. |
| Playfair Display titles; neutral sans for Earnings figures | Brand feel for headings, readability for money (Bodoni was too thin). |
| No fades on page change; transform-only swipe | Fades caused visible blinking and colour shifts. |
| Laptop zoom (up to 125%) instead of re-layout | Owner liked the 125% browser-zoom look; one scale step keeps all layouts intact. |
