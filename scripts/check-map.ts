/**
 * Vérifie une carte : croisements de routes, villes trop proches d'une route,
 * routes trop courtes à l'écran, répartition des longueurs et des couleurs, valeur des billets.
 * Usage : npx tsx scripts/check-map.ts <france|bretagne|europe>
 */
import { MAPS } from '../shared/maps';
import type { MapId } from '../shared/maps/build';
import type { City } from '../shared/types';

const map = MAPS[(process.argv[2] ?? 'france') as MapId];
const P = map.cityById;
const len: Record<number, number> = {};
const col: Record<string, number> = {};
let total = 0;
for (const r of map.routes) {
  len[r.length] = (len[r.length] ?? 0) + 1;
  col[r.color] = (col[r.color] ?? 0) + r.length;
  total += r.length;
}
console.log(map.id, 'routes', map.routes.length, 'wagons sur la carte', total, 'longueurs', len);
console.log('couleurs (wagons)', col);
const cross = (p1: City, p2: City, p3: City, p4: City) => {
  const d = (a: City, b: City, c: City) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return d(p3, p4, p1) * d(p3, p4, p2) < 0 && d(p1, p2, p3) * d(p1, p2, p4) < 0;
};
let problems = 0;
for (let i = 0; i < map.routes.length; i++)
  for (let j = i + 1; j < map.routes.length; j++) {
    const a = map.routes[i];
    const b = map.routes[j];
    if ([a.a, a.b].some((c) => c === b.a || c === b.b)) continue;
    if (cross(P[a.a], P[a.b], P[b.a], P[b.b])) {
      console.log('CROISEMENT', `${a.a}-${a.b}`, `${b.a}-${b.b}`);
      problems++;
    }
  }
for (const r of map.routes)
  for (const c of map.cities) {
    if (c.id === r.a || c.id === r.b) continue;
    const A = P[r.a];
    const B = P[r.b];
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const t = ((c.x - A.x) * dx + (c.y - A.y) * dy) / (dx * dx + dy * dy);
    if (t <= 0 || t >= 1) continue;
    const dist = Math.hypot(A.x + t * dx - c.x, A.y + t * dy - c.y);
    if (dist < 22) {
      console.log('VILLE PROCHE', `${r.a}-${r.b}`, c.id, dist.toFixed(1));
      problems++;
    }
  }
for (const r of map.routes) {
  const d = Math.hypot(P[r.a].x - P[r.b].x, P[r.a].y - P[r.b].y);
  if (d / r.length < 30) console.log('TROP COURTE', r.a, r.b, r.length, d.toFixed(0));
  if (d < 26) problems++;
}
for (const c of map.cities)
  if (c.x < 0 || c.y < 0 || c.x > map.width || c.y > map.height) {
    console.log('HORS CARTE', c.id, c.x, c.y);
    problems++;
  }
console.log('billets', map.tickets.map((t) => `${t.a}-${t.b}:${t.points}`).join(' '));
console.log(problems ? `${problems} problème(s)` : 'OK');
process.exit(problems ? 1 : 0);
