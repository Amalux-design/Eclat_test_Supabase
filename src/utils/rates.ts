// Prices never go into bookings.work, which the team can read. On the device a
// booking's services carry them ("2× Hairdo @2500"); the database keeps the names
// in bookings.work and the prices in booking_private.rates ({"Hairdo": 2500}).
// Only api/client.ts converts between the two.
import { joinWorks, parseWorks, splitQty, withQty } from "./format";

export type Rates = Record<string, number>;

/** For saving: the team-visible text, and the private prices. */
export function splitRates(work: string): { work: string; rates: Rates } {
  const services = parseWorks(work).map(splitQty);
  return {
    work: joinWorks(services.map((s) => withQty(s.name, s.qty))),
    rates: Object.fromEntries(services.flatMap((s) => (s.price ? [[s.name, s.price] as const] : []))),
  };
}

/** For reading as admin. A price still in the text (saved by an older app) wins. */
export function withRates(work: string, rates: Rates | null | undefined): string {
  return joinWorks(
    parseWorks(work).map((part) => {
      const { name, qty, price } = splitQty(part);
      const saved = rates && Object.prototype.hasOwnProperty.call(rates, name) ? Number(rates[name]) : undefined;
      return withQty(name, qty, price ?? saved);
    })
  );
}
