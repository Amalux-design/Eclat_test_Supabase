export const CURRENCY = "INR";
export const CURRENCY_LOCALE = "en-IN";

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(CURRENCY_LOCALE, {
    style: "currency",
    currency: CURRENCY,
    maximumFractionDigits: 0,
  }).format(amount);
}

function parseISODate(isoDate: string): Date {
  return new Date(isoDate.slice(0, 10) + "T00:00:00");
}

export function formatDateHeading(isoDate: string): string {
  return parseISODate(isoDate).toLocaleDateString(CURRENCY_LOCALE, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatDateLong(isoDate: string): string {
  return parseISODate(isoDate).toLocaleDateString(CURRENCY_LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDays(isoDate: string, days: number): string {
  const d = parseISODate(isoDate);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Monday–Sunday week containing `isoDate`. */
export function weekRange(isoDate: string): { start: string; end: string } {
  const d = parseISODate(isoDate);
  const offset = (d.getDay() + 6) % 7; // Monday = 0
  const start = addDays(isoDate, -offset);
  return { start, end: addDays(start, 6) };
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isPastOrToday(isoDate: string): boolean {
  return isoDate <= todayISO();
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(CURRENCY_LOCALE, {
    month: "long",
    year: "numeric",
  });
}

export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7); // YYYY-MM
}

// The `work` field is stored as a single comma-delimited string so the Sheets
// backend keeps it in one column. These convert between that and string[].
export function parseWorks(work: string): string[] {
  return String(work ?? "")
    .split(/\s*,\s*/)
    .map((w) => w.trim())
    .filter(Boolean);
}

/**
 * "2× Classic Bridal" → { name: "Classic Bridal", qty: 2 }. No prefix means 1.
 * Off-menu items carry their own price: "7× Hairdo @2500" → price 2500.
 */
export function splitQty(work: string): { name: string; qty: number; price?: number } {
  let t = work.trim();
  let price: number | undefined;
  const pm = /\s@(\d+)$/.exec(t);
  if (pm) {
    price = Number(pm[1]);
    t = t.slice(0, pm.index).trim();
  }
  const m = /^(\d+)\s*[×xX]\s+(.+)$/.exec(t);
  const base = m ? { name: m[2].trim(), qty: Math.max(1, Number(m[1])) } : { name: t, qty: 1 };
  return price != null ? { ...base, price } : base;
}

/** Inverse of splitQty: quantity 1 is the plain name; a price is stored as " @2500". */
export function withQty(name: string, qty: number, price?: number): string {
  const label = qty > 1 ? `${qty}× ${name}` : name;
  return price ? `${label} @${price}` : label;
}

/** How a stored service reads on screen: "7× Hairdo" (the @price is hidden). */
export function workLabel(work: string): string {
  const w = splitQty(work);
  return withQty(w.name, w.qty);
}

export function joinWorks(works: string[]): string {
  return works
    .map((w) => w.replace(/,/g, "").trim())
    .filter(Boolean)
    .join(", ");
}

/** A pasted map link opens as-is; plain text becomes a Google Maps search. */
export function mapsUrl(location: string): string {
  const trimmed = location.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
}

export function isMapLink(location: string): boolean {
  return /^https?:\/\//i.test(location.trim());
}

/**
 * Clients are always Indian mobiles. Reduce anything typed to the plain 10
 * digits ("+91 99476 12345", "09947612345", "99476-12345" → "9947612345").
 * If it doesn't reduce cleanly to 10 digits, keep exactly what was typed so
 * nothing is ever thrown away.
 */
export function normalizePhone(raw: string): string {
  const typed = String(raw ?? "").trim();
  if (!typed) return "";
  let digits = typed.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits.length === 10 ? digits : typed;
}

export function isValidPhone(raw: string): boolean {
  const n = normalizePhone(raw);
  return !n || /^\d{10}$/.test(n);
}

/** Always dial as +91 so the call connects (also fixes older "91…" rows). */
export function telHref(phone: string): string {
  const n = normalizePhone(phone);
  if (/^\d{10}$/.test(n)) return `tel:+91${n}`;
  return `tel:${String(phone).replace(/[^\d+]/g, "")}`;
}

/** Money received for a booking: the full amount once paid, else part-payments. */
export function receivedOf(log: { paymentStatus: string; amount: number; paidAmount: number }): number {
  if (log.paymentStatus === "PAID") return log.amount;
  return Math.min(Math.max(log.paidAmount || 0, 0), log.amount);
}

export function isPartPaid(log: { paymentStatus: string; amount: number; paidAmount: number }): boolean {
  return log.paymentStatus !== "PAID" && log.paidAmount > 0 && log.paidAmount < log.amount;
}
