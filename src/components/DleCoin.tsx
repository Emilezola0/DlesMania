/** The DleCoin: a gold coin with a milled rim and an embossed D, a spark on its shine. */
export function DleCoin({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={`inline-block shrink-0 ${className}`} aria-hidden>
      <defs>
        <radialGradient id="dlecoin-face" cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#fff4b8" />
          <stop offset="0.45" stopColor="#facc15" />
          <stop offset="1" stopColor="#b45309" />
        </radialGradient>
        <linearGradient id="dlecoin-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="1" stopColor="#92400e" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="url(#dlecoin-rim)" />
      {/* Milled edge. */}
      <circle cx="16" cy="16" r="13.6" fill="none" stroke="#78350f" strokeOpacity="0.45" strokeWidth="1.4" strokeDasharray="1.1 1.3" />
      <circle cx="16" cy="16" r="12.2" fill="url(#dlecoin-face)" />
      <circle cx="16" cy="16" r="12.2" fill="none" stroke="#92400e" strokeOpacity="0.5" strokeWidth="0.8" />
      {/* The D, embossed: a darker shadow under a lighter letter. */}
      <path d="M11.5 9.5h4.6c4 0 6.4 2.6 6.4 6.5s-2.4 6.5-6.4 6.5h-4.6z M14.4 12.2v7.6h1.6c2.2 0 3.5-1.4 3.5-3.8s-1.3-3.8-3.5-3.8z" fill="#78350f" fillRule="evenodd" transform="translate(0.6 0.7)" opacity="0.55" />
      <path d="M11.5 9.5h4.6c4 0 6.4 2.6 6.4 6.5s-2.4 6.5-6.4 6.5h-4.6z M14.4 12.2v7.6h1.6c2.2 0 3.5-1.4 3.5-3.8s-1.3-3.8-3.5-3.8z" fill="#fef3c7" fillRule="evenodd" />
      {/* A spark on the shine. */}
      <path d="M8.6 6.4l0.7 1.8 1.8 0.7-1.8 0.7-0.7 1.8-0.7-1.8-1.8-0.7 1.8-0.7z" fill="#fff" opacity="0.9" />
    </svg>
  );
}

/** An amount of DleCoins, coin first. */
export function Coins({ n, className = '' }: { n: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 font-display font-bold tabular-nums ${className}`}>
      <DleCoin className="size-[1.15em]" />
      {n.toLocaleString('en')}
    </span>
  );
}
