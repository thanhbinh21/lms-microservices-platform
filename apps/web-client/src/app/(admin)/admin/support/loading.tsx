export default function Loading() {
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-zinc-100" />
      <div className="h-4 w-96 animate-pulse rounded-lg bg-zinc-100" />
      <div className="space-y-3">
        <div className="h-64 animate-pulse rounded-xl bg-white/50" />
      </div>
    </div>
  );
}
