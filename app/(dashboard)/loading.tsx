// Shown instantly while a dashboard page loads its data.
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-4 py-6 md:px-8 md:py-8" aria-busy="true" aria-label="Loading">
      <div className="mb-6 space-y-2">
        <div className="h-6 w-40 rounded-md bg-surface-2" />
        <div className="h-4 w-72 max-w-full rounded-md bg-surface-2" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl border border-border bg-surface" />
        ))}
      </div>
      <div className="mt-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl border border-border bg-surface" />
        ))}
      </div>
    </div>
  );
}
