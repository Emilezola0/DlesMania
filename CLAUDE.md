# Working on Omnidle (DlesMania)

Rules the owner set; keep to them in every change.

## Git
- Work on the **`Eva`** branch; push to `main` only when asked.

## JLPT (`/jlpt`, the JLPT boss, its cards, Name Them All in Japanese)
- **The point of the JLPT games is to learn Japanese.** Once a question is over (right, wrong or timed out), always show the **reading under the character** (kana for a word, on/kun readings for a kanji), with its meaning. Any new JLPT game or round must do the same.
- **Every Japanese word, kanji, reading and grammar point comes from `src/data/jlpt.json`** (Coto Academy's *JLPT Grammar and Vocab Mega List*, the document the owner gave). Pictures aside, no other source — **ask the owner for permission before using any other source**, even for a single word or a flavour line.
- Coming later: **English and French** for the JLPT content (meanings shown in the player's language). Keep meanings in data (not hard-coded in components) so a French version can be added next to the English one.

## Pictures
- **3D models only for silhouettes** (Who's That? and silhouette rounds). Boss Battle and every other picture use drawn (2D) art. One exception (the owner's call): the **Smash Bros boss's radar and Final Blow** show the fighters' 3D models from Ultimate, as in the game (`gameArt` in `src/data/bosses.json`); its cards stay drawn. Bosses marked `drawnOnly` take no card pictures in Final Blow (`scripts/data/boss-2d-art.mjs`).
- A card's **animated clip** may be anything that looks good and stylish: game footage (3D), effects, GIFs, fan animation. Its **still picture** stays drawn (2D).
- An **Omni's voice line matches its video**: the line the character says in the moment the clip shows. A clip with no voice of its own (like the Doorman's) gets the voice lines played on top.
- A **GIF** clip may loop in the background (icons, backdrops). A **video** clip plays when the player succeeds at something, not on a loop in a corner.
- On a **win**, the **background card** plays: its video behind the page **and its voice line**, every win, never the icon's. The icon only shows its face and a word in its bubble (its voice line only when no background is equipped). A background changed mid-video takes over once that video ends.
- Cards keep the picture they were pulled with (`src/data/card-art.json`).
- **Card videos are MP4s hosted in `public/clips/`, never YouTube or TikTok embeds** (their pause button and titles can't be hidden). Make them with `node scripts/card-clip.mjs` (1080p, CRF 24, constant 30 fps, AAC 128k; the method is in the README, "Card videos"): they must look good full screen behind a win, so don't compress harder. A re-encoded clip gets a new file name (browser caches).

## Cards
- **Rarity follows what fans love.** For each franchise, research who people's favourites are (popularity polls, well-known tier lists) before setting rarities: Legendary, Mythic and Omni go to the favourites and the coolest picks; lesser-known faces stay Common or Rare.
- **No duplicates at the top:** never give a Mythic or Omni to a character who already has a card at Mythic or Omni in that set; pick another favourite. Duplicates that already exist stay as they are.

## Music
- Music is **song titles only**: never an album or an artist as an answer. Artists and albums may be clues (Classic's Artist column, the Quote round's clues). Video game and anime songs belong in Music too.

## Dates
- Omnidle went online on **18 October 2026** (first deploy): its birthday, `LAUNCH` in `src/lib/date.ts`, marked 🎂 in the Archive every year. Puzzle №1 is earlier (`EPOCH`, 1 October 2026): the archive was filled back from there.
