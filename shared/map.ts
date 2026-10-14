import type { City, Route, RouteColor, Ticket } from './types';

/** Projection simple (équirectangulaire corrigée) longitude/latitude -> coordonnées SVG. */
const LON0 = -5.3;
const LAT0 = 51.45;
const SCALE = 100;
const COS = Math.cos((46.5 * Math.PI) / 180);
export const MAP_WIDTH = 935;
export const MAP_HEIGHT = 1035;
/** Pixels par wagon : sert à déduire la longueur d'une route de sa distance. */
const PX_PER_WAGON = 46;

export function project(lon: number, lat: number): [number, number] {
  return [Math.round((lon - LON0) * COS * SCALE * 10) / 10, Math.round((LAT0 - lat) * SCALE * 10) / 10];
}

type RawCity = [id: string, name: string, lon: number, lat: number, label: City['label'], foreign?: boolean];

const RAW_CITIES: RawCity[] = [
  ['cal', 'Calais', 1.86, 50.95, 'nw'],
  ['lil', 'Lille', 3.06, 50.63, 'ne'],
  ['bru', 'Bruxelles', 4.35, 50.85, 'e', true],
  ['ami', 'Amiens', 2.3, 49.89, 'w'],
  ['rou', 'Rouen', 1.1, 49.44, 'ne'],
  ['lha', 'Le Havre', 0.11, 49.49, 'n'],
  ['cae', 'Caen', -0.37, 49.18, 's'],
  ['che', 'Cherbourg', -1.62, 49.64, 'n'],
  ['bre', 'Brest', -4.49, 48.39, 'n'],
  ['ren', 'Rennes', -1.68, 48.11, 'n'],
  ['nts', 'Nantes', -1.55, 47.22, 'w'],
  ['lma', 'Le Mans', 0.2, 48.0, 'sw'],
  ['par', 'Paris', 2.35, 48.86, 'nw'],
  ['rei', 'Reims', 4.03, 49.26, 'ne'],
  ['met', 'Metz', 6.18, 49.12, 'e'],
  ['ncy', 'Nancy', 6.18, 48.69, 'w'],
  ['str', 'Strasbourg', 7.75, 48.58, 'e'],
  ['mul', 'Mulhouse', 7.34, 47.75, 'e'],
  ['bes', 'Besançon', 6.02, 47.24, 'sw'],
  ['dij', 'Dijon', 5.04, 47.32, 'w'],
  ['tro', 'Troyes', 4.07, 48.3, 's'],
  ['orl', 'Orléans', 1.91, 47.9, 'w'],
  ['tou', 'Tours', 0.69, 47.39, 's'],
  ['bou', 'Bourges', 2.4, 47.08, 'e'],
  ['poi', 'Poitiers', 0.34, 46.58, 'e'],
  ['lro', 'La Rochelle', -1.15, 46.16, 'w'],
  ['lim', 'Limoges', 1.26, 45.83, 'n'],
  ['cle', 'Clermont-Fd', 3.08, 45.78, 'ne'],
  ['lyo', 'Lyon', 4.84, 45.76, 'w'],
  ['gen', 'Genève', 6.14, 46.2, 'e', true],
  ['gre', 'Grenoble', 5.72, 45.19, 'w'],
  ['tur', 'Turin', 7.68, 45.07, 'e', true],
  ['brv', 'Brive', 1.53, 45.16, 'e'],
  ['bdx', 'Bordeaux', -0.58, 44.84, 'w'],
  ['rod', 'Rodez', 2.57, 44.35, 'e'],
  ['tls', 'Toulouse', 1.44, 43.6, 'nw'],
  ['bia', 'Biarritz', -1.56, 43.48, 'w'],
  ['pau', 'Pau', -0.37, 43.3, 's'],
  ['mtp', 'Montpellier', 3.88, 43.61, 's'],
  ['avi', 'Avignon', 4.81, 43.95, 'n'],
  ['mrs', 'Marseille', 5.37, 43.3, 's'],
  ['nic', 'Nice', 7.26, 43.7, 'se'],
  ['per', 'Perpignan', 2.89, 42.7, 'e'],
  ['bcn', 'Barcelone', 2.17, 41.39, 'e', true],
];

export const CITIES: City[] = RAW_CITIES.map(([id, name, lon, lat, label, foreign]) => {
  const [x, y] = project(lon, lat);
  return { id, name, x, y, label, foreign };
});

export const CITY_BY_ID: Record<string, City> = Object.fromEntries(CITIES.map((c) => [c.id, c]));

const RAW_ROUTES: [string, string, RouteColor][] = [
  ['cal', 'lil', 'white'],
  ['cal', 'ami', 'orange'],
  ['lil', 'bru', 'red'],
  ['lil', 'bru', 'blue'],
  ['lil', 'ami', 'black'],
  ['lil', 'rei', 'yellow'],
  ['bru', 'rei', 'green'],
  ['bru', 'met', 'purple'],
  ['ami', 'par', 'yellow'],
  ['ami', 'par', 'purple'],
  ['ami', 'rou', 'gray'],
  ['rou', 'lha', 'red'],
  ['rou', 'par', 'green'],
  ['rou', 'par', 'white'],
  ['lha', 'cae', 'gray'],
  ['cae', 'che', 'orange'],
  ['cae', 'ren', 'black'],
  ['che', 'ren', 'gray'],
  ['cae', 'lma', 'purple'],
  ['bre', 'ren', 'green'],
  ['bre', 'nts', 'gray'],
  ['ren', 'nts', 'red'],
  ['ren', 'lma', 'orange'],
  ['ren', 'lma', 'white'],
  ['nts', 'lma', 'blue'],
  ['nts', 'lro', 'yellow'],
  ['nts', 'tou', 'black'],
  ['lma', 'par', 'black'],
  ['lma', 'par', 'red'],
  ['lma', 'tou', 'green'],
  ['lma', 'rou', 'yellow'],
  ['par', 'orl', 'orange'],
  ['par', 'orl', 'blue'],
  ['par', 'rei', 'white'],
  ['par', 'rei', 'black'],
  ['par', 'tro', 'gray'],
  ['par', 'dij', 'red'],
  ['par', 'lyo', 'purple'],
  ['orl', 'tou', 'red'],
  ['orl', 'bou', 'yellow'],
  ['rei', 'met', 'orange'],
  ['rei', 'tro', 'purple'],
  ['met', 'ncy', 'gray'],
  ['met', 'str', 'blue'],
  ['ncy', 'str', 'yellow'],
  ['ncy', 'tro', 'green'],
  ['ncy', 'dij', 'orange'],
  ['ncy', 'bes', 'black'],
  ['str', 'mul', 'white'],
  ['mul', 'bes', 'purple'],
  ['mul', 'gen', 'gray'],
  ['bes', 'dij', 'yellow'],
  ['bes', 'gen', 'green'],
  ['tro', 'dij', 'blue'],
  ['dij', 'lyo', 'green'],
  ['dij', 'lyo', 'white'],
  ['bou', 'cle', 'purple'],
  ['bou', 'lim', 'gray'],
  ['tou', 'poi', 'white'],
  ['poi', 'lro', 'gray'],
  ['poi', 'lim', 'yellow'],
  ['poi', 'bdx', 'orange'],
  ['lro', 'bdx', 'purple'],
  ['lim', 'cle', 'red'],
  ['lim', 'brv', 'black'],
  ['lim', 'bdx', 'green'],
  ['cle', 'lyo', 'black'],
  ['cle', 'rod', 'yellow'],
  ['cle', 'brv', 'gray'],
  ['brv', 'tls', 'blue'],
  ['brv', 'bdx', 'yellow'],
  ['lyo', 'gen', 'blue'],
  ['lyo', 'gre', 'red'],
  ['lyo', 'avi', 'orange'],
  ['gen', 'gre', 'yellow'],
  ['gen', 'tur', 'gray'],
  ['gre', 'tur', 'green'],
  ['gre', 'avi', 'black'],
  ['gre', 'nic', 'purple'],
  ['tur', 'nic', 'red'],
  ['bdx', 'bia', 'blue'],
  ['bdx', 'tls', 'red'],
  ['bdx', 'tls', 'black'],
  ['bdx', 'pau', 'gray'],
  ['bia', 'pau', 'green'],
  ['pau', 'tls', 'yellow'],
  ['tls', 'rod', 'orange'],
  ['tls', 'mtp', 'blue'],
  ['tls', 'per', 'green'],
  ['tls', 'bcn', 'gray'],
  ['rod', 'mtp', 'purple'],
  ['mtp', 'avi', 'white'],
  ['mtp', 'per', 'orange'],
  ['mtp', 'mrs', 'gray'],
  ['avi', 'mrs', 'yellow'],
  ['mrs', 'nic', 'green'],
  ['mrs', 'nic', 'red'],
  ['per', 'bcn', 'white'],
  ['pau', 'bcn', 'orange'],
];

export function cityDistance(a: string, b: string): number {
  const ca = CITY_BY_ID[a];
  const cb = CITY_BY_ID[b];
  return Math.hypot(ca.x - cb.x, ca.y - cb.y);
}

export const ROUTES: Route[] = RAW_ROUTES.map(([a, b, color], id) => ({
  id,
  a,
  b,
  color,
  length: Math.min(6, Math.max(1, Math.round(cityDistance(a, b) / PX_PER_WAGON))),
}));

for (const r of ROUTES) {
  const twin = ROUTES.find((o) => o.id !== r.id && ((o.a === r.a && o.b === r.b) || (o.a === r.b && o.b === r.a)));
  if (twin) r.pair = twin.id;
}

export const ROUTE_BY_ID: Record<number, Route> = Object.fromEntries(ROUTES.map((r) => [r.id, r]));

/** Plus court chemin (en nombre de wagons) entre deux villes sur la carte complète. */
export function mapShortestPath(from: string, to: string): number {
  const dist: Record<string, number> = { [from]: 0 };
  const done = new Set<string>();
  while (true) {
    let best: string | null = null;
    for (const c of Object.keys(dist)) if (!done.has(c) && (best === null || dist[c] < dist[best])) best = c;
    if (best === null) return Infinity;
    if (best === to) return dist[best];
    done.add(best);
    for (const r of ROUTES) {
      const other = r.a === best ? r.b : r.b === best ? r.a : null;
      if (!other || done.has(other)) continue;
      const d = dist[best] + r.length;
      if (dist[other] === undefined || d < dist[other]) dist[other] = d;
    }
  }
}

const RAW_TICKETS: [string, string][] = [
  ['bre', 'nic'],
  ['lil', 'mrs'],
  ['cal', 'per'],
  ['che', 'bcn'],
  ['bru', 'tls'],
  ['str', 'bdx'],
  ['lil', 'bia'],
  ['par', 'nic'],
  ['par', 'bdx'],
  ['che', 'gen'],
  ['lha', 'str'],
  ['nts', 'lyo'],
  ['ren', 'mrs'],
  ['bre', 'par'],
  ['lil', 'str'],
  ['cae', 'tls'],
  ['lro', 'dij'],
  ['lyo', 'bcn'],
  ['bia', 'nic'],
  ['met', 'mrs'],
  ['rei', 'gre'],
  ['tou', 'gen'],
  ['orl', 'mtp'],
  ['bdx', 'mtp'],
  ['nts', 'bcn'],
  ['lim', 'str'],
  ['cle', 'nic'],
  ['par', 'tur'],
  ['cal', 'lyo'],
  ['rou', 'tls'],
  ['bes', 'bia'],
  ['poi', 'gre'],
  ['pau', 'avi'],
  ['lma', 'mul'],
  ['ami', 'cle'],
  ['ncy', 'per'],
  ['bru', 'tur'],
  ['mtp', 'gen'],
  ['dij', 'tls'],
  ['brv', 'mrs'],
];

export const TICKETS: Ticket[] = RAW_TICKETS.map(([a, b], id) => ({ id, a, b, points: mapShortestPath(a, b) }));

export const TICKET_BY_ID: Record<number, Ticket> = Object.fromEntries(TICKETS.map((t) => [t.id, t]));

/** Contour simplifié de la France métropolitaine (lon, lat). */
const FRANCE_OUTLINE: [number, number][] = [
  [2.54, 51.09], [2.9, 50.7], [3.27, 50.53], [3.68, 50.32], [4.15, 50.28], [4.23, 49.96], [4.84, 50.15],
  [4.87, 49.8], [5.47, 49.5], [6.36, 49.46], [6.73, 49.16], [7.45, 49.17], [8.22, 48.97], [7.8, 48.5],
  [7.57, 48.03], [7.59, 47.58], [7.0, 47.45], [6.9, 47.33], [6.45, 46.95], [6.1, 46.6], [6.13, 46.26],
  [6.3, 46.4], [6.8, 46.43], [6.97, 45.9], [7.15, 45.25], [6.62, 45.1], [7.05, 44.7], [6.9, 44.36],
  [7.7, 44.1], [7.53, 43.78], [7.2, 43.65], [6.9, 43.42], [6.6, 43.17], [6.1, 43.05], [5.4, 43.2],
  [4.85, 43.35], [4.1, 43.5], [3.4, 43.25], [3.05, 42.9], [3.17, 42.43], [2.6, 42.35], [1.7, 42.5],
  [1.45, 42.6], [0.7, 42.8], [-0.3, 42.82], [-0.75, 42.95], [-1.45, 43.05], [-1.78, 43.37], [-1.52, 43.5],
  [-1.35, 44.0], [-1.25, 44.6], [-1.15, 45.5], [-1.2, 46.0], [-1.6, 46.4], [-2.15, 46.85], [-2.2, 47.15],
  [-2.5, 47.3], [-3.1, 47.5], [-3.5, 47.7], [-4.35, 47.8], [-4.7, 48.05], [-4.78, 48.35], [-4.6, 48.6],
  [-3.9, 48.7], [-3.0, 48.85], [-2.3, 48.65], [-1.6, 48.62], [-1.55, 49.2], [-1.9, 49.7], [-1.3, 49.7],
  [-1.1, 49.4], [-0.2, 49.3], [0.1, 49.48], [0.6, 49.86], [1.4, 50.07], [1.6, 50.4], [1.6, 50.9],
  [1.95, 51.0], [2.54, 51.09],
];

export const FRANCE_PATH =
  FRANCE_OUTLINE.map(([lon, lat], i) => {
    const [x, y] = project(lon, lat);
    return `${i === 0 ? 'M' : 'L'}${x} ${y}`;
  }).join(' ') + ' Z';

export const MAP_LABELS: { text: string; lon: number; lat: number; kind: 'sea' | 'country' }[] = [
  { text: 'La Manche', lon: -2.6, lat: 50.0, kind: 'sea' },
  { text: 'Océan Atlantique', lon: -3.7, lat: 46.4, kind: 'sea' },
  { text: 'Angleterre', lon: -2.4, lat: 51.15, kind: 'country' },
  { text: 'Mer Méditerranée', lon: 4.9, lat: 42.4, kind: 'sea' },
  { text: 'Belgique', lon: 5.4, lat: 50.55, kind: 'country' },
  { text: 'Allemagne', lon: 7.4, lat: 49.75, kind: 'country' },
  { text: 'Suisse', lon: 7.3, lat: 46.75, kind: 'country' },
  { text: 'Italie', lon: 7.6, lat: 44.6, kind: 'country' },
  { text: 'Espagne', lon: 0.4, lat: 41.9, kind: 'country' },
];

function polygon(points: [number, number][]): string {
  return (
    points
      .map(([lon, lat], i) => {
        const [x, y] = project(lon, lat);
        return `${i === 0 ? 'M' : 'L'}${x} ${y}`;
      })
      .join(' ') + ' Z'
  );
}

/** Terres voisines (tracés approximatifs) pour habiller la carte. */
export const NEIGHBOR_PATHS: string[] = [
  polygon([...FRANCE_OUTLINE.slice(0, 30), [8.0, 43.9], [8.7, 44.2], [8.7, 51.7], [3.6, 51.7], [3.3, 51.38]]),
  polygon([
    ...FRANCE_OUTLINE.slice(39, 48),
    [-2.5, 43.35], [-3.8, 43.45], [-5.6, 43.55], [-5.6, 40.8], [0.5, 40.8], [0.9, 41.0], [1.5, 41.15],
    [2.17, 41.35], [2.8, 41.65], [3.2, 41.9], [3.3, 42.3],
  ]),
  polygon([
    [-5.6, 50.05], [-4.2, 50.35], [-3.5, 50.6], [-2.5, 50.6], [-1.3, 50.75], [0.0, 50.78], [1.0, 50.95],
    [1.4, 51.2], [1.45, 51.7], [-5.6, 51.7],
  ]),
];
