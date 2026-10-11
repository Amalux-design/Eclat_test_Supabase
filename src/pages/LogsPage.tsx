import { useMemo, useState } from "react";
import { useLogs } from "../context/LogsContext";
import { LogCard } from "../components/LogCard";
import { LogForm } from "../components/LogForm";
import { FAB } from "../components/FAB";
import { formatDateHeading } from "../utils/format";
import type { WorkLog, WorkLogInput } from "../types";

export function LogsPage() {
  const { logs, loading, error, addLog, editLog, removeLog, logsByDate } = useLogs();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<WorkLog | null>(null);

  // logs (and therefore logsByDate's insertion order) already come back
  // date-desc from the API, so a direct map iteration preserves that order
  // without an O(n²) find-based grouping pass.
  const grouped = useMemo(
    () => Array.from(logsByDate.entries()).map(([date, items]) => ({ date, items })),
    [logsByDate]
  );

  async function handleDelete(id: string) {
    if (confirm("Delete this log entry?")) {
      await removeLog(id).catch((e) => alert(e.message));
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">Work Logs</h1>

      {error && <div className="inline-error">{error}</div>}

      {loading && <div className="spinner" />}

      {!loading && logs.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-title">Your diary is empty</div>
          <div>Tap the + button to log your first booking.</div>
        </div>
      )}

      {!loading &&
        grouped.map((group) => (
          <div key={group.date}>
            <div className="section-heading">{formatDateHeading(group.date)}</div>
            {group.items.map((log) => (
              <LogCard
                key={log.id}
                log={log}
                onClick={() => setEditing(log)}
                onDelete={() => handleDelete(log.id)}
              />
            ))}
          </div>
        ))}

      <FAB onClick={() => setShowAdd(true)} />

      {showAdd && (
        <LogForm
          title="Add Log"
          onSubmit={async (input: WorkLogInput) => {
            await addLog(input);
          }}
          onClose={() => setShowAdd(false)}
        />
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
