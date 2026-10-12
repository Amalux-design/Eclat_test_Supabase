// Éclat by Harsha service menu. Picking a service in the booking form fills
// in its price; prices can still be edited per booking.

export interface Service {
  name: string;
  price: number | null; // null = no fixed price (e.g. on-call consultation)
  note?: string;
}

export interface ServiceGroup {
  title: string;
  services: Service[];
}

export const SERVICE_GROUPS: ServiceGroup[] = [
  {
    title: "Bridal",
    services: [
      { name: "Classic Bridal", price: 15000, note: "By the Éclat team" },
      { name: "Signature Bridal", price: 20000, note: "By Harsha" },
      { name: "Luxe Bridal", price: 40000, note: "By Harsha" },
      { name: "Airbrush Bridal", price: 45000, note: "Hair, draping and touch-up kit included" },
    ],
  },
  {
    title: "Engagement",
    services: [
      { name: "Classic Engagement", price: 8000, note: "By the Éclat team" },
      { name: "Signature Engagement", price: 12000, note: "By Harsha" },
    ],
  },
  {
    title: "Occasion",
    services: [
      { name: "Occasional Glam", price: 5000, note: "By the Éclat team" },
      { name: "Signature Occasional", price: 8000, note: "By Harsha" },
      { name: "Signature Grooming", price: 5000, note: "Calicut only" },
    ],
  },
  {
    title: "Saree draping",
    services: [
      { name: "Saree Draping (Bridal)", price: 3000 },
      { name: "Saree Draping (Non-bridal)", price: 2000 },
    ],
  },
  {
    title: "Consultation & trials",
    services: [
      { name: "On-call Consultation", price: null },
      { name: "In-person Consultation", price: 800, note: "Calicut" },
      { name: "Trial Makeup", price: 5000, note: "Calicut only" },
      { name: "Airbrush Trial", price: 10000, note: "Calicut only" },
    ],
  },
];

const PRICE_BY_NAME = new Map(
  SERVICE_GROUPS.flatMap((g) => g.services.map((s) => [s.name, s.price] as const))
);

export function servicePrice(name: string): number | null {
  return PRICE_BY_NAME.get(name) ?? null;
}

export const EVENT_TYPES = [
  "Wedding",
  "Engagement",
  "Reception",
  "Haldi / Mehendi",
  "Save the date",
  "Party",
  "Photoshoot",
  "Trial",
  "Consultation",
  "Other",
];
