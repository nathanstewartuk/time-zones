import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { tzOffsetMin, sunUTC, utcMinToLocalHour } = require("./astro.js");
const assert = require("assert");

const fmt = (x) => x == null || x.polar ? String(x && x.polar) :
  `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(Math.round(x % 60)).padStart(2, "0")}`;

// offsets, DST-correct
assert.equal(tzOffsetMin("Europe/London", new Date("2025-07-15T12:00:00Z")), 60, "BST +60");
assert.equal(tzOffsetMin("Europe/London", new Date("2025-01-15T12:00:00Z")), 0, "GMT 0");
assert.equal(tzOffsetMin("Australia/Sydney", new Date("2025-07-15T12:00:00Z")), 600, "AEST +600");
assert.equal(tzOffsetMin("Australia/Sydney", new Date("2025-01-15T12:00:00Z")), 660, "AEDT +660");
assert.equal(tzOffsetMin("Asia/Kolkata", new Date("2025-07-15T12:00:00Z")), 330, "IST +330 half-hour");

// sun times to the minute (London, City coords)
const s = sunUTC(2025, 6, 21, 51.51, -0.13);
assert.equal(fmt(s.rise), "03:43", "London solstice sunrise UTC");
assert.equal(fmt(s.set), "20:21", "London solstice sunset UTC");
const w = sunUTC(2025, 12, 21, 51.51, -0.13);
assert.ok(Math.abs(w.rise - 484) <= 2, "London midwinter sunrise ~08:04");

// polar day: Tromsø in June, sun never sets
const p = sunUTC(2025, 6, 21, 69.65, 18.96);
assert.ok(p.rise && (p.rise.polar === "day" || p.set.polar === "day"), "polar day detected");

// local-hour projection wraps correctly
assert.equal(utcMinToLocalHour(0, 60).toFixed(2), "1.00", "midnight UTC +1h = 01:00");
assert.equal(utcMinToLocalHour(23 * 60, 120).toFixed(2), "1.00", "23:00 UTC +2h wraps to 01:00");

console.log("ok — all astro checks pass");
