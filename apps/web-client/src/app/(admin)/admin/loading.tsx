export default function Loading() {
  return (
    <div className="workspace-page space-y-6">
      <div className="space-y-2">
        <div className="h-4 w-32 animate-pulse rounded-full bg-primary/10" />
        <div className="h-8 w-48 animate-pulse rounded-lg bg-zinc-100" />
        <div className="h-4 w-72 animate-pulse rounded-lg bg-zinc-100" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/50" />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-48 animate-pulse rounded-2xl bg-white/50" />
        <div className="h-48 animate-pulse rounded-2xl bg-white/50" />
      </div>
    </div>
  );
}

