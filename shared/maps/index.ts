import { bretagneMap } from './bretagne';
import type { GameMap, MapId } from './build';
import { europeMap } from './europe';
import { franceMap } from './france';

export type { GameMap, MapId } from './build';

export const MAPS: Record<MapId, GameMap> = {
  france: franceMap,
  bretagne: bretagneMap,
  europe: europeMap,
};

export const MAP_IDS = Object.keys(MAPS) as MapId[];

/** Carte d'une partie (les parties enregistrées avant les cartes multiples sont en France). */
export function getMap(id?: string | null): GameMap {
  return MAPS[(id ?? 'france') as MapId] ?? franceMap;
}
