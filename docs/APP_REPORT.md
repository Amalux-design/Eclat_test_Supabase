# Éclat by Harsha — App Report

Booking and schedule app for Éclat by Harsha, a bridal makeup studio in Calicut (Kozhikode). Built as a mobile-first web app that installs on Android and iPhone like a native app.

Live: https://eclat-test-server-zyn4.vercel.app
Code: https://github.com/Amalux-design/eclat-test-server

---

## 1. What it does

| Area | What the app offers |
|---|---|
| Calendar | Month view of all bookings, dots for booked/done days, tap a day to see its bookings |
| Bookings | Full list with quick filters (Today, Tomorrow, This week, Upcoming, Past, Payment due) and search |
| Earnings (admin only) | Total booked, received, due; by month or by client; mark paid / part-paid |
| Booking form | Client, occasion, venue, times, services from her price menu, bridesmaids, payment, notes |
| Invoices | Branded one-page PDF per booking (logo, client, occasion, services, totals) |
| Two modes | View-only for assistants, Admin (6-digit PIN) for Harsha |

---

## 2. Who uses it and what they see

### Assistants (view-only, default)
- See: client name, services, event type, date, start time, ready-by time, venue (with Maps link), bridesmaids count, team notes.
- Do not see: phone numbers, prices, amounts, payment status, referrer, "Notes for me".
- Cannot add, edit or delete anything.
- Earnings tab is hidden.

### Admin (Harsha)
- Unlocks with a 6-digit PIN; stays unlocked on that device until "Lock" is tapped.
- Sees everything, edits everything, Earnings tab, invoices.

### How privacy is enforced
- Hidden fields are removed **on the server** before data is sent. They never reach an assistant's phone, not even in its cache.
- The PIN is stored on the server (Apps Script Script Properties), never in the app code.
- Wrong PIN lockout on the server: 3 wrong → 60 s lock, every further wrong → 5 min lock.
- Changing the PIN in Script Properties signs out every admin device.

---

## 3. Booking fields

| Field | Required | Visible to team |
|---|---|---|
| Client name | **Yes (only required field)** | Yes |
| Date | Defaults to today | Yes |
| Start time / Ready by | No | Yes |
| Event type (Wedding, Engagement, Reception…) | No | Yes |
| Place / venue (text or Google Maps link) | No | Yes |
| Services (from price menu, multi-select, custom allowed) | No | Yes |
| Bridesmaids' makeup count | No | Yes |
| Notes for the team | No | Yes |
| Contact number / Alternative number | No | **No** |
| Amount (auto from menu prices, editable) | No | **No** |
| Received so far (advance / part payment) | No | **No** |
| Payment status (Payment due / Paid) | No | **No** |
| Direct client / Referred by | No | **No** |
| Booked / Done status | Auto from date | Yes (calendar colours) |
| Notes for me (private) | No | **No** |

### Service menu (prices auto-fill the amount)
- Bridal: Classic ₹15,000 · Signature ₹20,000 · Luxe ₹40,000 · Airbrush ₹45,000
- Engagement: Classic ₹8,000 · Signature ₹12,000
- Occasion: Occasional Glam ₹5,000 · Signature Occasional ₹8,000 · Signature Grooming ₹5,000
- Saree draping: Bridal ₹3,000 · Non-bridal ₹2,000
- Consultation & trials: On-call (no fee) · In-person ₹800 · Trial ₹5,000 · Airbrush Trial ₹10,000

---

## 4. How it works (architecture)

```
Phone (React app, installed PWA)
   │  instant UI from on-device cache
   │  background save queue (IndexedDB)
   ▼
Google Apps Script web app  (API, PIN check, field stripping)
   ▼
Google Sheet "WORK_LOGS"  (database, 23 columns A–W)
```

### Frontend
- React 19 + TypeScript, built with Vite, hosted on Vercel (auto-deploys on every push to GitHub `main`).
- Installable PWA: app icon, standalone window, launch screens for Android and 10 iPhone sizes.

### Backend
- Google Sheet as the database; Google Apps Script as the API.
- Script caches reads, finds rows with TextFinder, serialises writes with LockService, keeps a data version number.
- Editing the Sheet directly is fine; the app picks it up within ~2 minutes.

### Speed and offline
- **Instant open:** last bookings are cached on the phone and shown immediately, then refreshed.
- **Instant saves:** changes show on screen at once and go into a background queue (stored in IndexedDB). The queue retries automatically (2 s → 1 min), survives closing the app, and sends when back online.
- **No flicker after saving:** the server's confirmed copy replaces the on-screen copy directly; no full reload.
- **Auto-refresh:** every open device checks a tiny version number every 2 minutes and only downloads bookings if something changed. Paused while the app is in the background.
- **Search and filters** run on the phone: instant, no server load.

### Server load (typical)
- 1 request per save, 1 tiny check per device every 2 minutes, full download only when data changed. Well within Apps Script free limits.

---

## 5. Design

### Brand
- Logo: supplied Éclat by Harsha SVG, used in header, splash, icons and invoices.
- Colours (from Harsha's palette): cream `#F8F2EA` background, wine `#461A1C` highlight panels, oxblood `#420C15` actions, dark brown `#3F1715` text, gold `#9E7650` / `#D4B48C` accents, moss green for "done", rose for "booked".
- Type: Bodoni Moda (titles, money) + Jost (everything else). Weights 400 / 500 / 600 only.
- Always light theme (cream), even if the phone is in dark mode.

### Style
- iOS-inspired: large titles, rounded grouped lists, frosted glass header, filter bar, floating tab bar and "+ New" button.
- Pill shape for everything tappable (buttons, filters, inputs, toggles).
- One wine "hero" panel per screen: the calendar, the selected filter group on Bookings, the totals on Earnings.

### Motion
- Splash: logo drawn in like a brush stroke → gold shimmer while loading → glides up into the header.
- Saving: gold shimmer sweeps through the header logo while changes upload; offline shows a dimmed logo + cloud icon.
- Calendar: month follows the finger when swiped; card height and month title animate smoothly between months.
- Tab bar: one oxblood pill slides between tabs.
- Sheets (forms, pickers) slide up and down; confirmation pop-ups are iOS-style alerts.
- Custom date, time and dropdown pickers (no browser defaults).
- Respects "Reduce Motion".

---

## 6. Screens

**Calendar** — wine month card (title, booking count, Today button, weekdays, dates with dots, legend), then a cream panel with the selected day's bookings and "+ Add" (admin).

**Bookings** — frosted search pill + filter pills, the selected group (default Today) in a wine panel, then all other bookings by date. "+ New" button for admin.

**Earnings (admin)** — wine totals panel (total booked, progress bar, received, due), By month / By client toggle, expandable months. Tap a booking → Mark paid, Mark partial, Save invoice, Edit.

**Booking form** — sections: The client, The occasion, Services, Payment, Notes for the team, Notes for me. Brown "Save" pill.

**PIN screen** — full-screen keypad, dots, lockout countdown.

---

## 7. Invoices
- One-page A4 PDF, generated on the phone (no server).
- Logo, invoice number, issue date, studio address, client, occasion line, itemised services (menu prices; difference shown as discount/additional), bridesmaids note, Total / Received / Balance due (or "Paid in full").
- iPhone: opens the Share sheet (Save to Files, WhatsApp, Mail). Others: downloads.
- Amounts show as "Rs." (built-in PDF fonts have no ₹ glyph).
- Studio phone, email, Instagram, GSTIN, UPI/bank details: to be filled in `src/data/business.ts`.

---

## 8. Install
- **Android (Chrome/Brave):** open the site → menu → Install app.
- **iPhone (Safari):** open the site → Share → Add to Home Screen (a one-time tip explains this).

---

## 9. Setup and operations
- Sheet: tab `WORK_LOGS`, 23 headers A–W (see `apps-script/README.md`).
- Script: paste `apps-script/Code.gs`, set `ADMIN_PIN` in Script Properties, deploy as Web App (Execute as Me, Anyone).
- Vercel: environment variable `VITE_APPS_SCRIPT_URL` = Apps Script `/exec` URL; redeploy after changing it.
- After any `Code.gs` change: Deploy → Manage deployments → Edit → New version.
- Demo data: `demo-data/eclat-demo-bookings.xlsx` (22 sample bookings).

---

## 10. Current limits
- One shared admin PIN; view-only is open to anyone with the link (no per-person access yet).
- No reference photos/videos.
- No quotations; no per-payment receipts or payment history (only a running "received" total).
- No quantities per service (except bridesmaids); no Hair only / Makeup only / Kids makeup items.
- No client directory; no "Cancelled" state (only delete).
- PDFs use "Rs." instead of "₹".

---

## 11. Proposed next scope

| Priority | Feature | Notes |
|---|---|---|
| 1 | Team access & revoke | Personal access code per member, Owner/Admin/Team roles, revoke from the app, close the open view-only link |
| 2 | Payment history & receipts | Each payment with date, amount, method; numbered receipt PDF per payment |
| 3 | Quotations | Quote state → branded quote PDF → convert to booking |
| 4 | Reference photos | Compressed on the phone (~300 KB), stored in Supabase Storage or Google Drive; videos as links |
| 5 | More services & quantities | Hair only, Makeup only, Kids makeup; qty per item; discounts/extra charges |
| 6 | Booking states | Quote → Confirmed → Done → Cancelled |
| 7 | Client directory | Repeat clients and contacts in one place |
| 8 | ₹ in PDFs | Embed a font with the rupee sign |

### Backend decision
Sheets + Apps Script works today and is free. Per-person logins, photos and payment history are where **Supabase** becomes worth it (real accounts, database-level privacy rules, file storage).

Supabase free tier estimate at 2 photos/day: compressed photos ≈ 220 MB/year → ~4.5 years in the 1 GB free storage. Uncompressed phone photos ≈ 5 months. Videos should be stored as links (Drive/Instagram), not uploaded.
