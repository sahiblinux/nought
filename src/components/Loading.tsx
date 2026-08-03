export function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton rounded ${className || ''}`} />;
}

export function PageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-6 h-10 w-2/3 max-w-md" />
      <Skeleton className="mt-3 h-4 w-1/2 max-w-sm" />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
      <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">{label}…</p>
    </div>
  );
}

export function ErrorNote({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-lg border border-clay/30 bg-clay/[0.04] px-5 py-4">
      <p className="text-[13.5px] text-ink">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-clay underline decoration-clay/30 underline-offset-4 transition-colors hover:decoration-clay"
        >
          Try again
        </button>
      )}
    </div>
  );
}
