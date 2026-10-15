import { createClient } from "@supabase/supabase-js";

// Strip stray spaces, line breaks and quotes that sneak in when pasting into
// a hosting dashboard; any of them breaks every request.
const clean = (v: unknown) => (typeof v === "string" ? v.replace(/[\s"']/g, "").replace(/\/+$/, "") : undefined);
const url = clean(import.meta.env.VITE_SUPABASE_URL);
// A key is only letters, digits, "-", "_" and "."; drop anything else
// (invisible characters, smart quotes) that the browser refuses to send.
const anonKey = clean(import.meta.env.VITE_SUPABASE_ANON_KEY)?.replace(/[^A-Za-z0-9._-]/g, "");

if (!url || !anonKey) {
  throw new Error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill them in.");
}

if (anonKey.split(".").length !== 3 || anonKey.length < 100) {
  throw new Error("VITE_SUPABASE_ANON_KEY looks cut short or damaged. Paste the full anon key into Vercel again, then redeploy.");
}

// The anon key is public by design: what each person can read or change is
// enforced by the database's row-level security policies (supabase/schema.sql).
export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  realtime: { params: { eventsPerSecond: 5 } },
});

export const PHOTO_BUCKET = "reference-photos";
