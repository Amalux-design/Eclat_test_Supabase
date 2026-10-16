import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { PhotoChanges, WorkLog, WorkLogInput } from "../types";
import { ApiError, api } from "../api/client";
import { supabase } from "../lib/supabase";
import { readLogsCache, writeLogsCache } from "../utils/localCache";
import { monthKey } from "../utils/format";
import { generateId } from "../utils/id";
import { useAuth } from "./AuthContext";
import { useNotice } from "../components/Notice";

// Online-only: each save goes straight to the database and resolves when it
// is confirmed. Other devices learn about changes instantly through Supabase
// Realtime, so there's no polling and no offline queue.

const SYNC_FIELDS: (keyof WorkLogInput)[] = [
  "date", "clientName", "clientPhone", "altPhone", "work", "eventType", "location", "bridesmaids",
  "qty", "price", "amount", "paymentStatus", "status", "own", "referrerName", "startTime", "endTime",
  "notes", "privateNotes", "paidAmount",
];

interface LogsContextValue {
  logs: WorkLog[];
  loading: boolean;
  /** True once the first load from the server has finished (success or not). */
  settled: boolean;
  error: string | null;
  /** Number of saves in flight; drives the header logo shimmer. */
  saving: number;
  refetch: () => Promise<void>;
  addLog: (input: WorkLogInput, photos?: PhotoChanges) => Promise<void>;
  editLog: (id: string, patch: Partial<WorkLogInput>, photos?: PhotoChanges) => Promise<void>;
  removeLog: (id: string) => Promise<void>;
  markPaid: (id: string) => Promise<void>;
  /** Record the total received so far; reaching the full amount marks it paid. */
  recordPayment: (id: string, received: number) => Promise<void>;
  logsByDate: Map<string, WorkLog[]>;
  logsByMonth: Map<string, WorkLog[]>;
}

const LogsContext = createContext<LogsContextValue | undefined>(undefined);

function sortDesc(list: WorkLog[]): WorkLog[] {
  return [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function LogsProvider({ children }: { children: ReactNode }) {
  const { status, isAdmin, recheck } = useAuth();
  const notify = useNotice();
  const ready = status === "ready";

  const [logs, setLogs] = useState<WorkLog[]>(() => readLogsCache(isAdmin)?.logs ?? []);
  const [loading, setLoading] = useState(() => readLogsCache(isAdmin) === null);
  const [settled, setSettled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(0);
  const logsRef = useRef(logs);
  const adminRef = useRef(isAdmin);
  useLayoutEffect(() => {
    logsRef.current = logs;
    adminRef.current = isAdmin;
  }, [logs, isAdmin]);

  const commit = useCallback((next: WorkLog[]) => {
    const sorted = sortDesc(next);
    setLogs(sorted);
    writeLogsCache(adminRef.current, sorted, "");
  }, []);

  const refetch = useCallback(async () => {
    try {
      // Re-check the role alongside every load: a removed member's rows are
      // simply filtered out by the database, so ask explicitly.
      const [data, role] = await Promise.all([api.fetchBookings(adminRef.current), api.myRole()]);
      if (!role) {
        void recheck();
        return;
      }
      commit(data);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.code === "AUTH") void recheck();
      setError(
        e instanceof ApiError && e.code === "NETWORK"
          ? "You're offline. Showing the last saved bookings."
          : e instanceof Error
            ? e.message
            : "Couldn't load bookings."
      );
    } finally {
      setLoading(false);
      setSettled(true);
    }
  }, [commit, recheck]);

  // Load when access is confirmed (and again if the role changes).
  useEffect(() => {
    if (status === "signed-out" || status === "no-access") {
      setLogs([]);
      setSettled(true);
      return;
    }
    if (!ready) return;
    const cached = readLogsCache(isAdmin);
    if (cached) setLogs(cached.logs);
    setLoading(cached === null);
    void refetch();
  }, [status, ready, isAdmin, refetch]);

  // Live updates: any change to bookings, private details or photos refreshes
  // the list (debounced, so a burst of changes means one reload).
  useEffect(() => {
    if (!ready) return;
    let timer: number | undefined;
    const soon = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void refetch(), 350);
    };
    const channel = supabase
      .channel("bookings-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "booking_photos" }, soon);
    if (isAdmin) channel.on("postgres_changes", { event: "*", schema: "public", table: "booking_private" }, soon);
    // Own membership row changed (removed, restored, role switched): re-check
    // access at once, so a removed person is locked out without a refresh.
    channel.on("postgres_changes", { event: "*", schema: "public", table: "members" }, () => void recheck());
    channel.subscribe();
    // Catch up after the phone wakes or the app returns to the foreground.
    const onVisible = () => document.visibilityState === "visible" && soon();
    document.addEventListener("visibilitychange", onVisible);
    // Backstop if the live connection drops: re-check every minute.
    const heartbeat = window.setInterval(() => document.visibilityState === "visible" && soon(), 60 * 1000);
    return () => {
      window.clearInterval(heartbeat);
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [ready, isAdmin, refetch, recheck]);

  // Reference photos are removed 2 months after the work date. Admin devices
  // run the sweep at most once a day; the team has no delete permission.
  useEffect(() => {
    if (!ready || !isAdmin) return;
    const KEY = "eclat:photo-sweep";
    const today = new Date().toISOString().slice(0, 10);
    try {
      if (localStorage.getItem(KEY) === today) return;
    } catch {
      // storage unavailable: just run it
    }
    void api
      .cleanupExpiredPhotos()
      .then((n) => {
        try {
          localStorage.setItem(KEY, today);
        } catch {
          // ignore
        }
        if (n > 0) void refetch();
      })
      .catch((e) => console.warn("Photo clean-up skipped:", e));
  }, [ready, isAdmin, refetch, recheck]);

  /** Run a write; on failure, explain it and re-sync where that helps. */
  const run = useCallback(
    async <T,>(work: () => Promise<T>, onConflict?: () => Promise<boolean>): Promise<T | undefined> => {
      setSaving((n) => n + 1);
      try {
        return await work();
      } catch (e) {
        const err = e instanceof ApiError ? e : new ApiError(e instanceof Error ? e.message : "Something went wrong.", "ERROR");
        if (err.code === "CONFLICT") {
          // A retried save whose first attempt already landed is not a conflict.
          if (onConflict && (await onConflict())) return undefined;
          notify("This booking was changed on another device. Your edit wasn't saved. Please check and edit again.", "error");
          await refetch();
          return undefined;
        }
        if (err.code === "NOT_FOUND") {
          notify("This booking was deleted on another device.", "error");
          await refetch();
          return undefined;
        }
        if (err.code === "AUTH") {
          void recheck();
        }
        console.error("Save failed:", err);
        throw err; // NETWORK / VALIDATION / AUTH / ERROR: the form stays open with the message
      } finally {
        setSaving((n) => n - 1);
      }
    },
    [notify, refetch, recheck]
  );

  const applyPhotos = useCallback(async (id: string, date: string, photos?: PhotoChanges) => {
    if (!photos) return;
    if (photos.remove.length) await api.removePhotos(photos.remove);
    if (photos.add.length) await api.addPhotos(id, date, photos.add);
  }, []);

  const addLog = useCallback(
    async (input: WorkLogInput, photos?: PhotoChanges) => {
      const id = generateId();
      await run(async () => {
        await api.saveBooking({ ...input, id }, null);
        await applyPhotos(id, input.date, photos);
        await refetch();
      });
    },
    [run, applyPhotos, refetch]
  );

  const editLog = useCallback(
    async (id: string, patch: Partial<WorkLogInput>, photos?: PhotoChanges) => {
      const current = logsRef.current.find((l) => l.id === id);
      if (!current) return;
      const next: WorkLog = { ...current, ...patch };
      await run(
        async () => {
          await api.saveBooking(next, current.updatedAt);
          await applyPhotos(id, next.date, photos);
          await refetch();
        },
        // Conflict check: if the server already holds exactly these values
        // (a repeated tap after a lost reply), treat it as saved.
        async () => {
          const server = await api.fetchBooking(id, adminRef.current);
          if (!server) return false;
          const same = SYNC_FIELDS.every((f) => String(server[f]) === String(next[f]));
          if (same) {
            await applyPhotos(id, next.date, photos);
            await refetch();
          }
          return same;
        }
      );
    },
    [run, applyPhotos, refetch]
  );

  const removeLog = useCallback(
    async (id: string) => {
      const current = logsRef.current.find((l) => l.id === id);
      if (!current) return;
      await run(async () => {
        await api.deleteBooking(current);
        commit(logsRef.current.filter((l) => l.id !== id));
      });
    },
    [run, commit]
  );

  const markPaid = useCallback(
    async (id: string) => {
      const current = logsRef.current.find((l) => l.id === id);
      if (!current) return;
      await editLog(id, { paymentStatus: "PAID", paidAmount: current.amount });
    },
    [editLog]
  );

  const recordPayment = useCallback(
    async (id: string, received: number) => {
      const current = logsRef.current.find((l) => l.id === id);
      if (!current) return;
      const paid = Math.max(0, Math.min(received, current.amount));
      await editLog(id, {
        paidAmount: paid,
        paymentStatus: paid >= current.amount && current.amount > 0 ? "PAID" : "PENDING",
      });
    },
    [editLog]
  );

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
      saving,
      refetch,
      addLog,
      editLog,
      removeLog,
      markPaid,
      recordPayment,
      logsByDate,
      logsByMonth,
    }),
    [logs, loading, settled, error, saving, refetch, addLog, editLog, removeLog, markPaid, recordPayment, logsByDate, logsByMonth]
  );

  return <LogsContext.Provider value={value}>{children}</LogsContext.Provider>;
}

export function useLogs(): LogsContextValue {
  const ctx = useContext(LogsContext);
  if (!ctx) throw new Error("useLogs must be used within LogsProvider");
  return ctx;
}
