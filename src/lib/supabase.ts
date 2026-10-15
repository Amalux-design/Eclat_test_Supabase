import { createClient } from "@supabase/supabase-js";

// Strip stray spaces, line breaks and quotes that sneak in when pasting into
// a hosting dashboard; any of them breaks every request.
const clean = (v: unknown) => (typeof v === "string" ? v.replace(/[\s"']/g, "").replace(/\/+$/, "") : undefined);
const url = clean(import.meta.env.VITE_SUPABASE_URL);
const anonKey = clean(import.meta.env.VITE_SUPABASE_ANON_KEY);

if (!url || !anonKey) {
  throw new Error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill them in.");
}

// The anon key is public by design: what each person can read or change is
// enforced by the database's row-level security policies (supabase/schema.sql).
export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  realtime: { params: { eventsPerSecond: 5 } },
});

export const PHOTO_BUCKET = "reference-photos";
