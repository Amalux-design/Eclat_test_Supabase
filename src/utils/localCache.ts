import type { WorkLog } from "../types";

const CACHE_KEY = "glow-diary:logs-cache:v1";

interface CachePayload {
  logs: WorkLog[];
  savedAt: number;
}

export function readLogsCache(): WorkLog[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachePayload;
    return Array.isArray(parsed.logs) ? parsed.logs : null;
  } catch {
    return null;
  }
}

export function writeLogsCache(logs: WorkLog[]): void {
  try {
    const payload: CachePayload = { logs, savedAt: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // storage full or unavailable — cache is a pure optimization, safe to skip
  }
}
