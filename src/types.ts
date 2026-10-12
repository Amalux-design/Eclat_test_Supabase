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
  createdAt: string;
  updatedAt: string;
}

export type WorkLogInput = Omit<WorkLog, "id" | "createdAt" | "updatedAt">;

export interface CalendarDayData {
  status: "WORKED" | "RESERVED" | "MIXED";
  logs: WorkLog[];
}

export type CalendarData = Record<string, CalendarDayData>;

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: string;
  code?: "AUTH" | "ERROR";
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface LogsSnapshot {
  logs: WorkLog[];
  version: string;
  admin: boolean;
}

export interface LoginResult {
  ok: boolean;
  token?: string;
  attemptsLeft?: number;
  lockedUntil?: number; // epoch ms
}
