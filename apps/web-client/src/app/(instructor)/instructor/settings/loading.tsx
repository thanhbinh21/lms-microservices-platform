export default function Loading() {
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-zinc-100" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/50" />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-xl bg-white/50" />
    </div>
  );
}
