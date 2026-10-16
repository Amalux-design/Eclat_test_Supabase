// Daily ping from Vercel Cron (see vercel.json) so the free Supabase project
// never sits idle for 7 days and pauses. Runs a tiny real query.
export default async function handler(req, res) {
  const url = (process.env.VITE_SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key = (process.env.VITE_SUPABASE_ANON_KEY || "").replace(/[^A-Za-z0-9._-]/g, "");
  if (!url || !key) return res.status(500).json({ ok: false, error: "Supabase env vars missing" });
  try {
    const r = await fetch(`${url}/rest/v1/rpc/is_invited`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: "keep-alive@eclat.invalid" }),
    });
    return res.status(r.ok ? 200 : 502).json({ ok: r.ok, status: r.status, at: new Date().toISOString() });
  } catch (e) {
    return res.status(502).json({ ok: false, error: String(e) });
  }
}
