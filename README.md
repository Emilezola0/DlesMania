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

Each category has its own challenge at `/daily/<games|anime|cinema|music>[/YYYY-MM-DD]`. `buildDaily(date, domain)` in `src/lib/rounds.ts` seeds a PRNG with a hash of `omnidle:<date>:<domain>`, so every player gets the same ten rounds — ten different mechanics, one each, with no repeated target (Anime and Video Games have eleven mechanics with the voice game, so one sits out each day). Works that have real media (cover, item/location image, YouTube clip) are drawn four times as often for the rounds that use them.

Progress is stored per `domain:date` (`src/store/progress.ts`). Each round is a `RoundRecord` (`status`, `guesses`, `score`) and games rebuild their whole view from `guesses`, so half-played rounds resume exactly. Streaks are tracked per category, plus an overall streak (any category completed that day). The archive lists every past day per category since `EPOCH`.

## Mini-games

| Game | Component | Media |
|------|-----------|-------|
| Classic attributes | `ClassicGame` | Green / yellow (partial) / red; shared genres and platforms are ticked, a year within 3 is yellow, ▲▼ for year. Cinema adds Type (live-action / animated), anime adds Creator. Clues unlock after 3, 5 and 7 misses: themes (or, without themes, a side character or track), a credit line, then a side character (albums: a track); any that names the title is skipped |
| Quote | `ClueGame` | Quote with progressive hints; albums reveal their **tracklist** instead |
| Soundtrack | `ClueGame` + `AudioClip` | Hidden YouTube player, Heardle-style 1→16 s snippets starting ~40% into the clip (or `audio.start`); video revealed at the end. If a clip is missing or won't play, the round becomes a **zoomed-in cover detail** (`ZoomImage`), then text |
| Voice Line | `ClueGame` + `AudioClip` | A character's original voice acting (no openings, endings or soundtrack), 2→16 s snippets from `voice.start`; the speaker is the last hint. Anime clips are in the original Japanese; when none is found, the French dub (marked **VF**, `voice.lang: "fr"`), never an English dub. `node scripts/find-voice-clips.mjs` searches YouTube for anime without a clip (titles only, so picks are worth a listen). Anime and Video Games only |
| Emoji | `ClueGame` | One more emoji per miss |
| Pixelated | `ClueGame` + `PixelCanvas` | Real cover art (or a generated glyph cover), de-pixelates per miss |
| Timeline | `TimelineGame` | Drag or arrows, 3 attempts |
| Guess from the Image | `ClueGame` + `ObscuredImage` | Picture of an iconic item, partly shown through clear windows (colour-shifted, tilted) that open further with each miss; the description becomes the first hint |
| Location | `ClueGame` + `ZoomImage` | In-world screenshot or real filming/recording location, starting at ×3.2 on a focal point (`location.focus`) and zooming out per miss |
| Cover Puzzle | `TilesGame` + `TilePuzzle` | The cover cut into a 3×3 grid, shuffled, rotated and disguised per tile (colour shift, blur, some inverted or mirrored). Swapping (tap two) and rotating (tap one twice) help read it, but only typing the title wins; a piece keeps its disguise wherever it's moved, and each miss restores two pieces to their true look |
| Connections | `ConnectionsGame` | 16 picture tiles in 4 groups of 4, Yellow→Purple difficulty, 4 mistakes, "One away…" |

`GameHost` adds the shared juice: synthesized WebAudio SFX (`src/lib/sfx.ts`, toggle 🔊 in the header), confetti (`src/lib/fx.ts`), a glow on wins and slide-in round transitions. Finishing a daily plays a fanfare and produces a Wordle-style share text:

```
Omnidle Video Games 2026-10-18 — 820/1000 🔥3
🟩🟩🟨🟥🟩
🟩🟨🟩🟩🟥
```

## Data

- **Works**: `src/data/works/{games,anime,cinema,music}.json`, 100+ per category. Shape: [`schema/work.schema.json`](schema/work.schema.json). Optional fields (`quote`/`tracks`, `audio`, `emoji`, `item`, `location`, `cover`, `visual`) decide which mini-games a work can appear in.
- **Connections**: `src/data/connections.json` (10 per category + 7 mixed) — `domain` decides which daily uses a puzzle (`mixed` = free play), `theme` marks single-universe grids, each group has a `level` 0–3. A tile is a label or `{ "label", "src" }`; `images` sets the puzzle's default picture source (`wp`, `fandom:<wiki>`, `ddragon`). `node scripts/enrich-connections.mjs` resolves them and reports misses — a grid only shows pictures when all 16 tiles have one, since a lone text tile would give its group away.
- **Themed Connections**: `src/data/connection-themes.json` — per theme (One Piece, Zelda, Star Wars...), a list of `cards` and reusable `categories` (`{ id, label, level, items }`). Six grids in ten are built at play time from four of a theme's sub-categories, four tiles each (`settings.json` → `connections.themed`) (`src/lib/connections.ts`, id `theme:<theme>:<seed>`): a card listed in several sub-categories becomes a red herring (every grid gets at least `minHerrings`, three by default, and aims for `targetHerrings`), and every grid is checked to have exactly one solution. Trio sub-categories (the Legendary Sannin, the Triforce bearers, the Golden Trio) stack extra layers on one franchise. Add a sub-category by listing its cards; `enrich-connections.mjs` fetches the new pictures.

- **Boss Battle**: `src/data/bosses.json` — one guardian per franchise with dialogue, Knowledge Blitz prompts (`"Name|alias|alias"` answers), Radar `members`/`impostors` and Final Blow cards. Cards use the same picture sources as Connections tiles; `node scripts/enrich-bosses.mjs` resolves them. Easy, Medium and Hard (`DIFFICULTIES` in `src/lib/boss.ts`) set the rounds per phase, timers, wave sizes and visual distortion; validation requires pools big enough for Hard (6+ prompts, 12+ members, 10+ impostors, 12+ faces). The numbers live in [`src/data/difficulties.json`](src/data/difficulties.json). Hard's `secondLoop` block makes each phase's second round shorter but harder (`blitz`: fewer answers, less time; `radar`: fewer, faster cards; `finale`: fewer faces, a short clock). Its visual difficulty is a still distortion of each picture — `zoom`, `hue`, `flip` (chance the picture is turned) and `turns` (the angles it can take; default upside down) — and in the Final Blow it comes on top of the first round's spotlight, blur, flicker and turning. Hard's `secret` block configures the secret last phase, the Name Chain: the boss names something of one category ("Character: Zoro"), the player answers with a different one of the same category, nothing can be named twice, and a wrong category, a repeat or a timeout loses on the spot. There are no suggestions and no list of what was already named: the player has to know the names and remember the chain; only the reason for a loss is shown. Settings: `picksToWin`, `turnSeconds`, `bonus`. Each boss lists its categories in `bosses.json` (`secret.categories`, entities as `"Name|alias"`) and can override the settings there; `picksToWin` is capped at what the categories allow (floor(n / 2) per category).
- **French names**: works can carry `nameFr` (the French release title) and boss answers list French spellings as aliases. Both live in `scripts/data/` and are applied by `node scripts/add-french-titles.mjs`. The Inazuma Eleven boss goes further: `node scripts/data/inazuma-french.mjs` makes the French dub names (Mark Evans, Main Magique, Tempête des Gémeaux, Ray Dark…, checked on the French wiki) the displayed names, keeping the Japanese and English ones as accepted answers.
- **Batches of works**: `scripts/data/new-anime.mjs` and `new-games.mjs` hold the latest 100 entries in compact form; `node scripts/add-works.mjs` merges them and gives anime and voiced games a `voice` entry (speaker + search query), then `enrich-media.mjs` fetches pictures.
- **Who's That?** (`/whos-that`): name blacked-out silhouettes one after another until the first mistake — a wrong name or a pass ends the run, and the score is the streak. The results show the silhouette that ended it and what was typed. **Easy** keeps the plain silhouette; **Rising** gets harder every 4 names (turned, then zoomed in on part of it, maybe mirrored, cropped, and finally spinning); **Hell** gives 10 seconds per silhouette (running out ends the run) and cycles one effect per silhouette — normal, turned, zoomed, mirrored, cropped, spinning, then normal again. **Flash** shows the plain silhouette for 1.5 s once its picture has loaded, then hides it; every name shortens the glimpse (geometrically) down to 0.2 s at a 50 streak, where it stays. Crops cut the same slice off two opposite sides and sit outside the turn and spin, so their edges stay straight. Best streaks are kept per mode. Play one series or "All" of a domain. English and French names both count (French names are aliases; names that are the same in French have none). Rosters live in `src/data/silhouettes.json`, built by `node scripts/build-silhouettes.mjs` (League of Legends renders, Minecraft mob renders, Pokémon official artwork with French names, One Piece renders from Thousand Storm, with World Seeker, Burning Will and Unlimited World Red as fallbacks — never Bounty Rush, whose glow outline shows as a doubled edge, nor Pirate Warriors, whose renders sit on brush strokes). Only cut-outs with a transparent background work as silhouettes: pictures are checked in the browser (share of transparent pixels, and gaps around the shape) and the choices applied with `--apply=choices.json`.
- **Settings**: [`src/data/settings.json`](src/data/settings.json) — `connections.groups` (groups of 4 per hand-made grid; fewer cuts the puzzles down at play time) and `connections.maxMistakes`.
- **Typed answers** go through [`src/utils/textMatcher.ts`](src/utils/textMatcher.ts): case, accents, ligatures and punctuation are ignored, and small typos pass (1 for 3–5 letters, 2 from 6, a swapped pair counts as one).

### Scaling the dataset

`npm run data:seed` runs the whole pipeline (optional imports → French names → wiki check → images → clips → Connections and Boss pictures → validation); see the header of `scripts/seed-database.mjs`. Step by step:

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

# 4. Connections and Boss Battle pictures (Wikipedia, Fandom wikis, League Data Dragon)
node scripts/enrich-connections.mjs
node scripts/enrich-bosses.mjs

# French titles and boss answer spellings (scripts/data/*.mjs)
node scripts/add-french-titles.mjs

# 5. Check
npm run data:validate
```

`enrich-media` looks up `cover.wiki` / `item.wiki` / `location.wiki` with the MediaWiki API (50 titles per request). Item and location clues can instead carry `src` (`fandom:<wiki>:<Title>`, `wp:<Title>` or a URL), or inherit the work's `fandom` wiki, which is then searched by the clue's `name`. Images whose file name looks like a logo, box art, cover or poster — or equal to the work's cover — are rejected so a clue never shows the title. It also and rejects images when a title redirects to a different subject (e.g. "Hyrule" → the franchise page, whose image would give the answer away). Works without `cover.wiki` get one by search — check those. `--force` re-resolves everything; `--dry` writes nothing.

### Media notice

Cover art and many item images are hot-linked from Wikipedia/Wikimedia and are often non-free (used there under fair use). Clips are third-party YouTube uploads played through the official embed. That's fine for a personal fan project; for a public or commercial release, replace them with licensed assets (`image` accepts any URL) and verify each clip.
