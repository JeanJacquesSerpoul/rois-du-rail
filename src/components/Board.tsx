import { motion } from 'motion/react';
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TransformComponent, TransformWrapper, useControls } from 'react-zoom-pan-pinch';
import {
  CITIES,
  CITY_BY_ID,
  FRANCE_PATH,
  MAP_HEIGHT,
  MAP_LABELS,
  MAP_WIDTH,
  NEIGHBOR_PATHS,
  ROUTES,
  project,
} from '../../shared/map';
import { COLOR_NAMES, ROUTE_POINTS, routeName } from '../../shared/engine';
import type { GameState, PlayerColor, Route } from '../../shared/types';
import { usePref } from '../lib/prefs';
import { CARD_INK, COLOR_SYMBOL, PLAYER_FILL, PLAYER_LIGHT, ROUTE_FILL } from '../lib/theme';

const CITY_R = 8;
const WAGON_H = 9;
const DOUBLE_OFFSET = 6.6;

/** Trajet d'une destination à afficher sur la carte (calque « Mes trajets »). */
export interface PlanOverlay {
  id: number;
  a: string;
  b: string;
  state: 'done' | 'open' | 'blocked';
  routeIds: number[];
}

interface Wagon {
  x: number;
  y: number;
  w: number;
  angle: number;
}

interface RouteGeom {
  route: Route;
  wagons: Wagon[];
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const GEOMS: RouteGeom[] = ROUTES.map((route) => {
  const a = CITY_BY_ID[route.a];
  const b = CITY_BY_ID[route.b];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  // décalage perpendiculaire pour les voies doubles
  const off = route.pair === undefined ? 0 : route.id < route.pair ? -DOUBLE_OFFSET : DOUBLE_OFFSET;
  const ox = -uy * off;
  const oy = ux * off;
  const margin = CITY_R + 2;
  const usable = len - margin * 2;
  const seg = usable / route.length;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const wagons = Array.from({ length: route.length }, (_, i) => {
    const t = margin + seg * (i + 0.5);
    return { x: a.x + ux * t + ox, y: a.y + uy * t + oy, w: Math.max(8, seg - 3.5), angle };
  });
  return {
    route,
    wagons,
    x1: a.x + ux * margin + ox,
    y1: a.y + uy * margin + oy,
    x2: b.x - ux * margin + ox,
    y2: b.y - uy * margin + oy,
  };
});

/** Distance d'un point au segment d'une route (unités SVG). */
function distToRoute(px: number, py: number, g: RouteGeom): number {
  const dx = g.x2 - g.x1;
  const dy = g.y2 - g.y1;
  const t = Math.max(0, Math.min(1, ((px - g.x1) * dx + (py - g.y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(g.x1 + t * dx - px, g.y1 + t * dy - py);
}

/** Tolérance de toucher, en pixels écran, autour d'une route. */
const TAP_TOLERANCE_PX = 18;
/** En dessous de cet écart (px écran) entre deux routes, on laisse le joueur choisir. */
const AMBIGUOUS_PX = 7;

/** Recentre et zoome sur une route si elle paraît trop petite à l'écran. */
function FocusRoute({ routeId }: { routeId: number | null }) {
  const { zoomToElement, state } = useControls();
  // biome-ignore lint/correctness/useExhaustiveDependencies: on ne recentre que lorsque la route change, pas à chaque zoom
  useEffect(() => {
    if (routeId === null) return;
    const el = document.getElementById(`route-${routeId}`);
    if (!el) return;
    const box = el.getBoundingClientRect();
    const size = Math.max(box.width, box.height);
    if (size >= 140) return; // déjà bien visible
    const target = Math.min(5, Math.max(state.scale, (state.scale * 160) / Math.max(size, 1)));
    void zoomToElement(el, target, 450);
  }, [routeId]);
  return null;
}

/** Durée (s) du trajet de la locomotive qui pose les wagons d'une route. */
export const travelTime = (length: number) => 0.35 + 0.28 * length;

/**
 * Animation de pose d'une route : une locomotive parcourt le tronçon en laissant
 * ses wagons derrière elle, de la vapeur, des ondes aux deux villes et les points gagnés.
 */
function ClaimFx({ g, color }: { g: RouteGeom; color: PlayerColor }) {
  const len = g.route.length;
  const T = travelTime(len);
  const angle = g.wagons[0].angle;
  const mx = (g.x1 + g.x2) / 2;
  const my = (g.y1 + g.y2) / 2;
  const a = CITY_BY_ID[g.route.a];
  const b = CITY_BY_ID[g.route.b];
  const ring = { transformBox: 'fill-box', transformOrigin: 'center' } as const;
  return (
    <g className="claim-fx" pointerEvents="none">
      <motion.line
        x1={g.x1}
        y1={g.y1}
        x2={g.x2}
        y2={g.y2}
        stroke={PLAYER_LIGHT[color]}
        strokeWidth="16"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0.75 }}
        animate={{ pathLength: 1, opacity: [0.75, 0.75, 0] }}
        transition={{ pathLength: { duration: T, ease: 'linear' }, opacity: { duration: T + 0.7, times: [0, 0.7, 1] } }}
      />
      {g.wagons.map((w, i) => (
        <motion.circle
          key={i}
          cx={w.x}
          cy={w.y}
          r="4"
          fill="#fff"
          style={ring}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: [0, 0.85, 0], scale: [0.4, 1.8, 2.8], y: [0, -10, -20] }}
          transition={{ delay: (T * (i + 0.5)) / len, duration: 1.1 }}
        />
      ))}
      {[a, b].map((c, i) => (
        <motion.circle
          key={c.id}
          cx={c.x}
          cy={c.y}
          r="10"
          fill="none"
          stroke={PLAYER_FILL[color]}
          strokeWidth="4"
          style={ring}
          initial={{ opacity: 0, scale: 1 }}
          animate={{ opacity: [0, 0.9, 0], scale: [1, 2.2, 3.2] }}
          transition={{ delay: i === 0 ? 0 : T, duration: 0.9 }}
        />
      ))}
      <motion.g
        initial={{ x: g.x1, y: g.y1, opacity: 0 }}
        animate={{ x: g.x2, y: g.y2, opacity: [0, 1, 1, 0] }}
        transition={{
          x: { duration: T, ease: 'linear' },
          y: { duration: T, ease: 'linear' },
          opacity: { duration: T + 0.3, times: [0, 0.1, 0.85, 1] },
        }}
      >
        <g transform={`rotate(${angle})`}>
          <ellipse cx="0" cy="3" rx="15" ry="6" fill="#000" opacity=".25" />
          <rect x="-14" y="-8" width="10" height="15" rx="1.8" fill={PLAYER_FILL[color]} stroke="#1b1206" strokeWidth="1.2" />
          <rect x="-12" y="-6" width="6" height="5" rx="1" fill={PLAYER_LIGHT[color]} />
          <rect x="-5" y="-5.5" width="16" height="11" rx="5.5" fill={PLAYER_FILL[color]} stroke="#1b1206" strokeWidth="1.2" />
          <path d="M11 -5 L16 0 L11 5 Z" fill="#1b1206" />
          <circle cx="6" cy="0" r="2.8" fill="#1b1206" />
          <circle cx="-1" cy="0" r="1.6" fill={PLAYER_LIGHT[color]} />
        </g>
      </motion.g>
      <g transform={`translate(${mx} ${my})`}>
        <motion.g
          initial={{ opacity: 0, y: 0, scale: 0.4 }}
          animate={{ opacity: [0, 1, 1, 0], y: [0, -12, -30, -42], scale: [0.4, 1.25, 1, 1] }}
          transition={{ delay: T, duration: 1.5, times: [0, 0.2, 0.75, 1] }}
        >
          <text className="claim-fx__pts" textAnchor="middle" dy="-14">
            +{ROUTE_POINTS[len]}
          </text>
        </motion.g>
      </g>
    </g>
  );
}

const LABEL_OFFSET: Record<string, [number, number, 'start' | 'middle' | 'end']> = {
  n: [0, -13, 'middle'],
  s: [0, 21, 'middle'],
  e: [12, 4, 'start'],
  w: [-12, 4, 'end'],
  ne: [9, -9, 'start'],
  nw: [-9, -9, 'end'],
  se: [9, 16, 'start'],
  sw: [-9, 16, 'end'],
};

/** Grain de papier : bruit généré une fois (SVG en data URI), répété en motif sur toute la carte. */
const PAPER_NOISE = `data:image/svg+xml;utf8,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.32  0 0 0 0 0.22  0 0 0 0 0.08  0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>",
)}`;

/** Fond de la carte. Les couleurs viennent de variables CSS (--map-*) : thème jour ou crépuscule. */
const Background = memo(function Background() {
  const [cx, cy] = project(-3.9, 44.4);
  return (
    <g>
      <defs>
        <pattern id="waves" width="34" height="16" patternUnits="userSpaceOnUse">
          <path
            d="M0 8 q8.5 -6 17 0 t17 0"
            fill="none"
            style={{ stroke: 'var(--map-wave)' }}
            strokeOpacity=".28"
            strokeWidth="1.2"
          />
        </pattern>
        <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="7" style={{ stroke: 'var(--map-hatch)' }} strokeOpacity=".22" strokeWidth="1.4" />
        </pattern>
        <pattern id="paper" width="160" height="160" patternUnits="userSpaceOnUse">
          <image href={PAPER_NOISE} width="160" height="160" />
        </pattern>
        <radialGradient id="land" cx="50%" cy="45%" r="65%">
          <stop offset="0%" style={{ stopColor: 'var(--map-land-1)' }} />
          <stop offset="100%" style={{ stopColor: 'var(--map-land-2)' }} />
        </radialGradient>
        <radialGradient id="vignette" cx="50%" cy="50%" r="75%">
          <stop offset="60%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" style={{ stopColor: 'var(--map-vignette)', stopOpacity: 'var(--map-vignette-opacity)' }} />
        </radialGradient>
        <linearGradient id="fold" x1="0" x2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0" />
          <stop offset="48%" stopColor="#000" stopOpacity=".06" />
          <stop offset="50%" stopColor="#fff" stopOpacity=".18" />
          <stop offset="52%" stopColor="#000" stopOpacity=".06" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </linearGradient>
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#3b2b12" floodOpacity=".35" />
        </filter>
      </defs>
      <rect width={MAP_WIDTH} height={MAP_HEIGHT} className="map-sea" />
      <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#waves)" />
      {NEIGHBOR_PATHS.map((d, i) => (
        <g key={i}>
          <path d={d} className="map-neighbor" strokeWidth="1.2" />
          <path d={d} fill="url(#hatch)" />
        </g>
      ))}
      <path
        d={FRANCE_PATH}
        fill="url(#land)"
        className="map-coast"
        strokeWidth="2.2"
        strokeLinejoin="round"
        filter="url(#shadow)"
      />
      <path d={FRANCE_PATH} fill="none" className="map-coast" strokeOpacity=".25" strokeWidth="7" strokeLinejoin="round" />
      {MAP_LABELS.map((l) => {
        const [x, y] = project(l.lon, l.lat);
        return (
          <text key={l.text} x={x} y={y} className={`map-label map-label--${l.kind}`} textAnchor="middle">
            {l.text}
          </text>
        );
      })}
      {/* rose des vents */}
      <g transform={`translate(${cx} ${cy})`} className="compass">
        <circle r="34" fill="none" stroke="#6b5430" strokeOpacity=".5" strokeWidth="1.2" />
        <circle r="27" fill="none" stroke="#6b5430" strokeOpacity=".35" strokeDasharray="2 3" />
        <path d="M0 -42 L7 0 L0 42 L-7 0Z" fill="#6b5430" fillOpacity=".75" />
        <path d="M-42 0 L0 7 L42 0 L0 -7Z" fill="#6b5430" fillOpacity=".45" />
        <path d="M0 -42 L7 0 L0 0Z" fill="#a8122a" />
        <text y="-47" textAnchor="middle" className="compass__n">
          N
        </text>
      </g>
      {/* papier : grain et plis d'une vieille carte dépliée */}
      <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#paper)" className="map-paper" pointerEvents="none" />
      <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#fold)" pointerEvents="none" />
      <rect
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        fill="url(#fold)"
        transform={`rotate(90 ${MAP_WIDTH / 2} ${MAP_HEIGHT / 2})`}
        opacity=".7"
        pointerEvents="none"
      />
      <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#vignette)" pointerEvents="none" />
    </g>
  );
});

/** Thème de carte effectif : en automatique, crépuscule de 19 h à 7 h. */
function useMapTheme(): 'day' | 'dusk' {
  const pref = usePref('mapTheme');
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const t = setInterval(() => setHour(new Date().getHours()), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);
  if (pref !== 'auto') return pref;
  return hour >= 19 || hour < 7 ? 'dusk' : 'day';
}

interface RouteViewProps {
  g: RouteGeom;
  ownerColor: PlayerColor | null;
  selected: boolean;
  canClaim: boolean;
  flash: boolean;
  hint: boolean;
  claimAnim: boolean;
  colorBlind: boolean;
  onActivate: (id: number) => void;
}

/**
 * Une route de la carte. Mémoïsée : seules les routes dont l'état change sont
 * redessinées à chaque coup (99 routes, près de 280 wagons).
 */
const RouteView = memo(function RouteView({
  g,
  ownerColor,
  selected,
  canClaim,
  flash,
  hint,
  claimAnim,
  colorBlind,
  onActivate,
}: RouteViewProps) {
  const { route } = g;
  const owned = ownerColor !== null;
  const focusable = canClaim || hint;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: le rôle « button » est posé quand la route est jouable au clavier
    <g
      id={`route-${route.id}`}
      // routes jouables (et route conseillée) atteignables au clavier
      tabIndex={focusable ? 0 : undefined}
      role={focusable ? 'button' : undefined}
      aria-label={
        focusable
          ? `${routeName(route)}, ${route.length} wagon${route.length > 1 ? 's' : ''}, ${COLOR_NAMES[route.color]}`
          : undefined
      }
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate(route.id);
        }
      }}
      className={`route ${owned ? 'route--owned' : ''} ${selected ? 'route--selected' : ''} ${canClaim ? 'route--claimable' : ''} ${flash ? 'route--flash' : ''} ${hint ? 'route--hint' : ''}`}
    >
      <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} className="route__hit" />
      {hint && <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} className="route__hint" />}
      {(selected || canClaim) && <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} className="route__glow" />}
      {g.wagons.map((w, i) => (
        <g key={i} transform={`translate(${w.x} ${w.y}) rotate(${w.angle})`}>
          {ownerColor ? (
            <motion.g
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                // avec l'animation de pose, chaque wagon apparaît au passage de la locomotive
                delay: claimAnim && flash ? (travelTime(route.length) * (i + 0.5)) / route.length : i * 0.08,
                type: 'spring',
                stiffness: 320,
                damping: 18,
              }}
            >
              <rect
                x={-w.w / 2 - 1}
                y={-WAGON_H / 2 - 1.5}
                width={w.w + 2}
                height={WAGON_H + 3}
                rx="2.6"
                fill={PLAYER_FILL[ownerColor]}
                stroke="#1b1206"
                strokeWidth="1"
              />
              <rect
                x={-w.w / 2 + 2}
                y={-WAGON_H / 2 + 0.8}
                width={w.w - 4}
                height={2.4}
                rx="1"
                fill={PLAYER_LIGHT[ownerColor]}
                opacity=".8"
              />
              <circle cx={-w.w / 2 + 3.5} cy={WAGON_H / 2 + 1.5} r="1.7" fill="#1b1206" />
              <circle cx={w.w / 2 - 3.5} cy={WAGON_H / 2 + 1.5} r="1.7" fill="#1b1206" />
            </motion.g>
          ) : (
            <rect
              x={-w.w / 2}
              y={-WAGON_H / 2}
              width={w.w}
              height={WAGON_H}
              rx="2"
              fill={ROUTE_FILL[route.color]}
              stroke="rgba(40,25,5,.75)"
              strokeWidth="1"
              className="route__slot"
            />
          )}
          {!owned && colorBlind && route.color !== 'gray' && (
            // le symbole reste droit quel que soit le sens de la route
            <text
              className="route__symbol"
              transform={`rotate(${-w.angle})`}
              fill={CARD_INK[route.color]}
              textAnchor="middle"
              dy="2.6"
            >
              {COLOR_SYMBOL[route.color]}
            </text>
          )}
        </g>
      ))}
    </g>
  );
});

function ZoomControls() {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div className="zoom-controls">
      <button type="button" onClick={() => zoomIn()} aria-label="Zoomer">
        +
      </button>
      <button type="button" onClick={() => zoomOut()} aria-label="Dézoomer">
        −
      </button>
      <button type="button" onClick={() => resetTransform()} aria-label="Recentrer">
        ⤢
      </button>
    </div>
  );
}

interface BoardProps {
  state: GameState;
  selectedRoute: number | null;
  highlightCities: string[];
  claimable: Set<number>;
  flashRoute: number | null;
  /** Route conseillée par le chef de gare. */
  hintRoute?: number | null;
  /** Animation de pose des wagons (facultative). */
  claimAnim?: boolean;
  /** Route sur laquelle recentrer la carte si elle est trop petite à l'écran. */
  focusRoute?: number | null;
  /** Calque des trajets de destinations. */
  plans?: PlanOverlay[];
  /** Villes d'un billet tout juste réalisé (ondes de célébration). */
  burstCities?: string[];
  onRouteClick: (id: number) => void;
}

export function Board({
  state,
  selectedRoute,
  highlightCities,
  claimable,
  flashRoute,
  hintRoute = null,
  claimAnim = false,
  focusRoute = null,
  plans = [],
  burstCities = [],
  onRouteClick,
}: BoardProps) {
  const down = useRef<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const colorBlind = usePref('colorBlind');
  const theme = useMapTheme();
  // routes candidates quand un toucher tombe entre deux voies (routes doubles, tronçons serrés)
  const [chooser, setChooser] = useState<{ x: number; y: number; ids: number[] } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  // Zoom initial : en portrait (mobile), la carte remplit la hauteur disponible.
  const [fillScale, setFillScale] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const fitHeight = (width * MAP_HEIGHT) / MAP_WIDTH;
    setFillScale(Math.min(2.2, Math.max(1, height / fitHeight)));
  }, []);
  // rappel stable : les routes mémoïsées ne se redessinent pas quand le parent change de fonction
  const routeClick = useRef(onRouteClick);
  routeClick.current = onRouteClick;
  const activate = useCallback((id: number) => routeClick.current(id), []);

  const isTap = (e: React.MouseEvent) => {
    const d = down.current;
    return !d || Math.hypot(e.clientX - d.x, e.clientY - d.y) < 10;
  };

  /** Toucher généreux : on prend la route la plus proche dans un rayon de quelques pixels. */
  const handleTap = (e: React.MouseEvent) => {
    if (!isTap(e)) return;
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const unit = 1 / ctm.a; // unités SVG par pixel écran
    const hits = GEOMS.map((g) => ({ id: g.route.id, d: distToRoute(pt.x, pt.y, g) }))
      .filter((h) => h.d <= TAP_TOLERANCE_PX * unit)
      .sort((a, b) => a.d - b.d);
    if (hits.length === 0) {
      setChooser(null);
      return;
    }
    const close = hits.filter((h) => h.d - hits[0].d <= AMBIGUOUS_PX * unit).map((h) => h.id);
    if (close.length > 1) {
      const box = e.currentTarget.closest('.board')!.getBoundingClientRect();
      setChooser({ x: e.clientX - box.left, y: e.clientY - box.top, ids: close.slice(0, 3) });
    } else {
      setChooser(null);
      onRouteClick(hits[0].id);
    }
  };

  return (
    <div
      ref={box}
      className="board"
      data-theme={theme}
      onPointerDownCapture={(e) => {
        down.current = { x: e.clientX, y: e.clientY };
      }}
    >
      {fillScale !== null && (
        <TransformWrapper
          initialScale={fillScale}
          minScale={1}
          maxScale={6}
          centerOnInit
          doubleClick={{ mode: 'zoomIn', step: 0.7 }}
          wheel={{ step: 0.15 }}
        >
          <ZoomControls />
          <FocusRoute routeId={focusRoute} />
          <TransformComponent wrapperClass="board__wrapper" contentClass="board__content">
            {/* biome-ignore lint/a11y/noSvgWithoutTitle lint/a11y/useKeyWithClickEvents: la carte se pilote aussi au clavier via les routes focalisables */}
            <svg
              ref={svgRef}
              viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
              className="board__svg"
              preserveAspectRatio="xMidYMid meet"
              onClick={handleTap}
            >
              <Background />

              {/* routes */}
              {GEOMS.map((g) => {
                const owner = state.owners[g.route.id];
                return (
                  <RouteView
                    key={g.route.id}
                    g={g}
                    ownerColor={owner !== undefined ? state.players[owner].color : null}
                    selected={selectedRoute === g.route.id}
                    canClaim={claimable.has(g.route.id)}
                    flash={flashRoute === g.route.id}
                    hint={hintRoute === g.route.id}
                    claimAnim={claimAnim}
                    colorBlind={colorBlind}
                    onActivate={activate}
                  />
                );
              })}

              {/* calque des trajets de destinations */}
              {plans.length > 0 && (
                <g className="plans" pointerEvents="none">
                  {plans.map((p) => {
                    const a = CITY_BY_ID[p.a];
                    const b = CITY_BY_ID[p.b];
                    return (
                      <g key={p.id} className={`plan plan--${p.state}`}>
                        {p.state === 'blocked' && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="plan__direct" />}
                        {p.routeIds.map((rid) => {
                          const g = GEOMS[rid];
                          return <line key={rid} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} className="plan__route" />;
                        })}
                        <circle cx={a.x} cy={a.y} r={CITY_R + 6} className="plan__city" />
                        <circle cx={b.x} cy={b.y} r={CITY_R + 6} className="plan__city" />
                      </g>
                    );
                  })}
                </g>
              )}

              {/* villes */}
              {CITIES.map((c) => {
                const [dx, dy, anchor] = LABEL_OFFSET[c.label];
                const hl = highlightCities.includes(c.id);
                return (
                  <g key={c.id} className={`city ${hl ? 'city--hl' : ''} ${c.foreign ? 'city--foreign' : ''}`}>
                    {hl && <circle cx={c.x} cy={c.y} r={CITY_R + 7} className="city__pulse" />}
                    <circle cx={c.x} cy={c.y} r={CITY_R} className="city__dot" />
                    <circle cx={c.x} cy={c.y} r={CITY_R - 3.5} className="city__core" />
                    <text x={c.x + dx} y={c.y + dy} textAnchor={anchor} className="city__label">
                      {c.name}
                    </text>
                  </g>
                );
              })}

              {/* célébration d'un billet réalisé : ondes vertes sur ses deux villes */}
              {burstCities.map((id) => {
                const c = CITY_BY_ID[id];
                return (
                  <g key={`burst-${id}`} pointerEvents="none">
                    {[0, 0.35, 0.7].map((d) => (
                      <motion.circle
                        key={d}
                        cx={c.x}
                        cy={c.y}
                        r={CITY_R + 4}
                        className="city-burst"
                        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                        initial={{ scale: 0.6, opacity: 0.9 }}
                        animate={{ scale: 4, opacity: 0 }}
                        transition={{ delay: d, duration: 1.4, ease: 'easeOut', repeat: 1 }}
                      />
                    ))}
                  </g>
                );
              })}
              {claimAnim && flashRoute !== null && state.owners[flashRoute] !== undefined && (
                <ClaimFx key={flashRoute} g={GEOMS[flashRoute]} color={state.players[state.owners[flashRoute]].color} />
              )}
            </svg>
          </TransformComponent>
        </TransformWrapper>
      )}
      {chooser && (
        <div className="route-chooser" style={{ left: chooser.x, top: chooser.y }} role="menu" aria-label="Choisir une route">
          <span className="route-chooser__title">Quelle route ?</span>
          {chooser.ids.map((id) => {
            const r = ROUTES[id];
            const owner = state.owners[id];
            return (
              <button
                key={id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setChooser(null);
                  onRouteClick(id);
                }}
              >
                <span
                  className="route-chooser__swatch"
                  style={{ background: owner !== undefined ? PLAYER_FILL[state.players[owner].color] : ROUTE_FILL[r.color] }}
                />
                {routeName(r)} · {owner !== undefined ? state.players[owner].name : COLOR_NAMES[r.color]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
