// HLS proxy (Vercel serverless). Fetches playlists/segments from an upstream
// stream using Vercel's (non-Morocco) IP, bypassing geo-blocks for viewers
// in restricted countries. Playlist URLs are rewritten to keep going through
// this proxy. Usage: /api/p?u=<encoded absolute url>
//
// NOTE: proxying video uses Vercel bandwidth. Fine for moderate traffic; for
// large scale relay the stream through a dedicated server (e.g. Oracle VM).

function proxify(ref, base) {
  let abs;
  try { abs = new URL(ref, base).toString(); } catch (e) { return ref; }
  return "/api/p?u=" + encodeURIComponent(abs);
}

module.exports = async (req, res) => {
  const u = req.query && req.query.u;
  if (!u || !/^https?:\/\//i.test(u)) { res.status(400).end("bad url"); return; }

  try {
    const upstream = await fetch(u, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        "Accept": "*/*",
      },
      redirect: "follow",
    });
    if (!upstream.ok) { res.status(upstream.status).end("upstream " + upstream.status); return; }

    const ct = upstream.headers.get("content-type") || "";
    const isM3u8 = /mpegurl|x-mpegURL/i.test(ct) || /\.m3u8(\?|$)/i.test(u);
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (isM3u8) {
      const text = await upstream.text();
      const out = text.split("\n").map((line) => {
        const t = line.trim();
        if (!t) return line;
        if (t[0] === "#") {
          // rewrite URI="..." (EXT-X-KEY, EXT-X-MAP, etc.)
          return line.replace(/URI="([^"]+)"/g, (m, p1) => `URI="${proxify(p1, u)}"`);
        }
        return proxify(t, u); // media/variant URL line
      }).join("\n");
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      res.setHeader("Cache-Control", "no-store");
      res.status(200).send(out);
    } else {
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.setHeader("Content-Type", ct || "video/mp2t");
      res.setHeader("Cache-Control", "public, max-age=15");
      res.status(200).send(buf);
    }
  } catch (e) {
    res.status(502).end("proxy error");
  }
};
