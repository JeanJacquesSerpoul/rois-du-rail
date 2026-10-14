import type { City, Route, RouteColor, Ticket } from '../types';

/**
 * Construction d'une carte de jeu à partir d'une description géographique :
 * villes en longitude/latitude, routes (couleur seulement : la longueur se déduit
 * de la distance), billets (les points se déduisent du plus court chemin).
 */

export type MapId = 'france' | 'bretagne' | 'europe';
export type Localized = { fr: string; en: string };
type LonLat = [lon: number, lat: number];

/** [id, nom, longitude, latitude, position de l'étiquette, hors région ?, nom anglais] */
export type RawCity = [
  id: string,
  name: string,
  lon: number,
  lat: number,
  label: City['label'],
  foreign?: boolean,
  nameEn?: string,
];

export interface MapSpec {
  id: MapId;
  name: Localized;
  description: Localized;
  /** Projection équirectangulaire corrigée par le cosinus de `refLat`. */
  projection: { lon0: number; lat0: number; scale: number; refLat: number };
  width: number;
  height: number;
  /** Distance (unités SVG) correspondant à un wagon. */
  pxPerWagon: number;
  /** Wagons de chaque joueur en début de partie. */
  wagons: number;
  cities: RawCity[];
  routes: [string, string, RouteColor][];
  tickets: [string, string][];
  /** Terres de la région jouée (fond crème). */
  lands: LonLat[][];
  /** Terres voisines (fond hachuré). */
  neighbors: LonLat[][];
  /** Limites intérieures en pointillés (départements, pays…). */
  borders?: LonLat[][];
  labels: { text: Localized; lon: number; lat: number; kind: 'sea' | 'country' | 'region' }[];
  compass: LonLat;
}

export interface MapLabel {
  text: Localized;
  x: number;
  y: number;
  kind: 'sea' | 'country' | 'region';
}

export interface GameMap {
  id: MapId;
  name: Localized;
  description: Localized;
  width: number;
  height: number;
  wagons: number;
  cities: City[];
  cityById: Record<string, City>;
  routes: Route[];
  routeById: Record<number, Route>;
  tickets: Ticket[];
  ticketById: Record<number, Ticket>;
  landPaths: string[];
  neighborPaths: string[];
  borderPaths: string[];
  labels: MapLabel[];
  compass: [number, number];
  project: (lon: number, lat: number) => [number, number];
}

export function buildMap(spec: MapSpec): GameMap {
  const { lon0, lat0, scale, refLat } = spec.projection;
  const cos = Math.cos((refLat * Math.PI) / 180);
  const project = (lon: number, lat: number): [number, number] => [
    Math.round((lon - lon0) * cos * scale * 10) / 10,
    Math.round((lat0 - lat) * scale * 10) / 10,
  ];
  const path = (points: LonLat[], close = true) =>
    points
      .map(([lon, lat], i) => {
        const [x, y] = project(lon, lat);
        return `${i === 0 ? 'M' : 'L'}${x} ${y}`;
      })
      .join(' ') + (close ? ' Z' : '');

  const cities: City[] = spec.cities.map(([id, name, lon, lat, label, foreign, nameEn]) => {
    const [x, y] = project(lon, lat);
    return { id, name, nameEn, x, y, label, foreign };
  });
  const cityById = Object.fromEntries(cities.map((c) => [c.id, c]));
  for (const [a, b] of [...spec.routes, ...spec.tickets]) {
    if (!cityById[a] || !cityById[b]) throw new Error(`Carte ${spec.id} : ville inconnue dans ${a}-${b}`);
  }

  const distance = (a: string, b: string) => Math.hypot(cityById[a].x - cityById[b].x, cityById[a].y - cityById[b].y);
  const routes: Route[] = spec.routes.map(([a, b, color], id) => ({
    id,
    a,
    b,
    color,
    length: Math.min(6, Math.max(1, Math.round(distance(a, b) / spec.pxPerWagon))),
  }));
  for (const r of routes) {
    const twin = routes.find((o) => o.id !== r.id && ((o.a === r.a && o.b === r.b) || (o.a === r.b && o.b === r.a)));
    if (twin) r.pair = twin.id;
  }

  /** Plus court chemin (en wagons) sur la carte complète : sert à fixer la valeur des billets. */
  const shortest = (from: string, to: string): number => {
    const dist: Record<string, number> = { [from]: 0 };
    const done = new Set<string>();
    while (true) {
      let best: string | null = null;
      for (const c of Object.keys(dist)) if (!done.has(c) && (best === null || dist[c] < dist[best])) best = c;
      if (best === null) return Number.POSITIVE_INFINITY;
      if (best === to) return dist[best];
      done.add(best);
      for (const r of routes) {
        const other = r.a === best ? r.b : r.b === best ? r.a : null;
        if (!other || done.has(other)) continue;
        const d = dist[best] + r.length;
        if (dist[other] === undefined || d < dist[other]) dist[other] = d;
      }
    }
  };
  const tickets: Ticket[] = spec.tickets.map(([a, b], id) => {
    const points = shortest(a, b);
    if (!Number.isFinite(points)) throw new Error(`Carte ${spec.id} : billet ${a}-${b} impossible`);
    return { id, a, b, points };
  });

  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    width: spec.width,
    height: spec.height,
    wagons: spec.wagons,
    cities,
    cityById,
    routes,
    routeById: Object.fromEntries(routes.map((r) => [r.id, r])),
    tickets,
    ticketById: Object.fromEntries(tickets.map((t) => [t.id, t])),
    landPaths: spec.lands.map((p) => path(p)),
    neighborPaths: spec.neighbors.map((p) => path(p)),
    borderPaths: (spec.borders ?? []).map((p) => path(p, false)),
    labels: spec.labels.map((l) => {
      const [x, y] = project(l.lon, l.lat);
      return { text: l.text, x, y, kind: l.kind };
    }),
    compass: project(...spec.compass),
    project,
  };
}
