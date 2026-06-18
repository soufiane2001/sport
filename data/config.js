// Global site configuration
module.exports = {
  domain: "https://www.sportalive.live",
  domainBare: "https://sportalive.live",
  siteName: "SportaLive",
  // The live stream to diffuse (HLS .m3u8). See data/streams.js for per-match sources.
  streamUrl: "https://origin-m6web.live.6cloud.fr/out/v1/6play/6play-m6/cmaf_q2hyb21h/index-hd720.m3u8",
  // Monetization popunder smartlink (effectivecpmnetwork)
  adPopunder: "https://www.effectivecpmnetwork.com/hcaq4nu9f5?key=3bc0543a8c18dd8145fd0b0ef8cede34",
  // Popunder min interval in ms (fires on a user gesture, at most this often)
  adPopunderGapMs: 60000,
  // Auto full-screen interstitial ad interval in ms (in-page overlay, never blocked)
  adInterstitialGapMs: 120000,
  // Native/banner ad (effectivecpmnetwork invoke.js)
  adNativeSrc: "https://pl29569991.effectivecpmnetwork.com/8c2948cd379e7f712c043acbbd7ad4dd/invoke.js",
  adNativeId: "container-8c2948cd379e7f712c043acbbd7ad4dd",
  // Default / source language
  defaultLang: "en",
  // World Cup 2026 window
  tournament: {
    name: "FIFA World Cup 2026",
    start: "2026-06-11",
    end: "2026-07-19",
  },
};
