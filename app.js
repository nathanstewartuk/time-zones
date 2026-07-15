(function () {
  var $ = function (id) { return document.getElementById(id); };
  var SIZE = 600, CX = 300, CY = 300;
  var GAP = 13;                       // gap dial->dial AND outer-dial->glass-rim (equal)
  // outer edge 300-GAP=287; each band 82 wide; gap 13 between; hole radius 110.
  var OUTER = { rMid: 246, w: 82 };   // spans 205..287
  var INNER = { rMid: 151, w: 82 };   // spans 110..192  (192 = 205-GAP)
  var byTz = {};
  ZONES.forEach(function (z) { byTz[z.tz] = z; });

  // ---- theme (persisted so extensions / force-dark can't override choice) ---
  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem("tz-theme"); } catch (e) {}
    var q = (location.search.match(/[?&]theme=(dark|light)/) || [])[1];
    var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", saved || q || (prefersDark ? "dark" : "light"));
  }
  $("themeBtn").addEventListener("click", function () {
    var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("tz-theme", next); } catch (e) {}
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
  var textColor = { day: "#3c2d0a", night: "#f7f9ff" };
  function readThemeColors() {
    textColor.day = document.documentElement.getAttribute("data-theme") === "dark" ? "#3a2804" : "#5a4610";
    textColor.night = "#f7f9ff";
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

  // ---- state + render -------------------------------------------------------
  var state = { left: null, right: null, sort: "offset" };
  function offset(tz, date) { return tzOffsetMin(tz, date); }

  var DPR = 1;
  function setupCanvas() {
    DPR = window.devicePixelRatio || 1;
    dial.width = SIZE * DPR; dial.height = SIZE * DPR;
    dctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function render() {
    var now = new Date();
    var zL = byTz[state.left], zR = byTz[state.right];
    var offL = offset(state.left, now), offR = offset(state.right, now);
    // -ve so both dials' current hour lands at the same screen angle (radially aligned).
    var rotOuter = -(offR - offL) / 60 * 15;
    readThemeColors();
    var altL = hourlyAlts(zL, offL, now), altR = hourlyAlts(zR, offR, now);

    dctx.clearRect(0, 0, SIZE, SIZE);
    drawBand(OUTER, altR, rotOuter);
    drawBand(INNER, altL, 0);
    dctx.strokeStyle = "rgba(255,255,255,0.16)"; dctx.lineWidth = 1;
    [OUTER.rMid + OUTER.w / 2, OUTER.rMid - OUTER.w / 2, INNER.rMid + INNER.w / 2, INNER.rMid - INNER.w / 2].forEach(function (r) {
      dctx.beginPath(); dctx.arc(CX, CY, r, 0, Math.PI * 2); dctx.stroke();
    });
    drawNumbers(OUTER, altR, rotOuter);
    drawNumbers(INNER, altL, 0);
  }

  function fmtOffset(min) {
    var s = min < 0 ? "-" : "+", a = Math.abs(min);
    return "UTC" + s + String(Math.floor(a / 60)).padStart(2, "0") + ":" + String(a % 60).padStart(2, "0");
  }

  // ---- drag the dial to rotate the outer ring -------------------------------
  var drag = { on: false, startAngle: 0, startOff: 0, pending: false };
  function angleOf(ev) {
    var r = dial.getBoundingClientRect();
    var pt = ev.touches && ev.touches[0] ? ev.touches[0] : ev;
    return Math.atan2(pt.clientY - (r.top + r.height / 2), pt.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
  }
  function dragDown(ev) {
    drag.on = true; drag.startAngle = angleOf(ev); drag.startOff = offset(state.right, new Date());
    dial.classList.add("grabbing");
    ev.preventDefault();
  }
  function dragMove(ev) {
    if (!drag.on || drag.pending) return;
    drag.pending = true;
    requestAnimationFrame(function () {
      drag.pending = false;
      var hoursDelta = Math.round((angleOf(ev) - drag.startAngle) / 15);
      var tz = zoneAtOffset(drag.startOff + hoursDelta * 60);
      if (tz && tz !== state.right) {
        state.right = tz;
        $("selRight").value = tz;   // option already exists — no rebuild
        render();
      }
    });
    ev.preventDefault();
  }
  function dragUp() {
    if (!drag.on) return;
    drag.on = false; dial.classList.remove("grabbing");
    fillSelect($("selRight"), state.right); // resync full list once, on release
  }
  dial.addEventListener("mousedown", dragDown);
  dial.addEventListener("touchstart", dragDown, { passive: false });
  window.addEventListener("mousemove", dragMove);
  window.addEventListener("touchmove", dragMove, { passive: false });
  window.addEventListener("mouseup", dragUp);
  window.addEventListener("touchend", dragUp);

  function zoneAtOffset(targetMin) {
    var now = new Date(), best = null, bestDiff = 1e9;
    for (var i = 0; i < ZONES.length; i++) {
      var d = Math.abs(offset(ZONES[i].tz, now) - targetMin);
      if (d < bestDiff) { bestDiff = d; best = ZONES[i].tz; }
    }
    return bestDiff <= 30 ? best : null;
  }

  // ---- dropdowns ------------------------------------------------------------
  function sortedZones() {
    var now = new Date(), arr = ZONES.slice();
    if (state.sort === "offset") {
      arr.sort(function (a, b) {
        var d = offset(a.tz, now) - offset(b.tz, now);
        return d !== 0 ? d : a.city.localeCompare(b.city);
      });
    } else {
      arr.sort(function (a, b) {
        var r = a.region.localeCompare(b.region);
        return r !== 0 ? r : a.city.localeCompare(b.city);
      });
    }
    return arr;
  }
  function fillSelect(sel, selected) {
    var now = new Date(), frag = document.createDocumentFragment();
    sortedZones().forEach(function (z) {
      var o = document.createElement("option");
      o.value = z.tz;
      o.textContent = z.city + (z.region ? " (" + z.region + ")" : "") + "  " + fmtOffset(offset(z.tz, now));
      if (z.tz === selected) o.selected = true;
      frag.appendChild(o);
    });
    sel.innerHTML = ""; sel.appendChild(frag);
  }

  // ---- defaults -------------------------------------------------------------
  function userZone() {
    try { var tz = Intl.DateTimeFormat().resolvedOptions().timeZone; if (byTz[tz]) return tz; } catch (e) {}
    return "Europe/London";
  }
  function nextZoneAhead(baseTz) {
    var now = new Date(), base = offset(baseTz, now), best = null, bestDiff = 1e9;
    ZONES.forEach(function (z) {
      var diff = offset(z.tz, now) - base;
      if (diff > 30 && diff < bestDiff) { bestDiff = diff; best = z.tz; }
    });
    return best || "Australia/Sydney";
  }

  // ---- segmented sort toggle ------------------------------------------------
  var seg = $("seg");
  seg.querySelectorAll(".seg-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      state.sort = b.getAttribute("data-sort");
      seg.setAttribute("data-active", state.sort);
      fillSelect($("selLeft"), state.left);
      fillSelect($("selRight"), state.right);
    });
  });

  // ---- wire up --------------------------------------------------------------
  initTheme();
  setupCanvas();
  state.left = userZone();
  state.right = nextZoneAhead(state.left);
  fillSelect($("selLeft"), state.left);
  fillSelect($("selRight"), state.right);
  $("selLeft").addEventListener("change", function () { state.left = this.value; render(); });
  $("selRight").addEventListener("change", function () { state.right = this.value; render(); });
  window.addEventListener("resize", function () { setupCanvas(); render(); });
  render();
})();
