# Omnidle

A daily pop-culture guessing platform across **Video Games, Anime, Cinema and Music**: four independent daily challenges of ten mini-games each, plus endless free play.

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # typecheck + production build
npm run data:validate  # schema + coverage check for the dataset
```

Stack: Vite · React 18 · TypeScript · Tailwind CSS v4 · Zustand (persisted to `localStorage`) · React Router (hash routing) · canvas-confetti. Deployed to GitHub Pages by `.github/workflows/deploy.yml`.

## Daily mode

Each category has its own challenge at `/daily/<games|anime|cinema|music>[/YYYY-MM-DD]`. `buildDaily(date, domain)` in `src/lib/rounds.ts` seeds a PRNG with a hash of `omnidle:<date>:<domain>`, so every player gets the same ten rounds — all ten mechanics, one each, with no repeated target. Works that have real media (cover, item/location image, YouTube clip) are drawn four times as often for the rounds that use them.

Progress is stored per `domain:date` (`src/store/progress.ts`). Each round is a `RoundRecord` (`status`, `guesses`, `score`) and games rebuild their whole view from `guesses`, so half-played rounds resume exactly. Streaks are tracked per category, plus an overall streak (any category completed that day). The archive lists every past day per category since `EPOCH`.

## Mini-games

| Game | Component | Media |
|------|-----------|-------|
| Classic attributes | `ClassicGame` | Green / yellow (partial) / red, ▲▼ for year |
| Quote | `ClueGame` | Quote with progressive hints; albums reveal their **tracklist** instead |
| Soundtrack | `ClueGame` + `AudioClip` | Hidden YouTube player, Heardle-style 1→16 s snippets starting ~40% into the clip (or `audio.start`); video revealed at the end. If a clip is missing or won't play, the round becomes a **zoomed-in cover detail** (`ZoomImage`), then text |
| Emoji | `ClueGame` | One more emoji per miss |
| Pixelated | `ClueGame` + `PixelCanvas` | Real cover art (or a generated glyph cover), de-pixelates per miss |
| Timeline | `TimelineGame` | Drag or arrows, 3 attempts |
| Iconic item | `ClueGame` + `BlurImage` | Picture of the item, blurred and desaturated, clearing per miss; the description becomes the first hint |
| Location | `ClueGame` + `ZoomImage` | In-world screenshot or real filming/recording location, starting at ×3.2 on a focal point (`location.focus`) and zooming out per miss |
| Cover Puzzle | `ClueGame` + `TilePuzzle` | The cover cut into a 3×3 grid, shuffled and rotated: tap two tiles to swap, tap one twice to rotate. Each miss snaps a tile home |
| Connections | `ConnectionsGame` | 4×4 picture tiles, Yellow→Purple difficulty, 4 mistakes, "One away…", per-category and single-universe grids |

`GameHost` adds the shared juice: synthesized WebAudio SFX (`src/lib/sfx.ts`, toggle 🔊 in the header), confetti (`src/lib/fx.ts`), a glow on wins and slide-in round transitions. Finishing a daily plays a fanfare and produces a Wordle-style share text:

```
Omnidle Video Games 2026-10-18 — 820/1000 🔥3
🟩🟩🟨🟥🟩
🟩🟨🟩🟩🟥
```

## Data

- **Works**: `src/data/works/{games,anime,cinema,music}.json`, 100+ per category. Shape: [`schema/work.schema.json`](schema/work.schema.json). Optional fields (`quote`/`tracks`, `audio`, `emoji`, `item`, `location`, `cover`, `visual`) decide which mini-games a work can appear in.
- **Connections**: `src/data/connections.json` (10 per category + 7 mixed) — `domain` decides which daily uses a puzzle (`mixed` = free play), `theme` marks single-universe grids, each group has a `level` 0–3. A tile is a label or `{ "label", "src" }`; `images` sets the puzzle's default picture source (`wp`, `fandom:<wiki>`, `ddragon`). `node scripts/enrich-connections.mjs` resolves them and reports misses — a grid only shows pictures when all 16 tiles have one, since a lone text tile would give its group away.

### Scaling the dataset

`npm run data:seed` runs the whole pipeline (optional imports → wiki check → images → clips → Connections pictures → validation); see the header of `scripts/seed-database.mjs`. Step by step:

```bash
# 1. Import factual metadata (year, genres, studio, creator, characters, tracklist...)
node scripts/import.mjs anilist "Mob Psycho 100" "Vinland Saga"          # no key
node scripts/import.mjs musicbrainz "Random Access Memories"              # no key
TMDB_API_KEY=... node scripts/import.mjs tmdb --list=films.txt            # one title per line
IGDB_CLIENT_ID=... IGDB_TOKEN=... node scripts/import.mjs igdb "Hades"
node scripts/import.mjs file my-entries.json                              # hand-written batch, any domain

# 2. Write the creative clue fields by hand (emoji, quote, item, location, audio.clue + audio.query, visual)

# 3. Resolve media
node scripts/enrich-media.mjs                    # images from Wikipedia (batched, no key)
YOUTUBE_API_KEY=... node scripts/enrich-media.mjs --no-images   # clip ids from audio.query

# 4. Connections pictures (Wikipedia, Fandom wikis, League Data Dragon)
node scripts/enrich-connections.mjs

# 5. Check
npm run data:validate
```

`enrich-media` looks up `cover.wiki` / `item.wiki` / `location.wiki` with the MediaWiki API (50 titles per request). Item and location clues can instead carry `src` (`fandom:<wiki>:<Title>`, `wp:<Title>` or a URL), or inherit the work's `fandom` wiki, which is then searched by the clue's `name`. Images whose file name looks like a logo, box art, cover or poster — or equal to the work's cover — are rejected so a clue never shows the title. It also and rejects images when a title redirects to a different subject (e.g. "Hyrule" → the franchise page, whose image would give the answer away). Works without `cover.wiki` get one by search — check those. `--force` re-resolves everything; `--dry` writes nothing.

### Media notice

Cover art and many item images are hot-linked from Wikipedia/Wikimedia and are often non-free (used there under fair use). Clips are third-party YouTube uploads played through the official embed. That's fine for a personal fan project; for a public or commercial release, replace them with licensed assets (`image` accepts any URL) and verify each clip.
