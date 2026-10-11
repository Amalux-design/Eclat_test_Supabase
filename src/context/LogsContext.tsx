import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { PaymentStatus, WorkLog, WorkLogInput } from "../types";
import { api } from "../api/client";
import { readLogsCache, writeLogsCache } from "../utils/localCache";
import { monthKey } from "../utils/format";

interface LogsContextValue {
  logs: WorkLog[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  addLog: (input: WorkLogInput) => Promise<WorkLog>;
  addReservation: (input: WorkLogInput) => Promise<WorkLog>;
  editLog: (id: string, patch: Partial<WorkLogInput>) => Promise<WorkLog>;
  removeLog: (id: string) => Promise<void>;
  markPaid: (id: string) => Promise<void>;
  /** O(1) lookup: logs for one exact "YYYY-MM-DD" date. */
  logsByDate: Map<string, WorkLog[]>;
  /** O(1) lookup: logs for one "YYYY-MM" month. */
  logsByMonth: Map<string, WorkLog[]>;
}

const LogsContext = createContext<LogsContextValue | undefined>(undefined);

export function LogsProvider({ children }: { children: ReactNode }) {
  const cachedOnMount = useRef(readLogsCache());
  const [logs, setLogs] = useState<WorkLog[]>(cachedOnMount.current ?? []);
  // If we have a cached snapshot, paint it immediately (no spinner) and
  // revalidate against the API in the background — stale-while-revalidate.
  const [loading, setLoading] = useState(cachedOnMount.current === null);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (opts?: { background?: boolean }) => {
    if (!opts?.background) setLoading(true);
    setError(null);
    try {
      const data = await api.getLogs();
      setLogs(data);
      writeLogsCache(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch({ background: cachedOnMount.current !== null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addLog = useCallback(async (input: WorkLogInput) => {
    const created = await api.createLog(input);
    setLogs((prev) => {
      const next = [created, ...prev];
      writeLogsCache(next);
      return next;
    });
    return created;
  }, []);

  const addReservation = useCallback(async (input: WorkLogInput) => {
    const created = await api.createReservation(input);
    setLogs((prev) => {
      const next = [created, ...prev];
      writeLogsCache(next);
      return next;
    });
    return created;
  }, []);

  const editLog = useCallback(async (id: string, patch: Partial<WorkLogInput>) => {
    const updated = await api.updateLog(id, patch);
    setLogs((prev) => {
      const next = prev.map((l) => (l.id === id ? updated : l));
      writeLogsCache(next);
      return next;
    });
    return updated;
  }, []);

  const removeLog = useCallback(async (id: string) => {
    let prevLogs: WorkLog[] = [];
    setLogs((prev) => {
      prevLogs = prev;
      const next = prev.filter((l) => l.id !== id);
      writeLogsCache(next);
      return next;
    });
    try {
      await api.deleteLog(id);
    } catch (e) {
      setLogs(prevLogs);
      writeLogsCache(prevLogs);
      throw e;
    }
  }, []);

  const markPaid = useCallback(async (id: string) => {
    let prevLogs: WorkLog[] = [];
    setLogs((prev) => {
      prevLogs = prev;
      const next = prev.map((l) => (l.id === id ? { ...l, paymentStatus: "PAID" as PaymentStatus } : l));
      writeLogsCache(next);
      return next;
    });
    try {
      await api.updatePaymentStatus(id, "PAID");
    } catch (e) {
      setLogs(prevLogs);
      writeLogsCache(prevLogs);
      throw e;
    }
  }, []);

  // Built once per logs change, reused by every page instead of each one
  // re-scanning the full array with its own useMemo/filter pass.
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
      error,
      refetch: () => refetch(),
      addLog,
      addReservation,
      editLog,
      removeLog,
      markPaid,
      logsByDate,
      logsByMonth,
    }),
    [logs, loading, error, refetch, addLog, addReservation, editLog, removeLog, markPaid, logsByDate, logsByMonth]
  );

  return <LogsContext.Provider value={value}>{children}</LogsContext.Provider>;
}

export function useLogs(): LogsContextValue {
  const ctx = useContext(LogsContext);
  if (!ctx) throw new Error("useLogs must be used within LogsProvider");
  return ctx;
}
