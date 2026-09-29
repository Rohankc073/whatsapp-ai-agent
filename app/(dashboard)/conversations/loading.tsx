// Chat-shaped skeleton so the Conversations screen appears instantly.
export default function Loading() {
  return (
    <div className="flex h-full min-h-0 animate-pulse" aria-busy="true" aria-label="Loading conversations">
      <div className="w-full shrink-0 space-y-3 border-r border-border bg-surface p-4 md:w-80 lg:w-96">
        <div className="h-5 w-32 rounded-md bg-surface-2" />
        <div className="h-9 rounded-lg bg-surface-2" />
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <div className="size-10 rounded-full bg-surface-2" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-2/3 rounded bg-surface-2" />
              <div className="h-3 w-5/6 rounded bg-surface-2" />
            </div>
          </div>
        ))}
      </div>
      <div className="hidden flex-1 bg-chat-bg md:block" />
    </div>
  );
}
