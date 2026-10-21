// Builds A4 invoice and quotation PDFs on the device and downloads them.
// One design for both. jsPDF is loaded only when a document is first saved,
// keeping the app light.
import type { WorkLog } from "../types";
import { withBusy } from "../components/Loader";
import { BUSINESS } from "../data/business";
import { servicePrice } from "../data/services";
import { formatDateLong, formatTime, parseWorks, receivedOf, splitQty, todayISO, withQty } from "./format";

const WINE: [number, number, number] = [70, 26, 28];
const INK: [number, number, number] = [63, 23, 21];
const SOFT: [number, number, number] = [110, 84, 70];
const GILT: [number, number, number] = [158, 118, 80];
const RULE: [number, number, number] = [225, 210, 196];

// The PDF's built-in fonts have no ₹ glyph, so amounts are printed as "Rs.".
function money(n: number): string {
  return `Rs. ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n)}`;
}

// Standard PDF fonts are Latin-1: swap characters they can't draw.
function pdfText(s: string): string {
  return s.replace(/₹\s?/g, "Rs. ").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-");
}

function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y.slice(2)}`;
}

export function invoiceNumber(log: WorkLog): string {
  return `${BUSINESS.invoicePrefix}-${log.date.replace(/-/g, "")}-${log.id.replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase()}`;
}

/** A fresh number for a document that isn't tied to a saved booking. */
export function newDocNumber(kind: DocKind): string {
  const prefix = kind === "quote" ? BUSINESS.quotePrefix : BUSINESS.invoicePrefix;
  const rand = Math.floor(Math.random() * 36 ** 4).toString(36).toUpperCase().padStart(4, "0");
  return `${prefix}-${todayISO().replace(/-/g, "")}-${rand}`;
}

/** Render the header logo SVG to an image the PDF can embed, in the given colour. */
async function logoImage(fill: string): Promise<{ data: string; ratio: number } | null> {
  try {
    const svg = await (await fetch("/logo.svg")).text();
    const tinted = svg.replace(/fill="#000(000)?"/g, `fill="${fill}"`);
    const url = URL.createObjectURL(new Blob([tinted], { type: "image/svg+xml" }));
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = url;
    });
    const ratio = 657 / 274;
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = Math.round(900 / ratio);
    const ctx = canvas.getContext("2d")!;
    // White ground + JPEG keeps the embedded logo around 30 KB instead of megabytes.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    return { data: canvas.toDataURL("image/jpeg", 0.9), ratio };
  } catch {
    return null;
  }
}

/* ---------- document model ---------- */

export type DocKind = "invoice" | "quote";

export interface DocRow {
  date?: string; // ISO; shown in a Date column when any row has one
  label: string;
  rate?: number; // per unit
  qty?: number; // e.g. 2 for "2× Classic Bridal", or people
  amount: number;
}

export interface DocData {
  kind: DocKind;
  number: string;
  issueDate: string; // ISO
  clientName: string;
  clientLines: string[]; // phones, place
  occasion?: string;
  venue?: string;
  rows: DocRow[];
  rowsNote?: string; // small line under the table
  extras: { label: string; amount: number }[]; // travel etc., added after the subtotal
  notes: string[];
  received?: number; // invoices: paid so far
  advance?: { amount: number; date: string; method: string; eventDates: string }; // invoice page 2
}

export function docTotal(d: Pick<DocData, "rows" | "extras">): number {
  return d.rows.reduce((s, r) => s + r.amount, 0) + d.extras.reduce((s, e) => s + e.amount, 0);
}

/* ---------- from a saved booking (the invoice button on a card) ---------- */

/** Menu prices per service; any difference from the booked total becomes one adjustment line. */
function lineItems(log: WorkLog): DocRow[] {
  const services = parseWorks(log.work).map(splitQty);
  const priced: DocRow[] = services.map((s) => {
    const rate = servicePrice(s.name) ?? s.price ?? 0;
    return { label: s.name, rate, qty: s.qty, amount: rate * s.qty };
  });
  const menuTotal = priced.reduce((sum, l) => sum + l.amount, 0);
  if (menuTotal === 0 || (services.length === 1 && services[0].qty === 1)) {
    return services.length === 1
      ? [{ label: withQty(services[0].name, services[0].qty), amount: log.amount }]
      : [{ label: services.map((s) => withQty(s.name, s.qty)).join(", ") || "Makeup services", amount: log.amount }];
  }
  const diff = log.amount - menuTotal;
  if (diff !== 0) priced.push({ label: diff > 0 ? "Additional services" : "Discount", amount: diff });
  return priced;
}

export function bookingToDoc(log: WorkLog): DocData {
  return {
    kind: "invoice",
    number: invoiceNumber(log),
    issueDate: todayISO(),
    clientName: log.clientName || "Client",
    clientLines: [log.clientPhone, log.altPhone].filter(Boolean),
    occasion: [log.eventType || "Makeup", formatDateLong(log.date), log.startTime ? formatTime(log.startTime) : ""]
      .filter(Boolean)
      .join(", "),
    venue: log.location || undefined,
    rows: lineItems(log),
    rowsNote:
      log.bridesmaids > 0 ? `Includes makeup for ${log.bridesmaids} bridesmaid${log.bridesmaids > 1 ? "s" : ""}` : undefined,
    extras: [],
    notes: [],
    received: receivedOf(log),
  };
}

export function saveInvoice(log: WorkLog): Promise<void> {
  return saveDocument(bookingToDoc(log));
}

export function saveDocument(d: DocData): Promise<void> {
  return withBusy(d.kind === "quote" ? "Preparing proposal" : "Preparing invoice", () => buildDocument(d));
}

/* ---------- the PDF ---------- */

async function buildDocument(d: DocData): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const W = 210;
  const M = 20;
  const R = W - M; // right edge of the text column
  const quote = d.kind === "quote";
  let y = 22;

  // Logo, with the document name and number opposite
  const logo = await logoImage("#461A1C");
  if (logo) {
    const h = 18;
    doc.addImage(logo.data, "JPEG", M, y - 2, h * logo.ratio, h, undefined, "FAST");
  } else {
    doc.setFont("times", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...WINE);
    doc.text(pdfText(BUSINESS.name), M, y + 10);
  }
  doc.setFont("times", "normal");
  doc.setFontSize(22);
  doc.setTextColor(...WINE);
  doc.text(quote ? "The Beauty Proposal" : "Invoice", R, y + 6, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SOFT);
  doc.text(d.number, R, y + 12, { align: "right" });
  doc.text(formatDateLong(d.issueDate), R, y + 16.5, { align: "right" });

  y += 36;

  // From / For
  const colB = W / 2 + 4;
  doc.setFontSize(8.5);
  doc.setTextColor(...GILT);
  doc.text("From", M, y);
  doc.text(quote ? "Prepared for" : "Billed to", colB, y);
  y += 5.5;

  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  doc.text(pdfText(BUSINESS.name), M, y);
  doc.text(pdfText(d.clientName || "Client"), colB, y);
  doc.setFontSize(9);
  doc.setTextColor(...SOFT);

  const fromLines = [
    ...BUSINESS.addressLines,
    BUSINESS.phone,
    BUSINESS.email,
    BUSINESS.instagram,
    BUSINESS.gstin ? `GSTIN ${BUSINESS.gstin}` : "",
  ].filter(Boolean);

  let yA = y + 5;
  for (const line of fromLines) {
    const wrapped = doc.splitTextToSize(pdfText(line), W / 2 - M - 6);
    doc.text(wrapped, M, yA);
    yA += 4.4 * wrapped.length;
  }
  let yB = y + 5;
  for (const line of d.clientLines.filter(Boolean)) {
    const wrapped = doc.splitTextToSize(pdfText(line), R - colB);
    doc.text(wrapped, colB, yB);
    yB += 4.4 * wrapped.length;
  }
  y = Math.max(yA, yB) + 12;

  // The occasion, as one quiet line (plus venue)
  if (d.occasion) {
    doc.setFontSize(8.5);
    doc.setTextColor(...GILT);
    doc.text("Occasion", M, y);
    y += 5.5;
    doc.setFontSize(10.5);
    doc.setTextColor(...INK);
    doc.text(pdfText(d.occasion), M, y);
    if (d.venue) {
      y += 5;
      doc.setFontSize(9);
      doc.setTextColor(...SOFT);
      const venue = doc.splitTextToSize(pdfText(d.venue), R - M);
      doc.text(venue, M, y);
      y += 4.4 * (venue.length - 1);
    }
    y += 14;
  }

  // Services table. Detailed columns only when the rows need them.
  const detailed = d.rows.some((r) => r.date || (r.qty ?? 1) > 1);
  const cDate = M;
  const hasDates = d.rows.some((r) => r.date);
  const cService = hasDates ? M + 24 : M;
  const cRate = R - 62;
  const cQty = R - 34;
  // Content stops above the footer; anything that doesn't fit moves to a new page.
  const BOTTOM = 266;
  const room = (need: number): boolean => {
    if (y + need <= BOTTOM) return false;
    doc.addPage();
    y = 26;
    return true;
  };
  const tableHeader = () => {
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.2);
    doc.setFontSize(8.5);
    doc.setTextColor(...GILT);
    if (detailed) {
      if (hasDates) doc.text("Date", cDate, y);
      doc.text("Rate", cRate, y, { align: "right" });
      doc.text("Qty", cQty, y, { align: "center" });
    }
    doc.text("Service", cService, y);
    doc.text("Amount", R, y, { align: "right" });
    y += 3.5;
    doc.line(M, y, R, y);
    y += 7;
    doc.setFontSize(10.5);
  };
  tableHeader();

  const serviceWidth = detailed ? cRate - cService - 22 : R - M - 40;
  for (const row of d.rows) {
    const label = doc.splitTextToSize(pdfText(row.label), serviceWidth);
    if (room(5.5 * (label.length - 1) + 10.5)) tableHeader();
    doc.setTextColor(...INK);
    if (detailed) {
      doc.setTextColor(...SOFT);
      if (row.date) doc.text(shortDate(row.date), cDate, y);
      if (row.rate != null) doc.text(money(row.rate), cRate, y, { align: "right" });
      doc.text(String(row.qty ?? 1), cQty, y, { align: "center" });
      doc.setTextColor(...INK);
    }
    doc.text(label, cService, y);
    doc.text(row.amount < 0 ? `- ${money(-row.amount)}` : money(row.amount), R, y, { align: "right" });
    y += 5.5 * (label.length - 1);
    y += 3.5;
    doc.line(M, y, R, y);
    y += 7;
  }
  if (d.rowsNote) {
    doc.setFontSize(9);
    doc.setTextColor(...SOFT);
    doc.text(pdfText(d.rowsNote), M, y - 2);
    y += 6;
  }
  y += 4;

  // Totals: right column, everything inside the margins (kept together)
  room(48 + d.extras.length * 6.5);
  const subtotal = d.rows.reduce((s, r) => s + r.amount, 0);
  const total = docTotal(d);
  const labelX = R - 70;
  const totalsTop = y;
  doc.setFontSize(10);
  doc.setTextColor(...SOFT);
  if (d.extras.length) {
    doc.text("Subtotal", labelX, y);
    doc.text(money(subtotal), R, y, { align: "right" });
    y += 6.5;
    for (const e of d.extras) {
      doc.text(pdfText(e.label), labelX, y);
      doc.text(money(e.amount), R, y, { align: "right" });
      y += 6.5;
    }
  }
  if (quote) {
    doc.setDrawColor(...WINE);
    doc.setLineWidth(0.4);
    doc.line(labelX, y - 1.5, R, y - 1.5);
    y += 6.5;
    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...WINE);
    doc.text("Total", labelX, y);
    doc.text(money(total), R, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 7;
    doc.setFontSize(9);
    doc.setTextColor(...SOFT);
    doc.text("Advance to confirm (50%)", labelX, y);
    doc.text(money(Math.round(total / 2)), R, y, { align: "right" });
  } else {
    const received = d.received ?? 0;
    const balance = total - received;
    doc.text("Total", labelX, y);
    doc.text(money(total), R, y, { align: "right" });
    y += 6.5;
    doc.text("Received", labelX, y);
    doc.text(money(received), R, y, { align: "right" });
    y += 5;
    doc.setDrawColor(...WINE);
    doc.setLineWidth(0.4);
    doc.line(labelX, y, R, y);
    y += 8;
    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...WINE);
    doc.text(balance > 0 ? "Balance due" : "Paid in full", labelX, y);
    // Paid in full shows the amount paid, not "Rs. 0", so it reads at a glance.
    doc.text(money(balance > 0 ? balance : received), R, y, { align: "right" });
    doc.setFont("helvetica", "normal");
  }

  // Left of the totals: payment method
  const paymentLines: string[] = BUSINESS.paymentLines?.length
    ? BUSINESS.paymentLines
    : BUSINESS.paymentNote
      ? [BUSINESS.paymentNote]
      : [];
  if (paymentLines.length) {
    let yP = totalsTop;
    doc.setFontSize(8.5);
    doc.setTextColor(...GILT);
    doc.text("Payment method", M, yP);
    yP += 5.5;
    doc.setFontSize(9);
    doc.setTextColor(...SOFT);
    for (const line of paymentLines) {
      const wrapped = doc.splitTextToSize(pdfText(line), labelX - M - 8);
      doc.text(wrapped, M, yP);
      yP += 4.4 * wrapped.length;
    }
    y = Math.max(y, yP);
  }

  // Notes
  const notes = d.notes.map((n) => n.trim()).filter(Boolean);
  if (notes.length) {
    y += 16;
    room(12);
    doc.setFontSize(8.5);
    doc.setTextColor(...GILT);
    doc.text("Note", M, y);
    y += 5.5;
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    for (const n of notes) {
      const wrapped = doc.splitTextToSize(pdfText(n), R - M);
      room(4.8 * wrapped.length + 1);
      doc.text(wrapped, M, y);
      y += 4.8 * wrapped.length + 1;
    }
  }

  if (quote) {
    y += 12;
    room(6);
    doc.setFontSize(9);
    doc.setTextColor(...SOFT);
    doc.text("50% advance required to confirm the booking. Advance is strictly non-refundable. Full policy overleaf.", M, y);
  }

  // Footer on every content page (+ page numbers when it runs over)
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("times", "italic");
    doc.setFontSize(11);
    doc.setTextColor(...WINE);
    doc.text(pdfText(`Thank you for choosing ${BUSINESS.name}.`), W / 2, 280, { align: "center" });
    if (pages > 1) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...SOFT);
      doc.text(`${i} / ${pages}`, R, 280, { align: "right" });
    }
  }
  doc.setPage(pages);
  doc.setFont("helvetica", "normal");

  // Page 2: policy (quotes) or advance confirmation (invoices with an advance)
  if (quote && BUSINESS.quotePolicy?.length) {
    await letterPage(doc, "Booking & payment policy", BUSINESS.quotePolicy);
  } else if (!quote && d.advance && d.advance.amount > 0) {
    const a = d.advance;
    const balance = total - (d.received ?? a.amount);
    const paras = [
      `I have received an advance payment from ${d.clientName || "the client"} for the booking on ${a.eventDates}. The total booking amount is ${money(total)}${d.extras.length ? " including travel charges" : ""}, and the advance payment of ${money(a.amount)} was received on ${formatDateLong(a.date)}${a.method ? ` via ${a.method}` : ""}.`,
      "The remaining balance is to be paid on the day of the event.",
      ...notes.map((n) => `Note: ${n}`),
    ];
    const summary = [
      `Booking date: ${a.eventDates}`,
      `Total amount: ${money(total)}`,
      `Advance received: ${money(a.amount)}`,
      `Balance payable on event day: ${money(Math.max(balance, 0))}`,
    ];
    await letterPage(doc, "Advance payment confirmation", paras, summary, "Thank you for confirming the booking.");
  }

  const safeName = (d.clientName || "client").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  const fileName = `${quote ? "Proposal" : "Invoice"}-${d.number}-${safeName}.pdf`;
  await deliver(doc.output("blob"), fileName, () => doc.save(fileName));
}

/** A letter-style second page: heading, paragraphs, signature and a faint logo. */
async function letterPage(
  doc: import("jspdf").jsPDF,
  title: string,
  paragraphs: string[],
  summary: string[] = [],
  closing = ""
): Promise<void> {
  const M = 20;
  const R = 190;
  doc.addPage();
  let y = 34;
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...WINE);
  doc.text(pdfText(title), M, y);
  y += 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  for (const p of paragraphs) {
    const wrapped = doc.splitTextToSize(pdfText(p), R - M);
    doc.text(wrapped, M, y, { lineHeightFactor: 1.5 });
    y += wrapped.length * 6.2 + 5;
  }
  if (summary.length) {
    y += 2;
    for (const s of summary) {
      doc.text(pdfText(s), M, y);
      y += 6.2;
    }
    y += 5;
  }
  if (closing) {
    doc.setFont("helvetica", "bold");
    doc.text(pdfText(closing), M, y);
    doc.setFont("helvetica", "normal");
  }

  // Signature and a faint logo
  doc.setFont("times", "italic");
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text(pdfText(BUSINESS.signature), M, 238);
  doc.setFont("helvetica", "normal");
  const faint = await logoImage("#C9BDB4");
  if (faint) {
    const h = 16;
    doc.addImage(faint.data, "JPEG", M, 252, h * faint.ratio, h, undefined, "FAST");
  }
}

const IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/**
 * iPhone: hand the PDF to the Share sheet (Save to Files, WhatsApp, Mail).
 * A plain download inside the installed app opens the PDF full-screen with no
 * way back to the app. Everywhere else, download as usual.
 */
async function deliver(blob: Blob, fileName: string, download: () => void): Promise<void> {
  const file = new File([blob], fileName, { type: "application/pdf" });
  if (IS_IOS && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // user closed the sheet
    }
  }
  download();
}
