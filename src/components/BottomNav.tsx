import { NotebookPen, CalendarDays, Wallet } from "lucide-react";
import { NavLink } from "react-router-dom";

const ITEMS = [
  { to: "/", label: "Calendar", icon: CalendarDays, end: true },
  { to: "/logs", label: "Logs", icon: NotebookPen, end: false },
  { to: "/payments", label: "Payments", icon: Wallet, end: false },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      {ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          {({ isActive }) => (
            <>
              <Icon
                size={22}
                strokeWidth={2}
                fill={isActive ? "currentColor" : "none"}
                stroke={isActive ? "var(--color-surface)" : "currentColor"}
              />
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
