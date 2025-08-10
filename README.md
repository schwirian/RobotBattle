# Robot Battle

A streetfighter-inspired 2D robot fighting game built with React, TypeScript, Vite, Tailwind, and a tiny Socket.IO server for online play.

## Requirements & Decisions

- Node 18+ and npm
- React + Vite + TypeScript
- TailwindCSS for UI/HUD styling
- Socket.IO for basic online rooms (2 players)
- Canvas rendering for robots/arena (performant and flexible)

## Features (MVP)

- Local 2P keyboard controls (WASD/F/G/H vs Arrows/1/2/3)
- Online play via room code (Socket.IO)
- Humanoid robots with distinct fighting styles and power meters
- Light/Heavy/Special attacks, power builds on hit, special consumes power
- Fun effects: sparks and knockback; parts can be added as particles later
- HUD with HP and Power bars

## Controls

- Player 1: Move WASD, Light F, Heavy G, Special H, Block V
- Player 2: Move Arrows, Light 1, Heavy 2, Special 3, Block 0

## Scripts

- `npm run dev`: start Vite dev server at http://localhost:5173
- `npm run server`: start Socket.IO server at http://localhost:3001
- `npm run dev:all`: run both client and server concurrently
- `npm run build`: typecheck and build for production
- `npm run preview`: preview production build

## Getting Started

1. Install dependencies
2. Run the server and client

### Install

Use Node 18+.

```
npm install
```

### Develop

Run client and server together:

```
npm run dev:all
```

Or separately:

```
npm run server
npm run dev
```

Open http://localhost:5173.

## Online Rooms

- Click Online in the main menu.
- Create a room to get a 5-char room ID; share it with your opponent.
- Alternatively, enter an existing ID and Join.

## Architecture

- Client: React + Vite + TS, stateful `GameState` tick loop, canvas rendering.
- Server: Socket.IO relays inputs and game-state snapshots between peers.
- Styling: Tailwind for UI/HUD, canvas for arena/robots.

## Next Steps / Ideas

- Robot roster: unique specials (dash punch, rocket uppercut, EMP burst).
- Animations: windups, hitstun, screenshake, limb particles.
- Combo system and block mechanics.
- Gamepad support.
- Mobile-friendly spectate mode.
- Netcode: explore rollback or deterministic lockstep.

## Notes

- This MVP favors simplicity over perfect fighting-game feel and netcode. Physics and balance are intentionally light to get a playable build quickly.
- Tailwind is used for UI and HUD; the fight scene is drawn on a canvas for performance and control.
