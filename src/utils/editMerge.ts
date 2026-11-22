// An edit is merged onto the booking's latest saved version: only the fields
// changed in the form are written, so another device's work is never undone.
import type { WorkLog, WorkLogInput } from "../types";
import { formatCurrency, receivedOf } from "./format";

type Field = keyof WorkLogInput;

// Fields a person edits. price, qty and paymentStatus follow from amount + received.
const LABELS: Partial<Record<Field, string>> = {
  date: "Date",
  clientName: "Name",
  clientPhone: "Phone",
  altPhone: "Other phone",
  work: "Services",
  eventType: "Event",
  location: "Venue",
  bridesmaids: "Bridesmaids",
  status: "Booked / Done",
  startTime: "Start time",
  endTime: "Ready by",
  amount: "Total",
  paidAmount: "Received",
  own: "Direct / Referred",
  referrerName: "Referred by",
  notes: "Team notes",
  privateNotes: "Private notes",
};

export function changedFields(opened: WorkLogInput, now: WorkLogInput): Partial<WorkLogInput> {
  const out: Partial<WorkLogInput> = {};
  for (const key of Object.keys(now) as Field[]) {
    if (now[key] !== opened[key]) Object.assign(out, { [key]: now[key] });
  }
  return out;
}

/** The latest version with this edit's fields on top, and payment status worked out again. */
export function mergeEdit(latest: WorkLog, changes: Partial<WorkLogInput>): WorkLog {
  const next: WorkLog = { ...latest, paidAmount: receivedOf(latest), ...changes };
  next.price = next.amount / (next.qty || 1);
  if (next.amount > 0) next.paymentStatus = next.paidAmount >= next.amount ? "PAID" : "PENDING";
  return next;
}

function valueOf(log: WorkLog, key: Field) {
  return key === "paidAmount" ? receivedOf(log) : log[key];
}

export function sameBooking(a: WorkLog, b: WorkLog): boolean {
  return a.paymentStatus === b.paymentStatus && (Object.keys(LABELS) as Field[]).every((k) => valueOf(a, k) === valueOf(b, k));
}

/** What to tell someone whose booking was saved elsewhere while they edited it. */
export function changeWarning(opened: WorkLog, latest: WorkLog, changes: Partial<WorkLogInput>): string {
  const clashes = (Object.keys(LABELS) as Field[]).filter((key) => {
    if (!(key in changes)) return false;
    const theirs = valueOf(latest, key);
    return theirs !== valueOf(opened, key) && theirs !== changes[key];
  });
  const intro = "This booking was changed on another device. Nothing you typed is lost.";
  if (!clashes.length) return `${intro} Tap Save again to keep both sets of changes.`;
  const theirs = clashes.map((key) => {
    const v = valueOf(latest, key);
    const shown =
      key === "amount" || key === "paidAmount"
        ? formatCurrency(Number(v))
        : key === "own"
          ? v ? "Direct" : "Referred"
          : key === "status"
            ? v === "WORKED" ? "Done" : "Booked"
            : String(v) || "empty";
    return `${LABELS[key]}: ${shown}`;
  });
  return `${intro} They also changed ${theirs.join("; ")}. Save again to replace that with yours, or Cancel to keep theirs.`;
}
