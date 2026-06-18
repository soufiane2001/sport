// Analytics beacon collector (Vercel serverless function) — Vercel KV storage.
// Records pageviews + heartbeats. Country/city come from Vercel geo headers.
// No database required: uses Vercel KV (Upstash Redis) over REST if connected;
// if no store is connected, it silently no-ops (the site keeps working).
const { enabled, pipe } = require("./_kv");

function readRaw(req) {
  return new Promise((resolve) => {
    let d = "";
    req.on("data", (c) => { d += c; if (d.length > 1e4) req.destroy(); });
    req.on("end", () => resolve(d));
    req.on("error", () => resolve(""));
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).end(); return; }
  if (!enabled) { res.status(200).end(); return; }

  let b = req.body;
  if (b === undefined || b === null || b === "") {
    const raw = await readRaw(req);
    try { b = JSON.parse(raw); } catch (e) { b = {}; }
  } else if (typeof b === "string") {
    try { b = JSON.parse(b); } catch (e) { b = {}; }
  }
  if (!b || typeof b !== "object") b = {};

  const h = req.headers;
  const country = h["x-vercel-ip-country"] || null;
  const ua = h["user-agent"] || "";
  const isBot = /bot|crawl|spider|preview|monitor|lighthouse/i.test(ua);
  if (isBot) { res.status(200).end(); return; }

  const type = b.type === "heartbeat" ? "heartbeat" : "view";
  const path = (b.path || "").slice(0, 200) || "/";
  const ref = ((b.ref || "").slice(0, 200)) || "(direct)";
  const lang = (b.lang || "").slice(0, 8) || "??";
  const vid = (b.vid || "").slice(0, 40) || ("a" + Date.now());
  const now = Date.now();
  const hour = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH

  const cmds = [];
  if (type === "view") {
    cmds.push(["INCR", "views:total"]);
    cmds.push(["PFADD", "visitors:all", vid]);
    cmds.push(["HINCRBY", "traffic:hour", hour, 1]);
    cmds.push(["HINCRBY", "page:views", path, 1]);
    cmds.push(["HINCRBY", "lang:views", lang, 1]);
    cmds.push(["HINCRBY", "ref:views", ref, 1]);
    if (country) cmds.push(["HINCRBY", "country:views", country, 1]);
  } else {
    cmds.push(["INCR", "hb:total"]);
    cmds.push(["HINCRBY", "page:watch", path, 1]);
    if (country) cmds.push(["HINCRBY", "country:watch", country, 1]);
  }
  // presence (active in last 5 min)
  cmds.push(["ZADD", "active", now, vid]);
  cmds.push(["ZREMRANGEBYSCORE", "active", 0, now - 300000]);

  try { await pipe(cmds); } catch (e) {}
  res.status(204).end();
};
