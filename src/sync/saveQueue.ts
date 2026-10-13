// Background save queue. Admin edits apply on screen immediately and are
// sent to the server here, in order, with retries. The queue lives in
// IndexedDB so nothing is lost if the app is closed or the phone goes offline.
//
// At most one pending op per booking id: a newer save replaces an older one,
// and a delete replaces a pending save. The server treats saves as
// create-or-update and deletes as idempotent, so retries are always safe.
import type { WorkLog } from "../types";
import { ApiError, api } from "../api/client";
import { kvGet, kvSet } from "../utils/kvStore";

export type QueueOp = { kind: "save"; id: string; log: WorkLog } | { kind: "delete"; id: string };

export type SyncState = "saved" | "syncing" | "offline" | "locked";

export interface SyncStatus {
  state: SyncState;
  pending: number;
  error: string | null; // last rejected save, shown once to the admin
}

const STORE_KEY = "save-queue:v1";
const RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000, 60_000];

type Listener = () => void;

class SaveQueue {
  private ops: QueueOp[] = [];
  private inFlight: QueueOp | null = null;
  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private state: SyncState = "saved";
  private error: string | null = null;
  private listeners = new Set<Listener>();
  private snapshot: { ops: QueueOp[]; status: SyncStatus } = { ops: [], status: this.computeStatus() };
  private getToken: () => string | null = () => null;
  private onAuthLost: () => void = () => {};
  private onSettled: () => void = () => {};
  private onApplied: (op: QueueOp, saved: WorkLog | null) => void = () => {};
  readonly ready: Promise<void>;

  constructor() {
    this.ready = kvGet<QueueOp[]>(STORE_KEY).then((saved) => {
      if (saved?.length) {
        this.ops = [...saved, ...this.ops.filter((op) => !saved.some((s) => s.id === op.id))];
        this.emit();
      }
    });
    window.addEventListener("online", () => this.flushNow());
  }

  configure(opts: {
    getToken: () => string | null;
    onAuthLost: () => void;
    onSettled: () => void;
    /** Called with the server's copy before the pending op is dropped. */
    onApplied: (op: QueueOp, saved: WorkLog | null) => void;
  }) {
    this.onApplied = opts.onApplied;
    this.getToken = opts.getToken;
    this.onAuthLost = opts.onAuthLost;
    this.onSettled = opts.onSettled;
  }

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = () => this.snapshot;

  enqueue(op: QueueOp) {
    this.ops = [...this.ops.filter((o) => o.id !== op.id), op];
    this.error = null;
    this.persistAndEmit();
    this.flushNow();
  }

  clearError() {
    this.error = null;
    this.emit();
  }

  /** Retry immediately, e.g. after coming back online or unlocking admin. */
  flushNow() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.attempt = 0;
    void this.ready.then(() => this.pump());
  }

  private async pump() {
    if (this.inFlight || this.ops.length === 0) {
      if (!this.inFlight && this.ops.length === 0) this.setState("saved");
      return;
    }
    const token = this.getToken();
    if (!token) {
      this.setState("locked");
      return;
    }
    if (!navigator.onLine) {
      this.setState("offline");
      return;
    }

    const op = this.ops[0];
    this.inFlight = op;
    this.setState("syncing");
    try {
      let saved: WorkLog | null = null;
      if (op.kind === "save") saved = await api.saveLog(token, op.log);
      else await api.deleteLog(token, op.id);
      // Hand the confirmed copy to the list first, then drop the pending op,
      // so the booking never disappears between the two.
      this.onApplied(op, saved);
      // Give React a moment to render the merged copy before the overlay goes.
      await new Promise((r) => setTimeout(r, 60));
      this.finish(op);
    } catch (e) {
      this.inFlight = null;
      const code = e instanceof ApiError ? e.code : "NETWORK";
      if (code === "AUTH") {
        this.setState("locked");
        this.onAuthLost();
        return;
      }
      if (code === "ERROR") {
        // The server rejected this change; retrying won't help. Drop it and
        // let the next refetch restore the server's version.
        this.error = e instanceof Error ? e.message : "A change could not be saved";
        this.finish(op);
        return;
      }
      this.setState(navigator.onLine ? "syncing" : "offline");
      const wait = RETRY_DELAYS_MS[Math.min(this.attempt, RETRY_DELAYS_MS.length - 1)];
      this.attempt += 1;
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        void this.pump();
      }, wait);
      return;
    }
  }

  private finish(op: QueueOp) {
    this.inFlight = null;
    this.attempt = 0;
    // Only drop the op if it wasn't replaced by a newer edit while in flight.
    this.ops = this.ops.filter((o) => o !== op);
    this.persistAndEmit();
    if (this.ops.length === 0) {
      this.setState("saved");
      this.onSettled();
    } else {
      void this.pump();
    }
  }

  private computeStatus(): SyncStatus {
    const pending = this.ops?.length ?? 0;
    // Between enqueue and the first send, report "syncing" rather than "saved".
    const state = this.state === "saved" && pending > 0 ? "syncing" : this.state;
    return { state, pending, error: this.error };
  }

  private setState(state: SyncState) {
    if (this.state === state) return;
    this.state = state;
    this.emit();
  }

  private persistAndEmit() {
    void kvSet(STORE_KEY, this.ops);
    this.emit();
  }

  private emit() {
    this.snapshot = { ops: this.ops, status: this.computeStatus() };
    this.listeners.forEach((fn) => fn());
  }
}

export const saveQueue = new SaveQueue();

/** Lay pending ops over the server's list so unsynced edits always show. */
export function applyOps(logs: WorkLog[], ops: QueueOp[]): WorkLog[] {
  if (ops.length === 0) return logs;
  const byId = new Map(logs.map((l) => [l.id, l]));
  for (const op of ops) {
    if (op.kind === "delete") byId.delete(op.id);
    else byId.set(op.id, op.log);
  }
  return Array.from(byId.values()).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
