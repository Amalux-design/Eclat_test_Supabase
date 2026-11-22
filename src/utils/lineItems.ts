// One set of price lines for a booking, shared by the booking sheet and the
// invoice/proposal PDF so both always show the same figures.
import type { WorkLog } from "../types";
import { servicePrice } from "../data/services";
import { parseWorks, splitQty, withQty } from "./format";

export interface LineItem {
  label: string;
  rate?: number; // per unit; none on a combined or adjustment line
  qty?: number; // none on a combined or adjustment line
  amount: number;
  adjustment?: boolean; // "Discount" / "Additional services": booked total vs service prices
}

/**
 * Each service's price as booked (else the menu's); any difference from the booked total becomes one
 * adjustment line. A single service, a booking with no menu prices, or a ₹0
 * booking is one line carrying the booked amount (nothing itemised to explain).
 */
export function lineItems(log: Pick<WorkLog, "work" | "amount">): LineItem[] {
  const services = parseWorks(log.work).map(splitQty);
  const priced = services.map((s) => {
    const rate = s.price ?? servicePrice(s.name) ?? 0;
    return { label: s.name, rate, qty: s.qty, amount: rate * s.qty };
  });
  const menuTotal = priced.reduce((sum, l) => sum + l.amount, 0);
  if (menuTotal === 0 || log.amount <= 0 || (services.length === 1 && services[0].qty === 1)) {
    return [
      {
        label: services.map((s) => withQty(s.name, s.qty)).join(", ") || "Makeup services",
        amount: log.amount,
      },
    ];
  }
  const items: LineItem[] = priced;
  const diff = log.amount - menuTotal;
  if (diff !== 0) items.push({ label: diff > 0 ? "Additional services" : "Discount", amount: diff, adjustment: true });
  return items;
}
