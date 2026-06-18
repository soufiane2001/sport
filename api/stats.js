// Admin analytics aggregator (Vercel serverless function).
// Protected by ?key=ADMIN_KEY. Returns JSON consumed by /admin/.
const { neon } = require("@neondatabase/serverless");

const HB_SECONDS = 15; // one heartbeat ~ every 15s of watch time

module.exports = async (req, res) => {
  const key = (req.query && req.query.key) || "";
  if (!process.env.ADMIN_KEY) {
    res.status(500).json({ error: "ADMIN_KEY not configured on the server." });
    return;
  }
  if (key !== process.env.ADMIN_KEY) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  if (!process.env.DATABASE_URL) {
    res.status(500).json({ error: "DATABASE_URL not configured on the server." });
    return;
  }

  const sql = neon(process.env.DATABASE_URL);
  try {
    await sql`create table if not exists events (
      id bigserial primary key, ts timestamptz not null default now(),
      type text, path text, ref text, country text, city text, lang text, ua text, vid text
    )`;

    const totals = (await sql`
      select
        count(*) filter (where type='view')                         as views,
        count(distinct vid)                                         as visitors,
        count(*) filter (where type='heartbeat')                    as hb,
        count(*) filter (where type='view' and ts > now() - interval '24 hours') as views_24h,
        count(distinct vid) filter (where ts > now() - interval '5 minutes')     as active_now
      from events`)[0];

    const watchSeconds = Number(totals.hb || 0) * HB_SECONDS;

    const timeline = await sql`
      select to_char(date_trunc('hour', ts), 'YYYY-MM-DD"T"HH24:00') as hour,
             count(*) filter (where type='view') as views,
             count(distinct vid) as visitors
      from events
      where ts > now() - interval '24 hours'
      group by 1 order by 1`;

    const countries = await sql`
      select coalesce(country,'??') as country,
             count(*) filter (where type='view') as views,
             count(distinct vid) as visitors,
             round((count(*) filter (where type='heartbeat')) * ${HB_SECONDS} / 60.0) as watch_min
      from events
      group by 1 order by views desc limit 25`;

    const pages = await sql`
      select coalesce(path,'/') as path,
             count(*) filter (where type='view') as views,
             count(distinct vid) as visitors,
             round((count(*) filter (where type='heartbeat')) * ${HB_SECONDS} / 60.0) as watch_min
      from events
      group by 1 order by views desc limit 25`;

    const langs = await sql`
      select coalesce(lang,'??') as lang, count(*) filter (where type='view') as views
      from events group by 1 order by views desc limit 20`;

    const referrers = await sql`
      select case when ref is null or ref='' then '(direct)' else ref end as ref,
             count(*) filter (where type='view') as views
      from events group by 1 order by views desc limit 15`;

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      ok: true,
      generatedAt: new Date().toISOString(),
      totals: {
        views: Number(totals.views || 0),
        visitors: Number(totals.visitors || 0),
        views24h: Number(totals.views_24h || 0),
        activeNow: Number(totals.active_now || 0),
        watchHours: +(watchSeconds / 3600).toFixed(1),
      },
      timeline, countries, pages, langs, referrers,
    });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
};
