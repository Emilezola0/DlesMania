/** A small turning ring for things still loading (clips, videos). Inherits the text colour. */
export function Spinner({ className = 'size-4' }: { className?: string }) {
  return <span role="status" aria-label="Loading" className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${className}`} />;
}
