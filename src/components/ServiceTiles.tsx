import { Minus, Plus } from "lucide-react";
import { SERVICE_GROUPS } from "../data/services";
import { formatCurrency } from "../utils/format";

interface ServiceTilesProps {
  /** Selected services and how many of each (absent = not selected). */
  qty: Record<string, number>;
  /** 0 removes the service. */
  onChange: (name: string, qty: number) => void;
  /** Extra tiles for services not on the menu. */
  custom?: { name: string; price?: number }[];
}

/**
 * The service menu as tiles. Tap to select; a selected tile shows a stepper
 * for "2× Classic Bridal". Tapping the tile again, or − at 1, removes it.
 */
export function ServiceTiles({ qty, onChange, custom = [] }: ServiceTilesProps) {
  const tile = (name: string, priceLabel: string) => {
    const n = qty[name] ?? 0;
    const active = n > 0;
    return (
      <div key={name} className={`service-option ${active ? "active" : ""}`}>
        <button
          type="button"
          className="service-tile-main"
          onClick={() => onChange(name, active ? 0 : 1)}
          aria-pressed={active}
        >
          <span className="service-name">{name}</span>
          <span className="service-price">{priceLabel}</span>
        </button>
        {active && (
          <div className="tile-stepper">
            <button type="button" onClick={() => onChange(name, n - 1)} aria-label={`One less ${name}`}>
              <Minus size={14} strokeWidth={2.2} />
            </button>
            <span aria-live="polite">{n}</span>
            <button type="button" onClick={() => onChange(name, n + 1)} aria-label={`One more ${name}`}>
              <Plus size={14} strokeWidth={2.2} />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {SERVICE_GROUPS.map((group) => (
        <div key={group.title} className="service-group">
          <div className="service-group-title">{group.title}</div>
          <div className="service-options">
            {group.services.map((s) => tile(s.name, s.price ? formatCurrency(s.price) : "On call"))}
          </div>
        </div>
      ))}
      {custom.length > 0 && (
        <div className="service-options">
          {custom.map((c) => tile(c.name, c.price ? formatCurrency(c.price) : "Custom"))}
        </div>
      )}
    </>
  );
}
