# Working on Omnidle (DlesMania)

Rules the owner set; keep to them in every change.

## Git
- Work on the **`Eva`** branch; push to `main` only when asked.

## JLPT (`/jlpt`, the JLPT boss, its cards, Name Them All in Japanese)
- **The point of the JLPT games is to learn Japanese.** Once a question is over (right, wrong or timed out), always show the **reading under the character** (kana for a word, on/kun readings for a kanji), with its meaning. Any new JLPT game or round must do the same.
- **Every Japanese word, kanji, reading and grammar point comes from `src/data/jlpt.json`** (Coto Academy's *JLPT Grammar and Vocab Mega List*, the document the owner gave). Pictures aside, no other source — **ask the owner for permission before using any other source**, even for a single word or a flavour line.
- Coming later: **English and French** for the JLPT content (meanings shown in the player's language). Keep meanings in data (not hard-coded in components) so a French version can be added next to the English one.

## Pictures
- **3D models only for silhouettes** (Who's That? and silhouette rounds). Boss Battle and every other picture use drawn (2D) art. Bosses marked `drawnOnly` take no card pictures in Final Blow (`scripts/data/boss-2d-art.mjs`).
- Cards keep the picture they were pulled with (`src/data/card-art.json`).

## Music
- Music is **song titles only**: never an album or an artist as an answer. Artists and albums may be clues (Classic's Artist column, the Quote round's clues). Video game and anime songs belong in Music too.

## Dates
- Omnidle went online on **18 October 2026** (first deploy): its birthday, `LAUNCH` in `src/lib/date.ts`, marked 🎂 in the Archive every year. Puzzle №1 is earlier (`EPOCH`, 1 October 2026): the archive was filled back from there.
