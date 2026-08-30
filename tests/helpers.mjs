import path from "path";
import { fileURLToPath } from "url";

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const PAGE_URL = "file://" + path.join(REPO, "index.html");

export function urlWith(params) {
  const qs = new URLSearchParams(params).toString();
  return qs ? PAGE_URL + "?" + qs : PAGE_URL;
}

// dial canvas geometry, mirrored from app.js's own constants (SIZE/CX/CY/OUTER/INNER) -
// keep these in sync with app.js by hand, there is no shared module (no build step on the site).
export const SIZE = 640, CX = 320, CY = 320;
export const OUTER = { rMid: 246, w: 82 }; // spans 205..287
export const INNER = { rMid: 151, w: 82 }; // spans 110..192

// convert a canvas-space (radius in SIZE units, angle in degrees where 0=top/12 o'clock,
// increasing clockwise - same convention app.js uses throughout) into a real page pixel
// point, given #dial's actual bounding box on screen.
export function dialPoint(box, radiusUnits, angleDeg) {
  const scale = box.width / SIZE;
  const rad = (angleDeg - 90) * Math.PI / 180; // -90 so 0deg input = straight up, matching app.js's hourToAngle/-90 convention
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  return {
    x: cx + radiusUnits * scale * Math.cos(rad),
    y: cy + radiusUnits * scale * Math.sin(rad),
  };
}

export async function dialBox(page) {
  return page.$eval("#dial", (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
}

// read the RGBA pixel at a canvas-space (radius, angle) point directly off #dial's own pixel
// buffer (not a screenshot) - lets a test assert what colour got drawn at a spot (e.g. a dial
// label, or a hover overlay) without OCR. angle convention: 0=top, clockwise, same as dialPoint.
export async function samplePixel(page, radiusUnits, angleDeg) {
  return page.evaluate(({ radiusUnits, angleDeg, SIZE, CX, CY }) => {
    const rad = (angleDeg - 90) * Math.PI / 180;
    const x = CX + radiusUnits * Math.cos(rad), y = CY + radiusUnits * Math.sin(rad);
    const canvas = document.getElementById("dial");
    const dpr = canvas.width / SIZE; // matches app.js's setupCanvas() DPR scaling
    const ctx = canvas.getContext("2d");
    const d = ctx.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] };
  }, { radiusUnits, angleDeg, SIZE, CX, CY });
}

// hour (0-23) -> angle in degrees (in dialPoint's 0deg=top/clockwise convention) for a ring
// rotated by rotDeg, exactly matching app.js's own hourToAngle(h)+rotateDeg used in drawNumbers -
// verified against rendered screenshots: hour 12=top (0deg), hour 18=3-o'clock (90deg), hour 0=bottom (180deg).
export function hourAngle(hour, rotDeg) {
  return ((hour / 24) * 360 - 180) + (rotDeg || 0);
}
