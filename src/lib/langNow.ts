// The player's language, as a plain flag with no imports: data modules read it (`withFrench` in src/lib/i18n.ts) without
// pulling in the store. src/store/progress.ts keeps it in step with the `nameLang` setting.
let french = false;
export const frNow = () => french;
export const setFrNow = (fr: boolean) => {
  french = fr;
};

/**
 * Gives an object's texts a French twin: each field named in `fr` reads its French text when the game is in French
 * (a getter, so names and taglines kept in data switch with the setting). Components showing them should call
 * `useT()` or `useFr()` (src/lib/i18n.ts), so they re-render when the setting changes.
 */
export function withFrench<T extends object>(obj: T, fr: Partial<Record<keyof T, string>>): T {
  for (const key of Object.keys(fr) as (keyof T)[]) {
    const en = obj[key];
    const text = fr[key];
    Object.defineProperty(obj, key, { get: () => (french ? text : en), enumerable: true, configurable: true });
  }
  return obj;
}
