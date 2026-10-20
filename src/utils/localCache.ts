import type { WorkLog } from "../types";

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

/** Sign-out: remove every cached booking list (admin and team) from this device. */
export function clearAllCaches(): void {
  try {
    localStorage.removeItem(cacheKey(true));
    localStorage.removeItem(cacheKey(false));
  } catch {
    // nothing to clear
  }
}
