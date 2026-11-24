import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { PhotoChanges, WorkLog, WorkLogInput } from "../types";
import { ApiError, api } from "../api/client";
import { supabase } from "../lib/supabase";
import { readLastAccess, readLogsCache, writeLogsCache } from "../utils/localCache";
import { monthKey, receivedOf } from "../utils/format";
import { changeWarning, mergeEdit, sameBooking } from "../utils/editMerge";
import { useAuth } from "./AuthContext";

// Online-only: each save goes straight to the database and resolves when it
// is confirmed. Other devices learn about changes instantly through Supabase
// Realtime, so there's no polling and no offline queue.

/** An open edit form: the version it started from, and an id that is new each time a form opens. */
interface EditForm {
  id: string;
  opened: WorkLog;
}

interface LogsContextValue {
  logs: WorkLog[];
  loading: boolean;
  /** True once the first load from the server has finished (success or not). */
  settled: boolean;
  error: string | null;
  /** Number of saves in flight; drives the header logo shimmer. */
  saving: number;
  refetch: () => Promise<void>;
  /** `id` comes from the form, so retrying a save can't create a second booking. */
  addLog: (input: WorkLogInput, photos: PhotoChanges, id: string) => Promise<void>;
  editLog: (id: string, patch: Partial<WorkLogInput>, photos?: PhotoChanges, form?: EditForm) => Promise<void>;
  removeLog: (id: string) => Promise<void>;
  /**
   * Set the total received, starting from the booking as the person saw it. If its money
   * changed since (an earlier tap, a lost reply, another device) nothing is saved and the
   * booking as it now stands is returned, so the person can be asked.
   */
  recordPayment: (seen: WorkLog, received: number) => Promise<WorkLog | null>;
  logsByDate: Map<string, WorkLog[]>;
  logsByMonth: Map<string, WorkLog[]>;
}

const LogsContext = createContext<LogsContextValue | undefined>(undefined);

function sortDesc(list: WorkLog[]): WorkLog[] {
  return [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function LogsProvider({ children }: { children: ReactNode }) {
  const { status, role, isAdmin, recheck, userId } = useAuth();
  const ready = status === "ready";

  // First paint, before the login is known: only the copy of the person who used this device last.
  const [logs, setLogs] = useState<WorkLog[]>(() => readLogsCache(isAdmin, userId ?? readLastAccess()?.userId)?.logs ?? []);
  const [loading, setLoading] = useState(() => readLogsCache(isAdmin, userId ?? readLastAccess()?.userId) === null);
  const [settled, setSettled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(0);
  const logsRef = useRef(logs);
  const adminRef = useRef(isAdmin);
  const roleRef = useRef(role);
  const ownerRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    logsRef.current = logs;
    adminRef.current = isAdmin;
    roleRef.current = role;
    // Only a confirmed, signed-in person's list is ever saved on the device.
    ownerRef.current = status === "ready" ? userId : null;
  }, [logs, isAdmin, role, status, userId]);

  const commit = useCallback((next: WorkLog[]) => {
    const sorted = sortDesc(next);
    setLogs(sorted);
    if (ownerRef.current) writeLogsCache(adminRef.current, ownerRef.current, sorted, "");
  }, []);

  // Numbered loads: a slow, older reply never replaces a newer list.
  const loadsRef = useRef({ started: 0, shown: 0 });
  const refetch = useCallback(async () => {
    const load = ++loadsRef.current.started;
    try {
      // Re-check the role alongside every load: a removed member's rows are
      // simply filtered out by the database, so ask explicitly.
      const asAdmin = adminRef.current;
      const [data, current] = await Promise.all([api.fetchBookings(asAdmin), api.myRole()]);
      if (!current) {
        void recheck();
        return;
      }
      if (load < loadsRef.current.shown) return;
      if (current !== roleRef.current) {
        void recheck();
        // This list was fetched for the wrong view; the access change loads the right one.
        if ((current !== "team") !== asAdmin) return;
      }
      loadsRef.current.shown = load;
      commit(data);
      setError(null);
    } catch (e) {
      if (load < loadsRef.current.shown) return;
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
    loadsRef.current.shown = ++loadsRef.current.started; // replies from before this access change are void
    if (status === "signed-out" || status === "no-access") {
      setLogs([]);
      setSettled(true);
      return;
    }
    if (!ready) return;
    const cached = readLogsCache(isAdmin, userId);
    if (cached) setLogs(cached.logs);
    setLoading(cached === null);
    void refetch();
  }, [status, ready, isAdmin, userId, refetch]);

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

  /** Run a write. Failures always reject, so the form stays open with the message. */
  const run = useCallback(
    async <T,>(work: () => Promise<T>): Promise<T> => {
      setSaving((n) => n + 1);
      try {
        return await work();
      } catch (e) {
        const err = e instanceof ApiError ? e : new ApiError(e instanceof Error ? e.message : "Something went wrong.", "ERROR");
        if (err.code === "CONFLICT" || err.code === "NOT_FOUND") {
          void refetch();
          throw err;
        }
        if (err.code === "AUTH") {
          void recheck();
        }
        console.error("Save failed:", err);
        throw err;
      } finally {
        setSaving((n) => n - 1);
      }
    },
    [refetch, recheck]
  );

  const applyPhotos = useCallback(async (id: string, date: string, photos?: PhotoChanges) => {
    if (!photos) return;
    if (photos.remove.length) await api.removePhotos(photos.remove);
    if (photos.add.length) await api.addPhotos(id, date, photos.add);
  }, []);

  /** After the booking itself is saved: photos, then the fresh list. */
  const finishSave = useCallback(
    async (id: string, date: string, photos?: PhotoChanges) => {
      try {
        await applyPhotos(id, date, photos);
      } catch (e) {
        void refetch();
        console.warn("Photo save failed:", e);
        throw new ApiError("Booking saved, but the photo changes didn't finish. Tap Save to try again, or remove the new photo.", "ERROR");
      }
      await refetch();
    },
    [applyPhotos, refetch]
  );

  /** Show a confirmed save at once: the reload that follows can fail, and older loads are now out of date. */
  const showSaved = useCallback(
    (saved: WorkLog) => {
      loadsRef.current.shown = ++loadsRef.current.started;
      if (!adminRef.current) return; // signed out or no longer admin while saving
      commit([saved, ...logsRef.current.filter((l) => l.id !== saved.id)]);
    },
    [commit]
  );

  const addLog = useCallback(
    async (input: WorkLogInput, photos: PhotoChanges, id: string) => {
      await run(async () => {
        const savedAt = await api.saveBooking({ ...input, id }, null);
        const shown = logsRef.current.find((l) => l.id === id);
        showSaved({ ...input, id, photos: shown?.photos ?? [], createdAt: shown?.createdAt ?? savedAt, updatedAt: savedAt });
        await finishSave(id, input.date, photos);
      });
    },
    [run, finishSave, showSaved]
  );

  // Per open form (by its id, never by booking: reopening must start clean): the newest
  // version it has been warned about or saved itself, and the fields it has written.
  // `attempt` is the whole booking this form last sent, recorded before sending, so a lost
  // reply can still be recognised as this form's own write (and undone if asked).
  const editsRef = useRef(
    new Map<string, { seen: string; written: (keyof WorkLogInput)[]; attempt?: WorkLog }>()
  );

  /** The latest saved booking for a change: always with contacts and money, which only
   *  admins can read. Never save from a copy without them (an out-of-date role). */
  const latestToChange = useCallback(async (id: string) => {
    const latest = await api.fetchBooking(id, true);
    if (latest && !latest.hasPrivate) {
      const role = await api.myRole();
      if (role !== "owner" && role !== "admin") {
        void recheck();
        throw new ApiError("Your access has changed, so this wasn't saved. The app will refresh.", "AUTH");
      }
    }
    return latest;
  }, [recheck]);

  const editLog = useCallback(
    async (id: string, patch: Partial<WorkLogInput>, photos?: PhotoChanges, form?: EditForm) => {
      await run(async () => {
        const from = form?.opened ?? logsRef.current.find((l) => l.id === id);
        const latest = from && (await latestToChange(id));
        if (!from || !latest) {
          throw new ApiError("This booking was deleted on another device. Copy anything you need, then close it.", "NOT_FOUND");
        }
        // Only a form can acknowledge a warning; a quick payment always starts from the latest total.
        const edit = form && editsRef.current.get(form.id);
        // The server still holds exactly what this form sent last time (its reply was lost):
        // that is this form's own write, not another device's.
        const ours = !!edit?.attempt && sameBooking(latest, edit.attempt);
        // A field this form wrote before and has since put back is put back on the server too,
        // but only while the server still holds this form's value (never undo someone else).
        const changes: Partial<WorkLogInput> = {};
        for (const key of edit?.written ?? []) {
          if (key in patch) continue;
          const mine = edit?.attempt && (key === "paidAmount" ? receivedOf(edit.attempt) : edit.attempt[key]);
          const there = key === "paidAmount" ? receivedOf(latest) : latest[key];
          if (ours || there === mine) Object.assign(changes, { [key]: key === "paidAmount" ? receivedOf(from) : from[key] });
        }
        Object.assign(changes, patch);

        const next = mergeEdit(latest, changes);
        // Already holds exactly these values: a repeated tap after a lost reply.
        const landed = Object.keys(changes).length > 0 && sameBooking(latest, next);
        if (!landed && !ours && latest.updatedAt !== from.updatedAt && latest.updatedAt !== edit?.seen) {
          if (form) editsRef.current.set(form.id, { ...edit, seen: latest.updatedAt, written: edit?.written ?? [] });
          throw new ApiError(changeWarning(from, latest, changes), "CONFLICT");
        }
        const written = [...new Set([...(edit?.written ?? []), ...(Object.keys(changes) as (keyof WorkLogInput)[])])];
        // Recorded before sending, so a lost reply still counts as this form's write.
        if (form) editsRef.current.set(form.id, { seen: edit?.seen ?? from.updatedAt, written, attempt: next });
        const savedAt = landed ? latest.updatedAt : await api.saveBooking(next, latest.updatedAt);
        if (form) editsRef.current.set(form.id, { seen: savedAt, written, attempt: next });
        showSaved(landed ? latest : { ...next, updatedAt: savedAt });
        await finishSave(id, next.date, photos);
        if (form) editsRef.current.delete(form.id);
      });
    },
    [run, finishSave, showSaved, latestToChange]
  );

  const removeLog = useCallback(
    async (id: string) => {
      const current = logsRef.current.find((l) => l.id === id);
      if (!current) return;
      await run(async () => {
        await api.deleteBooking(current);
        loadsRef.current.shown = ++loadsRef.current.started; // a load already on its way still has this booking
        commit(logsRef.current.filter((l) => l.id !== id));
      });
    },
    [run, commit]
  );

  const recordPayment = useCallback(
    (seen: WorkLog, received: number) =>
      run(async () => {
        const latest = await latestToChange(seen.id);
        if (!latest) throw new ApiError("This booking was deleted on another device.", "NOT_FOUND");
        if (receivedOf(latest) !== receivedOf(seen) || latest.amount !== seen.amount) {
          showSaved(latest);
          return latest;
        }
        const next = mergeEdit(latest, { paidAmount: Math.max(0, received) });
        const savedAt = await api.saveBooking(next, latest.updatedAt);
        showSaved({ ...next, updatedAt: savedAt });
        await refetch();
        return null;
      }),
    [run, showSaved, refetch, latestToChange]
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
      recordPayment,
      logsByDate,
      logsByMonth,
    }),
    [logs, loading, settled, error, saving, refetch, addLog, editLog, removeLog, recordPayment, logsByDate, logsByMonth]
  );

  return <LogsContext.Provider value={value}>{children}</LogsContext.Provider>;
}

export function useLogs(): LogsContextValue {
  const ctx = useContext(LogsContext);
  if (!ctx) throw new Error("useLogs must be used within LogsProvider");
  return ctx;
}
