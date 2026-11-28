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
| Playfair Display titles; money in Jost everywhere; semi-bold (600) is the heaviest weight | Brand feel for headings; the owner chose the card amount style for all figures, then no bold anywhere (2026-11-24). PDFs keep their own fonts. |
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
| No proposal without a total; an invoice with no total says "To be confirmed" | A Rs. 0 proposal or "Paid in full" with nothing priced misleads the client. |
| "Received so far" is the only record of money in the form | Paid fills it once and Payment due undoes that tap; the switch shows what will be saved and never erases real money. |
| Money boxes read whole rupees ("₹15,000.00" = 15000, "1.5L" = 150000) | Pasted figures were multiplied by 100. |
| An edit records what it sends before sending | After a lost reply the server's copy is recognised as this form's own write, so it can be undone without a false warning, and never undoes someone else. |
| Edits and payments always re-read contacts and money; they stop if those are missing for a non-admin | An out-of-date role must not save blanks over a booking. |
| "% collected" counts money only towards each booking's own total, rounded down | One client's overpayment is a refund, not payment of another's balance; 99.6% is not 100%. |
| "All years" charts the 12 months up to the latest booking, each with its year | Months of different years were added together. |
| The saved booking list belongs to one person; access changes clear it at once | Removed or demoted people, and the next person on a shared device, must not keep or see client data. |
| Expired photos are chosen by the server (`expired_photos()`): its India date, the booking's current date, 3-day grace | A phone's wrong clock or a stale photo date must not delete current photos, which have no backup. |

## Money checks and single owner (2026-11-24)
- A discount is capped at the services total while typing, and a save is refused if removing a service leaves a larger discount.
- Saving a booking as Done with a balance still due asks first ("Balance still due"), so a fully paid job isn't left as due by mistake.
- Only one owner: a unique index `members_one_owner` (schema.sql and hardening.sql) refuses a second owner row.
- Bridesmaids' makeup counter removed from the booking form (2026-11-25): it added no money and could disagree with a priced line. Bridesmaids go under "Something else" (with a rate, or none for "Included"). Production starts empty, so no old counts exist there; an old saved count is kept untouched by edits and still shows on the sheet and PDF. The one test booking with a count (demo) was cleared.
- PDF: a free line shows no "Rs. 0" rate, only the quantity and "Included".
- PDF: scan-to-pay UPI QR beside "Payment method" on proposals and invoices (2026-11-27). Drawn as vector squares from `BUSINESS.upiQr` (decoded from Harsha's GPay QR, hrshaa96@okicici) so it prints sharp; the `qrcode` library loads only when a PDF is made. Empty `upiQr` hides it.
- Proposal note: hair extensions or other extras asked for on the event day are not in the package and go on the final invoice (no fixed price, 2026-11-28).
