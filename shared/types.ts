export type TrainColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'black' | 'white';
export type CardColor = TrainColor | 'loco';
export type RouteColor = TrainColor | 'gray';
export type PlayerColor = 'crimson' | 'navy' | 'forest' | 'amber' | 'violet';

export interface City {
  id: string;
  name: string;
  x: number;
  y: number;
  /** Position de l'étiquette par rapport au point. */
  label: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
  foreign?: boolean;
}

export interface Route {
  id: number;
  a: string;
  b: string;
  length: number;
  color: RouteColor;
  /** Identifiant de la voie parallèle (route double). */
  pair?: number;
}

export interface Ticket {
  id: number;
  a: string;
  b: string;
  points: number;
}

export type Hand = Record<CardColor, number>;

export type BotLevel = 'easy' | 'normal' | 'hard';

export interface PlayerConfig {
  name: string;
  isBot: boolean;
  color: PlayerColor;
  /** Niveau de l'ordinateur (absent dans les anciennes parties : « normal »). */
  level?: BotLevel;
}

export interface Player extends PlayerConfig {
  hand: Hand;
  tickets: number[];
  wagons: number;
  routePoints: number;
}

export type TurnState = null | { kind: 'draw'; drawn: 1 } | { kind: 'tickets'; offered: number[]; min: number };

export type Action =
  | { type: 'drawFaceUp'; index: number }
  | { type: 'drawDeck' }
  | { type: 'claimRoute'; routeId: number; color: CardColor }
  | { type: 'drawTickets' }
  | { type: 'keepTickets'; keep: number[] }
  | { type: 'pass' };

export interface GameEvent {
  seq: number;
  seat: number;
  kind: 'drawFaceUp' | 'drawDeck' | 'claimRoute' | 'drawTickets' | 'keepTickets' | 'pass' | 'lastRound' | 'end';
  card?: CardColor;
  routeId?: number;
  count?: number;
  text: string;
}

export interface TicketResult {
  id: number;
  done: boolean;
  points: number;
}

export interface PlayerResult {
  seat: number;
  routePoints: number;
  tickets: TicketResult[];
  ticketPoints: number;
  longest: number;
  longestBonus: number;
  total: number;
  rank: number;
}

export interface GameState {
  version: 1;
  rng: number;
  phase: 'setup' | 'playing' | 'finished';
  players: Player[];
  current: number;
  turn: TurnState;
  deck: CardColor[];
  discard: CardColor[];
  market: (CardColor | null)[];
  ticketDeck: number[];
  owners: Record<number, number>;
  lastRound: { trigger: number; turnsLeft: number } | null;
  consecutivePasses: number;
  turnNumber: number;
  events: GameEvent[];
  eventSeq: number;
  results: PlayerResult[] | null;
}
