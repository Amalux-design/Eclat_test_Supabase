import { useMemo, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { useLogs } from "../context/LogsContext";
import { LogCard } from "../components/LogCard";
import { LogForm } from "../components/LogForm";
import { formatCurrency, monthLabel, receivedOf } from "../utils/format";
import { useConfirm } from "../components/ConfirmDialog";
import { saveInvoice } from "../utils/invoice";
import { Loader } from "../components/Loader";
import { FileDown } from "lucide-react";
import type { WorkLog, WorkLogInput } from "../types";

export function PaymentsPage() {
  const { logs, loading, error, markPaid, recordPayment, editLog } = useLogs();
  const confirm = useConfirm();
  const [partialOpen, setPartialOpen] = useState(false);
  const [partialValue, setPartialValue] = useState("");
  const [groupByClient, setGroupByClient] = useState(false);
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<WorkLog | null>(null);
  const [editing, setEditing] = useState<WorkLog | null>(null);

  const totals = useMemo(() => {
    let total = 0, paid = 0, pending = 0, pendingCount = 0;
    for (const log of logs) {
      total += log.amount;
      const received = receivedOf(log);
      paid += received;
      if (received < log.amount) {
        pending += log.amount - received;
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
      .map(([key, g]) => {
        const paid = g.logs.reduce((s, l) => s + receivedOf(l), 0);
        const total = g.logs.reduce((s, l) => s + l.amount, 0);
        return { key, ...g, paid, due: total - paid, total };
      });
  }, [logs]);

  const clientGroups = useMemo(() => {
    const map = new Map<string, WorkLog[]>();
    for (const log of logs) {
      const key = log.clientName || "Unnamed client";
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

  const paidShare = totals.total ? Math.round((totals.paid / totals.total) * 100) : 0;

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Earnings</h1>
      </div>

      {error && <div className="inline-note">{error}</div>}
      {loading && <Loader label="Loading earnings" />}

      {!loading && (
        <>
          <section className="ledger pinned" aria-label="Totals">
            <div className="ledger-total">
              <span className="ledger-label">Total booked</span>
              <span className="ledger-figure">{formatCurrency(totals.total)}</span>
            </div>
            <div className="ledger-bar" aria-hidden="true">
              <span style={{ width: `${paidShare}%` }} />
            </div>
            <div className="ledger-split">
              <div>
                <span className="ledger-label">Received</span>
                <span className="ledger-value">{formatCurrency(totals.paid)}</span>
              </div>
              <div>
                <span className="ledger-label">
                  Due from {totals.pendingCount} {totals.pendingCount === 1 ? "booking" : "bookings"}
                </span>
                <span className="ledger-value due">{formatCurrency(totals.pending)}</span>
              </div>
            </div>
          </section>

          <div className="segmented view-switch">
            <button className={`segmented-btn ${!groupByClient ? "active" : ""}`} onClick={() => setGroupByClient(false)}>
              By month
            </button>
            <button className={`segmented-btn ${groupByClient ? "active" : ""}`} onClick={() => setGroupByClient(true)}>
              By client
            </button>
          </div>

          {!groupByClient && monthGroups.length > 0 && (
            <div className="group">
            {monthGroups.map((g) => {
              const isOpen = openMonths.has(g.key);
              return (
                <section key={g.key} className={`month-row ${isOpen ? "open" : ""}`}>
                  <button className="month-row-head" onClick={() => toggleMonth(g.key)} aria-expanded={isOpen}>
                    <span className="month-row-name">{monthLabel(g.year, g.month)}</span>
                    <span className="month-row-figures">
                      <span>{formatCurrency(g.total)}</span>
                      {g.due > 0 && <span className="due">{formatCurrency(g.due)} due</span>}
                    </span>
                    <ChevronDown size={18} strokeWidth={1.4} className="month-row-chevron" />
                  </button>
                  <div className="month-row-reveal" aria-hidden={!isOpen}>
                    <div className="month-row-body list">
                      {g.logs.map((log) => (
                        <LogCard key={log.id} log={log} onClick={() => setSelected(log)} />
                      ))}
                    </div>
                  </div>
                </section>
              );
            })}
            </div>
          )}

          {groupByClient &&
            clientGroups.map(([client, clientLogs]) => {
              const total = clientLogs.reduce((s, l) => s + l.amount, 0);
              return (
                <section key={client} className="day-group">
                  <h2 className="day-heading client-heading">
                    <span>{client}</span>
                    <span>{formatCurrency(total)}</span>
                  </h2>
                  <div className="group list">
                    {clientLogs.map((log) => (
                      <LogCard key={log.id} log={log} onClick={() => setSelected(log)} />
                    ))}
                  </div>
                </section>
              );
            })}

          {logs.length === 0 && (
            <div className="empty-state">
              <p className="empty-state-title">No earnings yet</p>
              <p>Totals appear here once bookings are added.</p>
            </div>
          )}
        </>
      )}

      {selected && (() => {
        const received = receivedOf(selected);
        const balance = selected.amount - received;
        const close = () => {
          setSelected(null);
          setPartialOpen(false);
          setPartialValue("");
        };
        return (
          <div className="modal-overlay" onClick={close}>
            <div className="modal-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Booking payment">
              <div className="modal-header">
                <span />
                <h2 className="modal-title">{selected.clientName || "Booking"}</h2>
                <button className="icon-btn" onClick={close} aria-label="Close">
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body">
                <div className="group list"><LogCard log={selected} /></div>

                {balance > 0 && (
                  <>
                    <div className="pay-summary">
                      <span>Received {formatCurrency(received)}</span>
                      <span className="due">Balance {formatCurrency(balance)}</span>
                    </div>

                    <button
                      className="primary-btn"
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Mark as fully paid?",
                          message: `${selected.clientName || "This booking"} will show ${formatCurrency(selected.amount)} received.`,
                          confirmLabel: "Mark paid",
                        });
                        if (ok) {
                          markPaid(selected.id);
                          close();
                        }
                      }}
                    >
                      Mark {formatCurrency(balance)} as paid
                    </button>

                    {!partialOpen ? (
                      <button className="ghost-btn full" onClick={() => setPartialOpen(true)}>
                        Mark partial
                      </button>
                    ) : (
                      <form
                        className="partial-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const add = Number(partialValue);
                          if (!add || add <= 0) return;
                          recordPayment(selected.id, received + add);
                          close();
                        }}
                      >
                        <label className="field-label" htmlFor="partial-amount">Amount received now</label>
                        <div className="partial-row">
                          <input
                            id="partial-amount"
                            type="number"
                            inputMode="numeric"
                            min="1"
                            max={balance}
                            autoFocus
                            className="field-input"
                            value={partialValue}
                            onChange={(e) => setPartialValue(e.target.value)}
                            placeholder={`Up to ${formatCurrency(balance)}`}
                          />
                          <button type="submit" className="save-pill" disabled={!Number(partialValue)}>
                            Save
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                )}

                <button className="ghost-btn full with-icon" onClick={() => void saveInvoice(selected)}>
                  <FileDown size={18} strokeWidth={1.8} /> Save invoice
                </button>

                <button
                  className="ghost-btn full"
                  onClick={() => {
                    setEditing(selected);
                    close();
                  }}
                >
                  Edit booking
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {editing && (
        <LogForm
          title="Edit booking"
          initial={editing}
          onSubmit={(input: WorkLogInput) => editLog(editing.id, input)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
