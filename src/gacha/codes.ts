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
  GamblePlease: { coins: 500, note: 'For Tokars who need Dle Coins' },
};

export const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, '');
