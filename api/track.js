// Analytics beacon collector (Vercel serverless function).
// Receives pageviews + heartbeats and stores them in Neon Postgres.
// Country/city are read from Vercel's geo headers automatically.
const { neon } = require("@neondatabase/serverless");

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
  if (!process.env.DATABASE_URL) { res.status(200).end(); return; }

  // Body may arrive parsed (JSON) or raw (sendBeacon text/plain)
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
  let city = h["x-vercel-ip-city"] || null;
  try { if (city) city = decodeURIComponent(city); } catch (e) {}
  const ua = (h["user-agent"] || "").slice(0, 300) || null;

  const type = b.type === "heartbeat" ? "heartbeat" : "view";
  const path = (b.path || "").slice(0, 300) || null;
  const ref = (b.ref || "").slice(0, 300) || null;
  const lang = (b.lang || "").slice(0, 10) || null;
  const vid = (b.vid || "").slice(0, 40) || null;

  try {
    const sql = neon(process.env.DATABASE_URL);
    await sql`create table if not exists events (
      id bigserial primary key,
      ts timestamptz not null default now(),
      type text, path text, ref text,
      country text, city text, lang text, ua text, vid text
    )`;
    await sql`insert into events (type, path, ref, country, city, lang, ua, vid)
      values (${type}, ${path}, ${ref}, ${country}, ${city}, ${lang}, ${ua}, ${vid})`;
    res.status(204).end();
  } catch (e) {
    // Never break the page over analytics
    res.status(200).end();
  }
};
