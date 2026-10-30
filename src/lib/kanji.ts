// Kanji drawn as pictures ("kanji:山" in bosses.json): ink on paper, like a page of a workbook. The
// guardian's ("kanji:鬼") is a red seal, and the omni's ("kanji-omni:漢字") gold on a red sun. They're
// SVGs written here, so they need no file and no network: the kanji come from the device's Japanese font.

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

/** The omni: gold characters on black lacquer under a red sun. */
function omni(text: string, awake: boolean): string {
  const size = text.length === 1 ? 230 : text.length === 2 ? 150 : 110;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
<defs><radialGradient id="g" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="${awake ? '#3a0a0a' : '#1a1410'}"/><stop offset="1" stop-color="#050303"/></radialGradient>
<linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".5" stop-color="#f5c542"/><stop offset="1" stop-color="#b7791f"/></linearGradient></defs>
<rect width="400" height="400" fill="url(#g)"/>
<circle cx="200" cy="200" r="${awake ? 170 : 150}" fill="#c1121f" fill-opacity="${awake ? 0.9 : 0.75}"/>
${awake ? '<circle cx="200" cy="200" r="186" fill="none" stroke="#f5c542" stroke-width="5" stroke-dasharray="4 10"/>' : ''}
<text x="200" y="206" font-family="${FONT}" font-size="${size}" font-weight="900" text-anchor="middle" dominant-baseline="central" fill="url(#t)" stroke="#2a1a05" stroke-width="3" paint-order="stroke">${text}</text>
</svg>`;
}

const SEALS = new Set(['鬼']);

/** "kanji:山" → the picture's data URL; anything else is returned as it is. */
export function kanjiPicture(image: string): string;
export function kanjiPicture(image: string | undefined): string | undefined;
export function kanjiPicture(image: string | undefined) {
  if (image?.startsWith('kanji-omni:') || image?.startsWith('kanji-awake:')) {
    const awake = image.startsWith('kanji-awake:');
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(omni(image.slice(image.indexOf(':') + 1), awake))}`;
  }
  if (!image?.startsWith('kanji:')) return image;
  const k = image.slice(6);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent((SEALS.has(k) ? seal : paper)(k))}`;
}
