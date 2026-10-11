export const CURRENCY = "INR";
export const CURRENCY_LOCALE = "en-IN";

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(CURRENCY_LOCALE, {
    style: "currency",
    currency: CURRENCY,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateHeading(isoDate: string): string {
  const d = new Date(isoDate.slice(0, 10) + "T00:00:00");
  return d.toLocaleDateString(CURRENCY_LOCALE, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function todayISO(): string {
  return toISODate(new Date());
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

// The `work` field is stored as a single comma-delimited string (e.g.
// "Makeup, Hair Style") so the Sheets backend writes it into one column with
// no schema change. These helpers convert between that wire string and the
// string[] the form works with.
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
