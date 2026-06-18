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
const streams = require("./data/streams");
const faqData = require("./data/faq");
const FLAGS = require("./data/flags");

const ROOT = __dirname;
const OUT = path.join(ROOT, "public"); // Vercel output directory
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

function flag(name, cls) {
  const code = FLAGS[name];
  if (!code) return "";
  return `<img class="fl${cls ? " " + cls : ""}" src="https://flagcdn.com/${code}.svg" width="24" height="18" loading="lazy" alt="${esc(name)} flag" />`;
}

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
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${esc(o.title)}" />
  <meta property="og:locale" content="${(LOCALE[lang] || "en_US").replace("-", "_")}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(o.title)}" />
  <meta name="twitter:description" content="${esc(o.desc)}" />
  <meta name="twitter:image" content="${esc(ogImg)}" />
${hreflangTags(o.buildPath)}  <link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://cdn.dashjs.org" />
  <link rel="preconnect" href="https://flagcdn.com" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" />
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
  <a class="brand" href="${homePath(lang)}">Sporta<b>Live</b></a>
  <nav class="nav-links">
    <a href="${homePath(lang)}">${esc(T.nav_home)}</a>
    <a href="${homePath(lang)}#matches">${esc(T.nav_matches)}</a>
    <a href="${homePath(lang)}#schedule">${esc(T.nav_schedule)}</a>
  </nav>
  <div class="search" id="searchBox">
    <input type="text" id="searchInput" placeholder="${esc(T.nav_matches)}… (104)" aria-label="search" autocomplete="off" />
    <div class="search-results" id="searchResults"></div>
  </div>
  <div class="topbar-right">
    <select class="lang-select" id="langSelect" aria-label="Language">${opts}</select>
    <a class="btn" href="${homePath(lang)}#live">${esc(T.nav_live)}</a>
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
      <span class="flag">${flag(m.teamA) || esc(initials)}</span>
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

function scripts(lang, sources) {
  const raw = sources || streams.DEFAULT_SOURCES;
  // Wrap proxied sources so they route through /api/p (bypasses geo-blocks)
  const src = raw.map((s) => {
    if (s.proxy && /^https?:\/\//i.test(s.url)) {
      return { name: s.name, type: s.type, url: "/api/p?u=" + encodeURIComponent(s.url) };
    }
    return { name: s.name, type: s.type, url: s.url };
  });
  return `
<script>window.SPORTALIVE_SOURCES=${JSON.stringify(src)};window.SPORTALIVE_AD=${JSON.stringify(cfg.adPopunder)};</script>
<script src="https://cdn.dashjs.org/latest/dash.all.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js"></script>
<script src="/assets/js/app.js"></script>
</body>
</html>`;
}

/* ---------------- all 104 matches as grouped cards ---------------- */
function matchCard(lang, m, live) {
  const T = t[lang];
  const liveTag = live ? `<span class="livep">● ${esc(T.nav_live)}</span>` : "";
  return `
    <a class="card" href="${matchPath(lang, m.slug)}">
      <div class="thumb">${liveTag}
        <span class="stagep">#${m.num}</span>
        <span class="match">
          <span class="tm">${flag(m.teamA)}<span>${esc(m.teamA)}</span></span>
          <span class="vsx">${esc(T.vs)}</span>
          <span class="tm">${flag(m.teamB)}<span>${esc(m.teamB)}</span></span>
        </span>
      </div>
      <div class="body">
        <div class="t">${esc(matchTitleText(lang, m))}</div>
        <div class="d">${esc(fmtDate(m.dateISO, lang))} · ${esc(m.city)}</div>
      </div>
    </a>`;
}
function groupedCards(lang) {
  const T = t[lang];
  let out = "";
  const groups = {};
  matches.filter((m) => m.stage === "group").forEach((m) => {
    (groups[m.group] = groups[m.group] || []).push(m);
  });
  Object.keys(groups).sort().forEach((g) => {
    out += `<h3 class="grp-h">${esc(T.group)} ${g}</h3><div class="grid">` +
      groups[g].map((m) => matchCard(lang, m, false)).join("") + `</div>`;
  });
  const ko = [["r32", T.stage.r32], ["r16", T.stage.r16], ["qf", T.stage.qf],
    ["sf", T.stage.sf], ["third", T.stage.third], ["final", T.stage.final]];
  ko.forEach(([key, label]) => {
    const ms = matches.filter((m) => m.stage === key);
    if (!ms.length) return;
    out += `<h3 class="grp-h">${esc(label)}</h3><div class="grid">` +
      ms.map((m) => matchCard(lang, m, false)).join("") + `</div>`;
  });
  return out;
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
      <h2>${esc(T.full_schedule)} — ${matches.length} ${esc(T.nav_matches)} · ${esc(COMP)}</h2>
      <p style="color:var(--muted);margin:-6px 0 4px">${esc(T.seo_home_desc)}</p>
      ${groupedCards(lang)}
    </section>
    ${footer(lang, { buildPath })}
  </main>
  ${chatPanel(lang)}
</div>`;

  const html = head(lang, {
    title: T.seo_home_title, desc: T.seo_home_desc,
    canonicalPath: homePath(lang), buildPath, jsonld,
  }) + body + scripts(lang, streams.DEFAULT_SOURCES);

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
  const faqItems = (faqData[lang] || faqData.en).map((x) => ({
    q: tpl(x.q, vars), a: tpl(x.a, vars),
  }));

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
          { "@type": "ListItem", position: 2, name: stage, item: abs(homePath(lang)) + "#matches" },
          { "@type": "ListItem", position: 3, name: `${m.teamA} vs ${m.teamB}`, item: abs(matchPath(lang, m.slug)) },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: faqItems.map((f) => ({
          "@type": "Question", name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
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
        <span class="match">
          <span class="tm">${flag(r.teamA)}<span>${esc(r.teamA)}</span></span>
          <span class="vsx">${esc(T.vs)}</span>
          <span class="tm">${flag(r.teamB)}<span>${esc(r.teamB)}</span></span>
        </span></div>
      <div class="body"><div class="t">${esc(matchTitleText(lang, r))}</div>
        <div class="d">${esc(fmtDate(r.dateISO, lang))}</div></div>
    </a>`;
  });

  const body = `
${topbar(lang, { buildPath })}
<div class="layout">
  ${sidebar(lang, m)}
  <main class="main">
    <nav class="crumb" aria-label="breadcrumb">
      <a href="${homePath(lang)}">${esc(T.nav_home)}</a> ›
      <a href="${homePath(lang)}#matches">${esc(stage)}</a> ›
      <span>${esc(matchTitleText(lang, m))}</span>
    </nav>
    <div class="player-wrap">
      <span class="live-badge">${esc(T.nav_live)}</span>
      <span class="viewers-badge"><span id="viewerCount">0</span> ${esc(T.viewers)}</span>
      <video id="player" playsinline controls preload="none"></video>
      <div class="player-overlay" id="playerOverlay">
        <div class="big">
          <span class="tm">${flag(m.teamA, "big-fl")}<span>${esc(m.teamA)}</span></span>
          <span class="vsx">${esc(T.vs)}</span>
          <span class="tm">${flag(m.teamB, "big-fl")}<span>${esc(m.teamB)}</span></span>
        </div>
        <button class="play-btn" id="startBtn">${esc(T.watch_live)}</button>
        <div style="color:#d6c8f5">${esc(T.free_stream)}</div>
      </div>
    </div>
    <div class="info-bar">
      <div class="teams-head">
        <span class="tm">${flag(m.teamA, "big-fl")}<b>${esc(m.teamA)}</b></span>
        <span class="vsx">${esc(T.vs)}</span>
        <span class="tm">${flag(m.teamB, "big-fl")}<b>${esc(m.teamB)}</b></span>
      </div>
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
      <h2>FAQ — ${esc(matchTitleText(lang, m))}</h2>
      <div class="faq">
        ${faqItems.map((f) => `<details class="faq-item"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}
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
  }) + body + scripts(lang, streams.sourcesFor(m.slug));

  const rel = lang === cfg.defaultLang
    ? `match/${m.slug}/index.html`
    : `${lang}/match/${m.slug}/index.html`;
  writeFile(rel, html);
}

/* ---------------- admin dashboard ---------------- */
function adminPage() {
  const html = `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>SportaLive — Admin Analytics</title>
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml"/>
<link rel="stylesheet" href="/assets/css/style.css"/>
<style>
  .wrap{max-width:1100px;margin:0 auto;padding:24px}
  .login{max-width:360px;margin:80px auto;background:var(--bg2);border:1px solid var(--line);
    border-radius:10px;padding:24px;text-align:center}
  .login h1{font-size:20px;margin:0 0 14px}
  .login input{width:100%;background:var(--bg3);border:1px solid var(--line);color:var(--text);
    padding:10px;border-radius:6px;margin-bottom:12px;outline:none}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin:18px 0}
  .stat{background:var(--bg2);border:1px solid var(--line);border-radius:10px;padding:16px}
  .stat .n{font-size:30px;font-weight:800}
  .stat .l{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.5px;margin-top:4px}
  .stat.live .n{color:#00d27a}
  .panel{background:var(--bg2);border:1px solid var(--line);border-radius:10px;padding:16px;margin-bottom:16px}
  .panel h2{font-size:15px;margin:0 0 12px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--line)}
  th{color:var(--muted);font-weight:700;text-transform:uppercase;font-size:11px;letter-spacing:.4px}
  td.num,th.num{text-align:right}
  .bars{display:flex;align-items:flex-end;gap:3px;height:120px}
  .bar{flex:1;background:linear-gradient(180deg,var(--purple),var(--purple2));border-radius:3px 3px 0 0;min-height:2px;position:relative}
  .bar:hover::after{content:attr(data-t);position:absolute;bottom:100%;left:50%;transform:translateX(-50%);
    background:#000;color:#fff;font-size:11px;padding:2px 6px;border-radius:4px;white-space:nowrap}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  @media(max-width:760px){.grid2{grid-template-columns:1fr}}
  .toolbar{display:flex;align-items:center;gap:12px;margin-bottom:6px}
  .toolbar .muted{color:var(--muted);font-size:12px}
  .err{color:#ff6b6b;font-size:13px;margin-top:8px}
  .flagc{display:inline-block;width:22px}
  .srow-edit{display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap;align-items:center}
  #srvRows input,#srvRows select{background:var(--bg3);border:1px solid var(--line);color:var(--text);
    padding:6px 8px;border-radius:5px;font-size:12px;outline:none}
  #srvRows input:focus{border-color:var(--purple)}
  #srvRows button{background:var(--bg3);border:1px solid var(--line);color:var(--text);
    border-radius:5px;padding:5px 9px;cursor:pointer;font-size:12px}
  #srvRows button:hover{border-color:var(--purple)}
  #srvRows label{font-size:12px;display:flex;align-items:center;gap:4px;color:var(--muted)}
</style>
</head>
<body>
<header class="topbar">
  <a class="brand" href="/">Sporta<b>Live</b></a>
  <div style="margin-left:auto;font-weight:700;color:var(--muted)">Admin · Analytics</div>
</header>

<div class="wrap">
  <div id="login" class="login">
    <h1>Admin Access</h1>
    <input id="key" type="password" placeholder="Admin key" autocomplete="current-password"/>
    <button class="btn" id="loginBtn" style="width:100%">Sign in</button>
    <div class="err" id="loginErr"></div>
  </div>

  <div id="dash" style="display:none">
    <div class="toolbar">
      <button class="btn" id="refreshBtn">Refresh</button>
      <span class="muted" id="updated"></span>
      <span style="margin-left:auto"><a href="#" id="logout" class="muted">Logout</a></span>
    </div>
    <div id="storageWarn" class="panel" style="display:none;border-color:#7a5b00;background:#211a00">
      <b>No storage connected</b> — analytics are not being recorded yet.
      In Vercel → Storage → create a free <b>KV</b> store and connect it to this project, then redeploy.
      The dashboard will then fill automatically (no database, no SQL).
    </div>
    <div class="cards" id="cards"></div>

    <div class="panel">
      <h2>Live now — who is watching <span id="liveCount" style="color:#00d27a"></span></h2>
      <table id="live"><thead><tr><th>Visitor ID</th><th>Country</th><th>City</th><th>Page</th><th class="num">Seen</th></tr></thead><tbody></tbody></table>
    </div>

    <div class="panel">
      <h2>Traffic — last 24 hours (page views per hour)</h2>
      <div class="bars" id="bars"></div>
    </div>

    <div class="grid2">
      <div class="panel">
        <h2>Top countries</h2>
        <table id="countries"><thead><tr><th>Country</th><th class="num">Views</th><th class="num">Watch (min)</th></tr></thead><tbody></tbody></table>
      </div>
      <div class="panel">
        <h2>Top pages</h2>
        <table id="pages"><thead><tr><th>Path</th><th class="num">Views</th><th class="num">Watch (min)</th></tr></thead><tbody></tbody></table>
      </div>
    </div>
    <div class="grid2">
      <div class="panel">
        <h2>Languages</h2>
        <table id="langs"><thead><tr><th>Lang</th><th class="num">Views</th></tr></thead><tbody></tbody></table>
      </div>
      <div class="panel">
        <h2>Referrers</h2>
        <table id="refs"><thead><tr><th>Source</th><th class="num">Views</th></tr></thead><tbody></tbody></table>
      </div>
    </div>
    <div class="panel" id="srvPanel">
      <h2>Streams / Servers <span class="muted" id="srvMsg" style="font-size:12px;font-weight:400"></span></h2>
      <div id="srvRows"></div>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" id="srvAdd">+ Add server</button>
        <button class="btn" id="srvSave">Save (apply live)</button>
        <button class="btn" id="srvReload" style="background:var(--bg3);color:var(--text)">Reload</button>
      </div>
      <div class="muted" style="font-size:12px;margin-top:8px">
        Order = priority (the player tries them top to bottom). <b>Proxy</b> = route via Vercel
        (bypasses geo-blocks &amp; upgrades HTTP→HTTPS). Changes apply instantly, no redeploy. Requires Vercel KV.
      </div>
    </div>
    <div class="err" id="dashErr"></div>
  </div>
</div>

<script>
(function(){
  var login=document.getElementById('login'), dash=document.getElementById('dash');
  var keyInput=document.getElementById('key');
  var srvLoaded=false;
  function flag(cc){ if(!cc||cc.length!==2||cc==='??') return '🏳️';
    return String.fromCodePoint.apply(null,[...cc.toUpperCase()].map(c=>0x1F1E6+c.charCodeAt(0)-65)); }
  function getKey(){ try{return sessionStorage.getItem('sl_admin')||'';}catch(e){return '';} }
  function setKey(k){ try{sessionStorage.setItem('sl_admin',k);}catch(e){} }

  async function load(){
    var k=getKey(); if(!k) return show(false);
    try{
      var r=await fetch('/api/stats/?key='+encodeURIComponent(k));
      if(r.status===401){ document.getElementById('loginErr').textContent='Wrong key.'; return show(false); }
      var d=await r.json();
      if(d.error){ document.getElementById('dashErr').textContent=d.error; }
      render(d); show(true);
      if(!srvLoaded){ srvLoaded=true; srvLoad(); }
    }catch(e){ document.getElementById('dashErr').textContent='Load failed: '+e; show(true); }
  }
  function show(ok){ login.style.display=ok?'none':'block'; dash.style.display=ok?'block':'none'; }

  function card(n,l,cls){ return '<div class="stat '+(cls||'')+'"><div class="n">'+n+'</div><div class="l">'+l+'</div></div>'; }
  function render(d){
    if(!d.totals) return;
    document.getElementById('storageWarn').style.display = (d.storage===false)?'block':'none';
    var t=d.totals;
    document.getElementById('cards').innerHTML =
      card(t.activeNow,'Active now','live')+card(t.visitors.toLocaleString(),'Unique visitors')+
      card(t.views.toLocaleString(),'Page views')+card(t.views24h.toLocaleString(),'Views (24h)')+
      card(t.watchHours.toLocaleString()+'h','Watch time');
    document.getElementById('updated').textContent='Updated '+new Date(d.generatedAt).toLocaleTimeString();

    // bars
    var tl=d.timeline||[], max=Math.max(1,...tl.map(x=>+x.views));
    document.getElementById('bars').innerHTML = tl.length? tl.map(function(x){
      var h=Math.round((+x.views/max)*100); var hr=x.hour.slice(11,16);
      return '<div class="bar" style="height:'+h+'%" data-t="'+hr+': '+x.views+' views"></div>';
    }).join('') : '<span class="muted" style="color:var(--muted)">No data yet.</span>';

    // Live now
    var live = d.live || [];
    document.getElementById('liveCount').textContent = '('+live.length+')';
    var lb = document.querySelector('#live tbody');
    lb.innerHTML = live.length ? live.map(function(v){
      var fl = (v.country && v.country.length===2) ? '<img class="fl" src="https://flagcdn.com/'+v.country.toLowerCase()+'.svg" width="22" height="16" alt="" loading="lazy"> ' : '';
      var ago = v.agoSec<60 ? v.agoSec+'s' : Math.round(v.agoSec/60)+'m';
      return '<tr><td><code>'+esc(v.id).slice(0,12)+'</code></td><td>'+fl+v.country+'</td><td>'+esc(v.city||'-')+'</td><td>'+esc(v.page)+'</td><td class="num">'+ago+' ago</td></tr>';
    }).join('') : '<tr><td colspan="5" class="muted" style="color:var(--muted)">Nobody online right now.</td></tr>';

    fill('countries', d.countries, function(r){
      var fl = (r.country && r.country.length===2) ? '<img class="fl" src="https://flagcdn.com/'+r.country.toLowerCase()+'.svg" width="22" height="16" alt="" loading="lazy"> ' : '';
      return '<td>'+fl+r.country+'</td><td class="num">'+r.views+'</td><td class="num">'+r.watch_min+'</td>'; });
    fill('pages', d.pages, function(r){
      return '<td>'+esc(r.path)+'</td><td class="num">'+r.views+'</td><td class="num">'+r.watch_min+'</td>'; });
    fill('langs', d.langs, function(r){ return '<td>'+r.lang+'</td><td class="num">'+r.views+'</td>'; });
    fill('refs', d.referrers, function(r){ return '<td>'+esc(r.ref).slice(0,60)+'</td><td class="num">'+r.views+'</td>'; });
  }
  function fill(id,rows,fn){
    var tb=document.querySelector('#'+id+' tbody');
    tb.innerHTML=(rows&&rows.length)? rows.map(function(r){return '<tr>'+fn(r)+'</tr>';}).join('') :
      '<tr><td colspan="4" class="muted" style="color:var(--muted)">No data yet.</td></tr>';
  }
  function esc(s){ return String(s==null?'':s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];}); }

  document.getElementById('loginBtn').onclick=function(){ setKey(keyInput.value.trim()); load(); };
  keyInput.addEventListener('keydown',function(e){ if(e.key==='Enter'){ setKey(keyInput.value.trim()); load(); } });
  document.getElementById('refreshBtn').onclick=load;
  document.getElementById('logout').onclick=function(e){ e.preventDefault(); try{sessionStorage.removeItem('sl_admin');}catch(x){} show(false); };

  /* ---- Servers management ---- */
  var srvRows=document.getElementById('srvRows');
  function attr(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
  function srvMsg(m){ document.getElementById('srvMsg').textContent=m||''; }
  function srvList(){ return [].map.call(srvRows.children,function(row){ return {
    name:row.querySelector('.s-name').value, url:row.querySelector('.s-url').value,
    type:row.querySelector('.s-type').value, proxy:row.querySelector('.s-proxy').checked }; }); }
  function srvRow(s){
    return '<div class="srow-edit">'
      +'<input class="s-name" placeholder="Name" value="'+attr(s.name)+'" style="width:120px">'
      +'<input class="s-url" placeholder="https://...m3u8" value="'+attr(s.url)+'" style="flex:1;min-width:220px">'
      +'<select class="s-type">'
      +'<option value="hls"'+(s.type==='hls'?' selected':'')+'>hls</option>'
      +'<option value="dash"'+(s.type==='dash'?' selected':'')+'>dash</option>'
      +'<option value="auto"'+(s.type==='auto'?' selected':'')+'>auto</option></select>'
      +'<label><input type="checkbox" class="s-proxy"'+(s.proxy?' checked':'')+'> proxy</label>'
      +'<button class="s-up">Up</button><button class="s-down">Down</button><button class="s-del">Remove</button>'
      +'</div>';
  }
  function srvRender(list){
    srvRows.innerHTML = (list&&list.length)? list.map(srvRow).join('') : srvRow({name:'Server 1',url:'',type:'hls',proxy:false});
    [].forEach.call(srvRows.children,function(row,idx){
      row.querySelector('.s-del').onclick=function(){ var l=srvList(); l.splice(idx,1); srvRender(l); };
      row.querySelector('.s-up').onclick=function(){ var l=srvList(); if(idx>0){ var t=l[idx-1]; l[idx-1]=l[idx]; l[idx]=t; srvRender(l);} };
      row.querySelector('.s-down').onclick=function(){ var l=srvList(); if(idx<l.length-1){ var t=l[idx+1]; l[idx+1]=l[idx]; l[idx]=t; srvRender(l);} };
    });
  }
  function srvLoad(){
    fetch('/api/servers/?raw=1&key='+encodeURIComponent(getKey()))
      .then(function(r){return r.json();})
      .then(function(d){ srvRender(d.raw||[]); srvMsg(''); })
      .catch(function(){ srvMsg('load failed'); });
  }
  document.getElementById('srvAdd').onclick=function(){ var l=srvList(); l.push({name:'Server '+(l.length+1),url:'',type:'hls',proxy:false}); srvRender(l); };
  document.getElementById('srvReload').onclick=srvLoad;
  document.getElementById('srvSave').onclick=function(){
    var l=srvList().filter(function(s){ return /^https?:/i.test((s.url||'').trim()); });
    if(!l.length){ srvMsg('No valid server URL (must start with http/https)'); return; }
    srvMsg('saving…');
    fetch('/api/servers/?key='+encodeURIComponent(getKey()),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({servers:l})})
      .then(function(r){return r.json();})
      .then(function(d){ srvMsg(d.ok?('Saved '+d.count+' servers — applied live ✓'):(d.error||'error')); })
      .catch(function(){ srvMsg('save failed'); });
  };

  load();
  setInterval(function(){ if(getKey()&&dash.style.display!=='none') load(); }, 12000);
})();
</script>
</body>
</html>`;
  writeFile("admin/index.html", html);
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

  const robots = `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${abs("/sitemap.xml")}\n`;
  writeFile("robots.txt", robots);
}

/* ---------------- search index ---------------- */
function buildSearchIndex() {
  const idx = matches.map((m) => ({
    a: m.teamA, b: m.teamB, s: m.slug,
    g: m.group || m.stage, st: m.stage,
    c: m.city, d: m.date,
  }));
  writeFile("assets/search-index.json", JSON.stringify(idx));
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
  buildSearchIndex();
  adminPage();
  buildSitemaps();
  console.log(`✅ Generated ${pages} pages across ${LANGS.length} languages.`);
  console.log(`   Matches: ${matches.length}  |  Sitemaps: ${LANGS.length + 1}`);
  console.log(`   Domain: ${cfg.domain}`);
}
run();
