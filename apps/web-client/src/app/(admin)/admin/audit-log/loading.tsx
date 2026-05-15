export default function Loading() {
  return (
    <div className="workspace-page space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-zinc-100" />
        <div className="h-4 w-80 animate-pulse rounded-lg bg-zinc-100" />
      </div>
      <div className="h-48 animate-pulse rounded-xl bg-white/50" />
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-100" />
        ))}
      </div>
    </div>
  );
}

