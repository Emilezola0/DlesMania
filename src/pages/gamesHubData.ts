// What the Games page counts (decks, lists, universes, the album): loaded after the page shows, as these lists weigh
// over a megabyte (the cards, the Japanese words, the bosses) and a phone would otherwise wait for them first.
export { HL_DECKS } from '../arcade/higherLower';
export { JLPT_DECKS } from '../arcade/jlpt';
export { NAME_LISTS } from '../arcade/lists';
export { COLLECTIBLE } from '../gacha/cards';
export { RANK_DATA, RANK_ROUNDS } from '../rank/data';
export { UNIVERSES } from '../specialist/rounds';
