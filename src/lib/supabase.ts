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

// Two kinds of public key work: "sb_publishable_…" (newer projects) and the
// older long "anon" key. A secret key skips every security rule, so refuse it.
function keyKind(key: string): "public" | "secret" | "damaged" {
  if (key.startsWith("sb_secret_")) return "secret";
  if (/^sb_publishable_[A-Za-z0-9_-]{25,}$/.test(key)) return "public";
  const parts = key.split(".");
  if (parts.length !== 3 || key.length < 100) return "damaged";
  try {
    const { role } = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (role === "service_role") return "secret";
    return role === "anon" ? "public" : "damaged";
  } catch {
    return "damaged";
  }
}

const kind = keyKind(anonKey);
if (kind === "secret") {
  throw new Error("VITE_SUPABASE_ANON_KEY holds a secret key. Replace that key in Supabase now, then use the publishable key here.");
}
if (kind === "damaged") {
  throw new Error("VITE_SUPABASE_ANON_KEY looks cut short or damaged. Paste the full publishable (or anon) key into Vercel again, then redeploy.");
}

// When the login can't be renewed (weak signal, phone asleep), supabase-js sends
// data requests as a signed-out visitor. The answers look real (an empty list,
// "0 rows deleted"), so refuse those requests and report a connection problem.
// The one data call made before sign-in is is_invited.
const signedInFetch: typeof fetch = (input, init) => {
  const address = String(input);
  if (
    /\/(rest|storage)\/v1\//.test(address) &&
    !/\/rpc\/is_invited($|\?)/.test(address) &&
    new Headers(init?.headers).get("Authorization") === `Bearer ${anonKey}`
  )
    return Promise.reject(new TypeError("Failed to fetch: your login couldn't be renewed"));
  return fetch(input, init);
};

// The anon key is public by design: what each person can read or change is
// enforced by the database's row-level security policies (supabase/schema.sql).
export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  global: { fetch: signedInFetch },
  realtime: { params: { eventsPerSecond: 5 } },
});

export const PHOTO_BUCKET = "reference-photos";
