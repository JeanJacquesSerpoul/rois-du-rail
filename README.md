# 🚂 Rois du Rail

[![CI](https://github.com/JeanJacquesSerpoul/rois-du-rail/actions/workflows/ci.yml/badge.svg)](https://github.com/JeanJacquesSerpoul/rois-du-rail/actions/workflows/ci.yml)
[![GitHub Pages](https://github.com/JeanJacquesSerpoul/rois-du-rail/actions/workflows/pages.yml/badge.svg)](https://jeanjacquesserpoul.github.io/rois-du-rail/)

**▶ Jouer en ligne : https://jeanjacquesserpoul.github.io/rois-du-rail/**

Jeu de conquête ferroviaire inspiré des *Aventuriers du Rail*, sur une carte originale de la France
(44 villes, 99 routes, 40 billets de destination).

- **React 19 + TypeScript + Vite**, animations avec **Motion**, zoom/pan tactile avec **react-zoom-pan-pinch**
- **Serveur Express** qui fait autorité sur les règles (moteur partagé dans `shared/`)
- **SQLite** (module natif `node:sqlite`, aucune compilation) : parties, coups joués, classement
- Pensé **mobile d'abord** (installable en PWA), jeu à plusieurs sur un même appareil et adversaires IA

## Démarrer

```bash
npm install
npm run dev
```

Ouvrir http://localhost:5173. Sur téléphone (même réseau Wi‑Fi), utiliser l'adresse « Network » affichée par Vite.

Production : `npm run build` puis `npm start` (sert l'appli et l'API sur le port `PORT`, 3001 par défaut).

## Démo GitHub Pages

GitHub Pages n'héberge que des fichiers statiques : la démo en ligne est construite avec `VITE_OFFLINE=1`
(`npm run build:pages`). Le moteur de jeu et l'IA tournent alors dans le navigateur et les parties sont
gardées dans le `localStorage`. La version complète (`npm run dev` / `npm start`) utilise le serveur et SQLite.

## Scripts

| Commande | Rôle |
| --- | --- |
| `npm run dev` | API (port 3001, `API_PORT`) + Vite (port 5173) |
| `npm test` | tests du moteur (dont des parties complètes simulées entre IA) |
| `npm run typecheck` | vérification TypeScript |
| `npm run build:pages` | build statique hors ligne pour GitHub Pages |

## Structure

```
shared/   moteur de jeu pur (règles, carte, IA) – utilisé par le serveur et le client
server/   API Express + base SQLite (data/rois-du-rail.db, chemin modifiable via DB_PATH)
src/      interface React
```

## Règles implémentées

110 cartes (12 × 8 couleurs + 14 locomotives), 5 cartes visibles (remplacées si 3 locomotives),
45 wagons par joueur, routes grises et doubles (une seule voie à moins de 4 joueurs), destinations
(3 tirées, au moins 2 gardées au départ, 1 ensuite), dernier tour à 2 wagons ou moins, bonus de
10 points pour le plus long trajet continu.
