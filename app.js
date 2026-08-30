(function () {
  var VERSION = "0.2.4"; // ponytail: bump manually alongside `git tag vX.Y.Z`, no build step to auto-inject it
  var $ = function (id) { return document.getElementById(id); };
  var SIZE = 680, CX = 340, CY = 340; // wider than the ring geometry so the curved labels have real room to sit centred in their gap, not hugging the ring
  var GAP = 13;                       // gap dial->dial AND outer-dial->glass-rim (equal)
  // outer edge 300-GAP=287; each band 82 wide; gap 13 between; hole radius 110.
  var OUTER = { rMid: 246, w: 82 };   // spans 205..287
  var INNER = { rMid: 151, w: 82 };   // spans 110..192  (192 = 205-GAP)
  var byTz = {};
  ZONES.forEach(function (z) { byTz[z.tz] = z; });

  // ---- theme (persisted so extensions / force-dark can't override choice) ---
  // matches index.html's --canvas token for each theme, so iOS Safari's own status-bar /
  // home-indicator safe-area strips paint the same colour as the page, not flat black.
  function syncThemeColor() {
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    var meta = $("themeColorMeta");
    if (meta) meta.setAttribute("content", dark ? "#05060a" : "#eef0f4");
  }
  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem("tz-theme"); } catch (e) {}
    var q = (location.search.match(/[?&]theme=(dark|light)/) || [])[1];
    var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", saved || q || (prefersDark ? "dark" : "light"));
    syncThemeColor();
  }
  $("themeBtn").addEventListener("click", function () {
    var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("tz-theme", next); } catch (e) {}
    syncThemeColor();
    render();
  });

  // ---- pastel sun-altitude colour ramp --------------------------------------
  // control stops: [altitude°, [r,g,b]]. interpolated linearly.
  var RAMP = [
    [-90, [44, 54, 96]],     // deep night indigo
    [-14, [62, 78, 138]],    // astronomical night
    [-8,  [120, 124, 194]],  // nautical
    [-4,  [182, 158, 220]],  // civil twilight lavender
    [-0.83, [255, 158, 126]],// horizon: sunrise / sunset coral
    [2,   [255, 196, 138]],  // golden peach
    [9,   [255, 217, 150]],  // low sun
    [30,  [255, 233, 172]],  // day
    [90,  [255, 241, 194]]   // peak
  ];
  function altColor(alt) {
    if (alt <= RAMP[0][0]) return RAMP[0][1];
    if (alt >= RAMP[RAMP.length - 1][0]) return RAMP[RAMP.length - 1][1];
    for (var i = 1; i < RAMP.length; i++) {
      if (alt <= RAMP[i][0]) {
        var a = RAMP[i - 1], b = RAMP[i];
        var t = (alt - a[0]) / (b[0] - a[0]);
        return [
          Math.round(a[1][0] + (b[1][0] - a[1][0]) * t),
          Math.round(a[1][1] + (b[1][1] - a[1][1]) * t),
          Math.round(a[1][2] + (b[1][2] - a[1][2]) * t)
        ];
      }
    }
    return RAMP[RAMP.length - 1][1];
  }
  function rgb(c) { return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"; }

  // ---- geometry -------------------------------------------------------------
  function hourToAngle(h) { return (h / 24) * 360 - 180; } // noon top, midnight bottom
  function norm(h) { return ((h % 24) + 24) % 24; }
  function normMin(m) { return ((m % 1440) + 1440) % 1440; }

  // altitude for a wall-clock hour h in a zone today (offsetMin = zone offset).
  // ponytail: same-date declination across the midnight wrap, sub-degree drift.
  function altAtHour(zone, offsetMin, date, h) {
    var y = date.getUTCFullYear(), m = date.getUTCMonth() + 1, d = date.getUTCDate();
    return sunAltitude(y, m, d, zone.lat, zone.lon, normMin(h * 60 - offsetMin));
  }

  // ---- canvas dial ----------------------------------------------------------
  var dial = $("dial"), dctx = dial.getContext("2d");
  var textColor = { day: "#3c2d0a", night: "#f7f9ff", label: "#10131a" };
  function readThemeColors() {
    textColor.day = document.documentElement.getAttribute("data-theme") === "dark" ? "#3a2804" : "#5a4610";
    textColor.night = "#f7f9ff";
    textColor.label = document.documentElement.getAttribute("data-theme") === "dark" ? "#f3f5fa" : "#10131a";
  }

  // cache each zone's 24 hourly altitudes for a date; keyed by tz+ymd+offset.
  var altCache = {};
  function hourlyAlts(zone, offsetMin, date) {
    var key = zone.tz + "|" + date.getUTCFullYear() + date.getUTCMonth() + date.getUTCDate() + "|" + offsetMin;
    if (altCache[key]) return altCache[key];
    var arr = new Array(97); // 15-min resolution for a smooth gradient
    for (var i = 0; i <= 96; i++) arr[i] = altAtHour(zone, offsetMin, date, i / 4);
    altCache[key] = arr;
    return arr;
  }
  function altAt(arr, h) { // interpolate the 15-min table
    var x = norm(h) * 4, i = Math.floor(x), f = x - i;
    return arr[i] * (1 - f) + arr[(i + 1) % 96] * f;
  }

  // build a conic gradient for a band. rotateDeg rotates the ring (offset diff).
  // with startAngle=(rotateDeg-180)deg, colour fraction f maps to wall-hour f*24+6.
  function makeConic(arr, rotateDeg) {
    var g = dctx.createConicGradient((rotateDeg - 180) * Math.PI / 180, CX, CY);
    for (var s = 0; s <= 96; s++) {
      var frac = s / 96;
      g.addColorStop(frac, rgb(altColor(altAt(arr, frac * 24 + 6))));
    }
    return g;
  }

  function drawBand(band, arr, rotateDeg) {
    dctx.save();
    dctx.beginPath();
    dctx.arc(CX, CY, band.rMid + band.w / 2, 0, Math.PI * 2);
    dctx.arc(CX, CY, band.rMid - band.w / 2, 0, Math.PI * 2, true);
    dctx.fillStyle = makeConic(arr, rotateDeg);
    dctx.fill("evenodd");
    dctx.restore();
  }

  function drawNumbers(band, arr, rotateDeg) {
    dctx.save();
    dctx.font = '500 22px "Google Sans", system-ui, sans-serif';
    dctx.textAlign = "center"; dctx.textBaseline = "middle";
    for (var hh = 0; hh < 24; hh++) {
      var ang = (hourToAngle(hh) + rotateDeg - 90) * Math.PI / 180;
      var x = CX + band.rMid * Math.cos(ang), y = CY + band.rMid * Math.sin(ang);
      dctx.fillStyle = altAt(arr, hh) > 0 ? textColor.day : textColor.night;
      dctx.fillText(String(hh).padStart(2, "0"), x, y);
    }
    dctx.restore();
  }

  // curved dial-edge label, glyphs oriented radially outward from centre, top-centred.
  function drawCurvedLabel(text, radius) {
    dctx.save();
    dctx.font = '600 22px "Google Sans", system-ui, sans-serif';
    dctx.textAlign = "center"; dctx.textBaseline = "middle";
    dctx.fillStyle = textColor.label;
    var angles = [];
    for (var i = 0; i < text.length; i++) angles.push((dctx.measureText(text[i]).width + 3) / radius);
    var totalAngle = angles.reduce(function (s, a) { return s + a; }, 0);
    var acc = -totalAngle / 2; // rotate(0) already points up in this translate/rotate scheme (unlike the cos/sin hour-angle convention above)
    dctx.translate(CX, CY);
    for (var j = 0; j < text.length; j++) {
      var mid = acc + angles[j] / 2;
      dctx.save();
      dctx.rotate(mid);
      dctx.translate(0, -radius);
      dctx.fillText(text[j], 0, 0);
      dctx.restore();
      acc += angles[j];
    }
    dctx.restore();
  }

  // ---- state + render -------------------------------------------------------
  var state = { left: null, right: null };
  function offset(tz, date) { return tzOffsetMin(tz, date); }

  var DPR = 1;
  function setupCanvas() {
    DPR = window.devicePixelRatio || 1;
    dial.width = SIZE * DPR; dial.height = SIZE * DPR;
    dctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    dial.style.touchAction = "none";
  }

  var dragPreviewDeg = null;

  // state.left = OUTER ring (draggable, shown in the first/top picker).
  // state.right = INNER ring (fixed, hour 12 always at top, shown in the second/bottom picker).
  function render() {
    var now = new Date();
    var zOuter = byTz[state.left], zInner = byTz[state.right];
    var offOuter = offset(state.left, now), offInner = offset(state.right, now);
    // -ve so both dials' current hour lands at the same screen angle (radially aligned).
    var rotOuter = -(offOuter - offInner) / 60 * 15;
    var rotOuterDisplay = rotOuter + (dragPreviewDeg || 0);
    readThemeColors();
    var altOuter = hourlyAlts(zOuter, offOuter, now), altInner = hourlyAlts(zInner, offInner, now);

    dctx.clearRect(0, 0, SIZE, SIZE);
    drawBand(OUTER, altOuter, rotOuterDisplay);
    drawBand(INNER, altInner, 0);
    dctx.strokeStyle = "rgba(255,255,255,0.16)"; dctx.lineWidth = 1;
    [OUTER.rMid + OUTER.w / 2, OUTER.rMid - OUTER.w / 2, INNER.rMid + INNER.w / 2, INNER.rMid - INNER.w / 2].forEach(function (r) {
      dctx.beginPath(); dctx.arc(CX, CY, r, 0, Math.PI * 2); dctx.stroke();
    });
    drawNumbers(OUTER, altOuter, rotOuterDisplay);
    drawNumbers(INNER, altInner, 0);
    // biased further into the gap (away from the ring, toward the dial's own border/hollow centre) -
    // a flat 50/50 split still read as hugging the ring, since the visible glass-card border sits
    // outside this canvas's own edge (dial-card padding+border), so true-centre reads ring-hugging.
    var labelGap = CX - (OUTER.rMid + OUTER.w / 2);
    drawCurvedLabel(zOuter.city.toUpperCase(), OUTER.rMid + OUTER.w / 2 + labelGap * 0.6);
    drawCurvedLabel(zInner.city.toUpperCase(), INNER.rMid - INNER.w / 2 - labelGap * 0.6);
  }

  function fmtOffset(min) {
    var s = min < 0 ? "-" : "+", a = Math.abs(min);
    return "UTC" + s + String(Math.floor(a / 60)).padStart(2, "0") + ":" + String(a % 60).padStart(2, "0");
  }

  // ---- dropdowns ------------------------------------------------------------
  function sortedZones() {
    var now = new Date(), arr = ZONES.slice();
    arr.sort(function (a, b) {
      var d = offset(a.tz, now) - offset(b.tz, now);
      return d !== 0 ? d : a.city.localeCompare(b.city);
    });
    return arr;
  }
  function fillSelect(sel, selected, query) {
    var now = new Date(), frag = document.createDocumentFragment();
    var q = (query || "").trim().toLowerCase();
    if (q) { // while searching, show a placeholder instead of the stale prior selection
      var ph = document.createElement("option");
      ph.textContent = "Search results…"; ph.value = ""; ph.disabled = true; ph.selected = true;
      frag.appendChild(ph);
    }
    sortedZones().forEach(function (z) {
      var hay = (z.city + " " + (z.region || "")).toLowerCase();
      if (q && hay.indexOf(q) === -1) return; // process-of-elimination filter, no exceptions
      var o = document.createElement("option");
      o.value = z.tz;
      o.textContent = z.city + (z.region ? " (" + z.region + ")" : "") + "  " + fmtOffset(offset(z.tz, now));
      if (!q && z.tz === selected) o.selected = true;
      frag.appendChild(o);
    });
    sel.innerHTML = ""; sel.appendChild(frag);
  }

  // ---- URL query-param sync ---------------------------------------------------
  function syncUrl() {
    history.replaceState(null, "", "?tz1=" + encodeURIComponent(state.left) + "&tz2=" + encodeURIComponent(state.right));
  }

  // ---- drag outer ring to rotate ---------------------------------------------
  var dragging = false, lastAngle = 0, totalDrag = 0;
  function pointerAngle(e) {
    var r = dial.getBoundingClientRect(), scale = SIZE / r.width;
    var dx = (e.clientX - r.left) * scale - CX, dy = (e.clientY - r.top) * scale - CY;
    return { deg: Math.atan2(dy, dx) * 180 / Math.PI, dist: Math.sqrt(dx * dx + dy * dy) };
  }
  function wireDragToRotate() {
    dial.addEventListener("pointerdown", function (e) {
      var p = pointerAngle(e);
      if (p.dist < OUTER.rMid - OUTER.w / 2 || p.dist > OUTER.rMid + OUTER.w / 2) return;
      dragging = true; lastAngle = p.deg; totalDrag = 0;
      try { dial.setPointerCapture(e.pointerId); } catch (err) {}
    });
    dial.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var cur = pointerAngle(e).deg;
      var step = cur - lastAngle;
      if (step > 180) step -= 360; else if (step < -180) step += 360; // atan2 wraps at +-180; accumulate the short way round, not the raw jump
      totalDrag += step;
      lastAngle = cur;
      dragPreviewDeg = totalDrag;
      render();
    });
    function drop() {
      if (!dragging) return;
      dragging = false;
      var now = new Date();
      var rotOuter = -(offset(state.left, now) - offset(state.right, now)) / 60 * 15;
      var snappedDelta = Math.round((dragPreviewDeg || 0) / 15) * 15;
      var targetOffset = offset(state.right, now) - (rotOuter + snappedDelta) / 15 * 60;
      var best = null, bestDiff = Infinity;
      ZONES.forEach(function (z) {
        // the dial wraps every 24h (same as the 00-23 hour ring itself), so measure the
        // SHORTEST distance around that circle, not a raw linear diff. Kiritimati (+14) and
        // Midway (-11) sit either side of the date line and are barely an hour apart this way -
        // a plain linear diff would treat them as ~25h apart and dead-stop the drag at each end.
        var raw = Math.abs(offset(z.tz, now) - targetOffset) % 1440;
        var diff = Math.min(raw, 1440 - raw);
        if (diff < bestDiff || (diff === bestDiff && z.city.localeCompare(best.city) < 0)) { bestDiff = diff; best = z; }
      });
      dragPreviewDeg = null;
      state.left = best.tz;
      $("selLeft").value = state.left;
      syncUrl();
      render();
    }
    dial.addEventListener("pointerup", drop);
    dial.addEventListener("pointercancel", function () { dragging = false; dragPreviewDeg = null; render(); });
  }

  // ---- wire up --------------------------------------------------------------
  $("versionTag").textContent = "v" + VERSION;
  initTheme();
  setupCanvas();
  var qp = new URLSearchParams(location.search);
  var qTz1 = qp.get("tz1"), qTz2 = qp.get("tz2");
  if (qTz1 && qTz2 && byTz[qTz1] && byTz[qTz2]) {
    state.left = qTz1; state.right = qTz2;
  } else {
    state.left = "Australia/Sydney"; state.right = "Europe/London";
  }
  fillSelect($("selLeft"), state.left);
  fillSelect($("selRight"), state.right);
  $("selLeft").addEventListener("change", function () { state.left = this.value; syncUrl(); render(); });
  $("selRight").addEventListener("change", function () { state.right = this.value; syncUrl(); render(); });
  $("searchLeft").addEventListener("input", function () { fillSelect($("selLeft"), state.left, this.value); });
  $("searchRight").addEventListener("input", function () { fillSelect($("selRight"), state.right, this.value); });
  window.addEventListener("resize", function () { setupCanvas(); render(); });
  wireDragToRotate();
  render();
})();
