import type { Role, WorkLog } from "../types";

// Last known logs, painted instantly on launch while a fresh copy loads.
// Kept per role so a full admin snapshot is never shown in view-only mode.
// localStorage (sync) rather than IndexedDB so the first frame already has data.
const cacheKey = (admin: boolean) => `eclat:logs-cache:${admin ? "admin" : "viewer"}:v1`;

interface CachePayload {
  logs: WorkLog[];
  version: string;
}

export function readLogsCache(admin: boolean): CachePayload | null {
  try {
    const raw = localStorage.getItem(cacheKey(admin));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachePayload;
    return Array.isArray(parsed.logs) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeLogsCache(admin: boolean, logs: WorkLog[], version: string): void {
  try {
    localStorage.setItem(cacheKey(admin), JSON.stringify({ logs, version }));
  } catch {
    // storage full or unavailable — cache is a pure optimization
  }
}

const ACCESS_KEY = "eclat:last-access:v1";

/** The last access the database confirmed. Only for display when the check can't be reached. */
export interface LastAccess {
  userId: string;
  role: Role;
  name: string;
}

export function readLastAccess(): LastAccess | null {
  try {
    return JSON.parse(localStorage.getItem(ACCESS_KEY) ?? "null") as LastAccess | null;
  } catch {
    return null;
  }
}

export function writeLastAccess(access: LastAccess | null): void {
  try {
    if (access) localStorage.setItem(ACCESS_KEY, JSON.stringify(access));
    else localStorage.removeItem(ACCESS_KEY);
  } catch {
    // storage unavailable: remembered for this session only
  }
}

/** Sign-out: remove every cached booking list (admin and team) from this device. */
export function clearAllCaches(): void {
  try {
    localStorage.removeItem(cacheKey(true));
    localStorage.removeItem(cacheKey(false));
    localStorage.removeItem(ACCESS_KEY);
  } catch {
    // nothing to clear
  }
}
