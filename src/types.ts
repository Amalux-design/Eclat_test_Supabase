export type WorkStatus = "WORKED" | "RESERVED";
export type PaymentStatus = "PAID" | "PENDING";

export interface WorkLog {
  id: string;
  date: string; // ISO date "YYYY-MM-DD"
  clientName: string;
  clientPhone: string; // contact number, optional, "" allowed — lets the app offer a tap-to-call button
  work: string; // task/service, e.g. "Makeup", "Hair Style", "Saree Draping"
  eventType: string; // e.g. "Bridal", "Photoshoot", "Party" — optional, "" allowed
  qty: number;
  price: number;
  amount: number; // qty * price, or a manually entered flat amount
  paymentStatus: PaymentStatus;
  status: WorkStatus;
  own: boolean; // true = direct client work (no referral commission), false = work referred by another professional
  referrerName: string; // name of the referring professional, only meaningful when own is false
  startTime: string; // "HH:mm", optional, "" allowed
  endTime: string; // "HH:mm", optional, "" allowed
  notes: string;
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
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
