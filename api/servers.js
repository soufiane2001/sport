// Dynamic stream/server config, editable from the admin (no redeploy).
// GET                       -> { sources: [...player-ready...] }  (public)
// GET ?key=ADMIN&raw=1      -> { raw: [...editable config...] }
// POST ?key=ADMIN {servers} -> save config to Vercel KV
const { enabled, pipe } = require("./_kv");
const streams = require("../data/streams");

const ADMIN = process.env.ADMIN_KEY || "060101";

function playerReady(list) {
  return list.map((s) => {
    const type = s.type === "dash" ? "dash" : (s.type === "auto" ? "auto" : "hls");
    if (s.proxy && /^https?:\/\//i.test(s.url)) {
      return { name: s.name, type, url: "/api/p?u=" + encodeURIComponent(s.url) };
    }
    return { name: s.name, type, url: s.url };
  });
}

async function getRaw() {
  if (enabled) {
    try {
      const r = await pipe([["GET", "streams:config"]]);
      if (r && r[0]) {
        const parsed = JSON.parse(r[0]);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (e) {}
  }
  return streams.DEFAULT_SOURCES;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const key = (req.query && req.query.key) || "";
  const authed = key && key === ADMIN;

  if (req.method === "POST") {
    if (!authed) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!enabled) { res.status(400).json({ error: "No Vercel KV connected — cannot save server config." }); return; }
    let b = req.body;
    if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } }
    const servers = b && b.servers;
    if (!Array.isArray(servers) || !servers.length) { res.status(400).json({ error: "servers must be a non-empty array" }); return; }
    const clean = servers.slice(0, 12).map((s) => ({
      name: String(s.name || "Server").slice(0, 40),
      url: String(s.url || "").trim().slice(0, 500),
      type: s.type === "dash" ? "dash" : (s.type === "auto" ? "auto" : "hls"),
      proxy: !!s.proxy,
    })).filter((s) => /^https?:\/\//i.test(s.url));
    if (!clean.length) { res.status(400).json({ error: "no valid server URLs (must start with http/https)" }); return; }
    try { await pipe([["SET", "streams:config", JSON.stringify(clean)]]); }
    catch (e) { res.status(500).json({ error: "save failed" }); return; }
    res.status(200).json({ ok: true, count: clean.length });
    return;
  }

  const raw = await getRaw();
  if (authed && req.query.raw) { res.status(200).json({ raw }); return; }
  res.status(200).json({ sources: playerReady(raw) });
};
