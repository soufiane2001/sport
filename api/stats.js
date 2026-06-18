// Admin analytics aggregator (Vercel serverless function) — Vercel KV.
// Protected by ?key=ADMIN_KEY (default "060101"). Returns JSON for /admin/.
const { enabled, pipe, hToObj } = require("./_kv");

const ADMIN = process.env.ADMIN_KEY || "060101";
const HB_SECONDS = 15;

function sortHash(obj, limit) {
  return Object.keys(obj)
    .map((k) => ({ k, v: obj[k] }))
    .sort((a, b) => b.v - a.v)
    .slice(0, limit || 25);
}

module.exports = async (req, res) => {
  const key = (req.query && req.query.key) || "";
  if (key !== ADMIN) { res.status(401).json({ error: "unauthorized" }); return; }
  res.setHeader("Cache-Control", "no-store");

  const empty = {
    ok: true, storage: false, generatedAt: new Date().toISOString(),
    totals: { views: 0, visitors: 0, views24h: 0, activeNow: 0, watchHours: 0 },
    timeline: [], countries: [], pages: [], langs: [], referrers: [], live: [],
  };
  if (!enabled) { res.status(200).json(empty); return; }

  try {
    const now = Date.now();
    const r = await pipe([
      ["GET", "views:total"],            // 0
      ["GET", "hb:total"],               // 1
      ["PFCOUNT", "visitors:all"],       // 2
      ["HGETALL", "country:views"],      // 3
      ["HGETALL", "country:watch"],      // 4
      ["HGETALL", "page:views"],         // 5
      ["HGETALL", "page:watch"],         // 6
      ["HGETALL", "lang:views"],         // 7
      ["HGETALL", "ref:views"],          // 8
      ["HGETALL", "traffic:hour"],       // 9
      ["ZRANGEBYSCORE", "active", now - 300000, now, "WITHSCORES"], // 10
    ]);

    // active visitors: [vid, score, vid, score, ...]
    const activeArr = Array.isArray(r[10]) ? r[10] : [];
    const activeVids = [];
    const seenAt = {};
    for (let i = 0; i < activeArr.length; i += 2) {
      activeVids.push(activeArr[i]);
      seenAt[activeArr[i]] = Number(activeArr[i + 1]) || 0;
    }
    // fetch per-visitor metadata
    let live = [];
    if (activeVids.length) {
      const metas = await pipe([["HMGET", "meta"].concat(activeVids)]);
      const arr = (metas && metas[0]) || [];
      live = activeVids.map((vid, i) => {
        let m = {};
        try { m = JSON.parse(arr[i] || "{}"); } catch (e) { m = {}; }
        return {
          id: vid, country: m.c || "??", city: m.ci || "",
          page: m.p || "/", lang: m.l || "", agoSec: Math.round((now - (seenAt[vid] || now)) / 1000),
        };
      }).sort((a, b) => a.agoSec - b.agoSec);
    }

    const countryViews = hToObj(r[3]), countryWatch = hToObj(r[4]);
    const pageViews = hToObj(r[5]), pageWatch = hToObj(r[6]);
    const langViews = hToObj(r[7]), refViews = hToObj(r[8]);
    const trafficHour = hToObj(r[9]);

    // last 24 hourly buckets (ascending)
    const timeline = [];
    let views24h = 0;
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now - i * 3600000);
      const hk = d.toISOString().slice(0, 13);
      const v = trafficHour[hk] || 0;
      views24h += v;
      timeline.push({ hour: hk + ":00", views: v });
    }

    const countries = sortHash(countryViews).map((x) => ({
      country: x.k, views: x.v,
      watch_min: Math.round((countryWatch[x.k] || 0) * HB_SECONDS / 60),
    }));
    const pages = sortHash(pageViews).map((x) => ({
      path: x.k, views: x.v,
      watch_min: Math.round((pageWatch[x.k] || 0) * HB_SECONDS / 60),
    }));
    const langs = sortHash(langViews, 20).map((x) => ({ lang: x.k, views: x.v }));
    const referrers = sortHash(refViews, 15).map((x) => ({ ref: x.k, views: x.v }));

    const hb = Number(r[1] || 0);
    res.status(200).json({
      ok: true, storage: true, generatedAt: new Date().toISOString(),
      totals: {
        views: Number(r[0] || 0),
        visitors: Number(r[2] || 0),
        views24h,
        activeNow: activeVids.length,
        watchHours: +(hb * HB_SECONDS / 3600).toFixed(1),
      },
      live,
      timeline, countries, pages, langs, referrers,
    });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
