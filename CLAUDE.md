# Working on Omnidle (DlesMania)

Rules the owner set; keep to them in every change.

## Git
- Work on **`main`**, for everyone (the `Eva` branch is no longer used).

## JLPT (`/jlpt`, the JLPT boss, its cards, Name Them All in Japanese)
- **The point of the JLPT games is to learn Japanese.** Once a question is over (right, wrong or timed out), always show the **reading under the character** (kana for a word, on/kun readings for a kanji), with its meaning. Any new JLPT game or round must do the same.
- **Every Japanese word, kanji, reading and grammar point comes from `src/data/jlpt.json`** (Coto Academy's *JLPT Grammar and Vocab Mega List*, the document the owner gave). Pictures aside, no other source — **ask the owner for permission before using any other source**, even for a single word or a flavour line.
- **Animals and colours beyond the list** (23 November 2026, the owner's request): `src/data/jlpt-extra.json`, for the JLPT boss's Blitz and Name Chain and the Animals and Colours theme decks. Each form and reading checked against JMdict (through jisho.org). Colours: keep kanji ones for learning, **25 written in katakana at most**.
- Sources the owner allowed for the grammar points' explanations and example sentences (16 November 2026): **Tatoeba** (tatoeba.org, CC BY 2.0 FR) and **Wikibooks' *JLPT Guide*** (CC BY-SA). Credit each one where it's shown. Any other source still needs the owner's permission.
- The owner's own grammar books (`src/data/jlpt-books.json`, `scripts/data/books/`): only each book's **table of contents** (the list of points, units, pages) comes from the book. Every meaning, explanation and example is **written by the AI**, never copied or paraphrased from the book's pages, and shown as "written by AI, check it". Never transcribe a book's content, and never look for or download copies of the books.
- Coming later: **English and French** for the JLPT content (meanings shown in the player's language). Keep meanings in data (not hard-coded in components) so a French version can be added next to the English one.

## Pictures
- **3D models only for silhouettes** (Who's That? and silhouette rounds). Boss Battle and every other picture use drawn (2D) art. One exception (the owner's call): the **Smash Bros boss's radar and Final Blow** show the fighters' 3D models from Ultimate, as in the game (`gameArt` in `src/data/bosses.json`); its cards stay drawn. Bosses marked `drawnOnly` take no card pictures in Final Blow (`scripts/data/boss-2d-art.mjs`).
- A card's **animated clip** may be anything that looks good and stylish: game footage (3D), effects, GIFs, fan animation. Its **still picture** stays drawn (2D).
- An **Omni's voice line matches its video**: the line the character says in the moment the clip shows. A clip with no voice of its own (like the Doorman's) gets the voice lines played on top.
- A **GIF** clip may loop in the background (icons, backdrops). A **video** clip plays when the player succeeds at something, not on a loop in a corner.
- On a **win**, the **background card** plays its video behind the page, every win, never the icon's. **Videos come before voice lines, above all for Omnis:** a video that has sound always plays **with its own audio**, and no voice line goes over it. A voice line is for small moments (a booster opening, the icon's bubble), and on a win only when the video is silent (Tenor, GIFs) or the card has none. A new card video keeps its sound (`clipHasSound` in `src/gacha/cards.ts`). The icon only shows its face and a word in its bubble (its voice line only when no background is equipped). A background changed mid-video takes over once that video ends.
- Cards keep the picture they were pulled with (`src/data/card-art.json`).
- **Card videos are MP4s hosted in `public/clips/`, never YouTube or TikTok embeds** (their pause button and titles can't be hidden). Make them with `node scripts/card-clip.mjs` (1080p, CRF 24, constant 30 fps, AAC 128k; the method is in the README, "Card videos"): they must look good full screen behind a win, so don't compress harder. A re-encoded clip gets a new file name (browser caches).

## Browsers
- The site must work in **Firefox** as well as Chrome. For anything Firefox-only, test it there with `node scripts/firefox-check.mjs` (README, "Checking in Firefox"): it drives the installed Firefox headless and measures, it's allowed to run without asking.

## Cards
- **Rarity follows what fans love.** For each franchise, research who people's favourites are (popularity polls, well-known tier lists) before setting rarities: Legendary, Mythic and Omni go to the favourites and the coolest picks; lesser-known faces stay Common or Rare.
- **No duplicates at the top:** never give a Mythic or Omni to a character who already has a card at Mythic or Omni in that set; pick another favourite. Duplicates that already exist stay as they are.

## Music
- Music is **song titles only**: never an album or an artist as an answer. Artists and albums may be clues (Classic's Artist column, the Quote round's clues). Video game and anime songs belong in Music too.

## Dates
- Omnidle went online on **18 October 2026** (first deploy): its birthday, `LAUNCH` in `src/lib/date.ts`, marked 🎂 in the Archive every year. Puzzle №1 is earlier (`EPOCH`, 1 October 2026): the archive was filled back from there.

## Firebase
- **Every time `firestore.rules` changes, send the owner the whole file** (as a file in the chat, not just a summary), so they can copy and paste it into the Firebase console (Firestore → Rules) and publish it. Say what changed in it, and that it must be published.
