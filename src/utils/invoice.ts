// Builds A4 invoice and quotation PDFs on the device and downloads them.
// One design for both. jsPDF is loaded only when a document is first saved,
// keeping the app light.
import type { WorkLog } from "../types";
import { withBusy } from "../components/Loader";
import { BUSINESS } from "../data/business";
import { formatDateLong, formatNumber, formatTime, receivedOf, todayISO } from "./format";
import { lineItems, type LineItem } from "./lineItems";

const WINE: [number, number, number] = [70, 26, 28];
const INK: [number, number, number] = [63, 23, 21];
const SOFT: [number, number, number] = [110, 84, 70];
const GILT: [number, number, number] = [158, 118, 80];
const RULE: [number, number, number] = [225, 210, 196];

// The PDF's built-in fonts have no ₹ glyph, so amounts are printed as "Rs.".
function money(n: number): string {
  return `Rs. ${formatNumber(n)}`;
}

// Standard PDF fonts are Latin-1: swap characters they can't draw.
function pdfText(s: string): string {
  return s.replace(/₹\s?/g, "Rs. ").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-");
}

type Doc = import("jspdf").jsPDF;
const PT = 25.4 / 72; // mm per point
const SCALE = 12; // canvas pixels per mm for text drawn as an image (~300 dpi)
/** True when every character exists in the built-in (Latin-1) PDF fonts. */
const isLatin1 = (s: string): boolean => !/[Ā-￿]/.test(s);
let measurer: CanvasRenderingContext2D | null = null;

/** The CSS font matching the PDF's current font, at canvas scale. */
function cssFont(doc: Doc): string {
  const { fontName, fontStyle } = doc.getFont();
  const italic = fontStyle.includes("italic") ? "italic " : "";
  const bold = fontStyle.includes("bold") ? "bold " : "";
  const family = fontName === "times" ? "Georgia, serif" : "Helvetica, Arial, sans-serif";
  return `${italic}${bold}${doc.getFontSize() * PT * SCALE}px ${family}`;
}

/** Gap between wrapped lines at the current size (jsPDF's own line height). */
function lineGap(doc: Doc): number {
  return doc.getFontSize() * PT * 1.15;
}

/**
 * Wrap text to a width. Latin text uses the PDF font's metrics; anything the
 * built-in fonts can't draw (Malayalam, emoji) is measured with the device
 * font, because `put` draws it as an image.
 */
function wrap(doc: Doc, text: string, width: number): string[] {
  const t = pdfText(text);
  if (isLatin1(t)) return doc.splitTextToSize(t, width);
  const ctx = (measurer ??= document.createElement("canvas").getContext("2d")!);
  ctx.font = cssFont(doc);
  const max = width * SCALE;
  const lines: string[] = [];
  for (const para of t.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > max) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

/**
 * Draw lines of text in the current font, size and colour. A line the
 * built-in (Latin-1) fonts can't draw is rendered by the device, which shapes
 * Malayalam properly, and placed as an image on the same baseline.
 */
function put(
  doc: Doc,
  lines: string | string[],
  x: number,
  y: number,
  opts: { align?: "left" | "right" | "center"; lineH?: number } = {}
): void {
  const list = (Array.isArray(lines) ? lines : [lines]).map(pdfText);
  const align = opts.align ?? "left";
  const lineH = opts.lineH ?? lineGap(doc);
  list.forEach((line, i) => {
    const yy = y + i * lineH;
    if (isLatin1(line)) {
      doc.text(line, x, yy, { align });
      return;
    }
    const font = cssFont(doc);
    const canvas = document.createElement("canvas");
    let ctx = canvas.getContext("2d")!;
    ctx.font = font;
    const m = ctx.measureText(line);
    const px = doc.getFontSize() * PT * SCALE;
    const asc = Math.ceil(Math.max(m.actualBoundingBoxAscent || 0, px));
    const desc = Math.ceil(Math.max(m.actualBoundingBoxDescent || 0, px * 0.35));
    const pad = 4;
    canvas.width = Math.ceil(m.width) + pad * 2;
    canvas.height = asc + desc + pad * 2;
    ctx = canvas.getContext("2d")!; // resizing resets the context
    ctx.font = font;
    const colour = doc.getTextColor();
    ctx.fillStyle = /^#[0-9a-f]{6}$/i.test(colour) ? colour : "#3f1715";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(line, pad, pad + asc);
    const w = canvas.width / SCALE;
    const h = canvas.height / SCALE;
    const textW = m.width / SCALE;
    const left = align === "right" ? x - textW - pad / SCALE : align === "center" ? x - w / 2 : x - pad / SCALE;
    doc.addImage(canvas.toDataURL("image/png"), "PNG", left, yy - (pad + asc) / SCALE, w, h, undefined, "FAST");
  });
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

/** One table row; the same lines the booking sheet shows (utils/lineItems). */
export type DocRow = LineItem;

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
  notes: string[];
  received?: number; // invoices: paid so far
}

/* ---------- from a saved booking (the invoice button on a card) ---------- */

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
    notes: [],
    received: receivedOf(log),
  };
}

export function saveInvoice(log: WorkLog): Promise<void> {
  return saveDocument(bookingToDoc(log));
}

/** "The Beauty Proposal" for a saved booking: same lines, policy page, 50% advance. */
export function saveQuote(log: WorkLog): Promise<void> {
  const d = bookingToDoc(log);
  return saveDocument({
    ...d,
    kind: "quote",
    number: newDocNumber("quote"),
    received: undefined,
    notes: BUSINESS.defaultNote ? [BUSINESS.defaultNote] : [],
  });
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
  // Long names wrap inside the right column instead of running off the page.
  const nameLines = wrap(doc, d.clientName || "Client", R - colB);
  const nameGap = lineGap(doc);
  put(doc, nameLines, colB, y, { lineH: nameGap });
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
  let yB = y + 5 + nameGap * (nameLines.length - 1);
  for (const line of d.clientLines.filter(Boolean)) {
    const wrapped = wrap(doc, line, R - colB);
    put(doc, wrapped, colB, yB);
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
    const occasion = wrap(doc, d.occasion, R - M);
    put(doc, occasion, M, y);
    y += lineGap(doc) * (occasion.length - 1);
    if (d.venue) {
      y += 5;
      doc.setFontSize(9);
      doc.setTextColor(...SOFT);
      const venue = wrap(doc, d.venue, R - M);
      put(doc, venue, M, y);
      y += lineGap(doc) * (venue.length - 1);
    }
    y += 14;
  }

  // Services table. Detailed columns only when the rows need them.
  const detailed = d.rows.some((r) => (r.qty ?? 1) > 1);
  const cService = M;
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
    const label = wrap(doc, row.label, serviceWidth);
    const gap = lineGap(doc);
    if (room(gap * (label.length - 1) + 10.5)) tableHeader();
    doc.setTextColor(...INK);
    if (detailed) {
      // Adjustment lines (discount, additional services) have no rate or quantity.
      doc.setTextColor(...SOFT);
      // A free line ("Included") shows no "Rs. 0" rate.
      if (row.rate) doc.text(money(row.rate), cRate, y, { align: "right" });
      if (row.qty != null) doc.text(String(row.qty), cQty, y, { align: "center" });
      doc.setTextColor(...INK);
    }
    put(doc, label, cService, y, { lineH: gap });
    // A menu item with no price (e.g. a consultation) inside an itemised table is "Included".
    const shown =
      row.qty != null && row.amount === 0 ? "Included" : row.amount < 0 ? `- ${money(-row.amount)}` : money(row.amount);
    doc.text(shown, R, y, { align: "right" });
    y += gap * (label.length - 1);
    y += 3.5;
    doc.line(M, y, R, y);
    y += 7;
  }
  if (d.rowsNote) {
    room(4);
    doc.setFontSize(9);
    doc.setTextColor(...SOFT);
    put(doc, d.rowsNote, M, y - 2);
    y += 6;
  }
  y += 4;

  // Totals: right column, everything inside the margins (kept together)
  room(48);
  const total = d.rows.reduce((s, r) => s + r.amount, 0);
  const labelX = R - 70;
  const totalsTop = y;
  doc.setFontSize(10);
  doc.setTextColor(...SOFT);
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
    // With no total set yet, money received is an advance, not a refund.
    const balance = total > 0 ? total - received : 0;
    doc.text("Total", labelX, y);
    doc.text(total > 0 ? money(total) : "To be confirmed", R, y, { align: "right" });
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
    if (total <= 0) {
      // No total yet: nothing can be "paid in full"; say what has been received.
      doc.text(received > 0 ? "Advance received" : "Total to be confirmed", labelX, y);
      if (received > 0) doc.text(money(received), R, y, { align: "right" });
    } else {
      doc.text(balance > 0 ? "Balance due" : balance < 0 ? "Refund due" : "Paid in full", labelX, y);
      // Paid in full shows the amount paid, not "Rs. 0", so it reads at a glance.
      doc.text(money(balance === 0 ? received : Math.abs(balance)), R, y, { align: "right" });
    }
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
      const wrapped = wrap(doc, n, R - M);
      room(4.8 * wrapped.length + 1);
      put(doc, wrapped, M, y);
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

  // Page 2: the booking policy (proposals)
  if (quote && BUSINESS.quotePolicy?.length) {
    await letterPage(doc, "Booking & payment policy", BUSINESS.quotePolicy);
  }

  const safeName = (d.clientName || "client").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "client";
  // A time stamp per download: phones otherwise reopen an older file with the same name.
  const now = new Date();
  const stamp = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  const fileName = `${quote ? "Proposal" : "Invoice"}-${d.number}-${safeName}-${stamp}.pdf`;
  await deliver(doc.output("blob"), fileName, () => doc.save(fileName));
}

/** A letter-style page: heading, paragraphs, signature and a faint logo. Long text continues on a new page. */
async function letterPage(doc: Doc, title: string, paragraphs: string[]): Promise<void> {
  const M = 20;
  const R = 190;
  const SIGN = 238; // signature baseline; text stops well above it
  const STOP = SIGN - 12;
  const LINE = 6.2;
  doc.addPage();
  let y = 34;
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...WINE);
  put(doc, title, M, y);
  y += 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  for (const p of paragraphs) {
    let lines = wrap(doc, p, R - M);
    while (lines.length) {
      if (y > STOP) {
        doc.addPage();
        y = 34;
      }
      const chunk = lines.slice(0, Math.floor((STOP - y) / LINE) + 1);
      put(doc, chunk, M, y, { lineH: LINE });
      y += chunk.length * LINE;
      lines = lines.slice(chunk.length);
    }
    y += 5;
  }

  // Signature and a faint logo, on the last page
  doc.setFont("times", "italic");
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  put(doc, BUSINESS.signature, M, SIGN);
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
