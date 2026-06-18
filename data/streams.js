// Live stream sources for each match.
//
// HOW IT WORKS:
//  - Each source is { name, url, type }.  type = "dash" (.mpd) | "hls" (.m3u8) | "auto".
//  - A match uses bySlug[<match-slug>] if defined, otherwise DEFAULT_SOURCES.
//  - You can give a match SEVERAL sources -> the player shows "Server 1 / 2 / 3" buttons
//    so viewers can switch if one is offline/geo-blocked.
//
// TO BROADCAST ALL 104 MATCHES: add an entry per match slug below with the URL(s)
// of the channel(s) broadcasting that match. Slugs are like:
//   "argentina-vs-algeria-world-cup-2026", "final-world-cup-2026", etc.
// Run `node generate.js` after editing.

const DEFAULT_SOURCES = [
  // Direct (fast) — works in most countries.
  { name: "Server 1 · HD", url: "https://nl1.nghk.ai/ArenaPremium1HD/index.m3u8", type: "hls" },
  // Proxied via Vercel — bypasses geo-blocks (e.g. Morocco). Auto-used if S1 fails.
  { name: "Server 2 · Proxy", url: "https://nl1.nghk.ai/ArenaPremium1HD/index.m3u8", type: "hls", proxy: true },
];

// Optional: reusable channel sources you can point matches to.
const CHANNELS = {
  ArenaPremium1: { name: "Arena Premium 1 · HD", url: "https://nl1.nghk.ai/ArenaPremium1HD/index.m3u8", type: "hls" },
  // beinMax1: { name: "beIN MAX 1", url: "https://.../index.m3u8", type: "hls" },
};

// Per-match overrides. Example (commented):
const bySlug = {
  // "argentina-vs-algeria-world-cup-2026": [CHANNELS.HRT2, { name: "Server 2", url: "https://.../index.m3u8", type: "hls" }],
};

function sourcesFor(slug) {
  return (bySlug[slug] && bySlug[slug].length) ? bySlug[slug] : DEFAULT_SOURCES;
}

module.exports = { DEFAULT_SOURCES, CHANNELS, bySlug, sourcesFor };
