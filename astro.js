// pure time-zone + sun math. no DOM, no network. testable in node.
var RAD = Math.PI / 180, DEG = 180 / Math.PI;

function dayOfYear(y, m, d) {
  return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000);
}

// DST-correct offset (minutes east of UTC) for an IANA zone at an instant.
function tzOffsetMin(tz, date) {
  var dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
  var p = {};
  dtf.formatToParts(date).forEach(function (x) { if (x.type !== "literal") p[x.type] = +x.value; });
  var asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUTC - date.getTime()) / 60000);
}

// NOAA sunrise/sunset for a date at lat/lon. returns UTC minutes-from-midnight,
// or {polar:'day'|'night'} when the sun never sets/rises that day.
function sunUTC(y, m, d, lat, lon) {
  var out = {};
  ["rise", "set"].forEach(function (which) {
    var zenith = 90.833, lngHour = lon / 15;
    var t = which === "rise" ? dayOfYear(y, m, d) + (6 - lngHour) / 24
                             : dayOfYear(y, m, d) + (18 - lngHour) / 24;
    var M = 0.9856 * t - 3.289;
    var L = M + 1.916 * Math.sin(M * RAD) + 0.020 * Math.sin(2 * M * RAD) + 282.634;
    L = ((L % 360) + 360) % 360;
    var RA = DEG * Math.atan(0.91764 * Math.tan(L * RAD));
    RA = ((RA % 360) + 360) % 360;
    RA = (RA + (Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90)) / 15;
    var sinDec = 0.39782 * Math.sin(L * RAD);
    var cosDec = Math.cos(Math.asin(sinDec));
    var cosH = (Math.cos(zenith * RAD) - sinDec * Math.sin(lat * RAD)) / (cosDec * Math.cos(lat * RAD));
    if (cosH > 1) { out[which] = { polar: "night" }; return; }   // sun never rises
    if (cosH < -1) { out[which] = { polar: "day" }; return; }    // sun never sets
    var H = (which === "rise" ? 360 - DEG * Math.acos(cosH) : DEG * Math.acos(cosH)) / 15;
    var UT = ((H + RA - 0.06571 * t - 6.622 - lngHour) % 24 + 24) % 24;
    out[which] = UT * 60;
  });
  return out;
}

// solar elevation angle (degrees above horizon) at a UTC instant for lat/lon.
// NOAA solar position. utcMin = minutes from UTC midnight of that date.
function sunAltitude(y, m, d, lat, lon, utcMin) {
  var N = dayOfYear(y, m, d);
  var gamma = 2 * Math.PI / 365 * (N - 1 + (utcMin / 60 - 12) / 24);
  var eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
    - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  var decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma)
    - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma)
    - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  var tst = utcMin + eqtime + 4 * lon;          // true solar time, minutes (tz=UTC)
  var ha = (tst / 4 - 180) * RAD;               // hour angle
  var cosZ = Math.sin(lat * RAD) * Math.sin(decl) + Math.cos(lat * RAD) * Math.cos(decl) * Math.cos(ha);
  return 90 - Math.acos(Math.max(-1, Math.min(1, cosZ))) * DEG;
}

// local wall-clock hour (0..24 float) of a UTC-minutes-from-midnight value in a zone,
// given the zone's offset that day. wraps into 0..24.
function utcMinToLocalHour(utcMin, offsetMin) {
  return (((utcMin + offsetMin) / 60) % 24 + 24) % 24;
}

if (typeof module !== "undefined") {
  module.exports = { dayOfYear, tzOffsetMin, sunUTC, utcMinToLocalHour, sunAltitude };
}
