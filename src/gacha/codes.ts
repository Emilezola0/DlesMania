// Gift codes: typed in the Shop, each once per player. A code is matched without caring about case or
// spaces ("tokar", " TOKAR ").

export interface GiftCode {
  coins: number;
  /** Shown once it's redeemed. */
  note: string;
}

export const CODES: Record<string, GiftCode> = {
  WELCOME: { coins: 300, note: 'The first code — welcome gift.' },
  TOKAR: { coins: 300, note: 'For Tokars who need Dle Coins' },
  GAMBLEPLEASE: { coins: 500, note: 'Because We Love Gamble s love' },
  FORTSHONOR: { coins: 1000, note: 'Because We Love Gamble s love' },
};

export const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, '');
