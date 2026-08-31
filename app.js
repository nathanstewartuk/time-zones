(function () {
  var VERSION = "0.3.2"; // ponytail: bump manually alongside `git tag vX.Y.Z`, no build step to auto-inject it
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

  // ---- now hand ---------------------------------------------------------------
  // exact current time, in the INNER ring's fixed frame (same "one angle, both rings agree
  // this is now" reasoning as the hour-select overlay) - a solid line covering both rings only
  // (inner ring's own inner edge out to the outer ring's outer edge, not into the hollow centre).
  // Render-time snapshot like the rest of the dial, no live tick (see "No live clock tick yet"
  // under Design decisions).
  function drawNowHand(offInner) {
    var now = new Date();
    var mins = normMin(now.getUTCHours() * 60 + now.getUTCMinutes() + now.getUTCSeconds() / 60 + offInner);
    var deg = hourToAngle(mins / 60);
    var rad = (deg - 90) * Math.PI / 180;
    var rInner = INNER.rMid - INNER.w / 2, rOuter = OUTER.rMid + OUTER.w / 2;
    dctx.save();
    dctx.strokeStyle = document.documentElement.getAttribute("data-theme") === "dark" ? "rgba(120,120,120,0.75)" : "rgba(16,19,26,0.45)";
    dctx.lineWidth = 2.5;
    dctx.beginPath();
    dctx.moveTo(CX + rInner * Math.cos(rad), CY + rInner * Math.sin(rad));
    dctx.lineTo(CX + rOuter * Math.cos(rad), CY + rOuter * Math.sin(rad));
    dctx.stroke();
    dctx.restore();
  }

  // ---- hour-select overlay ---------------------------------------------------
  // selected hours are in the INNER ring's fixed, unrotated frame (hour h always spans
  // hourToAngle(h)..hourToAngle(h+1) on screen, same angle both rings agree "now" is aligned
  // through) - so a selection is really "this moment/range", shown correctly on both rings
  // regardless of their UTC-offset rotation, with zero extra math needed per ring.
  var selectedHours = new Set();
  function drawHourSelection() {
    if (!selectedHours.size) return;
    var sorted = Array.from(selectedHours).sort(function (a, b) { return a - b; });
    // group into runs of consecutive hours (mod 24) so a contiguous multi-hour drag renders as
    // one clean wedge with a dashed border around its OUTSIDE, not one per hour.
    var runs = [], run = [sorted[0]];
    for (var i = 1; i < sorted.length; i++) {
      if (sorted[i] === run[run.length - 1] + 1) run.push(sorted[i]);
      else { runs.push(run); run = [sorted[i]]; }
    }
    runs.push(run);
    // merge the last run into the first if they wrap across the 23->0 boundary.
    if (runs.length > 1 && runs[0][0] === 0 && runs[runs.length - 1][runs[runs.length - 1].length - 1] === 23) {
      runs[0] = runs.pop().concat(runs[0]);
    }
    dctx.save();
    runs.forEach(function (r) {
      // -7.5deg: hourToAngle(h) is the NUMBER's own angle, not a bucket edge - shift back half
      // an hour so the wedge is centred on the number, with its border falling between numbers.
      var startDeg = hourToAngle(r[0]) - 7.5, spanDeg = r.length * 15;
      var a0 = (startDeg - 90) * Math.PI / 180, a1 = a0 + spanDeg * Math.PI / 180;
      dctx.beginPath();
      dctx.arc(CX, CY, OUTER.rMid + OUTER.w / 2, a0, a1);
      dctx.arc(CX, CY, INNER.rMid - INNER.w / 2, a1, a0, true);
      dctx.closePath();
      dctx.fillStyle = "rgba(94,187,252,0.22)"; // #5EBBFC wash, same in both themes
      dctx.fill();
      dctx.setLineDash([6, 4]);
      dctx.lineWidth = 2.5;
      dctx.strokeStyle = "#5EBBFC";
      dctx.stroke();
    });
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
    drawHourSelection();
    drawNowHand(offInner);
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

  // ---- drag outer ring to rotate / click-or-drag inner ring+hollow to select hour(s) ----------
  var mode = null; // null | "rotate" | "select"
  var lastAngle = 0, totalDrag = 0;
  var selectStartHour = 0, selectWasSoleHour = false;
  function pointerAngle(e) {
    var r = dial.getBoundingClientRect(), scale = SIZE / r.width;
    var dx = (e.clientX - r.left) * scale - CX, dy = (e.clientY - r.top) * scale - CY;
    return { deg: Math.atan2(dy, dx) * 180 / Math.PI, dist: Math.sqrt(dx * dx + dy * dy) };
  }
  // absolute hour (0-23) under the pointer, in the INNER ring's fixed/unrotated frame.
  // buckets are centred on each number (matching drawHourSelection's -7.5deg wedge shift), so a
  // tap near the number itself selects that hour, not whichever hour's edge happens to be there.
  function hourFromPointer(e) {
    var mine = pointerAngle(e).deg + 90; // convert atan2's 0=3-o'clock convention to hourToAngle's 0=top convention
    var a = ((mine + 180 + 7.5) % 360 + 360) % 360;
    return Math.floor(a / 15);
  }
  // shorter of the two ways round the clock from startH to endH, inclusive both ends.
  function hourRange(startH, endH) {
    var fwd = [], h = startH;
    while (true) { fwd.push(h); if (h === endH) break; h = (h + 1) % 24; }
    var bwd = [], h2 = startH;
    while (true) { bwd.push(h2); if (h2 === endH) break; h2 = (h2 + 23) % 24; }
    return fwd.length <= bwd.length ? fwd : bwd;
  }
  function wireDragToRotate() {
    dial.addEventListener("pointerdown", function (e) {
      var p = pointerAngle(e);
      if (p.dist >= OUTER.rMid - OUTER.w / 2 && p.dist <= OUTER.rMid + OUTER.w / 2) {
        mode = "rotate"; lastAngle = p.deg; totalDrag = 0;
      } else if (p.dist < OUTER.rMid - OUTER.w / 2) {
        mode = "select"; selectStartHour = hourFromPointer(e);
        // tapping the one hour that's already the WHOLE selection toggles it off - remembered here,
        // resolved at drop() once we know whether the gesture ends up leaving that single hour.
        selectWasSoleHour = selectedHours.size === 1 && selectedHours.has(selectStartHour);
        selectedHours = new Set([selectStartHour]);
        render();
      } else {
        return; // outside the whole dial (in the glass-card rim margin) - not a gesture
      }
      try { dial.setPointerCapture(e.pointerId); } catch (err) {}
    });
    dial.addEventListener("pointermove", function (e) {
      if (mode === "rotate") {
        var cur = pointerAngle(e).deg;
        var step = cur - lastAngle;
        if (step > 180) step -= 360; else if (step < -180) step += 360; // atan2 wraps at +-180; accumulate the short way round, not the raw jump
        totalDrag += step;
        lastAngle = cur;
        dragPreviewDeg = totalDrag;
        render();
      } else if (mode === "select") {
        selectedHours = new Set(hourRange(selectStartHour, hourFromPointer(e)));
        render();
      }
    });
    function drop() {
      if (mode === "select") {
        mode = null;
        // the whole gesture (tap, or a drag that never left the start hour) stayed on the one
        // hour that was already the entire selection - that's the deselect gesture.
        if (selectWasSoleHour && selectedHours.size === 1 && selectedHours.has(selectStartHour)) {
          selectedHours = new Set();
          render();
        }
        return;
      }
      if (mode !== "rotate") return;
      mode = null;
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
    dial.addEventListener("pointercancel", function () { mode = null; dragPreviewDeg = null; render(); });
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
