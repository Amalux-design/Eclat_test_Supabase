import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

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
