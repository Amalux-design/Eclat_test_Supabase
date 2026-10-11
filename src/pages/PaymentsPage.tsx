import { useMemo, useState } from "react";
import { useLogs } from "../context/LogsContext";
import { PaymentSummaryCard } from "../components/PaymentSummaryCard";
import { LogCard } from "../components/LogCard";
import { LogForm } from "../components/LogForm";
import { formatCurrency, monthLabel } from "../utils/format";
import type { WorkLog, WorkLogInput } from "../types";

export function PaymentsPage() {
  const { logs, loading, error, markPaid, editLog } = useLogs();
  const [groupByClient, setGroupByClient] = useState(false);
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<WorkLog | null>(null);
  const [editing, setEditing] = useState<WorkLog | null>(null);

  const totals = useMemo(() => {
    let total = 0, paid = 0, pending = 0, pendingCount = 0;
    for (const log of logs) {
      total += log.amount;
      if (log.paymentStatus === "PAID") paid += log.amount;
      else {
        pending += log.amount;
        pendingCount++;
      }
    }
    return { total, paid, pending, pendingCount };
  }, [logs]);

  const monthGroups = useMemo(() => {
    const map = new Map<string, { year: number; month: number; logs: WorkLog[] }>();
    for (const log of logs) {
      const key = log.date.slice(0, 7);
      if (!map.has(key)) {
        const [y, m] = key.split("-").map(Number);
        map.set(key, { year: y, month: m - 1, logs: [] });
      }
      map.get(key)!.logs.push(log);
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, g]) => ({ key, ...g }));
  }, [logs]);

  const clientGroups = useMemo(() => {
    const map = new Map<string, WorkLog[]>();
    for (const log of logs) {
      const key = log.clientName || "No client name";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(log);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [logs]);

  function toggleMonth(key: string) {
    setOpenMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleMarkPaid(id: string) {
    try {
      await markPaid(id);
      setSelected(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to update payment status.");
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">Payments</h1>

      {error && <div className="inline-error">{error}</div>}
      {loading && <div className="spinner" />}

      {!loading && (
        <>
          <div className="summary-grid">
            <PaymentSummaryCard label="Total earnings" value={formatCurrency(totals.total)} />
            <PaymentSummaryCard label="Total paid" value={formatCurrency(totals.paid)} tint="success" />
            <PaymentSummaryCard label="Total pending" value={formatCurrency(totals.pending)} tint="warning" />
            <PaymentSummaryCard label="Pending count" value={String(totals.pendingCount)} tint="warning" />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 }}>
            <div className="section-heading" style={{ margin: 0 }}>
              {groupByClient ? "By client" : "Monthly breakdown"}
            </div>
            <button
              className="link-btn"
              onClick={() => setGroupByClient((v) => !v)}
            >
              {groupByClient ? "Group by month" : "Group by client"}
            </button>
          </div>

          {!groupByClient &&
            monthGroups.map((g) => {
              const paid = g.logs.filter((l) => l.paymentStatus === "PAID").reduce((s, l) => s + l.amount, 0);
              const pending = g.logs.filter((l) => l.paymentStatus === "PENDING").reduce((s, l) => s + l.amount, 0);
              const isOpen = openMonths.has(g.key);
              return (
                <div key={g.key} className="card" style={{ marginBottom: 10 }}>
                  <button
                    onClick={() => toggleMonth(g.key)}
                    style={{
                      width: "100%",
                      background: "none",
                      border: "none",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: 0,
                      minHeight: 44,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{monthLabel(g.year, g.month)}</span>
                    <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
                      {formatCurrency(paid)} paid · {formatCurrency(pending)} pending
                    </span>
                  </button>
                  {isOpen && (
                    <div style={{ marginTop: 12 }}>
                      {g.logs.map((log) => (
                        <LogCard key={log.id} log={log} onClick={() => setSelected(log)} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

          {groupByClient &&
            clientGroups.map(([client, clientLogs]) => {
              const total = clientLogs.reduce((s, l) => s + l.amount, 0);
              return (
                <div key={client} className="card" style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, marginBottom: 10 }}>
                    <span>{client}</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                  {clientLogs.map((log) => (
                    <LogCard key={log.id} log={log} onClick={() => setSelected(log)} />
                  ))}
                </div>
              );
            })}

          {logs.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-title">No payments yet</div>
              <div>Once you log work, your earnings will show up here.</div>
            </div>
          )}
        </>
      )}

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{selected.clientName || selected.work}</h2>
              <button className="icon-btn" onClick={() => setSelected(null)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="modal-body">
              <LogCard log={selected} onClick={() => {}} />
              {selected.paymentStatus === "PENDING" ? (
                <button className="primary-btn" onClick={() => handleMarkPaid(selected.id)}>
                  Mark as Paid
                </button>
              ) : (
                <button
                  className="primary-btn secondary"
                  onClick={() => {
                    setEditing(selected);
                    setSelected(null);
                  }}
                >
                  Edit details
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {editing && (
        <LogForm
          title="Edit Log"
          initial={editing}
          onSubmit={async (input: WorkLogInput) => {
            await editLog(editing.id, input);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
