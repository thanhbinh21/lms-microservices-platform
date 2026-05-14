export default function Loading() {
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-zinc-100" />
      <div className="h-4 w-80 animate-pulse rounded-lg bg-zinc-100" />
      <div className="h-12 animate-pulse rounded-xl bg-amber-50" />
      <div className="h-64 animate-pulse rounded-xl bg-white/50" />
    </div>
  );
}
