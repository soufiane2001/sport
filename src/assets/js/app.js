/* SportaLive front-end: DASH player, popunder monetization, chat & viewers */
(function () {
  "use strict";

  /* ---------------- Monetization: popunder (effectivecpmnetwork) -------------- */
  // Opens the smartlink once per session on the first user gesture.
  var AD_URL = window.SPORTALIVE_AD;
  function armPopunder() {
    if (!AD_URL) return;
    try { if (sessionStorage.getItem("sl_pop")) return; } catch (e) {}
    function fire() {
      try { sessionStorage.setItem("sl_pop", "1"); } catch (e) {}
      try {
        var w = window.open(AD_URL, "_blank");
        if (w) { w.blur(); window.focus(); }
      } catch (e) {}
      remove();
    }
    function remove() {
      document.removeEventListener("click", fire, true);
      document.removeEventListener("touchstart", fire, true);
    }
    document.addEventListener("click", fire, true);
    document.addEventListener("touchstart", fire, true);
  }
  armPopunder();

  /* ---------------- DASH player ---------------- */
  var video = document.getElementById("player");
  var mpd = window.SPORTALIVE_MPD;
  var overlay = document.getElementById("playerOverlay");
  var started = false;

  function startPlayer() {
    if (started || !video || !mpd) return;
    started = true;
    if (overlay) overlay.style.display = "none";

    if (window.dashjs && window.dashjs.MediaPlayer) {
      var player = window.dashjs.MediaPlayer().create();
      player.updateSettings({
        streaming: { buffer: { fastSwitchEnabled: true } },
      });
      player.initialize(video, mpd, true);
      player.on(window.dashjs.MediaPlayer.events.ERROR, function () {
        showError();
      });
    } else {
      // Fallback (native HLS/DASH if browser supports)
      video.src = mpd;
      video.play().catch(showError);
    }
  }

  function showError() {
    if (!overlay) return;
    overlay.style.display = "flex";
    overlay.innerHTML =
      '<div class="big">Stream unavailable</div>' +
      '<div style="color:#adadb8;max-width:380px">The live channel could not be loaded ' +
      "(it may be geo-restricted or offline). Please try again later.</div>";
  }

  var startBtn = document.getElementById("startBtn");
  if (startBtn) startBtn.addEventListener("click", startPlayer);
  // Auto-start muted attempt (some streams require gesture)
  if (video && mpd) {
    video.muted = false;
  }

  /* ---------------- Fake live viewers ---------------- */
  var vEl = document.getElementById("viewerCount");
  if (vEl) {
    var base = 1200 + Math.floor(Math.random() * 9000);
    function tick() {
      base += Math.floor(Math.random() * 41) - 18;
      if (base < 200) base = 200 + Math.floor(Math.random() * 50);
      vEl.textContent = base.toLocaleString();
    }
    tick();
    setInterval(tick, 4000);
  }

  /* ---------------- Demo chat ---------------- */
  var chatBody = document.getElementById("chatBody");
  if (chatBody) {
    var names = ["Goal_Hunter", "UltrasFan", "El10", "KeeperZone", "MidfieldMaestro",
      "TikiTaka", "VARkiller", "OffsideKing", "CornerFlag", "DerbyDay", "HatTrick"];
    var msgs = ["GOOOAL!!! 🔥", "What a save!", "ref is blind 😡", "best stream ever 🙌",
      "where are you watching from?", "🇧🇷🇧🇷🇧🇷", "this is class", "penalty!!", "let's go!!!",
      "free and HD, thanks", "offside clearly", "GG", "what a match ⚽", "🐐 moment"];
    var colors = ["c1", "c2", "c3", "c4", "c5"];
    function addMsg() {
      var d = document.createElement("div");
      d.className = "msg";
      var c = colors[Math.floor(Math.random() * colors.length)];
      d.innerHTML = '<b class="' + c + '">' +
        names[Math.floor(Math.random() * names.length)] + "</b>: " +
        msgs[Math.floor(Math.random() * msgs.length)];
      chatBody.appendChild(d);
      while (chatBody.children.length > 40) chatBody.removeChild(chatBody.firstChild);
      chatBody.scrollTop = chatBody.scrollHeight;
    }
    for (var i = 0; i < 8; i++) addMsg();
    setInterval(addMsg, 2200);
  }

  /* ---------------- Analytics beacon ---------------- */
  (function () {
    function vid() {
      try {
        var v = localStorage.getItem("sl_vid");
        if (!v) { v = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("sl_vid", v); }
        return v;
      } catch (e) { return "anon"; }
    }
    function send(type) {
      var payload = JSON.stringify({
        type: type, path: location.pathname, ref: document.referrer,
        lang: document.documentElement.lang || "", vid: vid(),
      });
      try {
        if (navigator.sendBeacon) { navigator.sendBeacon("/api/track", payload); return; }
      } catch (e) {}
      try { fetch("/api/track", { method: "POST", body: payload, keepalive: true }); } catch (e) {}
    }
    send("view");
    // Heartbeat = watch time. Only while tab is visible.
    setInterval(function () { if (!document.hidden) send("heartbeat"); }, 15000);
  })();

  /* ---------------- Match search (104 matches) ---------------- */
  (function () {
    var input = document.getElementById("searchInput");
    var box = document.getElementById("searchResults");
    if (!input || !box) return;
    var lang = document.documentElement.lang || "en";
    var data = null;

    function matchUrl(slug) {
      return lang === "en" ? "/match/" + slug + "/" : "/" + lang + "/match/" + slug + "/";
    }
    function load(cb) {
      if (data) return cb();
      fetch("/assets/search-index.json").then(function (r) { return r.json(); })
        .then(function (j) { data = j; cb(); })
        .catch(function () { data = []; cb(); });
    }
    function norm(s) { return (s || "").toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, ""); }

    function run() {
      var q = norm(input.value.trim());
      if (!q) { box.style.display = "none"; box.innerHTML = ""; return; }
      load(function () {
        var hits = data.filter(function (m) {
          return norm(m.a + " " + m.b + " " + m.c + " " + m.g).indexOf(q) !== -1;
        }).slice(0, 12);
        if (!hits.length) {
          box.innerHTML = '<div class="sr-empty">No match found</div>';
        } else {
          box.innerHTML = hits.map(function (m) {
            return '<a class="sr-item" href="' + matchUrl(m.s) + '">' +
              '<span class="sr-vs">' + esc(m.a) + ' <b>vs</b> ' + esc(m.b) + '</span>' +
              '<span class="sr-meta">' + esc(m.g) + ' · ' + esc(m.c) + ' · ' + esc(m.d) + '</span></a>';
          }).join("");
        }
        box.style.display = "block";
      });
    }
    function esc(s) { return String(s == null ? "" : s)
      .replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }

    var ti;
    input.addEventListener("input", function () { clearTimeout(ti); ti = setTimeout(run, 120); });
    input.addEventListener("focus", function () { if (input.value.trim()) run(); });
    document.addEventListener("click", function (e) {
      if (!e.target.closest("#searchBox")) box.style.display = "none";
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        var first = box.querySelector(".sr-item");
        if (first) window.location.href = first.getAttribute("href");
      }
      if (e.key === "Escape") { box.style.display = "none"; }
    });
  })();

  /* ---------------- Language switcher ---------------- */
  var langSel = document.getElementById("langSelect");
  if (langSel) {
    langSel.addEventListener("change", function () {
      var url = langSel.value;
      if (url) window.location.href = url;
    });
  }
})();
