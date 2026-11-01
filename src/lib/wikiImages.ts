// The fan wikis' pictures (static.wikia.nocookie.net) are only served to pages that don't say where they
// come from: asked from this site, they come back as a small "image not available" picture. So every
// picture from there is asked for without a referrer — set on the image before its address, whichever way
// the address is given (React's attribute, or `img.src = …` in the games' own code). Everything else (the
// YouTube players among them) keeps the browser's usual policy.
const WIKI = /^https?:\/\/(static\.wikia\.nocookie\.net|[a-z0-9-]+\.fandom\.com)\//i;

export function askWikiPicturesWithoutReferrer() {
  if (typeof HTMLImageElement === 'undefined') return;
  const proto = HTMLImageElement.prototype;
  const src = Object.getOwnPropertyDescriptor(proto, 'src');
  if (src?.set && src.get) {
    Object.defineProperty(proto, 'src', {
      configurable: true,
      enumerable: src.enumerable,
      get: src.get,
      set(this: HTMLImageElement, v: string) {
        if (WIKI.test(String(v))) this.referrerPolicy = 'no-referrer';
        src.set!.call(this, v);
      },
    });
  }
  const setAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (this: Element, name: string, value: string) {
    if (this instanceof HTMLImageElement && name.toLowerCase() === 'src' && WIKI.test(String(value))) this.referrerPolicy = 'no-referrer';
    return setAttribute.call(this, name, value);
  };
}
