import { CalendarDays, NotebookPen, Wallet } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ITEMS = [
  { to: "/", label: "Calendar", icon: CalendarDays, adminOnly: false },
  { to: "/logs", label: "Bookings", icon: NotebookPen, adminOnly: false },
  { to: "/payments", label: "Earnings", icon: Wallet, adminOnly: true },
];

export const TABS = ITEMS;

export function BottomNav() {
  const { isAdmin } = useAuth();
  const { pathname } = useLocation();
  const items = ITEMS.filter((item) => isAdmin || !item.adminOnly);
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => (item.to === "/" ? pathname === "/" : pathname.startsWith(item.to)))
  );

  // Tabs are equal fixed widths, so the highlight only ever slides: no
  // measuring, no reflow, nothing to drift out of place.
  return (
    <nav className="bottom-nav" style={{ ["--tabs" as string]: items.length, ["--active" as string]: activeIndex }}>
      <span className="nav-indicator" aria-hidden="true" />
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          onClick={(e) => {
            // Tapping the tab you're already on scrolls it back to the top.
            if (e.currentTarget.classList.contains("active")) {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
        >
          <Icon size={21} strokeWidth={1.5} />
          <span className="nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
