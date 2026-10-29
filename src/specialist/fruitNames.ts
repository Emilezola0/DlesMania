// Devil Fruits by the names fans use: "Gomu Gomu" or just "Gomu" for the Gomu Gomu no Mi, "Inu Inu
// (Wolf)" for a Model. The bare root ("Gomu") only when no other fruit shares it ("Inu" has five) and
// nothing else in the game goes by it (`taken`: Zou is also an island).

/** "Gomu Gomu no Mi" → { pair: "Gomu Gomu", root: "Gomu" }; a Model keeps its model ("Wolf"). */
export function fruitParts(name: string): { pair: string; root: string; model?: string } {
  const [head, model] = name.split(/,?\s*Model:\s*/);
  const pair = head.replace(/\s+no Mi\s*$/i, '').trim();
  return { pair, root: pair.split(' ')[0], model: model?.trim() };
}

/** The short way to write a fruit: "Gomu Gomu", "Inu Inu (Wolf)". */
export function fruitShortName(name: string): string {
  const { pair, model } = fruitParts(name);
  return model ? `${pair} (${model})` : pair;
}

/** Every short spelling a fruit can be answered with, given all fruit names and the names already used elsewhere. */
export function fruitShortSpellings(name: string, allFruits: string[], taken: Set<string> = new Set()): string[] {
  const { pair, root, model } = fruitParts(name);
  const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const sharedRoot = allFruits.filter((f) => fruitParts(f).root === root).length > 1;
  const out = model ? [`${pair} (${model})`, `${pair} ${model}`, `${pair} no Mi ${model}`] : [pair];
  if (!model && !sharedRoot && !taken.has(key(root))) out.push(root);
  return out.filter((s) => !taken.has(key(s)));
}
