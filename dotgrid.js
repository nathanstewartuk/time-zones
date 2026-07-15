// Faithful port of stitch's PublicHomepage dot-grid canvas.
// Canvas-rendered, Perlin-noise displacement, cursor push + chase smoothing.
// Constants verbatim from the stitch reference. Base colour adapts to theme.
(function () {
  var GRID = 16, DOT_R = 1.1, INFL = 725, PUSH = 28, CHASE = 0.035;
  var NOISE_AMP = 6, NOISE_SCALE = 0.04, NOISE_TIME = 8e-4;
  var GLOW_A = [124, 92, 255];   // purple
  var GLOW_B = [64, 217, 198];   // cyan
  function baseColor() {
    return document.documentElement.getAttribute("data-theme") === "dark"
      ? [150, 158, 180] : [70, 78, 100];
  }
  function baseAlpha() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? 0.22 : 0.20;
  }

  // Perlin noise (stitch's exact permutation table).
  var M = new Uint8Array(512);
  (function () {
    var e = new Uint8Array(256);
    for (var i = 0; i < 256; i++) e[i] = i;
    for (var j = 255; j > 0; j--) { var n = ((j * 2654435761) >>> 0) % (j + 1); var r = e[j]; e[j] = e[n]; e[n] = r; }
    for (var k = 0; k < 512; k++) M[k] = e[k & 255];
  })();
  var NV = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
  var fade = function (t) { return t * t * t * (t * (t * 6 - 15) + 10); };
  var lerp = function (a, b, t) { return a + t * (b - a); };
  var grad = function (h, x, y) { var r = NV[h & 7]; return r[0] * x + r[1] * y; };
  function noise2(x, y) {
    var ix = Math.floor(x) & 255, iy = Math.floor(y) & 255;
    var fx = x - Math.floor(x), fy = y - Math.floor(y);
    var u = fade(fx), v = fade(fy);
    var aa = M[M[ix] + iy], ab = M[M[ix] + iy + 1], ba = M[M[ix + 1] + iy], bb = M[M[ix + 1] + iy + 1];
    return lerp(lerp(grad(aa, fx, fy), grad(ba, fx - 1, fy), u),
                lerp(grad(ab, fx, fy - 1), grad(bb, fx - 1, fy - 1), u), v);
  }

  var canvas = document.getElementById("dot-canvas");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var dots = [], W = 0, H = 0, pointer = null;

  function buildDots(w, h) {
    var cols = Math.ceil(w / GRID) + 1, rows = Math.ceil(h / GRID) + 1;
    dots = [];
    for (var r = 0; r < rows; r++)
      for (var c = 0; c < cols; c++) dots.push({ gx: c * GRID, gy: r * GRID, x: c * GRID, y: r * GRID });
    W = w; H = h;
  }
  function resize() {
    var rect = canvas.parentElement.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    var w = Math.round(rect.width), h = Math.round(rect.height);
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(dpr, dpr);
    buildDots(w, h);
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    var t = performance.now() * NOISE_TIME, C2 = INFL * INFL;
    var BASE = baseColor(), BA = baseAlpha();
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i], tx = d.gx, ty = d.gy, a = 0;
      if (pointer) {
        var dx = d.gx - pointer.x, dy = d.gy - pointer.y, d2 = dx * dx + dy * dy;
        if (d2 < C2 && d2 > 0) {
          var dist = Math.sqrt(d2);
          a = 1 - dist / INFL;
          var push = a * a * a * PUSH;
          tx = d.gx + (dx / dist) * push; ty = d.gy + (dy / dist) * push;
          var namp = a * a * NOISE_AMP;
          tx += noise2(d.gx * NOISE_SCALE, d.gy * NOISE_SCALE + t) * namp;
          ty += noise2(d.gx * NOISE_SCALE + 100, d.gy * NOISE_SCALE + t) * namp;
        }
      }
      d.x += (tx - d.x) * CHASE; d.y += (ty - d.y) * CHASE;
      var R = BASE[0], G = BASE[1], B = BASE[2], m = BA;
      var fadeStart = H * 0.72;
      if (d.gy > fadeStart) m *= 1 - (d.gy - fadeStart) / (H - fadeStart);
      if (pointer && a > 0) {
        m = m + a * a * (0.9 - BA);          // brighten near cursor
        var ang = Math.atan2(d.gy - pointer.y, d.gx - pointer.x);
        var mix = (Math.sin(ang * 2 + t * 3) + 1) * 0.5;
        var k = a * a;
        R = Math.round(lerp(BASE[0], lerp(GLOW_A[0], GLOW_B[0], mix), k));
        G = Math.round(lerp(BASE[1], lerp(GLOW_A[1], GLOW_B[1], mix), k));
        B = Math.round(lerp(BASE[2], lerp(GLOW_A[2], GLOW_B[2], mix), k));
      }
      ctx.fillStyle = "rgba(" + R + "," + G + "," + B + "," + m + ")";
      ctx.beginPath(); ctx.arc(d.x, d.y, DOT_R, 0, Math.PI * 2); ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  window.addEventListener("mousemove", function (e) {
    var r = canvas.parentElement.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) { pointer = null; return; }
    pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
  });
  window.addEventListener("mouseleave", function () { pointer = null; });
  new ResizeObserver(resize).observe(canvas.parentElement);
  resize();
  requestAnimationFrame(draw);
})();
