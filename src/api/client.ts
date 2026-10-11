import type { ApiResponse, CalendarData, PaymentStatus, WorkLog, WorkLogInput } from "../types";
import { mockBackend } from "./mockBackend";

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL as string | undefined;
export const USING_MOCK = !APPS_SCRIPT_URL;

// Defensive normalization at the fetch boundary: Apps Script/Sheets can hand
// back date/time fields as full ISO timestamps (e.g. when a Sheet cell was
// auto-converted to a Date) instead of the plain "YYYY-MM-DD" / "HH:mm"
// strings the app expects everywhere. Trimming here means the rest of the
// app never has to worry about it, no matter what the backend sends.
function normalizeLog(log: WorkLog): WorkLog {
  return {
    ...log,
    date: String(log.date).slice(0, 10),
    startTime: log.startTime ? String(log.startTime).slice(0, 5) : "",
    endTime: log.endTime ? String(log.endTime).slice(0, 5) : "",
  };
}

function normalizeCalendarData(data: CalendarData): CalendarData {
  const result: CalendarData = {};
  for (const [date, entry] of Object.entries(data)) {
    const key = date.slice(0, 10);
    result[key] = { ...entry, logs: entry.logs.map(normalizeLog) };
  }
  return result;
}

async function callApi<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const isRead = action === "getLogs" || action === "getCalendarData";
  let response: Response;

  if (isRead) {
    const url = new URL(APPS_SCRIPT_URL as string);
    url.searchParams.set("action", action);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }
    response = await fetch(url.toString());
  } else {
    response = await fetch(APPS_SCRIPT_URL as string, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...params }),
    });
  }

  const json = (await response.json()) as ApiResponse<T>;
  if (!json.success) {
    throw new Error(json.error || "Request failed");
  }
  return json.data;
}

export const api = {
  async getLogs(): Promise<WorkLog[]> {
    if (USING_MOCK) return mockBackend.getLogs();
    return (await callApi<WorkLog[]>("getLogs")).map(normalizeLog);
  },

  async createLog(input: WorkLogInput): Promise<WorkLog> {
    if (USING_MOCK) return mockBackend.createLog(input);
    return normalizeLog(await callApi<WorkLog>("createLog", input as unknown as Record<string, unknown>));
  },

  async updateLog(id: string, patch: Partial<WorkLogInput>): Promise<WorkLog> {
    if (USING_MOCK) return mockBackend.updateLog(id, patch);
    return normalizeLog(await callApi<WorkLog>("updateLog", { id, ...patch }));
  },

  async deleteLog(id: string): Promise<{ success: true }> {
    if (USING_MOCK) return mockBackend.deleteLog(id);
    return callApi<{ success: true }>("deleteLog", { id });
  },

  async getCalendarData(year: number, month: number): Promise<CalendarData> {
    if (USING_MOCK) return mockBackend.getCalendarData(year, month);
    return normalizeCalendarData(await callApi<CalendarData>("getCalendarData", { year, month: month + 1 }));
  },

  async createReservation(input: WorkLogInput): Promise<WorkLog> {
    if (USING_MOCK) return mockBackend.createReservation(input);
    return normalizeLog(await callApi<WorkLog>("createReservation", input as unknown as Record<string, unknown>));
  },

  async updatePaymentStatus(id: string, paymentStatus: PaymentStatus): Promise<WorkLog> {
    if (USING_MOCK) return mockBackend.updatePaymentStatus(id, paymentStatus);
    return normalizeLog(await callApi<WorkLog>("updatePaymentStatus", { id, paymentStatus }));
  },
};
