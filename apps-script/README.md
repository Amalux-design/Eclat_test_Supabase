# Éclat by Harsha — Apps Script backend

Google Sheets is the database; this script is the API. It also enforces the
two modes:

- **View-only (assistants):** can read the schedule. The server only sends
  client name, services, event, date, times, location, bridesmaids count and
  notes. Phone numbers, prices, payment status and referrer never leave the
  server.
- **Admin:** unlocked with a 6-digit PIN. Full data and all edits.

## 1. Sheet columns

Tab name: `WORK_LOGS` (exact). Row 1 headers, columns A–W, in this order:

```
id  date  clientName  work  eventType  qty  price  amount  paymentStatus  status  own  referrerName  startTime  endTime  notes  createdAt  updatedAt  clientPhone  location  altPhone  bridesmaids  paidAmount  privateNotes
```

**Upgrading an existing sheet:** add these headers at the end of row 1:
`location` (S), `altPhone` (T), `bridesmaids` (U), `paidAmount` (V),
`privateNotes` (W). Nothing else moves.

| Column | Meaning |
| --- | --- |
| `id` | unique id (the app creates it) |
| `date` | `YYYY-MM-DD` |
| `work` | services, comma-separated, e.g. `Signature Bridal, Saree Draping (Bridal)` |
| `eventType` | Wedding, Engagement, Reception… optional |
| `amount` | booking total; `qty` / `price` kept for older rows |
| `paymentStatus` | `PAID` or `PENDING` |
| `status` | `WORKED` (done) or `RESERVED` (booked) — drives calendar colours |
| `own` / `referrerName` | `TRUE` = direct client; `FALSE` + name = referred |
| `startTime` / `endTime` | `HH:mm`; `endTime` is the "ready by" time |
| `location` | venue text or a pasted Google Maps link |
| `clientPhone` / `altPhone` | contact numbers (admin only) |
| `bridesmaids` | number of bridesmaids' makeups |
| `paidAmount` | amount received so far (part payments); admin only |
| `privateNotes` | "Notes for me" — admin only, never sent to assistants |

## 2. Paste the script

1. In the Sheet: **Extensions → Apps Script**.
2. Replace everything in `Code.gs` with [`Code.gs`](./Code.gs). Save.

## 3. Set the admin PIN

1. In the Apps Script editor, click the **gear icon (Project Settings)** on the left.
2. Scroll to **Script Properties** → **Add script property**.
3. Property: `ADMIN_PIN` — Value: your 6-digit PIN (e.g. `482916`). **Save**.

The script adds `TOKEN_SALT`, `DATA_VERSION`, `PIN_FAILS` and
`PIN_LOCK_UNTIL` by itself. Leave those alone.

### Changing the PIN (also signs out every admin device)

Same place: Project Settings → Script Properties → edit `ADMIN_PIN` → Save.
Every phone or computer that was unlocked returns to view-only on its next
refresh (within about 2 minutes) and needs the new PIN. No redeploy needed.

### Wrong-PIN lockout

Counted on the server, across all devices: 3 wrong tries lock the PIN pad
for 60 seconds; every wrong try after that locks it for 5 minutes. A correct
PIN resets the count. If you ever lock yourself out, delete `PIN_LOCK_UNTIL`
and `PIN_FAILS` in Script Properties.

## 4. Deploy

**First time:** Deploy → New deployment → gear → **Web app** →
Execute as **Me**, Who has access **Anyone** → Deploy → authorise → copy the
Web app URL into the frontend `.env`:

```
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/XXXXXXX/exec
```

**After replacing `Code.gs` (this update):** Deploy → **Manage deployments**
→ pencil (Edit) → Version: **New version** → Deploy. The URL stays the same.

## How sync works

- **Saves** from the admin device show instantly and are sent in the
  background, in order, with automatic retries. Offline changes wait on the
  device and send when the connection returns. Saves are safe to repeat.
- **Assistants' devices** ask the server for a tiny version number every 2
  minutes while the app is open, and download bookings only when something
  changed. Polling pauses when the app is in the background.
- **Edits made directly in the Sheet** bump the version through the `onEdit`
  trigger, so the app picks them up on the next check.
- Rows are found with `TextFinder` on the id column, and writes are
  serialised with `LockService`.
