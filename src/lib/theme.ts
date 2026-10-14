import type { CardColor, PlayerColor, RouteColor } from '../../shared/types';

export const CARD_FILL: Record<CardColor | 'gray', string> = {
  red: '#d4473f',
  orange: '#ec8b2e',
  yellow: '#f1c534',
  green: '#4c9a4a',
  blue: '#3877c4',
  purple: '#b25599',
  black: '#2a2a30',
  white: '#f6f2e8',
  loco: '#8a6a3a',
  gray: '#b5ae9f',
};

export const CARD_INK: Record<CardColor | 'gray', string> = {
  red: '#fff',
  orange: '#fff',
  yellow: '#3a2c05',
  green: '#fff',
  blue: '#fff',
  purple: '#fff',
  black: '#f6f2e8',
  white: '#2a2a30',
  loco: '#fff',
  gray: '#2a2a30',
};

export const ROUTE_FILL: Record<RouteColor, string> = CARD_FILL;

export const PLAYER_FILL: Record<PlayerColor, string> = {
  crimson: '#a8122a',
  navy: '#1c3f8f',
  forest: '#16704a',
  amber: '#dd8f0b',
  violet: '#6b2f97',
};

export const PLAYER_LIGHT: Record<PlayerColor, string> = {
  crimson: '#ff8a9b',
  navy: '#8fb4ff',
  forest: '#86e0b4',
  amber: '#ffe08a',
  violet: '#d4a8ff',
};

export const PLAYER_COLOR_NAMES: Record<PlayerColor, string> = {
  crimson: 'Cramoisi',
  navy: 'Marine',
  forest: 'Forêt',
  amber: 'Ambre',
  violet: 'Violet',
};

/** Symboles du mode daltonien : chaque couleur se reconnaît aussi par sa forme. */
export const COLOR_SYMBOL: Record<CardColor | 'gray', string> = {
  red: '♥',
  orange: '◆',
  yellow: '★',
  green: '♣',
  blue: '●',
  purple: '▲',
  black: '■',
  white: '○',
  loco: '✦',
  gray: '',
};
