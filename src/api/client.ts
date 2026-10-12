import type { ApiResponse, LoginResult, LogsSnapshot, WorkLog } from "../types";
import { mockBackend } from "./mockBackend";

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL as string | undefined;
export const USING_MOCK = !APPS_SCRIPT_URL;

export class ApiError extends Error {
  code: "AUTH" | "ERROR" | "NETWORK";
  constructor(message: string, code: ApiError["code"]) {
    super(message);
    this.code = code;
  }
}

// View-only devices receive a subset of fields; fill the rest with neutral
// defaults so components never deal with undefined. Also trims date/time
// values Sheets may hand back as full ISO timestamps.
export function normalizeLog(log: Partial<WorkLog> & { id: string }): WorkLog {
  const defaults: Omit<WorkLog, "id"> = {
    date: "",
    clientName: "",
    clientPhone: "",
    altPhone: "",
    work: "",
    eventType: "",
    location: "",
    bridesmaids: 0,
    qty: 1,
    price: 0,
    amount: 0,
    paymentStatus: "PENDING",
    status: "RESERVED",
    own: true,
    referrerName: "",
    startTime: "",
    endTime: "",
    notes: "",
    privateNotes: "",
    paidAmount: 0,
    createdAt: "",
    updatedAt: "",
  };
  const merged = { ...defaults, ...log };
  return {
    ...merged,
    date: String(merged.date).slice(0, 10),
    startTime: merged.startTime ? String(merged.startTime).slice(0, 5) : "",
    endTime: merged.endTime ? String(merged.endTime).slice(0, 5) : "",
    location: String(merged.location ?? ""),
    notes: String(merged.notes ?? ""),
    bridesmaids: Number(merged.bridesmaids) || 0,
    paidAmount: Number(merged.paidAmount) || 0,
    privateNotes: String(merged.privateNotes ?? ""),
  };
}

// Everything goes out as a text/plain POST: no CORS preflight for Apps Script,
// and the admin token stays in the body instead of the URL.
async function callApi<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(APPS_SCRIPT_URL as string, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...params }),
    });
  } catch {
    throw new ApiError("No connection", "NETWORK");
  }
  if (!response.ok) throw new ApiError(`Server responded ${response.status}`, "NETWORK");

  const json = (await response.json()) as ApiResponse<T>;
  if (!json.success) {
    throw new ApiError(json.error || "Request failed", json.code === "AUTH" ? "AUTH" : "ERROR");
  }
  return json.data;
}

async function viaMock<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const code = (e as { code?: string }).code === "AUTH" ? "AUTH" : "ERROR";
    throw new ApiError(e instanceof Error ? e.message : "Request failed", code);
  }
}

export const api = {
  async getVersion(): Promise<string> {
    if (USING_MOCK) return (await mockBackend.getVersion()).version;
    return (await callApi<{ version: string }>("getVersion")).version;
  },

  async getLogs(token: string | null): Promise<LogsSnapshot> {
    const snap = USING_MOCK
      ? await viaMock(() => mockBackend.getLogs(token))
      : await callApi<LogsSnapshot>("getLogs", { token });
    return { ...snap, logs: snap.logs.map(normalizeLog) };
  },

  async login(pin: string): Promise<LoginResult> {
    if (USING_MOCK) return mockBackend.login(pin);
    return callApi<LoginResult>("login", { pin });
  },

  /** Create-or-update: the server treats a known id as an update. */
  async saveLog(token: string | null, log: WorkLog): Promise<WorkLog> {
    if (USING_MOCK) return normalizeLog(await viaMock(() => mockBackend.saveLog(token, log)));
    return normalizeLog(await callApi<WorkLog>("createLog", { ...log, token }));
  },

  async deleteLog(token: string | null, id: string): Promise<void> {
    if (USING_MOCK) {
      await viaMock(() => mockBackend.deleteLog(token, id));
      return;
    }
    await callApi("deleteLog", { id, token });
  },
};
