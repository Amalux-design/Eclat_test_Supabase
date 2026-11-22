import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import type { WorkLog } from "../types";
import { Sheet } from "./Sheet";
import { servicePrice } from "../data/services";
import { formatCurrency, parseWorks, receivedOf, splitQty, todayISO } from "../utils/format";

// Series colours, validated with the dataviz palette check (light surface):
// lightness band, chroma, colour-blind separation and contrast all pass.
const BOOKED = "#9b3a4a";
const RECEIVED = "#c28a3a";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const short = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(n % 100000 ? 1 : 0)}L` : n >= 1000 ? `₹${Math.round(n / 1000)}k` : `₹${n}`;

interface Props {
  logs: WorkLog[];
  year: string;
  onClose: () => void;
}

/** Earnings in detail, in the studio's own look: wine hero, Playfair sections. */
export function EarningsDashboard({ logs, year, onClose }: Props) {
  const d = useMemo(() => {
    const today = todayISO();
    const total = logs.reduce((s, l) => s + l.amount, 0);
    const received = logs.reduce((s, l) => s + receivedOf(l), 0);
    const months = MONTHS.map((m) => ({ m, booked: 0, received: 0, count: 0 }));
    const weekdays = WEEKDAYS.map((w) => ({ w, count: 0 }));
    const services = new Map<string, number>();
    const clients = new Map<string, number>();
    const referrers = new Map<string, number>();
    let direct = 0, referred = 0, directN = 0, referredN = 0;
    let overdue = 0, upcoming = 0;
    const overdueList: { name: string; due: number; date: string }[] = [];

    for (const l of logs) {
      const r = receivedOf(l);
      const due = Math.max(0, l.amount - r);
      const mi = Number(l.date.slice(5, 7)) - 1;
      if (months[mi]) {
        months[mi].booked += l.amount;
        months[mi].received += r;
        months[mi].count++;
      }
      const wd = (new Date(l.date + "T00:00").getDay() + 6) % 7; // Monday first
      weekdays[wd].count++;
      for (const w of parseWorks(l.work).map(splitQty)) {
        const v = (servicePrice(w.name) ?? w.price ?? 0) * w.qty;
        if (v > 0) services.set(w.name, (services.get(w.name) ?? 0) + v);
      }
      const c = l.clientName || "Unnamed client";
      clients.set(c, (clients.get(c) ?? 0) + l.amount);
      if (l.own) {
        direct += l.amount;
        directN++;
      } else {
        referred += l.amount;
        referredN++;
        const name = l.referrerName || "Referral";
        referrers.set(name, (referrers.get(name) ?? 0) + l.amount);
      }
      if (due > 0) {
        if (l.date < today) {
          overdue += due;
          overdueList.push({ name: c, due, date: l.date });
        } else upcoming += due;
      }
    }
    const top = (m: Map<string, number>, n: number) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
    const best = months.reduce((b, x) => (x.booked > b.booked ? x : b), months[0]);
    return {
      total,
      received,
      outstanding: overdue + upcoming,
      count: logs.length,
      avg: logs.length ? Math.round(total / logs.length) : 0,
      rate: total ? Math.min(100, Math.round((received / total) * 100)) : 0,
      months,
      best: best.booked > 0 ? best : null,
      weekdays,
      services: top(services, 6),
      clients: top(clients, 5),
      direct, referred, directN, referredN,
      referrers: top(referrers, 3),
      overdue,
      upcoming,
      overdueList: overdueList.sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 3),
    };
  }, [logs]);

  return (
    <Sheet label="Earnings dashboard" onClose={onClose}>
      {(close) => (
        <>
          <div className="modal-header">
            <span />
            <h2 className="modal-title">Dashboard</h2>
            <button className="icon-btn" onClick={close} aria-label="Close">
              <X size={20} />
            </button>
          </div>

          <div className="modal-body dash">
            {/* Hero: the one bold element, a gold ring for money collected */}
            <section className="dash-hero">
              <div className="dash-hero-top">
                <Ring pct={d.rate} />
                <div className="dash-hero-figures">
                  <span className="dash-hero-label">Booked in {year}</span>
                  <span className="dash-hero-total">{formatCurrency(d.total)}</span>
                  <span className="dash-hero-row">
                    <i style={{ background: RECEIVED }} /> Received <b>{formatCurrency(d.received)}</b>
                  </span>
                  <span className="dash-hero-row due">
                    <i /> Outstanding <b>{formatCurrency(d.outstanding)}</b>
                  </span>
                </div>
              </div>
              <dl className="dash-hero-stats">
                <div><dt>Bookings</dt><dd>{d.count}</dd></div>
                <div><dt>Average</dt><dd>{short(d.avg)}</dd></div>
                <div><dt>Best month</dt><dd>{d.best ? d.best.m : "—"}</dd></div>
              </dl>
            </section>

            <Section title="Money to collect">
              <div className="dash-collect">
                <div className="dash-collect-box overdue">
                  <span>Overdue</span>
                  <b>{formatCurrency(d.overdue)}</b>
                  <small>Work done, not fully paid</small>
                </div>
                <div className="dash-collect-box">
                  <span>Coming up</span>
                  <b>{formatCurrency(d.upcoming)}</b>
                  <small>Future bookings still owing</small>
                </div>
              </div>
              {d.overdueList.length > 0 && (
                <ul className="dash-rows">
                  {d.overdueList.map((o) => (
                    <li key={o.name + o.date}>
                      <span>{o.name}<em>{new Date(o.date + "T00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</em></span>
                      <b className="due">{formatCurrency(o.due)}</b>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Month by month">
              <div className="dash-legend" aria-hidden="true">
                <span><i style={{ background: BOOKED }} /> Booked</span>
                <span><i style={{ background: RECEIVED }} /> Received</span>
              </div>
              <MonthChart months={d.months} />
            </Section>

            <Section title="Busiest days">
              <WeekdayChart days={d.weekdays} />
            </Section>

            {d.services.length > 0 && (
              <Section title="Top services">
                <Ranked rows={d.services} color={BOOKED} />
              </Section>
            )}

            {d.clients.length > 0 && (
              <Section title="Top clients">
                <Ranked rows={d.clients} color={RECEIVED} />
              </Section>
            )}

            <Section title="Where bookings come from">
              <Split
                a={{ label: `Direct · ${d.directN}`, value: d.direct, color: BOOKED }}
                b={{ label: `Referred · ${d.referredN}`, value: d.referred, color: RECEIVED }}
              />
              {d.referrers.length > 0 && (
                <ul className="dash-rows">
                  {d.referrers.map(([name, v]) => (
                    <li key={name}><span>{name}</span><b>{formatCurrency(v)}</b></li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </>
      )}
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="dash-section">
      <h3 className="dash-section-title">{title}</h3>
      {children}
    </section>
  );
}

/** Gold progress ring: share of booked money already received. */
function Ring({ pct }: { pct: number }) {
  const r = 44, c = 2 * Math.PI * r;
  return (
    <div className="dash-ring" role="img" aria-label={`${pct}% collected`}>
      <svg viewBox="0 0 108 108">
        <circle cx="54" cy="54" r={r} className="dash-ring-track" />
        <circle
          cx="54"
          cy="54"
          r={r}
          className="dash-ring-fill"
          style={{ strokeDasharray: c, ["--ring-off" as string]: `${c * (1 - pct / 100)}`, strokeDashoffset: c * (1 - pct / 100) }}
        />
      </svg>
      <div className="dash-ring-text">
        <b>{pct}%</b>
        <span>collected</span>
      </div>
    </div>
  );
}

/** Grow-in progress 0→1 (eased), drawn every frame so bars stay crisp. */
function useGrow(ms = 750) {
  const [t, setT] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 0
  );
  useEffect(() => {
    if (t === 1) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      setT(1 - Math.pow(1 - p, 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return t;
}

/** Real width of an element, so SVG charts draw 1:1 (no stretching = no blur). */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(320);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Content width (minus padding), so the SVG is drawn at exactly its display size.
    const measure = () => {
      const cs = getComputedStyle(el);
      setW(Math.floor(el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    // The sheet slides in on open; measure again once it has settled.
    const t = window.setTimeout(measure, 450);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, []);
  return [ref, w] as const;
}

/** Grouped bars, one axis, recessive grid; tap/hover a month for values. */
function MonthChart({ months }: { months: { m: string; booked: number; received: number; count: number }[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [box, W] = useWidth<HTMLDivElement>();
  const grow = useGrow();
  const max = Math.max(1, ...months.map((x) => Math.max(x.booked, x.received)));
  const H = W < 400 ? 180 : 220;
  const padL = 44, padB = 22, padT = 8;
  const plotW = Math.max(10, W - padL), plotH = H - padB - padT;
  const slot = plotW / 12;
  const bw = Math.max(4, Math.min(14, slot / 2 - 3));
  const base = padT + plotH;
  const y = (v: number) => base - (v / max) * plotH;
  const a = active != null ? months[active] : null;

  return (
    <div className="dash-chart" ref={box}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} shapeRendering="geometricPrecision" role="img" aria-label="Booked and received amounts for each month">
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={Math.round(y(t * max)) + 0.5} y2={Math.round(y(t * max)) + 0.5} className="dash-grid" />
            <text x={padL - 8} y={y(t * max) + 4} className="dash-axis" textAnchor="end">{short(t * max)}</text>
          </g>
        ))}
        {months.map((x, i) => {
          const cx = padL + slot * i + slot / 2;
          const hb = (x.booked / max) * plotH * grow;
          const hr = (x.received / max) * plotH * grow;
          return (
            <g key={x.m} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onClick={() => setActive(active === i ? null : i)}>
              <rect x={padL + slot * i} y={padT} width={slot} height={plotH} fill="transparent" />
              {active === i && <rect x={padL + slot * i + 2} y={padT} width={slot - 4} height={plotH} className="dash-hover" rx="6" />}
              {hb > 0 && <rect x={cx - bw - 1} y={base - hb} width={bw} height={hb} rx={Math.min(4, bw / 2)} fill={BOOKED} />}
              {hr > 0 && <rect x={cx + 1} y={base - hr} width={bw} height={hr} rx={Math.min(4, bw / 2)} fill={RECEIVED} />}
              <text x={cx} y={H - 6} className="dash-axis" textAnchor="middle">{W < 420 ? x.m.slice(0, 1) : x.m}</text>
            </g>
          );
        })}
      </svg>
      <p className="dash-tip" aria-live="polite">
        {a ? (
          <><b>{a.m}</b> · {a.count} booking{a.count === 1 ? "" : "s"} · booked {formatCurrency(a.booked)} · received {formatCurrency(a.received)}</>
        ) : (
          <span className="dash-hint">Tap a month for details</span>
        )}
      </p>
      <details className="dash-table">
        <summary>View as table</summary>
        <table>
          <thead><tr><th>Month</th><th>Booked</th><th>Received</th></tr></thead>
          <tbody>
            {months.filter((x) => x.booked || x.received).map((x) => (
              <tr key={x.m}><td>{x.m}</td><td>{formatCurrency(x.booked)}</td><td>{formatCurrency(x.received)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

/** Bookings per weekday (single series, so no legend); busiest day labelled. */
function WeekdayChart({ days }: { days: { w: string; count: number }[] }) {
  const max = Math.max(1, ...days.map((x) => x.count));
  const busiest = days.reduce((b, x) => (x.count > b.count ? x : b), days[0]);
  return (
    <div className="dash-week" role="img" aria-label={`Bookings per weekday, busiest ${busiest.w}`}>
      {days.map((x, i) => (
        <div key={x.w} className={`dash-week-col ${x === busiest && x.count > 0 ? "top" : ""}`}>
          <span className="dash-week-n">{x.count || ""}</span>
          <span className="dash-week-bar">
            <span className="dash-grow-y" style={{ height: `${(x.count / max) * 100}%`, animationDelay: `${i * 50}ms` }} />
          </span>
          <span className="dash-week-d">{x.w.slice(0, 1)}</span>
        </div>
      ))}
    </div>
  );
}

/** Ranked list with fine bars, one series (title names it). */
function Ranked({ rows, color }: { rows: [string, number][]; color: string }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <ol className="dash-ranked">
      {rows.map(([name, v], i) => (
        <li key={name}>
          <div className="dash-ranked-head">
            <span className="dash-ranked-name">{name}</span>
            <b>{formatCurrency(v)}</b>
          </div>
          <span className="dash-ranked-track">
            <span className="dash-grow-x" style={{ width: `${(v / max) * 100}%`, background: color, animationDelay: `${i * 60}ms` }} />
          </span>
        </li>
      ))}
    </ol>
  );
}

/** One bar split into two labelled parts (2px surface gap). */
function Split({ a, b }: { a: { label: string; value: number; color: string }; b: { label: string; value: number; color: string } }) {
  const sum = a.value + b.value || 1;
  const pa = Math.round((a.value / sum) * 100);
  return (
    <div className="dash-split">
      <div className="dash-split-bar">
        <span className="dash-grow-x" style={{ width: `${pa}%`, background: a.color }} />
        <span className="dash-grow-x" style={{ width: `${100 - pa}%`, background: b.color, animationDelay: "120ms" }} />
      </div>
      <div className="dash-split-labels">
        <span><i style={{ background: a.color }} />{a.label} <b>{formatCurrency(a.value)}</b> · {pa}%</span>
        <span><i style={{ background: b.color }} />{b.label} <b>{formatCurrency(b.value)}</b> · {100 - pa}%</span>
      </div>
    </div>
  );
}
