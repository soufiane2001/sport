// FIFA World Cup 2026 — match dataset generator.
// Format: 48 teams, 12 groups of 4 (round-robin = 72 group matches),
// then knockouts: Round of 32 (16) + Round of 16 (8) + QF (4) + SF (2)
// + 3rd-place (1) + Final (1) = 32 knockout matches. Total = 104.
//
// NOTE: Group composition and exact fixtures depend on the official FIFA draw.
// Replace the GROUPS / SCHEDULE below with the official fixtures when confirmed.
// The whole site (SEO pages, sitemap, hreflang) regenerates automatically.

// 16 host venues across USA / Canada / Mexico
const VENUES = [
  { venue: "MetLife Stadium", city: "New York/New Jersey", country: "USA" },
  { venue: "SoFi Stadium", city: "Los Angeles", country: "USA" },
  { venue: "AT&T Stadium", city: "Dallas", country: "USA" },
  { venue: "Mercedes-Benz Stadium", city: "Atlanta", country: "USA" },
  { venue: "Hard Rock Stadium", city: "Miami", country: "USA" },
  { venue: "Lincoln Financial Field", city: "Philadelphia", country: "USA" },
  { venue: "Gillette Stadium", city: "Boston", country: "USA" },
  { venue: "NRG Stadium", city: "Houston", country: "USA" },
  { venue: "Arrowhead Stadium", city: "Kansas City", country: "USA" },
  { venue: "Levi's Stadium", city: "San Francisco Bay Area", country: "USA" },
  { venue: "Lumen Field", city: "Seattle", country: "USA" },
  { venue: "Estadio Azteca", city: "Mexico City", country: "Mexico" },
  { venue: "Estadio Akron", city: "Guadalajara", country: "Mexico" },
  { venue: "Estadio BBVA", city: "Monterrey", country: "Mexico" },
  { venue: "BMO Field", city: "Toronto", country: "Canada" },
  { venue: "BC Place", city: "Vancouver", country: "Canada" },
];

// 12 groups (A–L) of 4 teams each — OFFICIAL FIFA final draw,
// held 5 December 2025 at the Kennedy Center, Washington D.C.
// Teams listed in drawn order (position 1–4). Hosts: Mexico A1, Canada B1, USA D1.
// Source: en.wikipedia.org/wiki/2026_FIFA_World_Cup_draw
const GROUPS = {
  A: ["Mexico", "South Africa", "South Korea", "Czech Republic"],
  B: ["Canada", "Bosnia and Herzegovina", "Qatar", "Switzerland"],
  C: ["Brazil", "Morocco", "Haiti", "Scotland"],
  D: ["USA", "Paraguay", "Australia", "Turkey"],
  E: ["Germany", "Curacao", "Ivory Coast", "Ecuador"],
  F: ["Netherlands", "Japan", "Sweden", "Tunisia"],
  G: ["Belgium", "Egypt", "Iran", "New Zealand"],
  H: ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"],
  I: ["France", "Senegal", "Iraq", "Norway"],
  J: ["Argentina", "Algeria", "Austria", "Jordan"],
  K: ["Portugal", "DR Congo", "Uzbekistan", "Colombia"],
  L: ["England", "Croatia", "Ghana", "Panama"],
};

// Round-robin pairings for a 4-team group (6 matches)
const RR = [
  [0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2],
];

function slugify(s) {
  return s.toString().toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

function build() {
  const matches = [];
  let num = 0;
  const start = new Date("2026-06-11T00:00:00Z");

  // ---- Group stage: 72 matches over ~17 days ----
  const groupLetters = Object.keys(GROUPS);
  // interleave rounds so dates spread naturally
  for (let round = 0; round < RR.length; round++) {
    groupLetters.forEach((g, gi) => {
      const teams = GROUPS[g];
      const [i, j] = RR[round];
      const teamA = teams[i], teamB = teams[j];
      const dayOffset = round * 3 + Math.floor(gi / 4); // spread across days
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + dayOffset);
      const v = VENUES[(num) % VENUES.length];
      const hour = [13, 16, 19, 22][gi % 4];
      date.setUTCHours(hour, 0, 0, 0);
      num++;
      matches.push({
        num, stage: "group", group: g,
        teamA, teamB,
        slug: `${slugify(teamA)}-vs-${slugify(teamB)}-world-cup-2026`,
        dateISO: date.toISOString(),
        date: fmtDate(date),
        ...v,
      });
    });
  }

  // ---- Knockout stage ----
  const knockout = [
    { stage: "r32", count: 16, startDay: 21, label: "R32" },
    { stage: "r16", count: 8, startDay: 26, label: "R16" },
    { stage: "qf", count: 4, startDay: 30, label: "QF" },
    { stage: "sf", count: 2, startDay: 33, label: "SF" },
    { stage: "third", count: 1, startDay: 37, label: "3rd Place" },
    { stage: "final", count: 1, startDay: 38, label: "Final" },
  ];

  knockout.forEach((k) => {
    for (let m = 1; m <= k.count; m++) {
      num++;
      const teamA = k.stage === "final" ? "Finalist 1"
        : k.stage === "third" ? "Semi-final Loser 1"
        : `${k.label} Winner ${(m * 2) - 1}`;
      const teamB = k.stage === "final" ? "Finalist 2"
        : k.stage === "third" ? "Semi-final Loser 2"
        : `${k.label} Winner ${m * 2}`;
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + k.startDay + Math.floor((m - 1) / 4));
      date.setUTCHours([16, 19, 22, 13][(m - 1) % 4], 0, 0, 0);
      // Final at MetLife (index 0)
      const v = k.stage === "final" ? VENUES[0] : VENUES[(num) % VENUES.length];
      const labelSlug = k.stage === "final" ? "final-world-cup-2026"
        : k.stage === "third" ? "third-place-world-cup-2026"
        : `${k.stage}-match-${m}-world-cup-2026`;
      matches.push({
        num, stage: k.stage, group: null,
        teamA, teamB,
        slug: labelSlug,
        dateISO: date.toISOString(),
        date: fmtDate(date),
        ...v,
      });
    }
  });

  return matches;
}

module.exports = { build, slugify, GROUPS, VENUES };
