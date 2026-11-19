// VELVET TIDE — small math and collision helpers shared by every system.
// All original code, written for this game.
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function dist2d(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }
// Deterministic random from a seed, so screenshots and tests repeat.
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
// Push a circle (x,z,r) out of an axis-aligned box {minX,maxX,minZ,maxZ}.
// Returns true when a push happened; mutates pos {x,z}.
export function collideCircleBox(pos, r, box) {
  const cx = clamp(pos.x, box.minX, box.maxX);
  const cz = clamp(pos.z, box.minZ, box.maxZ);
  const dx = pos.x - cx, dz = pos.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    pos.x = cx + (dx / d) * r;
    pos.z = cz + (dz / d) * r;
  } else {
    // Centre inside the box: push out along the smallest penetration axis.
    const pl = pos.x - box.minX, pr = box.maxX - pos.x;
    const pt = pos.z - box.minZ, pb = box.maxZ - pos.z;
    const m = Math.min(pl, pr, pt, pb);
    if (m === pl) pos.x = box.minX - r;
    else if (m === pr) pos.x = box.maxX + r;
    else if (m === pt) pos.z = box.minZ - r;
    else pos.z = box.maxZ + r;
  }
  return true;
}
export function formatClock(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
export function formatMoney(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
