/* SportaLive front-end: DASH player, popunder monetization, chat & viewers */
(function () {
  "use strict";

  /* ---------------- Monetization: popunder every 2 minutes -------------- */
  // Opens the smartlink at most once every 2 minutes, on a user gesture
  // (browsers block window.open without a click, so we throttle on clicks).
  (function () {
    var AD_URL = window.SPORTALIVE_AD;
    if (!AD_URL) return;
    var GAP = window.SPORTALIVE_AD_GAP || 60000; // default 1 minute
    function last() { try { return +sessionStorage.getItem("sl_adt") || 0; } catch (e) { return 0; } }
    function setLast(t) { try { sessionStorage.setItem("sl_adt", t); } catch (e) {} }
    function maybeOpen() {
      var now = Date.now();
      if (now - last() < GAP) return;
      try {
        var w = window.open(AD_URL, "_blank");
        if (w) { w.blur(); window.focus(); setLast(now); } // only count it if it actually opened
      } catch (e) {}
    }
    document.addEventListener("click", maybeOpen, true);
    document.addEventListener("touchstart", maybeOpen, true);
    document.addEventListener("keydown", maybeOpen, true);

    /* Auto full-screen interstitial every N minutes (in-page overlay = never blocked).
       Clicking "Continue" opens the smartlink in a new tab (allowed: it's a user click). */
    var INT_GAP = window.SPORTALIVE_INT_GAP || 120000;
    function showInterstitial() {
      if (document.getElementById("sl-int")) return;
      var ov = document.createElement("div");
      ov.id = "sl-int";
      ov.innerHTML =
        '<div class="sl-int-box">' +
          '<div class="sl-int-h">Advertisement</div>' +
          '<a class="sl-int-cta" href="' + AD_URL + '" target="_blank" rel="noopener">Continue to stream</a>' +
          '<button class="sl-int-x" type="button">Skip ad</button>' +
        "</div>";
      document.body.appendChild(ov);
      function close() { try { ov.parentNode.removeChild(ov); } catch (e) {} }
      ov.querySelector(".sl-int-cta").addEventListener("click", function () { setTimeout(close, 60); });
      ov.querySelector(".sl-int-x").addEventListener("click", close);
      ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    }
    setTimeout(showInterstitial, INT_GAP);
    setInterval(showInterstitial, INT_GAP);
  })();

  /* ---------------- Multi-source live player (DASH + HLS) ---------------- */
  (function () {
    var video = document.getElementById("player");
    var overlay = document.getElementById("playerOverlay");
    var serverBar = document.getElementById("serverBar");
    var sources = window.SPORTALIVE_SOURCES || [];
    if (!video || !sources.length) return;

    var current = 0, dashPlayer = null, hls = null, started = false;

    function destroy() {
      try { if (dashPlayer) { dashPlayer.reset(); dashPlayer = null; } } catch (e) {}
      try { if (hls) { hls.destroy(); hls = null; } } catch (e) {}
      try { video.removeAttribute("src"); video.load(); } catch (e) {}
    }
    function typeOf(s) {
      if (s.type && s.type !== "auto") return s.type;
      if (/\.m3u8(\?|$)/i.test(s.url)) return "hls";
      if (/\.mpd(\?|$)/i.test(s.url)) return "dash";
      return "auto";
    }
    function play(i) {
      var s = sources[i]; if (!s) return;
      current = i; started = true; destroy();
      if (overlay) overlay.style.display = "none";
      var ty = typeOf(s);
      if (ty === "dash" && window.dashjs && window.dashjs.MediaPlayer) {
        dashPlayer = window.dashjs.MediaPlayer().create();
        dashPlayer.updateSettings({ streaming: { buffer: { fastSwitchEnabled: true } } });
        dashPlayer.initialize(video, s.url, true);
        dashPlayer.on(window.dashjs.MediaPlayer.events.ERROR, onErr);
      } else if (ty === "hls") {
        if (window.Hls && window.Hls.isSupported()) {
          hls = new window.Hls({
            lowLatencyMode: true,
            manifestLoadingMaxRetry: 6, manifestLoadingRetryDelay: 800,
            levelLoadingMaxRetry: 6, fragLoadingMaxRetry: 8,
          });
          var recov = 0;
          hls.loadSource(s.url);
          hls.attachMedia(video);
          hls.on(window.Hls.Events.MANIFEST_PARSED, function () {
            video.play().catch(function () {});
          });
          hls.on(window.Hls.Events.ERROR, function (e, d) {
            if (!d || !d.fatal) return; // ignore recoverable warnings
            if (d.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
              if (recov++ < 4) { setTimeout(function () { try { hls.startLoad(); } catch (x) {} }, 1000); }
              else onErr();
            } else if (d.type === window.Hls.ErrorTypes.MEDIA_ERROR) {
              if (recov++ < 4) { try { hls.recoverMediaError(); } catch (x) {} }
              else onErr();
            } else { onErr(); }
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = s.url; video.play().catch(onErr);
        } else { onErr(); }
      } else {
        video.src = s.url; video.play().catch(onErr);
      }
      renderBar();
    }
    function onErr() {
      // Auto-fallback: try the next server (e.g. the geo-bypass proxy)
      if (current < sources.length - 1) { play(current + 1); return; }
      if (overlay) {
        overlay.style.display = "flex";
        overlay.innerHTML = '<div class="big">Stream unavailable</div>' +
          '<div style="color:#d6c8f5;max-width:380px">All servers failed (offline or blocked). ' +
          "Please try again later.</div>";
      }
      renderBar();
    }
    function renderBar() {
      if (!serverBar) return;
      serverBar.innerHTML = sources.map(function (s, i) {
        var on = (i === current && started) ? " active" : "";
        return '<button class="srv' + on + '" data-i="' + i + '">' +
          (s.name || ("Server " + (i + 1))) + "</button>";
      }).join("");
      Array.prototype.forEach.call(serverBar.querySelectorAll("button"), function (b) {
        b.onclick = function () { play(+b.getAttribute("data-i")); };
      });
    }
    renderBar();
    // Live server config from the admin (Vercel KV), overrides baked sources.
    // Cache-buster (?t=) so mobile browsers never serve a stale config.
    fetch("/api/servers/?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.json(); }).then(function (d) {
        if (d && d.sources && d.sources.length && !started) { sources = d.sources; renderBar(); }
      }).catch(function () {});

    function startClick(e) {
      if (e) { try { e.stopPropagation(); } catch (x) {} }
      if (!started) play(current);
    }
    var startBtn = document.getElementById("startBtn");
    if (startBtn) startBtn.addEventListener("click", startClick);
    if (overlay) { overlay.style.cursor = "pointer"; overlay.addEventListener("click", startClick); }
    var wrap = document.querySelector(".player-wrap");
    if (wrap) wrap.addEventListener("click", function () { if (!started) play(current); });
  })();

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
    var msgs = ["GOOOAL!!!", "What a save!", "ref is blind", "best stream ever",
      "where are you watching from?", "let's go!!!", "this is class", "penalty!!",
      "free and HD, thanks", "offside clearly", "GG", "what a match", "what a goal"];
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
        if (navigator.sendBeacon) { navigator.sendBeacon("/api/track/", payload); return; }
      } catch (e) {}
      try { fetch("/api/track/", { method: "POST", body: payload, keepalive: true }); } catch (e) {}
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
