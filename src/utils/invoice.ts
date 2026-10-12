// Builds a one-page A4 invoice PDF on the device and downloads it.
// jsPDF is loaded only when an invoice is first saved, keeping the app light.
import type { WorkLog } from "../types";
import { withBusy } from "../components/Loader";
import { BUSINESS } from "../data/business";
import { servicePrice } from "../data/services";
import { formatDateLong, formatTime, parseWorks, receivedOf, todayISO } from "./format";

const WINE: [number, number, number] = [70, 26, 28];
const INK: [number, number, number] = [63, 23, 21];
const SOFT: [number, number, number] = [110, 84, 70];
const GILT: [number, number, number] = [158, 118, 80];

// The PDF's built-in fonts have no ₹ glyph, so amounts are printed as "Rs.".
function money(n: number): string {
  return `Rs. ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n)}`;
}

// Standard PDF fonts are Latin-1: swap characters they can't draw.
function pdfText(s: string): string {
  return s.replace(/₹/g, "Rs. ").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-");
}

export function invoiceNumber(log: WorkLog): string {
  return `${BUSINESS.invoicePrefix}-${log.date.replace(/-/g, "")}-${log.id.replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase()}`;
}

/** Render the header logo SVG to a PNG the PDF can embed, tinted wine. */
async function logoPng(): Promise<{ data: string; ratio: number } | null> {
  try {
    const svg = await (await fetch("/logo.svg")).text();
    const tinted = svg.replace(/fill="#000(000)?"/g, 'fill="#461A1C"');
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

interface Line {
  label: string;
  amount: number;
}

/** Menu prices per service; any difference from the booked total becomes one adjustment line. */
function lineItems(log: WorkLog): Line[] {
  const services = parseWorks(log.work);
  const priced = services.map((s) => ({ label: s, amount: servicePrice(s) ?? 0 }));
  const menuTotal = priced.reduce((sum, l) => sum + l.amount, 0);
  if (services.length === 1 || menuTotal === 0) {
    return services.length === 1
      ? [{ label: services[0], amount: log.amount }]
      : [{ label: services.join(", ") || "Makeup services", amount: log.amount }];
  }
  const diff = log.amount - menuTotal;
  if (diff !== 0) priced.push({ label: diff > 0 ? "Additional services" : "Discount", amount: diff });
  return priced;
}

export function saveInvoice(log: WorkLog): Promise<void> {
  return withBusy("Preparing invoice", () => buildInvoice(log));
}

async function buildInvoice(log: WorkLog): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const W = 210;
  const M = 20;
  const R = W - M; // right edge of the text column
  let y = 22;

  // Logo, with "Invoice" and its number opposite
  const logo = await logoPng();
  if (logo) {
    const h = 18;
    doc.addImage(logo.data, "JPEG", M, y - 2, h * logo.ratio, h, undefined, "FAST");
  } else {
    doc.setFont("times", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...WINE);
    doc.text("Éclat by Harsha", M, y + 10);
  }
  doc.setFont("times", "normal");
  doc.setFontSize(22);
  doc.setTextColor(...WINE);
  doc.text("Invoice", R, y + 6, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SOFT);
  doc.text(invoiceNumber(log), R, y + 12, { align: "right" });
  doc.text(formatDateLong(todayISO()), R, y + 16.5, { align: "right" });

  y += 36;

  // From / Billed to
  const colB = W / 2 + 4;
  doc.setFontSize(8.5);
  doc.setTextColor(...GILT);
  doc.text("From", M, y);
  doc.text("Billed to", colB, y);
  y += 5.5;

  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  doc.text(pdfText(BUSINESS.name), M, y);
  doc.text(pdfText(log.clientName || "Client"), colB, y);
  doc.setFontSize(9);
  doc.setTextColor(...SOFT);

  const fromLines = [
    ...BUSINESS.addressLines,
    BUSINESS.phone,
    BUSINESS.email,
    BUSINESS.instagram,
    BUSINESS.gstin ? `GSTIN ${BUSINESS.gstin}` : "",
  ].filter(Boolean);
  const toLines = [log.clientPhone, log.altPhone].filter(Boolean);

  let yA = y + 5;
  for (const line of fromLines) {
    const wrapped = doc.splitTextToSize(pdfText(line), W / 2 - M - 6);
    doc.text(wrapped, M, yA);
    yA += 4.4 * wrapped.length;
  }
  let yB = y + 5;
  for (const line of toLines) {
    doc.text(pdfText(line), colB, yB);
    yB += 4.4;
  }
  y = Math.max(yA, yB) + 12;

  // The occasion, as one quiet line (plus venue)
  doc.setFontSize(8.5);
  doc.setTextColor(...GILT);
  doc.text("Occasion", M, y);
  y += 5.5;
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  const occasion = [log.eventType || "Makeup", formatDateLong(log.date), log.startTime ? formatTime(log.startTime) : ""]
    .filter(Boolean)
    .join(", ");
  doc.text(pdfText(occasion), M, y);
  if (log.location) {
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(...SOFT);
    const venue = doc.splitTextToSize(pdfText(log.location), R - M);
    doc.text(venue, M, y);
    y += 4.4 * (venue.length - 1);
  }
  y += 14;

  // Services
  doc.setDrawColor(225, 210, 196);
  doc.setLineWidth(0.2);
  doc.setFontSize(8.5);
  doc.setTextColor(...GILT);
  doc.text("Service", M, y);
  doc.text("Amount", R, y, { align: "right" });
  y += 3.5;
  doc.line(M, y, R, y);
  y += 7;

  doc.setFontSize(10.5);
  for (const item of lineItems(log)) {
    doc.setTextColor(...INK);
    const label = doc.splitTextToSize(pdfText(item.label), R - M - 40);
    doc.text(label, M, y);
    doc.text(item.amount < 0 ? `- ${money(-item.amount)}` : money(item.amount), R, y, { align: "right" });
    y += 5.5 * (label.length - 1);
    y += 3.5;
    doc.line(M, y, R, y);
    y += 7;
  }
  if (log.bridesmaids > 0) {
    doc.setFontSize(9);
    doc.setTextColor(...SOFT);
    doc.text(`Includes makeup for ${log.bridesmaids} bridesmaid${log.bridesmaids > 1 ? "s" : ""}`, M, y - 2);
    y += 6;
  }
  y += 4;

  // Totals: right column, everything inside the margins
  const received = receivedOf(log);
  const balance = log.amount - received;
  const labelX = R - 70;
  doc.setFontSize(10);
  doc.setTextColor(...SOFT);
  doc.text("Total", labelX, y);
  doc.text(money(log.amount), R, y, { align: "right" });
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
  doc.text(money(Math.max(balance, 0)), R, y, { align: "right" });
  doc.setFont("helvetica", "normal");

  if (BUSINESS.paymentNote) {
    y += 16;
    doc.setFontSize(9);
    doc.setTextColor(...SOFT);
    doc.text(doc.splitTextToSize(pdfText(`Payment: ${BUSINESS.paymentNote}`), R - M), M, y);
  }

  // Footer
  doc.setFont("times", "italic");
  doc.setFontSize(11);
  doc.setTextColor(...WINE);
  doc.text("Thank you for choosing Éclat by Harsha.", W / 2, 280, { align: "center" });

  const safeName = (log.clientName || "client").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  doc.save(`Invoice-${invoiceNumber(log)}-${safeName}.pdf`);
}
