import type { CalendarData, PaymentStatus, WorkLog, WorkLogInput } from "../types";
import { generateId } from "../utils/id";
import { initialMockLogs } from "./mockData";
import { monthKey } from "../utils/format";

let logs: WorkLog[] = [...initialMockLogs];

function nowISO(): string {
  return new Date().toISOString();
}

function delay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function sortedDesc(list: WorkLog[]): WorkLog[] {
  return [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export const mockBackend = {
  async getLogs(): Promise<WorkLog[]> {
    return delay(sortedDesc(logs));
  },

  async createLog(input: WorkLogInput): Promise<WorkLog> {
    const log: WorkLog = {
      ...input,
      id: generateId(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    logs.push(log);
    return delay(log);
  },

  async updateLog(id: string, patch: Partial<WorkLogInput>): Promise<WorkLog> {
    const idx = logs.findIndex((l) => l.id === id);
    if (idx === -1) throw new Error("Log not found");
    logs[idx] = { ...logs[idx], ...patch, updatedAt: nowISO() };
    return delay(logs[idx]);
  },

  async deleteLog(id: string): Promise<{ success: true }> {
    logs = logs.filter((l) => l.id !== id);
    return delay({ success: true });
  },

  async getCalendarData(year: number, month: number): Promise<CalendarData> {
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;
    const data: CalendarData = {};
    for (const log of logs) {
      if (monthKey(log.date) !== key) continue;
      if (!data[log.date]) {
        data[log.date] = { status: log.status, logs: [] };
      }
      const entry = data[log.date];
      entry.logs.push(log);
      if (entry.status !== log.status) entry.status = "MIXED";
    }
    return delay(data);
  },

  async createReservation(input: WorkLogInput): Promise<WorkLog> {
    return this.createLog({ ...input, status: "RESERVED" });
  },

  async updatePaymentStatus(id: string, paymentStatus: PaymentStatus): Promise<WorkLog> {
    return this.updateLog(id, { paymentStatus });
  },
};
