# Omnidle

A daily pop-culture guessing platform across **Video Games, Anime, Cinema and Music** — ten mini-games a day, plus endless free play.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build
```

Stack: Vite · React 18 · TypeScript · Tailwind CSS v4 · Zustand (persisted to `localStorage`) · React Router (hash routing, so it deploys to any static host).

## How it works

- **Daily mode** (`/daily`, `/daily/YYYY-MM-DD`): `buildDaily(date)` in `src/lib/rounds.ts` seeds a PRNG with the date, so every player gets the same 10 rounds. All 10 mechanics appear once per day, and domains rotate so each shows up at least twice. Past days since `EPOCH` (`src/lib/date.ts`) are playable from the archive.
- **Free play** (`/play?domain=anime&type=emoji`): any domain × mini-game combination with data behind it.
- **Progress**: each round is stored as a `RoundRecord` (`status`, `guesses`, `score`). Games are controlled components that rebuild their whole view from `guesses`, so a half-played round resumes exactly where you left it. Streaks count consecutive fully-completed days.

## Mini-games

| # | Game | Component | Scoring |
|---|------|-----------|---------|
| 1 | Classic attributes | `ClassicGame` | 10 tries, −10/try |
| 2 | Quote | `ClueGame` | 6 tries, −15/try |
| 3 | Soundtrack (text description) | `ClueGame` | 6 tries |
| 4 | Emoji synopsis (reveals more per miss) | `ClueGame` | 6 tries |
| 5 | Pixelated cover (canvas, de-pixelates per miss) | `ClueGame` + `PixelCanvas` | 6 tries |
| 6 | Timeline (sort 4 by year) | `TimelineGame` | 3 tries: 100/60/30 |
| 7 | Iconic item | `ClueGame` | 6 tries |
| 8 | Location | `ClueGame` | 6 tries |
| 9 | Credits / creator | `ClueGame` | 6 tries |
| 10 | Connections (4×4 grid) | `ConnectionsGame` | 4 mistakes, −20/mistake |

Single-answer games share `ClueGame`: a type-specific clue, autocomplete restricted to the target's domain, and progressive hints (`src/lib/hints.ts`) after each wrong guess.

## Adding content

- Works live in `src/data/{games,anime,cinema,music}.ts`. Optional fields (`quote`, `audio`, `emoji`, `item`, `location`, `visual`) decide which mini-games a work can appear in — `candidates()` in `src/data/index.ts` filters on them.
- Connections puzzles live in `src/data/connections.ts`.
- New mechanic: add the type to `GameType`, metadata in `src/games/meta.ts`, and map a component in `src/games/GameHost.tsx`.

The "Pixelated" game currently draws a generated cover (gradient + emoji) since the repo ships no artwork; swapping in real cover images only requires changing `PixelCanvas` to draw an `<img>`.
