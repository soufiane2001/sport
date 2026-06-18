// Global site configuration
module.exports = {
  domain: "https://www.sportalive.live",
  domainBare: "https://sportalive.live",
  siteName: "SportaLive",
  // The live stream to diffuse (HLS .m3u8). See data/streams.js for per-match sources.
  streamUrl: "https://origin-m6web.live.6cloud.fr/out/v1/6play/6play-m6/cmaf_q2hyb21h/index-hd720.m3u8",
  // Monetization popunder smartlink (effectivecpmnetwork)
  adPopunder: "https://www.effectivecpmnetwork.com/jq97y8476?key=5ec0e0d291bbb0478b835617c8b2c877",
  // Default / source language
  defaultLang: "en",
  // World Cup 2026 window
  tournament: {
    name: "FIFA World Cup 2026",
    start: "2026-06-11",
    end: "2026-07-19",
  },
};
