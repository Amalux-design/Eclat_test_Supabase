import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import type { WorkLog, WorkLogInput } from "../types";
import { ApiError, api } from "../api/client";
import { readLogsCache, writeLogsCache } from "../utils/localCache";
import { monthKey } from "../utils/format";
import { generateId } from "../utils/id";
import { applyOps, saveQueue } from "../sync/saveQueue";
import type { SyncStatus } from "../sync/saveQueue";
import { useAuth } from "./AuthContext";

// How often open devices check for changes. Each check is a tiny version
// call; the full list is only downloaded when something actually changed.
export const POLL_INTERVAL_MS = 2 * 60 * 1000;
const MAX_POLL_INTERVAL_MS = 8 * 60 * 1000;

interface LogsContextValue {
  logs: WorkLog[];
  loading: boolean;
  /** True once the first network fetch has finished (succeeded or failed). */
  settled: boolean;
  error: string | null;
  sync: SyncStatus;
  refetch: () => Promise<void>;
  addLog: (input: WorkLogInput) => WorkLog;
  editLog: (id: string, patch: Partial<WorkLogInput>) => void;
  removeLog: (id: string) => void;
  markPaid: (id: string) => void;
  /** Record the total received so far; reaching the full amount marks it paid. */
  recordPayment: (id: string, received: number) => void;
  /** O(1) lookup: logs for one exact "YYYY-MM-DD" date. */
  logsByDate: Map<string, WorkLog[]>;
  /** O(1) lookup: logs for one "YYYY-MM" month. */
  logsByMonth: Map<string, WorkLog[]>;
}

const LogsContext = createContext<LogsContextValue | undefined>(undefined);

export function LogsProvider({ children }: { children: ReactNode }) {
  const { token, isAdmin, lock } = useAuth();
  const tokenRef = useRef(token);
  useLayoutEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const [serverLogs, setServerLogs] = useState<WorkLog[]>(() => readLogsCache(isAdmin)?.logs ?? []);
  const versionRef = useRef<string>(readLogsCache(isAdmin)?.version ?? "");
  const [loading, setLoading] = useState(() => readLogsCache(isAdmin) === null);
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);

  const queue = useSyncExternalStore(saveQueue.subscribe, saveQueue.getSnapshot);

  const refetch = useCallback(async () => {
    const requestedAs = tokenRef.current;
    try {
      const snap = await api.getLogs(requestedAs);
      if (tokenRef.current !== requestedAs) return; // role changed mid-request
      if (requestedAs && !snap.admin) {
        // PIN was changed on the server — this device is no longer admin.
        lock();
        return;
      }
      versionRef.current = snap.version;
      setServerLogs(snap.logs);
      writeLogsCache(snap.admin, snap.logs, snap.version);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError && e.code === "NETWORK" ? "You're offline. Showing the last saved bookings." : e instanceof Error ? e.message : "Couldn't load bookings.");
      throw e;
    } finally {
      setLoading(false);
      setSettled(true);
    }
  }, [lock]);

  // Switching role: show that role's cached copy at once, then refresh.
  useEffect(() => {
    const cached = readLogsCache(isAdmin);
    setServerLogs(cached?.logs ?? []);
    versionRef.current = cached?.version ?? "";
    setLoading(cached === null);
    refetch().catch(() => {});
  }, [isAdmin, refetch]);

  useEffect(() => {
    saveQueue.configure({
      getToken: () => tokenRef.current,
      onAuthLost: lock,
      // Once everything is saved, pull the server's copy so the cache and
      // version match what assistants will see.
      onSettled: () => void refetch().catch(() => {}),
    });
    if (token) saveQueue.flushNow();
  }, [token, lock, refetch]);

  // Background polling: version check every 2 min while the app is visible,
  // backing off to 8 min on errors; immediate check when the app comes back.
  useEffect(() => {
    let interval = POLL_INTERVAL_MS;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    async function check() {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        const version = await api.getVersion();
        if (version !== versionRef.current) await refetch();
        interval = POLL_INTERVAL_MS;
      } catch {
        interval = Math.min(interval * 2, MAX_POLL_INTERVAL_MS);
      }
      schedule();
    }

    function schedule() {
      if (timer) clearTimeout(timer);
      if (!cancelled && document.visibilityState === "visible") timer = setTimeout(check, interval);
    }

    function onVisibility() {
      if (document.visibilityState === "visible") void check();
      else if (timer) clearTimeout(timer);
    }

    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refetch]);

  const logs = useMemo(
    () => (isAdmin ? applyOps(serverLogs, queue.ops) : serverLogs),
    [isAdmin, serverLogs, queue.ops]
  );
  const logsRef = useRef(logs);
  useLayoutEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  const addLog = useCallback((input: WorkLogInput) => {
    const now = new Date().toISOString();
    const log: WorkLog = { ...input, id: generateId(), createdAt: now, updatedAt: now };
    saveQueue.enqueue({ kind: "save", id: log.id, log });
    return log;
  }, []);

  const editLog = useCallback((id: string, patch: Partial<WorkLogInput>) => {
    const current = logsRef.current.find((l) => l.id === id);
    if (!current) return;
    const log = { ...current, ...patch, updatedAt: new Date().toISOString() };
    saveQueue.enqueue({ kind: "save", id, log });
  }, []);

  const removeLog = useCallback((id: string) => {
    saveQueue.enqueue({ kind: "delete", id });
  }, []);

  const markPaid = useCallback(
    (id: string) => {
      const current = logsRef.current.find((l) => l.id === id);
      editLog(id, { paymentStatus: "PAID", paidAmount: current?.amount ?? 0 });
    },
    [editLog]
  );

  const recordPayment = useCallback(
    (id: string, received: number) => {
      const current = logsRef.current.find((l) => l.id === id);
      if (!current) return;
      const paid = Math.max(0, Math.min(received, current.amount));
      editLog(id, { paidAmount: paid, paymentStatus: paid >= current.amount && current.amount > 0 ? "PAID" : "PENDING" });
    },
    [editLog]
  );

  // Built once per logs change, reused by every page.
  const logsByDate = useMemo(() => {
    const map = new Map<string, WorkLog[]>();
    for (const log of logs) {
      const bucket = map.get(log.date);
      if (bucket) bucket.push(log);
      else map.set(log.date, [log]);
    }
    return map;
  }, [logs]);

  const logsByMonth = useMemo(() => {
    const map = new Map<string, WorkLog[]>();
    for (const log of logs) {
      const key = monthKey(log.date);
      const bucket = map.get(key);
      if (bucket) bucket.push(log);
      else map.set(key, [log]);
    }
    return map;
  }, [logs]);

  const value = useMemo(
    () => ({
      logs,
      loading,
      settled,
      error,
      sync: queue.status,
      refetch: () => refetch().catch(() => {}),
      addLog,
      editLog,
      removeLog,
      markPaid,
      recordPayment,
      logsByDate,
      logsByMonth,
    }),
    [logs, loading, settled, error, queue.status, refetch, addLog, editLog, removeLog, markPaid, recordPayment, logsByDate, logsByMonth]
  );

  return <LogsContext.Provider value={value}>{children}</LogsContext.Provider>;
}

export function useLogs(): LogsContextValue {
  const ctx = useContext(LogsContext);
  if (!ctx) throw new Error("useLogs must be used within LogsProvider");
  return ctx;
}
