export type WorkStatus = "WORKED" | "RESERVED";
export type PaymentStatus = "PAID" | "PENDING";

export interface WorkLog {
  id: string;
  date: string; // ISO date "YYYY-MM-DD"
  clientName: string;
  clientPhone: string; // admin only — "" for view-only devices
  altPhone: string; // alternative contact number, admin only
  work: string; // services, comma-delimited, e.g. "Signature Bridal, Saree Draping (Bridal)"
  eventType: string; // e.g. "Wedding", "Engagement" — optional, "" allowed
  location: string; // venue text or a pasted Google Maps link, "" allowed
  bridesmaids: number; // number of bridesmaids' makeups, 0 when none
  qty: number;
  price: number;
  amount: number; // qty * price, or a manually entered flat amount
  paymentStatus: PaymentStatus;
  status: WorkStatus;
  own: boolean; // true = direct client work, false = referred by another professional
  referrerName: string; // only meaningful when own is false
  startTime: string; // "HH:mm", optional, "" allowed
  endTime: string; // "HH:mm" ready-by time, optional, "" allowed
  notes: string; // shared with assistants
  privateNotes: string; // "Notes for me" — admin only, never sent to view-only devices
  paidAmount: number; // received so far; full amount once paymentStatus is PAID
  photos: BookingPhoto[]; // reference photos, removed 2 months after the work date
  createdAt: string;
  updatedAt: string;
}

export type WorkLogInput = Omit<WorkLog, "id" | "createdAt" | "updatedAt" | "photos">;

export interface BookingPhoto {
  id: string;
  path: string; // full image in storage
  thumbPath: string; // small preview in storage
}

/** Photo changes made in the booking form, applied after the booking saves. */
export interface PhotoChanges {
  add: File[];
  remove: BookingPhoto[];
}

export type Role = "owner" | "admin" | "team";

export interface Member {
  email: string;
  name: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

export interface CalendarDayData {
  status: "WORKED" | "RESERVED" | "MIXED";
  logs: WorkLog[];
}

export type CalendarData = Record<string, CalendarDayData>;
