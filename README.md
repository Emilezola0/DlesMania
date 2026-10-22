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

`GameHost` adds the shared juice: synthesized WebAudio SFX (`src/lib/sfx.ts`; the 🔊 header button opens a panel to switch them off and set two saved volumes — effects, and clips & voices for the YouTube soundtracks, voice lines and laughs), confetti (`src/lib/fx.ts`), a glow on wins and slide-in round transitions. Finishing a daily plays a fanfare and produces a Wordle-style share text:

```
Omnidle Video Games 2026-10-18 — 820/1000 🔥3
🟩🟩🟨🟥🟩
🟩🟨🟩🟩🟥
```

## Data

- **Works**: `src/data/works/{games,anime,cinema,music}.json`, 100+ per category. Shape: [`schema/work.schema.json`](schema/work.schema.json). Optional fields (`quote`/`tracks`, `audio`, `emoji`, `item`, `location`, `cover`, `visual`) decide which mini-games a work can appear in.
- **Connections**: `src/data/connections.json` (10 per category + 7 mixed) — `domain` decides which daily uses a puzzle (`mixed` = free play), `theme` marks single-universe grids, each group has a `level` 0–3. A tile is a label or `{ "label", "src" }`; `images` sets the puzzle's default picture source (`wp`, `fandom:<wiki>`, `ddragon`). `node scripts/enrich-connections.mjs` resolves them and reports misses — a grid only shows pictures when all 16 tiles have one, since a lone text tile would give its group away.
- **Themed Connections**: `src/data/connection-themes.json` — per theme (One Piece, Zelda, Star Wars...), a list of `cards` and reusable `categories` (`{ id, label, level, items }`). Six grids in ten are built at play time from four of a theme's sub-categories, four tiles each (`settings.json` → `connections.themed`) (`src/lib/connections.ts`, id `theme:<theme>:<seed>`): a card listed in several sub-categories becomes a red herring (every grid gets at least `minHerrings`, three by default, and aims for `targetHerrings`), and every grid is checked to have exactly one solution. Trio sub-categories (the Legendary Sannin, the Triforce bearers, the Golden Trio) stack extra layers on one franchise. Add a sub-category by listing its cards; `enrich-connections.mjs` fetches the new pictures.

- **Boss Battle**: `src/data/bosses.json` — one guardian per franchise with dialogue, Knowledge Blitz prompts (`"Name|alias|alias"` answers), Radar `members`/`impostors` and Final Blow cards. Cards use the same picture sources as Connections tiles; `node scripts/enrich-bosses.mjs` resolves them. Easy, Medium and Hard (`DIFFICULTIES` in `src/lib/boss.ts`) set the rounds per phase, timers, wave sizes and visual distortion; validation requires pools big enough for Hard (6+ prompts, 12+ members, 10+ impostors, 12+ faces). The numbers live in [`src/data/difficulties.json`](src/data/difficulties.json). Easy plays every phase once; Medium and Hard win the Final Blow twice (four rounds); a `secondLoop` block can still make a phase's second round harder, but none uses it now. Emptying the life bar on **Medium** starts the **Name Chain** (`secret` settings): the boss names something of one category ("Character: Zoro"), the player answers with a different one of the same category, nothing can be named twice, and a wrong category, a repeat or a timeout loses on the spot. There are no suggestions and no list of what was already named. Settings: `picksToWin`, `turnSeconds`, `bonus`. On **Hard** it starts the **Signature** (`signature` settings: `toWin`, `seconds`, `bonus`): `toWin` clues on one very specific side of the franchise, answered in a row with no suggestions — One Piece laughs (clips), League items by their stats and price (Data Dragon), Genshin constellations, MCU actors, Overwatch ultimates, Minecraft mob drops, Dragon Ball and Naruto techniques, Star Wars ships, Patronuses, Middle-earth weapons, Final Smashes and Inazuma Eleven hissatsu. A wrong answer or a timeout loses. Clues live in each boss's `signature` block, written by `node scripts/data/boss-signatures.mjs`. Each boss lists its categories in `bosses.json` (`secret.categories`, entities as `"Name|alias"`) and can override the settings there; `picksToWin` is capped at what the categories allow (floor(n / 2) per category).
- **French names**: works can carry `nameFr` (the French release title) and boss answers list French spellings as aliases. Both live in `scripts/data/` and are applied by `node scripts/add-french-titles.mjs`. The Inazuma Eleven boss goes further: `node scripts/data/inazuma-french.mjs` makes the French dub names (Mark Evans, Main Magique, Tempête des Gémeaux, Ray Dark…, checked on the French wiki) the displayed names, keeping the Japanese and English ones as accepted answers.
- **Batches of works**: `scripts/data/new-anime.mjs` and `new-games.mjs` hold the latest 100 entries in compact form; `node scripts/add-works.mjs` merges them and gives anime and voiced games a `voice` entry (speaker + search query), then `enrich-media.mjs` fetches pictures.
- **Who's That?** (`/whos-that`): name blacked-out silhouettes one after another until the first mistake — a wrong name or a pass ends the run, and the score is the streak. The results show the silhouette that ended it and what was typed. **Easy** keeps the plain silhouette; **Rising** gets harder every 4 names (turned, then zoomed in on part of it, maybe mirrored, cropped, and finally spinning); **Hell** gives 10 seconds per silhouette (running out ends the run) and cycles one effect per silhouette — normal, turned, zoomed, mirrored, cropped, spinning, then normal again. **Flash** shows the plain silhouette for 1.5 s once its picture has loaded, then hides it; every name shortens the glimpse (geometrically) down to 0.2 s at a 50 streak, where it stays. Crops cut the same slice off two opposite sides and sit outside the turn and spin, so their edges stay straight. Best streaks are kept per mode. Play one series or "All" of a domain. English and French names both count (French names are aliases; names that are the same in French have none). Rosters live in `src/data/silhouettes.json`, built by `node scripts/build-silhouettes.mjs` (League of Legends renders, Minecraft mob renders, Pokémon official artwork with French names, One Piece renders from Thousand Storm, with World Seeker, Burning Will and Unlimited World Red as fallbacks — never Bounty Rush, whose glow outline shows as a doubled edge, nor Pirate Warriors, whose renders sit on brush strokes). Only cut-outs with a transparent background work as silhouettes: pictures are checked in the browser (share of transparent pixels, and gaps around the shape) and the choices applied with `--apply=choices.json`.
- **Specialist** (`/specialist`): one universe per page, with a daily (same five rounds for everyone, seeded by date, streak and share text) and endless practice. One Piece, League of Legends, Marvel (MCU) and Genshin Impact are all playable. Each universe lists its round types in `UNIVERSES` (`src/specialist/rounds.ts`). One Piece rounds: **Classic** (gender, affiliation, Devil Fruit type, Haki, bounty ▲▼, height ▲▼, origin, first arc ▲▼; close numbers and neighbouring arcs are yellow), **Devil Fruit** (the fruit's picture when it has been shown, opening per miss; hints from its type, name meaning, debut arc, English name and user), **Laugh** (a character's signature laugh in the original Japanese voice, in 1 → 12 s snippets; the written laugh is a late hint, and the clue itself if a clip can't play — clips found by `node scripts/find-laugh-clips.mjs`, titles only, with a reject list for checked mismatches), **Jolly Roger** (the crew's flag) and **Wanted** (the character's wiki portrait on a wanted poster, blurred and sepia, sharpening with each miss). Data: `src/data/specialist/onepiece.json`, built by `node scripts/build-specialist-onepiece.mjs` from the One Piece wiki — characters from their infoboxes and categories (ranked by subpages and page size, 220 by default; only characters the anime has shown, plus those from chapters it hasn't reached yet), canon Devil Fruits, crews with a Jolly Roger and the wiki's laughter table. Only facts are kept, no article text; re-run it to pick up new characters, bounties and fruits. League rounds: **Classic** (gender, positions, species, resource, range, regions, release year ▲▼), **Ability** (one of the champion's five ability icons, greyscale, turned and blurred, clearing per miss; the ability's key and finally its name as hints), **Splash Art** (a ×3.2 crop of the base splash that pulls back per miss) and **Silhouette**. Data: `src/data/specialist/lol.json`, built by `node scripts/build-specialist-lol.mjs` — champions, abilities, icons and splash arts from Data Dragon; positions, range, resource, class and release date from the League wiki's `Module:ChampionData`; pronouns, species and region from its lore pages. Champions too new for the wiki's data sit out Classic until a later run (`complete: false`). Re-run it after each patch. Marvel rounds: **Classic** on characters (gender, species, team, status, debut film ▲▼, Phase ▲▼, number of films ▲▼), **Film** (a zoomed crop of the poster), **Emoji** (a film told in emojis, hand-written in `scripts/data/mcu-emoji.mjs`) and **Voice Line** (the character speaking in the original English version, 2 → 20 s snippets; clips found by `node scripts/find-marvel-voice-clips.mjs` from YouTube titles, with a reject list for checked mismatches). Data: `src/data/specialist/marvel.json`, built by `node scripts/build-specialist-marvel.mjs` from the MCU wiki — every released film, and the 180 characters with the most films and the biggest articles; pages named after a shared mantle (Captain America, Black Widow…) show the current holder, with the mantle accepted as an answer. Re-run it after each release, and add the new film's emoji line. Genshin rounds: **Classic** (gender, element, weapon, region, rarity, body type, version ▲▼), **Wish Art** (zoomed crop of the wish splash), **Silhouette** and **Constellation** (its name). Data: `src/data/specialist/genshin.json`, built by `node scripts/build-specialist-genshin.mjs` from the Genshin wiki (every playable character but the Traveler); the same data feeds Who's That? Genshin and the Genshin boss (`node scripts/data/genshin-boss.mjs`, then `enrich-bosses.mjs --boss=genshin`). Genshin portraits sit on white: `src/lib/cutout.ts` flood-fills the background away in the browser before they're blacked out. Code: `src/specialist/` (data, rounds, games) and `src/pages/Specialist.tsx`.
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
