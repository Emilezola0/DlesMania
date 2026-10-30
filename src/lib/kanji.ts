// Kanji drawn as pictures ("kanji:山" in bosses.json): ink on paper, like a page of a workbook. The
// guardian's ("kanji:鬼") is a red seal. They're SVGs written here, so they need no file and no network:
// the kanji itself comes from the device's Japanese font.

const FONT = "'Noto Serif JP','Hiragino Mincho ProN','Yu Mincho','MS Mincho',serif";

/** A kanji on squared paper, its practice grid in faint lines. */
function paper(k: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
<defs><radialGradient id="p" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#fbf5e6"/><stop offset="1" stop-color="#e8dcc0"/></radialGradient></defs>
<rect width="400" height="400" fill="url(#p)"/>
<rect x="40" y="40" width="320" height="320" fill="none" stroke="#c0392b" stroke-opacity=".35" stroke-width="3"/>
<path d="M200 40V360M40 200H360" stroke="#c0392b" stroke-opacity=".18" stroke-width="2" stroke-dasharray="10 8"/>
<text x="200" y="208" font-family="${FONT}" font-size="250" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="#1c1917">${k}</text>
</svg>`;
}

/** The guardian's: a kanji cut into a red seal on dark lacquer. */
function seal(k: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
<defs><radialGradient id="b" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#3b0d0d"/><stop offset="1" stop-color="#0c0606"/></radialGradient></defs>
<rect width="400" height="400" fill="url(#b)"/>
<rect x="70" y="70" width="260" height="260" rx="18" fill="#b91c1c"/>
<rect x="84" y="84" width="232" height="232" rx="10" fill="none" stroke="#fde68a" stroke-opacity=".55" stroke-width="4"/>
<text x="200" y="206" font-family="${FONT}" font-size="190" font-weight="900" text-anchor="middle" dominant-baseline="central" fill="#fef3c7">${k}</text>
</svg>`;
}

const SEALS = new Set(['鬼']);

/** "kanji:山" → the picture's data URL; anything else is returned as it is. */
export function kanjiPicture(image: string): string;
export function kanjiPicture(image: string | undefined): string | undefined;
export function kanjiPicture(image: string | undefined) {
  if (!image?.startsWith('kanji:')) return image;
  const k = image.slice(6);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent((SEALS.has(k) ? seal : paper)(k))}`;
}
