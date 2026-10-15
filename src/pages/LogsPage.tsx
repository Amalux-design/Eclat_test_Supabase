import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useLogs } from "../context/LogsContext";
import { useAuth } from "../context/AuthContext";
import { LogCard } from "../components/LogCard";
import { LogForm } from "../components/LogForm";
import { FAB } from "../components/FAB";
import { Loader } from "../components/Loader";
import { useConfirm } from "../components/ConfirmDialog";
import { useNotice } from "../components/Notice";
import { addDays, formatDateHeading, todayISO, weekRange } from "../utils/format";
import type { WorkLog, WorkLogInput } from "../types";

type ChipId = "all" | "today" | "tomorrow" | "week" | "upcoming" | "past" | "pending";

interface Chip {
  id: ChipId;
  label: string;
  adminOnly?: boolean;
}

const CHIPS: Chip[] = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "week", label: "This week" },
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
  { id: "pending", label: "Payment due", adminOnly: true },
];

const PINNED_TITLE: Record<Exclude<ChipId, "all">, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  week: "This week",
  upcoming: "Upcoming",
  past: "Past",
  pending: "Payment due",
};

const EMPTY_PINNED: Record<Exclude<ChipId, "all">, string> = {
  today: "Nothing booked today.",
  tomorrow: "Nothing booked tomorrow.",
  week: "Nothing else booked this week.",
  upcoming: "No upcoming bookings yet.",
  past: "No past bookings yet.",
  pending: "Every booking is paid.",
};

function byTime(a: WorkLog, b: WorkLog): number {
  // Bookings without a start time go last within their day.
  if (a.startTime === b.startTime) return 0;
  if (!a.startTime) return 1;
  if (!b.startTime) return -1;
  return a.startTime < b.startTime ? -1 : 1;
}

function shortDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export function LogsPage() {
  const { logs, loading, error, addLog, editLog, removeLog } = useLogs();
  const { isAdmin } = useAuth();
  const confirm = useConfirm();
  const notify = useNotice();
  const [chip, setChip] = useState<ChipId>("today");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<WorkLog | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  function openSearch() {
    rowRef.current?.scrollTo({ left: 0, behavior: "smooth" });
    setSearchOpen(true);
    // Focus inside the tap so the phone keyboard opens straight away.
    searchRef.current?.focus({ preventScroll: true });
  }

  // Tapping elsewhere or scrolling the page closes an empty search. With a
  // search typed, it only puts the keyboard away so the results stay readable.
  useEffect(() => {
    if (!searchOpen) return;
    const pill = searchRef.current?.closest(".search-pill");
    const dismiss = (e: Event) => {
      if (e.type === "pointerdown" && pill?.contains(e.target as Node)) return;
      if (searchRef.current?.value.trim()) searchRef.current.blur();
      else closeSearch();
    };
    const t = setTimeout(() => {
      document.addEventListener("pointerdown", dismiss, true);
      window.addEventListener("scroll", dismiss, { passive: true });
    }, 250); // ignore the scroll the opening keyboard can cause
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", dismiss, true);
      window.removeEventListener("scroll", dismiss);
    };
  }, [searchOpen]);

  function closeSearch() {
    setQuery("");
    setSearchOpen(false);
    searchRef.current?.blur();
  }

  // Search runs on the device over loaded bookings: instant, no server call.
  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return null;
    return logs
      .filter((l) =>
        [
          l.clientName,
          l.work,
          l.eventType,
          l.location,
          l.notes,
          ...(isAdmin ? [l.clientPhone, l.altPhone, l.privateNotes, l.referrerName] : []),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : byTime(a, b)));
  }, [logs, q, isAdmin]);

  const activeChip = !isAdmin && chip === "pending" ? "today" : chip;

  // Grouping runs on the device over already-loaded data: instant, no API call.
  const { pinned, rest } = useMemo(() => {
    const today = todayISO();
    const tomorrow = addDays(today, 1);
    const week = weekRange(today);

    const match: Record<Exclude<ChipId, "all">, (l: WorkLog) => boolean> = {
      today: (l) => l.date === today,
      tomorrow: (l) => l.date === tomorrow,
      week: (l) => l.date >= today && l.date <= week.end,
      upcoming: (l) => l.date > today,
      past: (l) => l.date < today,
      pending: (l) => l.paymentStatus === "PENDING",
    };

    if (activeChip === "all") return { pinned: null, rest: logs };

    const inGroup = logs.filter(match[activeChip]);
    const future = activeChip !== "past" && activeChip !== "pending";
    inGroup.sort((a, b) => {
      if (a.date !== b.date) return (a.date < b.date ? -1 : 1) * (future ? 1 : -1);
      return byTime(a, b);
    });
    const ids = new Set(inGroup.map((l) => l.id));
    return { pinned: inGroup, rest: logs.filter((l) => !ids.has(l.id)) };
  }, [logs, activeChip]);

  const restByDate = useMemo(() => {
    const groups: { date: string; items: WorkLog[] }[] = [];
    for (const log of rest) {
      const last = groups[groups.length - 1];
      if (last && last.date === log.date) last.items.push(log);
      else groups.push({ date: log.date, items: [log] });
    }
    groups.forEach((g) => g.items.sort(byTime));
    return groups;
  }, [rest]);

  const multiDay = activeChip !== "today" && activeChip !== "tomorrow";
  const open = isAdmin ? (log: WorkLog) => setEditing(log) : undefined;

  async function handleDelete(log: WorkLog) {
    const ok = await confirm({
      title: "Delete booking?",
      message: `${log.clientName || "This booking"} will be removed for everyone, including assistants.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await removeLog(log.id);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Couldn't delete. Try again.", "error");
    }
  }

  return (
    <div className="page bookings-page">
      <div className="page-head">
        <h1 className="page-title">Bookings</h1>
      </div>

      <div className="chip-bar"><div ref={rowRef} className={`chip-row ${searchOpen ? "searching" : ""}`} role="tablist" aria-label="Show bookings">
        <div className={`search-pill ${searchOpen ? "open" : ""}`} onClick={searchOpen ? undefined : openSearch}>
          {/* The lens turns into the close button once open: same spot, easy reach. */}
          <button
            type="button"
            className="search-pill-icon"
            onClick={(e) => {
              if (!searchOpen) return;
              e.stopPropagation();
              closeSearch();
            }}
            tabIndex={searchOpen ? 0 : -1}
            aria-label={searchOpen ? "Close search" : undefined}
            aria-hidden={searchOpen ? undefined : true}
          >
            <Search size={17} strokeWidth={2} className="lens" />
            <X size={17} strokeWidth={2.2} className="cross" />
          </button>
          <input
            ref={searchRef}
            className="search-pill-input"
            type="search"
            inputMode="search"
            enterKeyHint="search"
            placeholder="Search bookings"
            aria-label="Search bookings"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => !searchOpen && openSearch()}
            onKeyDown={(e) => e.key === "Escape" && closeSearch()}
            tabIndex={searchOpen ? 0 : -1}
          />
        </div>
        {CHIPS.filter((c) => isAdmin || !c.adminOnly).map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={activeChip === c.id}
            className={`chip ${activeChip === c.id ? "active" : ""}`}
            tabIndex={searchOpen ? -1 : 0}
            onClick={() => setChip(c.id === activeChip && c.id !== "all" ? "all" : c.id)}
          >
            {c.label}
          </button>
        ))}
      </div></div>

      {error && <div className="inline-note">{error}</div>}
      {loading && <Loader label="Loading bookings" />}

      {!loading && results && (
        <section key="search" className="pinned" aria-label="Search results" aria-live="polite">
          <header className="pinned-head">
            <h2 className="pinned-title">Results</h2>
            <span className="pinned-count">
              {results.length} {results.length === 1 ? "booking" : "bookings"}
            </span>
          </header>
          {results.length === 0 && <p className="pinned-empty">No bookings match "{query.trim()}".</p>}
          {results.map((log) => (
            <LogCard
              key={log.id}
              log={log}
              tone="wine"
              dateLabel={shortDate(log.date)}
              onEdit={open && (() => open(log))}
              onDelete={isAdmin ? () => handleDelete(log) : undefined}
            />
          ))}
        </section>
      )}

      {!loading && !results && pinned && activeChip !== "all" && (
        <section key={activeChip} className="pinned" aria-label={PINNED_TITLE[activeChip]}>
          <header className="pinned-head">
            <h2 className="pinned-title">{PINNED_TITLE[activeChip]}</h2>
            <span className="pinned-count">
              {pinned.length} {pinned.length === 1 ? "booking" : "bookings"}
            </span>
          </header>
          {pinned.length === 0 && <p className="pinned-empty">{EMPTY_PINNED[activeChip]}</p>}
          {pinned.map((log) => (
            <LogCard
              key={log.id}
              log={log}
              tone="wine"
              dateLabel={multiDay ? shortDate(log.date) : undefined}
              onEdit={open && (() => open(log))}
              onDelete={isAdmin ? () => handleDelete(log) : undefined}
            />
          ))}
        </section>
      )}

      {!loading && logs.length === 0 && (
        <div className="empty-state">
          <p className="empty-state-title">No bookings yet</p>
          <p>{isAdmin ? "Add the first booking with the button below." : "Bookings appear here as soon as they're added."}</p>
        </div>
      )}

      {!loading &&
        !results &&
        restByDate.map((group) => (
          <section key={group.date} className="day-group">
            <h2 className="day-heading">{formatDateHeading(group.date)}</h2>
            <div className="group list">
              {group.items.map((log) => (
                <LogCard
                  key={log.id}
                  log={log}
                  onEdit={open && (() => open(log))}
                  onDelete={isAdmin ? () => handleDelete(log) : undefined}
                />
              ))}
            </div>
          </section>
        ))}

      {isAdmin && <FAB onClick={() => setShowAdd(true)} />}

      {showAdd && (
        <LogForm
          title="New booking"
          defaultDate={activeChip === "tomorrow" ? addDays(todayISO(), 1) : undefined}
          onSubmit={(input: WorkLogInput, photos) => addLog(input, photos)}
          onClose={() => setShowAdd(false)}
        />
      )}

      {editing && (
        <LogForm
          title="Edit booking"
          initial={editing}
          onSubmit={(input: WorkLogInput, photos) => editLog(editing.id, input, photos)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
