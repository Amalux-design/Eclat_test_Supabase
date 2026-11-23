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
| One PDF engine for invoice and quotation | Same approved design; quote adds the policy page. Text the built-in Latin-1 fonts can't draw (Malayalam, emoji) is drawn by the device as an image on the same baseline, so it shapes correctly without embedding a ~400 KB font. |
| Playfair Display titles; neutral sans for Earnings figures | Brand feel for headings, readability for money (Bodoni was too thin). |
| No fades on page change; transform-only swipe | Fades caused visible blinking and colour shifts. |
| Laptop zoom (up to 125%) instead of re-layout | Owner liked the 125% browser-zoom look; one scale step keeps all layouts intact. |
| Received money is never clipped to the total | Raising a total leaves a balance due; lowering it shows a refund. Only an explicit Paid / Record payment adds money. |
| Edits send changed fields only, merged onto the latest row | A stale form can't undo another device's payment; a change made meanwhile always warns first (`utils/editMerge.ts`). |
| New-booking id belongs to the open form | Retrying a save updates the same booking instead of duplicating it. |
| Lists and backups read in pages of 1,000 | Supabase caps each reply at 1,000 rows. |
| Only the newest refresh may update the list | A slow older reply must not undo a newer change. |
| Delete removes the booking row before its photo files | A failed delete must not leave a booking with broken photos. |
| `schema.sql` has no default owner | An unedited setup stops and creates nothing; a re-run never adds a second owner. |
| Production is a fresh copy in the client's own accounts, starting empty | The test deployment stays the developer's; nothing is imported or repointed. |
| `schema.sql` grants API access explicitly | New Supabase projects grant none by default; every new table needs its own grant. |
| Role helpers answer true or false, never NULL | `if not <NULL>` skips a guard in PL/pgSQL. |
| The owner row is changed only in the SQL Editor | The owner can't lock themselves out from the app. |
| Team edits update one field, conditional on the state shown | An old screen can't undo someone else's change. |
| Data requests without a user login are refused on the device | An unrenewable login would otherwise get real-looking signed-out answers (empty list, 0 rows). Only `is_invited` is exempt. |
| The last confirmed role is remembered for display | A failed access check doesn't hide the owner's screens; the next refresh corrects it and RLS still decides. |
| Edit retry state is keyed by the open form's id | Reopening a booking must start clean, or an old acknowledgement undoes newer work. |
| A confirmed save is shown before the reload | A failed reload must not leave old values to edit from. |
| A quick payment saves only if Received and Total are as the person saw them; otherwise it asks | A lost reply, a double tap and a second person's equal payment look identical, so a person decides. No payment table needed. |
| Save stops while a typed custom service hasn't been added | Auto-adding would change the total after the person last saw it. |
| Each booking keeps every service's unit price in `booking_private.rates` | The team can read `bookings.work`, so it holds names and quantities only; a later menu change doesn't rewrite old invoices. Only `api/client.ts` converts (`utils/rates.ts`). |
| The standard price menu stays in the app bundle | Developer decision 2026-11-23: only custom prices and each booking's money are private. |
| Calendar's day list reuses the Bookings tab's white groups; Mark as done is each group's last row | It can only mean that booking, and adds no new visual pattern. |
| Earnings dashboard: one column under 700px, paired columns in a wider dialog from 700px | Phones must never scroll sideways; tablets and laptops shouldn't get a stretched phone layout. |
| A total typed before any service is kept when services are added | It was agreed with the client; the difference shows as extra or discount until the amount is edited. |
| `bookings.work` has a CHECK refusing " @price" | Prices can never again be saved where the team can read them. |
