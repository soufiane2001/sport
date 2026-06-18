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
  // Server 1 — M6 (https + CORS *), plays directly. Not blocked in Morocco.
  { name: "Server 1 · HD", url: "https://origin-m6web.live.6cloud.fr/out/v1/6play/6play-m6/cmaf_q2hyb21h/index-hd720.m3u8", type: "hls" },
  // Server 2 — CT Sport (HTTP, no CORS): MUST go through the proxy (HTTPS upgrade + CORS).
  { name: "Server 2 · Sport", url: "http://88.212.15.19/live/test_ctsport_25p/playlist.m3u8", type: "hls", proxy: true },
  // Server 3 — Arena Premium via proxy (geo-bypass backup).
  { name: "Server 3 · Arena", url: "https://nl1.nghk.ai/ArenaPremium1HD/index.m3u8", type: "hls", proxy: true },
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
