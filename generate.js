#!/usr/bin/env node
/* SportaLive static-site generator
 * Builds: multilingual homepages + per-match watch pages (SEO),
 * sitemap.xml + per-language sitemaps, robots.txt, hreflang alternates,
 * JSON-LD structured data, Open Graph, and the DASH player pages.
 */
const fs = require("fs");
const path = require("path");

const cfg = require("./data/config");
const { LANGS, RTL, t } = require("./data/i18n");
const { build } = require("./data/matches");

const ROOT = __dirname;
const OUT = ROOT; // deploy from project root
const matches = build();
const COMP = cfg.tournament.name;

// locale map for date formatting
const LOCALE = {
  en: "en-US", es: "es-ES", fr: "fr-FR", de: "de-DE", it: "it-IT", pt: "pt-BR",
  ar: "ar", ru: "ru-RU", zh: "zh-CN", ja: "ja-JP", ko: "ko-KR", hi: "hi-IN",
  tr: "tr-TR", id: "id-ID", vi: "vi-VN", th: "th-TH", fa: "fa-IR", nl: "nl-NL",
  pl: "pl-PL", ur: "ur-PK",
};

/* ---------------- helpers ---------------- */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function homePath(lang) { return lang === cfg.defaultLang ? "/" : `/${lang}/`; }
function matchPath(lang, slug) {
  return lang === cfg.defaultLang ? `/match/${slug}/` : `/${lang}/match/${slug}/`;
}
const abs = (p) => cfg.domain + p;

function tpl(str, vars) {
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ""));
}

function fmtDate(iso, lang) {
  try {
    return new Intl.DateTimeFormat(LOCALE[lang] || "en-US",
      { weekday: "short", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
  } catch (e) { return iso.slice(0, 10); }
}
function fmtTime(iso, lang) {
  try {
    return new Intl.DateTimeFormat(LOCALE[lang] || "en-US",
      { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(iso)) + " UTC";
  } catch (e) { return ""; }
}

function stageLabel(lang, m) {
  const L = t[lang].stage;
  if (m.stage === "group") return `${L.group} · ${t[lang].group} ${m.group}`;
  return L[m.stage] || m.stage;
}
function teamName(lang, m, which) {
  // knockout placeholders kept in English structure; team names are proper nouns
  return which === "A" ? m.teamA : m.teamB;
}
function matchTitleText(lang, m) {
  return `${m.teamA} ${t[lang].vs} ${m.teamB}`;
}

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function writeFile(rel, html) {
  const full = path.join(OUT, rel);
  ensureDir(path.dirname(full));
  fs.writeFileSync(full, html, "utf8");
}

/* ---------------- shared chrome ---------------- */
function hreflangTags(buildPath) {
  // buildPath: (lang) => path
  let out = "";
  for (const l of LANGS) out += `  <link rel="alternate" hreflang="${l}" href="${esc(abs(buildPath(l)))}" />\n`;
  out += `  <link rel="alternate" hreflang="x-default" href="${esc(abs(buildPath(cfg.defaultLang)))}" />\n`;
  return out;
}

function head(lang, o) {
  const dir = t[lang].dir;
  const canonical = abs(o.canonicalPath);
  const ogImg = abs("/assets/img/og.svg");
  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(o.title)}</title>
  <meta name="description" content="${esc(o.desc)}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <link rel="canonical" href="${esc(canonical)}" />
  <meta property="og:type" content="${o.ogType || "website"}" />
  <meta property="og:site_name" content="${cfg.siteName}" />
  <meta property="og:title" content="${esc(o.title)}" />
  <meta property="og:description" content="${esc(o.desc)}" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta property="og:image" content="${esc(ogImg)}" />
  <meta property="og:locale" content="${(LOCALE[lang] || "en_US").replace("-", "_")}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(o.title)}" />
  <meta name="twitter:description" content="${esc(o.desc)}" />
  <meta name="twitter:image" content="${esc(ogImg)}" />
${hreflangTags(o.buildPath)}  <link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://cdn.dashjs.org" />
  <link rel="stylesheet" href="/assets/css/style.css" />
  <script type="application/ld+json">${JSON.stringify(o.jsonld)}</script>
</head>
<body>`;
}

function topbar(lang, o) {
  // language selector: option value = alternate URL of THIS page in that lang
  let opts = "";
  for (const l of LANGS) {
    const sel = l === lang ? " selected" : "";
    opts += `<option value="${esc(o.buildPath(l))}"${sel}>${esc(t[lang === l ? l : l].name)}</option>`;
  }
  const T = t[lang];
  return `
<header class="topbar">
  <a class="brand" href="${homePath(lang)}"><span class="dot">▶</span>Sporta<b>Live</b></a>
  <nav class="nav-links">
    <a href="${homePath(lang)}">${esc(T.nav_home)}</a>
    <a href="${homePath(lang)}#matches">${esc(T.nav_matches)}</a>
    <a href="${homePath(lang)}#schedule">${esc(T.nav_schedule)}</a>
  </nav>
  <div class="search">
    <input type="text" placeholder="${esc(T.nav_matches)}…" aria-label="search" />
    <button>🔍</button>
  </div>
  <div class="topbar-right">
    <select class="lang-select" id="langSelect" aria-label="Language">${opts}</select>
    <a class="btn" href="${homePath(lang)}#live">● ${esc(T.nav_live)}</a>
  </div>
</header>`;
}

function sidebar(lang, current) {
  const T = t[lang];
  const live = matches.slice(0, 14);
  let rows = "";
  for (const m of live) {
    const initials = (m.teamA[0] || "?") + (m.teamB[0] || "?");
    rows += `
    <a class="chan" href="${matchPath(lang, m.slug)}">
      <span class="flag">${esc(initials)}</span>
      <span class="meta">
        <div class="n">${esc(matchTitleText(lang, m))}</div>
        <div class="g">${esc(stageLabel(lang, m))}</div>
      </span>
    </a>`;
  }
  return `
<aside class="sidebar">
  <div class="side-title">${esc(T.live_now)}</div>
  ${rows}
</aside>`;
}

function chatPanel(lang) {
  const T = t[lang];
  return `
<aside class="chat">
  <div class="chat-head">${esc(T.chat_title)}</div>
  <div class="chat-body" id="chatBody"></div>
  <div class="chat-foot"><input type="text" placeholder="${esc(T.chat_title)}…" /></div>
</aside>`;
}

function footer(lang, o) {
  const T = t[lang];
  let langs = "";
  for (const l of LANGS) langs += `<a href="${esc(o.buildPath(l))}" hreflang="${l}">${esc(t[l].name)}</a>`;
  return `
<footer class="footer">
  <div><strong>SportaLive</strong> · ${COMP} · ${esc(T.free_stream)}</div>
  <div class="langs">${langs}</div>
  <div>${esc(T.footer_note)} © 2026 SportaLive.live</div>
</footer>`;
}

function scripts(lang) {
  return `
<script>window.SPORTALIVE_MPD=${JSON.stringify(cfg.streamMpd)};window.SPORTALIVE_AD=${JSON.stringify(cfg.adPopunder)};</script>
<script src="https://cdn.dashjs.org/latest/dash.all.min.js"></script>
<script src="/assets/js/app.js"></script>
</body>
</html>`;
}

/* ---------------- pages ---------------- */
function homePage(lang) {
  const T = t[lang];
  const buildPath = (l) => homePath(l);
  const upcoming = matches.slice(0, 18);

  // JSON-LD: WebSite + ItemList of events
  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", name: cfg.siteName, url: cfg.domain,
        inLanguage: lang,
        potentialAction: { "@type": "SearchAction",
          target: cfg.domain + "/?q={search_term_string}", "query-input": "required name=search_term_string" } },
      { "@type": "Organization", name: cfg.siteName, url: cfg.domain, logo: abs("/assets/img/og.svg") },
      { "@type": "ItemList", itemListElement: upcoming.map((m, i) => ({
        "@type": "ListItem", position: i + 1,
        url: abs(matchPath(lang, m.slug)),
        name: `${matchTitleText(lang, m)} — ${COMP}` })) },
    ],
  };

  let cards = "";
  upcoming.forEach((m, i) => {
    const liveTag = i < 3 ? `<span class="livep">● ${esc(T.nav_live)}</span>` : "";
    cards += `
    <a class="card" href="${matchPath(lang, m.slug)}">
      <div class="thumb">
        ${liveTag}
        <span class="stagep">${esc(stageLabel(lang, m))}</span>
        <span class="match">${esc(m.teamA)}<br>${esc(T.vs)}<br>${esc(m.teamB)}</span>
      </div>
      <div class="body">
        <div class="t">${esc(matchTitleText(lang, m))}</div>
        <div class="d">${esc(fmtDate(m.dateISO, lang))} · ${esc(m.city)}</div>
      </div>
    </a>`;
  });

  const body = `
${topbar(lang, { buildPath })}
<div class="layout">
  ${sidebar(lang, null)}
  <main class="main">
    <section class="hero" id="live">
      <h1>${esc(T.hero_title)}</h1>
      <p>${esc(T.hero_sub)}</p>
      <a class="btn" href="${matchPath(lang, matches[0].slug)}">▶ ${esc(T.watch_live)}</a>
    </section>
    <section class="section" id="matches">
      <h2>${esc(T.upcoming)} — ${esc(COMP)}</h2>
      <div class="grid">${cards}</div>
    </section>
    <section class="section" id="schedule">
      <h2>${esc(T.full_schedule)}</h2>
      <p style="color:var(--muted)">${esc(T.seo_home_desc)}</p>
    </section>
    ${footer(lang, { buildPath })}
  </main>
  ${chatPanel(lang)}
</div>`;

  const html = head(lang, {
    title: T.seo_home_title, desc: T.seo_home_desc,
    canonicalPath: homePath(lang), buildPath, jsonld,
  }) + body + scripts(lang);

  writeFile(lang === cfg.defaultLang ? "index.html" : `${lang}/index.html`, html);
}

function matchPage(lang, m) {
  const T = t[lang];
  const buildPath = (l) => matchPath(l, m.slug);
  const dateStr = fmtDate(m.dateISO, lang);
  const timeStr = fmtTime(m.dateISO, lang);
  const stage = stageLabel(lang, m);
  const vars = { A: m.teamA, B: m.teamB, date: dateStr, time: timeStr,
    venue: m.venue, city: m.city, stage, comp: COMP };

  const title = tpl(T.match_title_tpl, vars);
  const desc = tpl(T.match_desc_tpl, vars);
  const h1 = tpl(T.watch_h1_tpl, vars);

  // JSON-LD: SportsEvent + BroadcastEvent + BreadcrumbList
  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SportsEvent",
        name: `${m.teamA} vs ${m.teamB} — ${COMP}`,
        sport: "Soccer",
        startDate: m.dateISO,
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
        location: { "@type": "Place", name: m.venue,
          address: { "@type": "PostalAddress", addressLocality: m.city, addressCountry: m.country } },
        competitor: [
          { "@type": "SportsTeam", name: m.teamA },
          { "@type": "SportsTeam", name: m.teamB },
        ],
        superEvent: { "@type": "SportsEvent", name: COMP },
        url: abs(matchPath(lang, m.slug)),
        description: desc,
        publication: {
          "@type": "BroadcastEvent", isLiveBroadcast: true,
          name: `${m.teamA} vs ${m.teamB} live stream`,
          startDate: m.dateISO, inLanguage: lang,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: T.nav_home, item: abs(homePath(lang)) },
          { "@type": "ListItem", position: 2, name: stage, item: abs(homePath(lang)) + "#schedule" },
          { "@type": "ListItem", position: 3, name: `${m.teamA} vs ${m.teamB}`, item: abs(matchPath(lang, m.slug)) },
        ],
      },
    ],
  };

  // related: same group or neighbours
  const related = matches.filter((x) => x.num !== m.num &&
    (m.group ? x.group === m.group : Math.abs(x.num - m.num) <= 4)).slice(0, 8);
  let relCards = "";
  related.forEach((r) => {
    relCards += `
    <a class="card" href="${matchPath(lang, r.slug)}">
      <div class="thumb"><span class="stagep">${esc(stageLabel(lang, r))}</span>
        <span class="match">${esc(r.teamA)}<br>${esc(T.vs)}<br>${esc(r.teamB)}</span></div>
      <div class="body"><div class="t">${esc(matchTitleText(lang, r))}</div>
        <div class="d">${esc(fmtDate(r.dateISO, lang))}</div></div>
    </a>`;
  });

  const body = `
${topbar(lang, { buildPath })}
<div class="layout">
  ${sidebar(lang, m)}
  <main class="main">
    <div class="player-wrap">
      <span class="live-badge">● ${esc(T.nav_live)}</span>
      <span class="viewers-badge">👁 <span id="viewerCount">0</span> ${esc(T.viewers)}</span>
      <video id="player" playsinline controls preload="none"></video>
      <div class="player-overlay" id="playerOverlay">
        <div class="big">${esc(matchTitleText(lang, m))}</div>
        <button class="play-btn" id="startBtn" aria-label="Play">▶</button>
        <div style="color:#adadb8">${esc(T.watch_live)} · ${esc(T.free_stream)}</div>
      </div>
    </div>
    <div class="info-bar">
      <h1>${esc(h1)}</h1>
      <div class="sub">${esc(stage)} · ${esc(COMP)} · <span id="viewerCount2"></span></div>
      <div class="tags">
        <span class="tag">${esc(T.free_stream)}</span>
        <span class="tag">HD</span>
        <span class="tag">${esc(m.venue)}</span>
        <span class="tag">${esc(m.city)}, ${esc(m.country)}</span>
      </div>
      <div class="meta-grid">
        <div class="mi"><div class="k">${esc(T.kickoff)}</div><div class="v">${esc(dateStr)}</div></div>
        <div class="mi"><div class="k">${esc(T.kickoff)} (UTC)</div><div class="v">${esc(timeStr)}</div></div>
        <div class="mi"><div class="k">${esc(T.venue)}</div><div class="v">${esc(m.venue)}</div></div>
        <div class="mi"><div class="k">${esc(T.nav_matches)}</div><div class="v">${esc(stage)}</div></div>
      </div>
    </div>
    <section class="section">
      <div class="prose">
        <h2>${esc(h1)}</h2>
        <p>${esc(tpl(T.match_desc_tpl, vars))}</p>
        <p>${esc(matchTitleText(lang, m))} — ${esc(dateStr)}, ${esc(m.venue)}, ${esc(m.city)}.
        ${esc(T.free_stream)} · ${esc(COMP)}.</p>
      </div>
    </section>
    <section class="section">
      <h2>${esc(T.related)}</h2>
      <div class="grid">${relCards}</div>
    </section>
    ${footer(lang, { buildPath })}
  </main>
  ${chatPanel(lang)}
</div>`;

  const html = head(lang, {
    title, desc, canonicalPath: matchPath(lang, m.slug),
    buildPath, jsonld, ogType: "video.other",
  }) + body + scripts(lang);

  const rel = lang === cfg.defaultLang
    ? `match/${m.slug}/index.html`
    : `${lang}/match/${m.slug}/index.html`;
  writeFile(rel, html);
}

/* ---------------- sitemaps & robots ---------------- */
function buildSitemaps() {
  const sm = [];
  // one urlset per language with xhtml:link alternates
  for (const lang of LANGS) {
    let urls = "";
    const add = (loc, buildPath, priority, changefreq) => {
      let alts = "";
      for (const l of LANGS) alts += `    <xhtml:link rel="alternate" hreflang="${l}" href="${esc(abs(buildPath(l)))}"/>\n`;
      alts += `    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(abs(buildPath(cfg.defaultLang)))}"/>\n`;
      urls += `  <url>\n    <loc>${esc(abs(loc))}</loc>\n${alts}    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`;
    };
    add(homePath(lang), (l) => homePath(l), "1.0", "hourly");
    for (const m of matches) add(matchPath(lang, m.slug), (l) => matchPath(l, m.slug), "0.8", "hourly");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}</urlset>\n`;
    writeFile(`sitemap-${lang}.xml`, xml);
    sm.push(`sitemap-${lang}.xml`);
  }
  const idx = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    sm.map((s) => `  <sitemap><loc>${esc(abs("/" + s))}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></sitemap>`).join("\n") +
    `\n</sitemapindex>\n`;
  writeFile("sitemap.xml", idx);

  const robots = `User-agent: *\nAllow: /\n\nSitemap: ${abs("/sitemap.xml")}\n`;
  writeFile("robots.txt", robots);
}

/* ---------------- assets ---------------- */
function copyAssets() {
  const srcAssets = path.join(ROOT, "src", "assets");
  const dstAssets = path.join(OUT, "assets");
  fs.cpSync(srcAssets, dstAssets, { recursive: true });
  // favicon + og image (SVG)
  ensureDir(path.join(dstAssets, "img"));
  const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#0e0e10"/>
<rect width="1200" height="630" fill="url(#g)"/>
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#1a0d2e"/><stop offset="1" stop-color="#0e0e10"/></linearGradient></defs>
<circle cx="150" cy="315" r="60" fill="#9147ff"/>
<text x="150" y="335" font-family="Arial" font-size="60" fill="#fff" text-anchor="middle">&#9654;</text>
<text x="250" y="300" font-family="Arial,Helvetica" font-size="72" font-weight="800" fill="#fff">Sporta<tspan fill="#9147ff">Live</tspan></text>
<text x="250" y="370" font-family="Arial" font-size="36" fill="#adadb8">World Cup 2026 — Free Live Streaming</text>
</svg>`;
  fs.writeFileSync(path.join(dstAssets, "img", "og.svg"), og, "utf8");
  const fav = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="14" fill="#9147ff"/><text x="32" y="44" font-family="Arial" font-size="34" fill="#fff" text-anchor="middle">&#9654;</text></svg>`;
  fs.writeFileSync(path.join(dstAssets, "img", "favicon.svg"), fav, "utf8");
}

/* ---------------- run ---------------- */
function run() {
  copyAssets();
  let pages = 0;
  for (const lang of LANGS) {
    homePage(lang); pages++;
    for (const m of matches) { matchPage(lang, m); pages++; }
  }
  buildSitemaps();
  console.log(`✅ Generated ${pages} pages across ${LANGS.length} languages.`);
  console.log(`   Matches: ${matches.length}  |  Sitemaps: ${LANGS.length + 1}`);
  console.log(`   Domain: ${cfg.domain}`);
}
run();
