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

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** Money received for a booking: the full amount once paid, else part-payments. */
export function receivedOf(log: { paymentStatus: string; amount: number; paidAmount: number }): number {
  if (log.paymentStatus === "PAID") return log.amount;
  return Math.min(Math.max(log.paidAmount || 0, 0), log.amount);
}

export function isPartPaid(log: { paymentStatus: string; amount: number; paidAmount: number }): boolean {
  return log.paymentStatus !== "PAID" && log.paidAmount > 0 && log.paidAmount < log.amount;
}
