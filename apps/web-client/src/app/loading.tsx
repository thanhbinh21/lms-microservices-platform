export default function GlobalLoading() {
  return (
    <div className="min-h-screen bg-background px-4 py-10 md:px-6">
      <div className="mx-auto w-full max-w-6xl animate-pulse space-y-4">
        <div className="h-8 w-44 rounded bg-muted" />
        <div className="h-36 rounded-2xl bg-muted" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-28 rounded-2xl bg-muted" />
          <div className="h-28 rounded-2xl bg-muted" />
          <div className="h-28 rounded-2xl bg-muted" />
        </div>
      </div>
    </div>
  );
}
