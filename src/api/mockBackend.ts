// In-browser stand-in for apps-script/Code.gs, used when no Apps Script URL is
// configured. It mirrors the real server's rules: viewer field stripping, the
// admin PIN with lockout, idempotent writes and a data version for polling.
import type { LoginResult, LogsSnapshot, WorkLog } from "../types";
import { initialMockLogs } from "./mockData";

export const MOCK_PIN = "123456";
const MOCK_TOKEN = "mock-admin-token";
const DB_KEY = "eclat:mock-db:v2";

const PUBLIC_FIELDS: (keyof WorkLog)[] = [
  "id", "date", "clientName", "work", "eventType", "status", "startTime",
  "endTime", "notes", "location", "bridesmaids", "updatedAt",
];

interface MockDb {
  logs: WorkLog[];
  version: string;
  fails: number;
  lockUntil: number;
}

function load(): MockDb {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw) as MockDb;
  } catch {
    // fall through to a fresh dataset
  }
  return { logs: initialMockLogs, version: String(Date.now()), fails: 0, lockUntil: 0 };
}

const db = load();

function persist() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    // demo only — nothing to do
  }
}

function changed() {
  db.version = String(Date.now());
  persist();
}

function delay<T>(value: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function requireAdmin(token: string | null) {
  if (token !== MOCK_TOKEN) {
    const err = new Error("Admin PIN required") as Error & { code: string };
    err.code = "AUTH";
    throw err;
  }
}

function sortedDesc(list: WorkLog[]): WorkLog[] {
  return [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

function strip(log: WorkLog): WorkLog {
  const out: Partial<WorkLog> = {};
  for (const key of PUBLIC_FIELDS) (out as Record<string, unknown>)[key] = log[key];
  return out as WorkLog;
}

export const mockBackend = {
  async getVersion(): Promise<{ version: string }> {
    return delay({ version: db.version }, 120);
  },

  async getLogs(token: string | null): Promise<LogsSnapshot> {
    const admin = token === MOCK_TOKEN;
    const logs = sortedDesc(db.logs);
    return delay({ logs: admin ? logs : logs.map(strip), version: db.version, admin });
  },

  async login(pin: string): Promise<LoginResult> {
    const now = Date.now();
    if (db.lockUntil > now) return delay({ ok: false, lockedUntil: db.lockUntil });
    if (pin === MOCK_PIN) {
      db.fails = 0;
      db.lockUntil = 0;
      persist();
      return delay({ ok: true, token: MOCK_TOKEN });
    }
    db.fails += 1;
    const result: LoginResult = { ok: false, attemptsLeft: Math.max(3 - db.fails, 0) };
    if (db.fails >= 3) {
      db.lockUntil = now + (db.fails === 3 ? 60_000 : 300_000);
      result.lockedUntil = db.lockUntil;
    }
    persist();
    return delay(result);
  },

  async saveLog(token: string | null, log: WorkLog): Promise<WorkLog> {
    requireAdmin(token);
    const saved = { ...log, updatedAt: new Date().toISOString() };
    const idx = db.logs.findIndex((l) => l.id === log.id);
    if (idx === -1) db.logs.push(saved);
    else db.logs[idx] = saved;
    changed();
    return delay(saved);
  },

  async deleteLog(token: string | null, id: string): Promise<{ id: string }> {
    requireAdmin(token);
    db.logs = db.logs.filter((l) => l.id !== id);
    changed();
    return delay({ id });
  },
};
